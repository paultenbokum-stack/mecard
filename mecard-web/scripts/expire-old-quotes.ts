// One-off clean-up: quotes created before 1 October 2026 (South African time,
// by quotes.created_at) that are still open become "expired".
//
// Open means status new or sent with no order, the same two statuses
// effectiveStatus() treats as able to expire. Accepted, rejected and already
// expired quotes are left alone, and so is anything with an order_id. The row's
// expires_at and sent_at stay as they were, as a record of what the quote said.
//
//   npm run quotes:expire-old              report only, changes nothing
//   npm run quotes:expire-old -- --apply   mark them expired
//
// Uses DATABASE_URL, from .env.local unless it's already set. --apply prints
// every id and its old status, which is all it takes to undo. Safe to run again.

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const CUTOFF = "2026-10-01T00:00:00+02:00";
const apply = process.argv.includes("--apply");

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL is not set.");
  const sql = postgres(url, { max: 1 });
  try {
    const [{ database }] = await sql<{ database: string }[]>`SELECT current_database() AS database`;
    console.log(`${apply ? "APPLY" : "Dry run"} on ${sql.options.host.join(",")}:${sql.options.port.join(",")}/${database}, created_at before ${CUTOFF}.\n`);

    const all = await sql<{ status: string; has_order: boolean; before: number; after: number }[]>`
      SELECT status, order_id IS NOT NULL AS has_order,
             count(*) FILTER (WHERE created_at <  ${CUTOFF}::timestamptz)::int AS before,
             count(*) FILTER (WHERE created_at >= ${CUTOFF}::timestamptz)::int AS after
        FROM quotes GROUP BY 1, 2 ORDER BY 1, 2`;
    console.log("All quotes:");
    console.table(all.map((r) => ({ status: r.status, "has order": r.has_order, "before cutoff": r.before, "on or after": r.after })));

    const open = sql`status IN ('new', 'sent') AND order_id IS NULL AND created_at < ${CUTOFF}::timestamptz`;
    const [c] = await sql<{ total: number; new: number; sent: number; live: number; no_expiry: number; value_cents: number; oldest: Date | null; newest: Date | null }[]>`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE status = 'new')::int AS new,
             count(*) FILTER (WHERE status = 'sent')::int AS sent,
             count(*) FILTER (WHERE expires_at >= now())::int AS live,
             count(*) FILTER (WHERE expires_at IS NULL)::int AS no_expiry,
             coalesce(sum(total_cents), 0)::bigint AS value_cents,
             min(created_at) AS oldest, max(created_at) AS newest
        FROM quotes WHERE ${open}`;
    console.log(`\nWould expire ${c.total}: ${c.new} new, ${c.sent} sent, oldest ${c.oldest?.toISOString() ?? "-"}, newest ${c.newest?.toISOString() ?? "-"}.`);
    console.log(`Of those, ${c.live} have an expiry date still ahead (a customer could accept these today) and ${c.no_expiry} have no expiry date.`);
    console.log(`Quoted value: R${(Number(c.value_cents) / 100).toFixed(2)}.`);

    if (!apply) {
      console.log("\nDry run: nothing changed. Add --apply to mark them expired.");
      return;
    }
    const done = await sql<{ id: number; old_status: string }[]>`
      UPDATE quotes q SET status = 'expired', updated_at = now()
        FROM (SELECT id, status FROM quotes WHERE ${open} FOR UPDATE) o
       WHERE q.id = o.id
       RETURNING q.id, o.status AS old_status`;
    console.log(`\nMarked ${done.length} quote(s) expired.`);
    for (const status of ["new", "sent"]) {
      const ids = done.filter((d) => d.old_status === status).map((d) => d.id).sort((a, b) => a - b);
      if (ids.length) console.log(`Were ${status}: ${ids.join(", ")}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
