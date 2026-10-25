import "server-only";
import postgres from "postgres";
import { connect, db } from "@/db/client";
import { adminLog } from "@/db/schema";
import { checkQuery, limited, MAX_ROWS, TIMEOUT_MS } from "./insights-sql";

// The read-only MCP server behind /api/mcp (conversion plan 4.2): JSON-RPC over
// MCP's Streamable HTTP transport, stateless, answering each POST with JSON.
// Two tools, query and schema, on the database as claude_insights.

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "mecard-insights", version: "1.0.0" };

const INSTRUCTIONS =
  "MeCard's conversion data: read-only views in the insights schema, with IDs and counts only. " +
  "Call schema first to see the views and their columns, then query with one SELECT (500 rows, 10 seconds at most). " +
  "Times are UTC timestamps; engagement_daily days are South African dates.";

const TOOLS = [
  {
    name: "schema",
    description: "Lists the insights views with what each one answers and its columns and types. Call this before writing SQL.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "query",
    description: `Runs one read-only SELECT on the insights views (for example "select intent, count(*) from insights.signups group by 1"). At most ${MAX_ROWS} rows and ${TIMEOUT_MS / 1000} seconds.`,
    inputSchema: { type: "object", properties: { sql: { type: "string", description: "A single SELECT or WITH … SELECT statement" } }, required: ["sql"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
];

let insightsDb: ReturnType<typeof postgres> | null = null;
function insights() {
  const url = process.env.INSIGHTS_DATABASE_URL;
  if (!url) throw new Error("INSIGHTS_DATABASE_URL is not set");
  return (insightsDb ??= connect(url, 2));
}

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> };

const text = (value: unknown, isError = false): ToolResult => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 1) }],
  ...(isError ? { isError } : {}),
});

async function schemaTool(): Promise<ToolResult> {
  const sql = insights();
  const rows = await sql<{ view: string; about: string | null; column: string; type: string }[]>`
    select c.table_name as view, obj_description(format('insights.%I', c.table_name)::regclass, 'pg_class') as about,
           c.column_name as column, c.data_type as type
    from information_schema.columns c
    where c.table_schema = 'insights'
    order by c.table_name, c.ordinal_position`;
  const views: Record<string, { about: string | null; columns: Record<string, string> }> = {};
  for (const r of rows) (views[r.view] ??= { about: r.about, columns: {} }).columns[r.column] = r.type;
  return text(views);
}

async function queryTool(args: Record<string, unknown>): Promise<ToolResult> {
  const checked = checkQuery(args.sql);
  const started = Date.now();
  if (!checked.ok) {
    await log(String(args.sql ?? ""), `refused: ${checked.error}`);
    return text(checked.error, true);
  }
  try {
    const rows = await insights().begin("read only", async (tx) => {
      await tx.unsafe(`set local statement_timeout = ${TIMEOUT_MS}`);
      return tx.unsafe(limited(checked.sql));
    });
    const truncated = rows.length > MAX_ROWS;
    const out = truncated ? rows.slice(0, MAX_ROWS) : [...rows];
    await log(checked.sql, `${out.length} rows${truncated ? " (truncated)" : ""} in ${Date.now() - started} ms`);
    return text({ columns: rows.columns?.map((c) => c.name) ?? [], row_count: out.length, truncated, rows: out });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await log(checked.sql, `error: ${message}`);
    return text(`The query failed: ${message}`, true);
  }
}

/** Every query, refused or run, goes in admin_log. */
async function log(sql: string, outcome: string) {
  await db
    .insert(adminLog)
    .values({ actorId: null, entity: "insights", entityId: 0, action: "mcp_query", detail: `${outcome}\n${sql}`.slice(0, 2000) })
    .catch((e) => console.error(JSON.stringify({ severity: "ERROR", message: "insights_log_failed", error: String(e) })));
}

const result = (id: Rpc["id"], value: unknown) => ({ jsonrpc: "2.0", id, result: value });
const failure = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/** One JSON-RPC message in, its response out (null for notifications). */
export async function handleRpc(msg: Rpc) {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return failure(msg?.id, -32600, "Invalid request");
  const isNotification = msg.id === undefined || msg.id === null;
  if (isNotification) return null;
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return result(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return result(msg.id, {});
    case "tools/list":
      return result(msg.id, { tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
      try {
        if (name === "schema") return result(msg.id, await schemaTool());
        if (name === "query") return result(msg.id, await queryTool(args));
      } catch (e) {
        return result(msg.id, text(`The tool failed: ${e instanceof Error ? e.message : String(e)}`, true));
      }
      return failure(msg.id, -32602, `Unknown tool: ${name}`);
    }
    default:
      return failure(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}
