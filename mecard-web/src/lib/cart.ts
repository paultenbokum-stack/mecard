import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, carts, entitlements, products, type CartLine } from "@/db/schema";
import { cardCartKey, cardTypesFor, CARD_TYPE_FOR_ENTITLEMENT, entitlementTypesFor, isBundle, newCardSlug } from "./catalog";

// The basket (WooCommerce cart plus the plugin's cart hooks):
//   - adding a card product creates its card records straight away, one per
//     unit, so they can be designed before checkout (add_tags_to_account);
//   - each unit also gets "in_cart" entitlement rows, bundles one row per
//     part under a shared group key (Me\Entitlements\Module::sync_cart_entitlements);
//   - changing the quantity adds or archives cards and rows; removing the line
//     archives them all (mecard_cleanup_cart_item_related_objects).

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type { CartLine };

export async function getCart(userId: number): Promise<{ items: CartLine[]; couponCode: string }> {
  const [c] = await db.select({ items: carts.items, couponCode: carts.couponCode }).from(carts).where(eq(carts.userId, userId)).limit(1);
  return c ?? { items: [], couponCode: "" };
}

async function saveCart(tx: Tx, userId: number, items: CartLine[], extra: { couponCode?: string } = {}) {
  const values = { items, ...extra, remindersSent: 0, updatedAt: new Date() };
  await tx.insert(carts).values({ userId, ...values }).onConflictDoUpdate({ target: carts.userId, set: values });
}

export async function setCouponCode(userId: number, couponCode: string) {
  await db.transaction(async (tx) => saveCart(tx, userId, (await getCart(userId)).items, { couponCode }));
}

/** Add a product. A Pro upgrade or bundle for a profile already in the basket isn't added twice. */
export async function addToCart(userId: number, productId: number, qty: number, profileId: number | null = null): Promise<CartLine> {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(carts).where(eq(carts.userId, userId)).for("update").limit(1);
    const items = c?.items ?? [];
    let line = items.find((l) => l.productId === productId && l.profileId === profileId);
    if (line && profileId) return line;
    if (line) line.qty += qty;
    else {
      line = { key: randomBytes(16).toString("hex"), productId, qty, profileId };
      items.push(line);
    }
    await syncLine(tx, userId, line);
    await saveCart(tx, userId, items);
    return line;
  });
}

export async function setLineQty(userId: number, key: string, qty: number) {
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(carts).where(eq(carts.userId, userId)).for("update").limit(1);
    if (!c) return;
    const line = c.items.find((l) => l.key === key);
    if (!line) return;
    line.qty = Math.max(0, Math.floor(qty));
    await syncLine(tx, userId, line);
    await saveCart(tx, userId, c.items.filter((l) => l.qty > 0));
  });
}

export const removeLine = (userId: number, key: string) => setLineQty(userId, key, 0);

/** Emptied after checkout: the lines' cards and rows now belong to the order. */
export async function clearCart(tx: Tx, userId: number) {
  await saveCart(tx, userId, [], { couponCode: "" });
}

/** Cards still in the basket for a line (not yet on an order). */
export function lineCards(tx: Tx | typeof db, userId: number, key: string) {
  return tx
    .select()
    .from(cards)
    .where(and(eq(cards.cartItemKey, cardCartKey(key, userId)), eq(cards.archived, false), isNull(cards.orderId)))
    .orderBy(asc(cards.id));
}

/** Make the line's cards and entitlement rows match its quantity. */
async function syncLine(tx: Tx, userId: number, line: CartLine) {
  // Cards: add or archive (newest first) per card type.
  const existing = await lineCards(tx, userId, line.key);
  for (const type of cardTypesFor(line.productId)) {
    const ofType = existing.filter((c) => c.type === type);
    for (let i = ofType.length; i < line.qty; i++) await createCard(tx, userId, type, line);
    const extra = ofType.slice(line.qty).map((c) => c.id);
    if (extra.length) await tx.update(cards).set({ archived: true, updatedAt: new Date() }).where(inArray(cards.id, extra));
  }

  // Entitlements: one row per type per unit (bundles grouped), "in_cart".
  const types = entitlementTypesFor(line.productId);
  if (!types.length) return;
  const rows = await tx
    .select()
    .from(entitlements)
    .where(and(eq(entitlements.ownerId, userId), eq(entitlements.cartItemKey, line.key), eq(entitlements.status, "in_cart")))
    .orderBy(asc(entitlements.id));
  const units = isBundle(line.productId)
    ? [...new Set(rows.map((r) => r.groupKey))].map((g) => rows.filter((r) => r.groupKey === g))
    : rows.map((r) => [r]);
  const perUnit = isBundle(line.productId) ? 1 : types.length;
  const have = isBundle(line.productId) ? units.length : Math.floor(rows.length / Math.max(1, perUnit));

  if (line.qty < have) {
    const drop = units.slice(isBundle(line.productId) ? line.qty : line.qty * perUnit).flat().map((r) => r.id);
    if (drop.length) await tx.update(entitlements).set({ status: "cancelled", updatedAt: new Date() }).where(inArray(entitlements.id, drop));
    return;
  }
  const cardsNow = await lineCards(tx, userId, line.key);
  const used = new Set(rows.flatMap((r) => [r.assignedCardId, r.assignedTagId]).filter((x): x is number => !!x));
  for (let u = have; u < line.qty; u++) {
    const groupKey = isBundle(line.productId) ? randomUUID() : null;
    for (const type of types) {
      const cardType = CARD_TYPE_FOR_ENTITLEMENT[type];
      const card = cardType ? cardsNow.find((c) => c.type === cardType && !used.has(c.id)) : undefined;
      if (card) used.add(card.id);
      await tx.insert(entitlements).values({
        ownerId: userId,
        type,
        status: "in_cart",
        groupKey,
        sourceProductId: line.productId,
        cartItemKey: line.key,
        assignedProfileId: line.profileId,
        assignedCardId: card && type !== "phone_tag" ? card.id : null,
        assignedTagId: card && type === "phone_tag" ? card.id : null,
      });
      // A bundle bought for a profile links its card and tag to it straight away.
      if (card && line.profileId) await tx.update(cards).set({ profileId: line.profileId }).where(eq(cards.id, card.id));
    }
  }
}

async function createCard(tx: Tx, userId: number, type: string, line: CartLine) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = newCardSlug(type, userId);
    const [taken] = await tx.select({ id: cards.id }).from(cards).where(eq(cards.slug, slug)).limit(1);
    if (taken) continue;
    await tx.insert(cards).values({
      slug,
      title: slug,
      type,
      ownerId: userId,
      autoDownloadVcard: true,
      cartItemKey: cardCartKey(line.key, userId),
    });
    return;
  }
  throw new Error("Could not create a unique card address");
}

export type CartView = Awaited<ReturnType<typeof cartView>>;

/** The basket with its products, for the basket and checkout pages. */
export async function cartView(userId: number) {
  const { items, couponCode } = await getCart(userId);
  const ids = [...new Set(items.map((l) => l.productId))];
  const prods = ids.length ? await db.select().from(products).where(inArray(products.id, ids)) : [];
  const map = new Map(prods.map((p) => [p.id, p]));
  const lines = items
    .filter((l) => map.has(l.productId))
    .map((l) => ({ ...l, product: map.get(l.productId)!, lineCents: map.get(l.productId)!.priceCents * l.qty }));
  return { lines, couponCode, subtotalCents: lines.reduce((n, l) => n + l.lineCents, 0) };
}

/** The card cart keys of these basket lines (their cards are moved onto the order). */
export const cardCartKeysFor = (lines: Pick<CartLine, "key">[], userId: number) => lines.map((l) => cardCartKey(l.key, userId));
