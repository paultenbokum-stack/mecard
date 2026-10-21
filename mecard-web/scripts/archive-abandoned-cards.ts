// Cutover clean-up: cards WordPress left "in a basket" (a cart item key, no
// order) that no basket here holds. WooCommerce baskets aren't imported, so
// after the import every such card is abandoned; AutomateWoo's Trash
// Abandoned Tags missed thousands of them over the years.
//
//   npm run cards:archive-abandoned            archive them, cancel their in-basket entitlement rows
//   npm run cards:archive-abandoned -- --dry-run   only count
//
// Safe to run again at any time: cards in a live basket are never touched, and
// archived cards are skipped. deploy/5-migrate-import.ps1 runs it after the import.

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
  // The card keys and line keys of every basket here (cards use "<line key>-<user id>").
  const baskets = await sql<{ user_id: number; key: string }[]>`
    SELECT c.user_id, l->>'key' AS key FROM carts c, jsonb_array_elements(c.items) l`;
  const cardKeys = baskets.map((b) => `${b.key}-${b.user_id}`);
  const lineKeys = baskets.map((b) => b.key);

  const cards = await sql<{ id: number }[]>`
    SELECT id FROM cards
     WHERE cart_item_key IS NOT NULL AND cart_item_key <> '' AND order_id IS NULL AND NOT archived
       AND NOT (cart_item_key = ANY(${sql.array(cardKeys.length ? cardKeys : [""])}))`;
  const ents = await sql<{ id: number }[]>`
    SELECT id FROM entitlements
     WHERE status = 'in_cart'
       AND NOT (coalesce(cart_item_key, '') = ANY(${sql.array(lineKeys.length ? lineKeys : [""])}))`;

  console.log(`${cards.length} abandoned card(s), ${ents.length} in-basket entitlement row(s) without a basket.`);
  if (dryRun || (!cards.length && !ents.length)) {
    if (dryRun) console.log("Dry run: nothing changed.");
    await sql.end();
    return;
  }
  await sql.begin(async (tx) => {
    if (cards.length) await tx`UPDATE cards SET archived = true, updated_at = now() WHERE id = ANY(${tx.array(cards.map((c) => c.id))}::int[])`;
    if (ents.length) await tx`UPDATE entitlements SET status = 'cancelled', updated_at = now() WHERE id = ANY(${tx.array(ents.map((e) => e.id))}::int[])`;
  });
  console.log(`Archived ${cards.length} card(s) and cancelled ${ents.length} entitlement row(s).`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
