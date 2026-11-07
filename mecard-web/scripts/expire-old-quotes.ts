// One-off clean-up: quotes from before October 2026 (South African time) that are
// still open become expired. Imported quotes often have no expiry date, so they
// never expire by themselves; those get the 10 days quotes are valid for.
//
//   npm run quotes:expire-old                  expire them
//   npm run quotes:expire-old -- --dry-run     only count
//
// Accepted and rejected quotes are left alone: an accepted quote may be in a
// customer's basket or on an order. Nobody is emailed. Safe to run again.
// Uses DATABASE_URL from .env.local, so it changes whichever database that names.

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const CUTOFF = "2026-10-01T00:00:00+02:00";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
  const rows = await sql<{ status: string; n: number }[]>`
    SELECT status, count(*)::int AS n FROM quotes
     WHERE status IN ('new', 'sent') AND created_at < ${CUTOFF}::timestamptz
     GROUP BY status ORDER BY status`;
  const total = rows.reduce((t, r) => t + r.n, 0);
  console.log(`${total} open quote(s) from before October 2026${rows.length ? ` (${rows.map((r) => `${r.n} ${r.status}`).join(", ")})` : ""}.`);
  if (dryRun || !total) {
    if (dryRun) console.log("Dry run: nothing changed.");
    await sql.end();
    return;
  }
  const done = await sql`
    UPDATE quotes
       SET status = 'expired', expires_at = coalesce(expires_at, created_at + interval '10 days'), updated_at = now()
     WHERE status IN ('new', 'sent') AND created_at < ${CUTOFF}::timestamptz`;
  console.log(`Expired ${done.count} quote(s).`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
