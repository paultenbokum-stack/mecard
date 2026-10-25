// The query tool's gatekeeper (conversion plan 4.2): one read-only SELECT on
// the insights views, wrapped with a row limit. The claude_insights role and a
// read-only transaction are the real walls; this keeps mistakes and tricks out
// before they reach the database.

export const MAX_ROWS = 500;
export const TIMEOUT_MS = 10_000;

const FORBIDDEN =
  /\b(insert|update|delete|merge|upsert|drop|alter|create|grant|revoke|truncate|copy|call|do|lock|vacuum|analyze|cluster|reindex|refresh|listen|notify|unlisten|prepare|execute|deallocate|discard|reset|set|begin|commit|rollback|savepoint|into)\b/i;
// Functions that could lift the timeout, sleep, or reach outside the views.
const FORBIDDEN_FUNCS = /\b(set_config|pg_sleep\w*|pg_read_\w+|pg_ls_\w+|pg_stat_file|lo_\w+|dblink\w*|pg_terminate_backend|pg_cancel_backend|pg_advisory\w*|current_setting|txid_\w+|pg_catalog)\b/i;

/** Comments out, string literals blanked (so their contents can't trip or hide anything). */
function scrub(sql: string): string {
  // One pass, left to right, so "--" inside a string or a quote inside a comment is read correctly.
  return sql.replace(/'(?:[^']|'')*'|\$(\w*)\$[\s\S]*?\$\1\$|--[^\n]*|\/\*[\s\S]*?\*\//g, (m) => (m.startsWith("-") || m.startsWith("/") ? " " : "''"));
}

export type CheckedQuery = { ok: true; sql: string } | { ok: false; error: string };

/** The statement to run, or why it was refused. */
export function checkQuery(input: unknown): CheckedQuery {
  if (typeof input !== "string" || !input.trim()) return { ok: false, error: "Pass one SELECT statement as `sql`." };
  if (input.length > 20_000) return { ok: false, error: "The query is too long (20,000 characters at most)." };
  const sql = input.trim().replace(/;\s*$/, "");
  const bare = scrub(sql);
  if (bare.includes(";")) return { ok: false, error: "Only a single statement is allowed." };
  if (!/^\s*\(?\s*(select|with)\b/i.test(bare)) return { ok: false, error: "Only SELECT (or WITH … SELECT) queries are allowed." };
  const word = bare.match(FORBIDDEN);
  if (word) return { ok: false, error: `"${word[1].toUpperCase()}" isn't allowed: the query tool is read-only.` };
  const fn = bare.match(FORBIDDEN_FUNCS);
  if (fn) return { ok: false, error: `${fn[1]} isn't allowed.` };
  // Only the insights views (unqualified names resolve there through the role's search_path).
  const schemas = [...bare.matchAll(/\b([a-z_][a-z0-9_]*)\s*\.\s*[a-z_"]/gi)].map((m) => m[1].toLowerCase());
  const other = schemas.find((s) => ["public", "information_schema", "pg_catalog", "pg_toast"].includes(s));
  if (other) return { ok: false, error: `Only the insights views can be queried, not ${other}.*` };
  return { ok: true, sql };
}

/** The checked statement as a subquery, so the row limit always applies (one extra row shows truncation). */
export const limited = (sql: string) => `select * from (\n${sql}\n) as q limit ${MAX_ROWS + 1}`;
