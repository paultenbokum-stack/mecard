// Creates (or updates) the claude_insights login role (conversion plan 4.1):
// USAGE and SELECT on the insights schema and nothing else, read-only, with a
// 10-second statement timeout. Run after the migrations, as the app's database
// user (on Cloud SQL it can create roles). Prints nothing secret.
//
//   INSIGHTS_DB_PASSWORD=… npm run insights:role
//
// deploy/10-insights.ps1 runs it against Cloud SQL and saves the secrets.

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL ?? "";
const password = process.env.INSIGHTS_DB_PASSWORD ?? "";
if (!url) throw new Error("DATABASE_URL is not set");
if (password.length < 16) throw new Error("Set INSIGHTS_DB_PASSWORD (16 characters or more)");

const sql = postgres(url, { max: 1 });
const ROLE = "claude_insights";

async function main() {
  const [db] = await sql<{ db: string }[]>`select current_database() as db`;
  const [exists] = await sql`select 1 from pg_roles where rolname = ${ROLE}`;
  // Passwords can't be bound parameters in CREATE / ALTER ROLE; quote it as a literal.
  const pw = `'${password.replace(/'/g, "''")}'`;
  // On Postgres 16 (Cloud SQL) a CREATEROLE user may not name SUPERUSER at all in ALTER ROLE, not even
  // NOSUPERUSER ("permission denied to alter role"); the other attributes were set by CREATE.
  if (exists) await sql.unsafe(`ALTER ROLE ${ROLE} WITH LOGIN PASSWORD ${pw}`);
  else await sql.unsafe(`CREATE ROLE ${ROLE} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD ${pw}`);

  await sql.unsafe(`ALTER ROLE ${ROLE} SET default_transaction_read_only = on`);
  await sql.unsafe(`ALTER ROLE ${ROLE} SET statement_timeout = '10s'`);
  await sql.unsafe(`ALTER ROLE ${ROLE} SET search_path = insights`);
  await sql.unsafe(`GRANT CONNECT ON DATABASE "${db.db}" TO ${ROLE}`);
  // Nothing in public: no table there is granted to PUBLIC, and it can't create anything.
  await sql.unsafe(`REVOKE CREATE ON SCHEMA public FROM ${ROLE}`);
  await sql.unsafe(`GRANT USAGE ON SCHEMA insights TO ${ROLE}`);
  await sql.unsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA insights TO ${ROLE}`);
  await sql.unsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA insights GRANT SELECT ON TABLES TO ${ROLE}`);

  // Check it: the views read, the tables don't.
  const check = postgres(url, { max: 1, username: ROLE, password });
  try {
    const [{ n }] = await check<{ n: number }[]>`select count(*)::int as n from insights.signups`;
    for (const t of ["users", "profiles", "orders", "events"]) {
      const denied = await check.unsafe(`select 1 from public.${t} limit 1`).then(() => false, (e: { code?: string }) => e.code === "42501");
      if (!denied) throw new Error(`${ROLE} can read public.${t}: stop and fix the grants`);
    }
    console.log(`${exists ? "Updated" : "Created"} ${ROLE}: reads insights (${n} signups), denied on users, profiles, orders and events.`);
  } finally {
    await check.end();
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
