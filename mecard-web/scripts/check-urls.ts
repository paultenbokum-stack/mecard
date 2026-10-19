// Requests every public card URL and reports the ones that don't answer as
// expected. The phase 3 gate and the cutover check (every printed /t/ URL must
// resolve before DNS moves).
//
//   BASE_URL=https://staging.mecard.co.za npm run check:urls
//   BASE_URL=http://localhost:3001 npm run check:urls   (after npm run build && npx next start -p 3001)
//
// Expected: live tags and live profiles → 200; trashed tags and archived
// profiles → 404 (as on WordPress).
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);

async function main() {
  const { db } = await import("../src/db/client");
  const { sql } = await import("drizzle-orm");
  const rows = (await db.execute(sql`
    SELECT '/t/' || c.slug || '/' AS path, CASE WHEN c.archived OR p.archived THEN 404 ELSE 200 END AS expect
      FROM cards c LEFT JOIN profiles p ON p.id = c.profile_id
    UNION ALL
    SELECT '/mecard-profile/' || slug || '/', CASE WHEN archived THEN 404 ELSE 200 END FROM profiles
  `)) as unknown as { path: string; expect: number }[];

  const failures: string[] = [];
  let done = 0;
  const started = Date.now();
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        let status = 0;
        try {
          // Slugs are stored URL-ready (WordPress percent-encodes non-ASCII), so send them as-is.
          status = (await fetch(BASE + r.path, { redirect: "manual" })).status;
        } catch (e) {
          failures.push(`ERR  ${r.path} ${String(e)}`);
        }
        if (status && status !== Number(r.expect)) failures.push(`${status}  ${r.path} (expected ${r.expect})`);
        if (++done % 1000 === 0) console.log(`${done} / ${rows.length}`);
      }
    }),
  );

  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.expect] = (m[r.expect] ?? 0) + 1), m), {});
  console.log(`Checked ${rows.length} URLs against ${BASE} in ${Math.round((Date.now() - started) / 1000)}s (expected: ${JSON.stringify(counts)})`);
  if (failures.length) {
    console.log(`${failures.length} unexpected:`);
    for (const f of failures.slice(0, 200)) console.log("  " + f);
    process.exit(1);
  }
  console.log("All as expected.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
