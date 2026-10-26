import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { adminLog, cards, entitlements, orderItems, orderNotes, orders, products } from "@/db/schema";
import { cardCartKey, cardTypesFor, CARD_TYPE_FOR_ENTITLEMENT, entitlementTypesFor, isBundle, isForProfile, newCardSlug } from "./catalog";
import { couponForLines, findCoupon } from "./coupons";
import { evaluateCoupon } from "./coupon-rules";
import type { LogEntity } from "./admin-log";
import { ORDER_STATUS_LABEL, rands } from "./money";
import { cardsForQty, couponCodesOf, isEditableOrder, orderTotals, otherDiscountOf, parseDiscount } from "./order-edit-rules";

// Staff edit an unpaid order (WooCommerce's editable order screen). The order's
// cards and basket entitlements follow its items as they do in the basket:
// a higher quantity adds cards (on the order, ready to design) and "in_cart"
// rows, a lower one archives the newest cards and cancels rows, and removing
// an item does both for all of them. Totals are recalculated after each edit,
// the coupon's discount from the new items. Each edit goes in the order
// history and admin_log.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Order = typeof orders.$inferSelect;
type Item = typeof orderItems.$inferSelect;
type CardRow = typeof cards.$inferSelect;

export type OrderEdit =
  | { kind: "items"; qty: Map<number, number> }
  | { kind: "add"; productId: number; qty: number }
  | { kind: "coupon"; code: string }
  | { kind: "removeCoupon" }
  | { kind: "adjust"; discount: string; shippingCents: number };

export type EditResult = { ok: true; message: string } | { ok: false; error: string };

export async function editOrder(orderId: number, by: number, edit: OrderEdit): Promise<EditResult> {
  // A new coupon is checked like the basket checks it, before anything changes.
  let newCoupon: { code: string; freeShipping: boolean } | null = null;
  if (edit.kind === "coupon") {
    const [o] = await db.select({ userId: orders.userId, couponCode: orders.couponCode }).from(orders).where(eq(orders.id, orderId));
    if (!o) return { ok: false, error: "Order not found." };
    if (couponCodesOf(o.couponCode).length) return { ok: false, error: "The order already has a coupon. Remove it first." };
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const r = await couponForLines(edit.code, linesOf(items), o.userId);
    if (!r.ok) return { ok: false, error: r.error };
    newCoupon = { code: r.code, freeShipping: r.freeShipping };
  }

  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o) return { ok: false, error: "Order not found." };
    if (!isEditableOrder(o.status)) return { ok: false, error: `Only orders on hold can be edited. This one is ${ORDER_STATUS_LABEL[o.status] ?? o.status}.` };
    const before = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.id));
    const otherBefore = otherDiscountOf(o.discountCents, await couponCents(o.couponCode, before, o));
    const changes: string[] = [];
    let couponCode = o.couponCode;
    let otherCents = otherBefore;
    let shippingCents = o.shippingCents;

    if (edit.kind === "items") {
      const cardMap = await itemCards(tx, o, before);
      for (const item of before) {
        let qty = edit.qty.get(item.id);
        if (qty === undefined || qty === item.quantity) continue;
        if (qty > 1 && item.meta.profileId && isForProfile(item.productId)) qty = 1;
        if (qty === item.quantity) continue;
        await syncItem(tx, o, item, qty, cardMap.get(item.id) ?? []);
        if (qty === 0) {
          await tx.delete(orderItems).where(eq(orderItems.id, item.id));
          changes.push(`removed ${item.name} × ${item.quantity}`);
        } else {
          await tx.update(orderItems).set({ quantity: qty }).where(eq(orderItems.id, item.id));
          changes.push(`${item.name} quantity ${item.quantity} → ${qty}`);
        }
      }
      if (!changes.length) return { ok: true, message: "No changes to save." };
    } else if (edit.kind === "add") {
      const [p] = await tx.select().from(products).where(eq(products.id, edit.productId));
      if (!p) return { ok: false, error: "Product not found." };
      const [item] = await tx
        .insert(orderItems)
        .values({ orderId, productId: p.id, name: p.name, quantity: edit.qty, unitPriceCents: p.priceCents, meta: { cartItemKey: randomBytes(16).toString("hex") } })
        .returning();
      await syncItem(tx, o, { ...item, quantity: 0 }, edit.qty, []);
      changes.push(`added ${p.name} × ${edit.qty} at ${rands(p.priceCents)}`);
    } else if (edit.kind === "coupon" && newCoupon) {
      couponCode = newCoupon.code;
      changes.push(`coupon ${newCoupon.code} applied`);
      if (newCoupon.freeShipping && shippingCents > 0) {
        shippingCents = 0;
        changes.push("free shipping");
      }
    } else if (edit.kind === "removeCoupon") {
      if (!couponCode) return { ok: true, message: "The order has no coupon." };
      changes.push(`coupon ${couponCode} removed`);
      couponCode = "";
    } else if (edit.kind === "adjust") {
      // A percentage is of today's subtotal, and stays that amount when the items change.
      const wanted = parseDiscount(edit.discount, before.reduce((n, i) => n + i.unitPriceCents * i.quantity, 0));
      if (Number.isNaN(wanted)) return { ok: false, error: "Enter the discount as an amount (R50) or a percentage (10%)." };
      if (wanted !== otherBefore) {
        changes.push(wanted ? `discount set to ${rands(wanted)}${edit.discount.includes("%") ? ` (${edit.discount.trim()})` : ""}` : "discount removed");
        otherCents = wanted;
      }
      if (edit.shippingCents !== o.shippingCents) {
        changes.push(`shipping ${rands(o.shippingCents)} → ${rands(edit.shippingCents)}`);
        shippingCents = edit.shippingCents;
      }
      if (!changes.length) return { ok: true, message: "No changes to save." };
    }

    const after = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const totals = orderTotals({
      lineCents: after.map((i) => i.unitPriceCents * i.quantity),
      couponCents: await couponCents(couponCode, after, o),
      otherCents,
      shippingCents,
    });
    await tx
      .update(orders)
      .set({ ...totals, couponCode, shippingCents })
      .where(eq(orders.id, orderId));
    const total = totals.totalCents === o.totalCents ? `Total still ${rands(o.totalCents)}.` : `Total ${rands(o.totalCents)} → ${rands(totals.totalCents)}.`;
    const detail = `${changes.join("; ")}. ${total}`;
    await tx.insert(orderNotes).values({ orderId, body: `Order edited: ${detail}`, authorId: by });
    const action = edit.kind === "add" ? "item_added" : edit.kind === "items" ? "items_edited" : "discount_edited";
    await tx.insert(adminLog).values({ actorId: by, entity: "order" satisfies LogEntity, entityId: orderId, action, detail: detail.slice(0, 2000) });
    return { ok: true, message: `Order updated. ${total}${o.bobgoOrderId ? " Update it in Bob Go to send the new items." : ""}` };
  });
}

const linesOf = (items: Item[]) => items.map((i) => ({ productId: i.productId, lineCents: i.unitPriceCents * i.quantity }));

/**
 * What the order's coupon(s) take off these items. The coupon is already on the
 * order, so it is worked out as it stood when the order was placed, without
 * counting its use again.
 */
async function couponCents(couponCode: string, items: Item[], o: Order) {
  let total = 0;
  for (const code of couponCodesOf(couponCode)) {
    const r = evaluateCoupon(await findCoupon(code), { code, lines: linesOf(items), usage: 0, userUsage: 0, userId: o.userId, now: o.createdAt });
    if (r.ok) total += r.discountCents;
  }
  return total;
}

/**
 * Each item's cards on the order: those its basket entitlements point to, and
 * those still carrying its basket key. Items without either (corporate classic
 * cards, and orders imported from WooCommerce) get the order's other cards of
 * their type. Imported items have no basket rows: they are made when it's paid.
 */
async function itemCards(tx: Tx, o: Order, items: Item[]) {
  const map = new Map<number, CardRow[]>();
  if (!o.userId) return map;
  const orderCards = await tx
    .select()
    .from(cards)
    .where(and(eq(cards.orderId, o.id), eq(cards.archived, false)))
    .orderBy(asc(cards.id));
  const keys = items.map((i) => i.meta.cartItemKey).filter(Boolean);
  const rows = keys.length
    ? await tx
        .select()
        .from(entitlements)
        .where(and(eq(entitlements.ownerId, o.userId), inArray(entitlements.cartItemKey, keys), eq(entitlements.status, "in_cart")))
    : [];
  const claimed = new Set<number>();
  for (const item of items) {
    const key = item.meta.cartItemKey;
    if (!key) continue;
    const ids = new Set(rows.filter((r) => r.cartItemKey === key).flatMap((r) => [r.assignedCardId, r.assignedTagId]));
    const mine = orderCards.filter((c) => ids.has(c.id) || c.cartItemKey === cardCartKey(key, o.userId!));
    mine.forEach((c) => claimed.add(c.id));
    map.set(item.id, mine);
  }
  for (const item of items) {
    if (item.meta.cartItemKey && entitlementTypesFor(item.productId).length) continue;
    const types = cardTypesFor(item.productId);
    const rest = orderCards.filter((c) => !claimed.has(c.id) && types.includes(c.type));
    rest.forEach((c) => claimed.add(c.id));
    map.set(item.id, [...(map.get(item.id) ?? []), ...rest]);
  }
  return map;
}

/** Make the item's cards and basket entitlements match its new quantity. */
async function syncItem(tx: Tx, o: Order, item: Item, qty: number, itemCardsNow: CardRow[]) {
  if (!o.userId) return;
  const userId = o.userId;
  const profileId = Number(item.meta.profileId) || null;
  const fresh: CardRow[] = [];
  for (const type of cardTypesFor(item.productId)) {
    const { keep, archive, add } = cardsForQty(
      itemCardsNow.filter((c) => c.type === type),
      qty,
    );
    if (archive.length) {
      await tx
        .update(cards)
        .set({ archived: true, updatedAt: new Date() })
        .where(inArray(cards.id, archive.map((c) => c.id)));
    }
    for (let i = 0; i < add; i++) fresh.push(await createOrderCard(tx, userId, type, o.id));
    fresh.push(...keep);
  }

  const types = entitlementTypesFor(item.productId);
  const key = item.meta.cartItemKey;
  if (!types.length || !key) return;
  const rows = await tx
    .select()
    .from(entitlements)
    .where(and(eq(entitlements.ownerId, userId), eq(entitlements.cartItemKey, key), eq(entitlements.status, "in_cart")))
    .orderBy(asc(entitlements.id));
  const bundle = isBundle(item.productId);
  const units = bundle ? [...new Set(rows.map((r) => r.groupKey))].map((g) => rows.filter((r) => r.groupKey === g)) : rows.map((r) => [r]);
  const perUnit = bundle ? 1 : types.length;
  const have = bundle ? units.length : Math.floor(rows.length / Math.max(1, perUnit));
  if (qty < have) {
    const drop = units.slice(bundle ? qty : qty * perUnit).flat().map((r) => r.id);
    if (drop.length) await tx.update(entitlements).set({ status: "cancelled", updatedAt: new Date() }).where(inArray(entitlements.id, drop));
    return;
  }
  const used = new Set(rows.flatMap((r) => [r.assignedCardId, r.assignedTagId]).filter((x): x is number => !!x));
  for (let u = have; u < qty; u++) {
    const groupKey = bundle ? randomUUID() : null;
    for (const type of types) {
      const cardType = CARD_TYPE_FOR_ENTITLEMENT[type];
      const card = cardType ? fresh.find((c) => c.type === cardType && !used.has(c.id)) : undefined;
      if (card) used.add(card.id);
      await tx.insert(entitlements).values({
        ownerId: userId,
        type,
        status: "in_cart",
        groupKey,
        sourceProductId: item.productId,
        cartItemKey: key,
        assignedProfileId: profileId,
        assignedCardId: card && type !== "phone_tag" ? card.id : null,
        assignedTagId: card && type === "phone_tag" ? card.id : null,
      });
      if (card && profileId) await tx.update(cards).set({ profileId }).where(eq(cards.id, card.id));
    }
  }
}

/** A new card on the order, in the customer's account to design (create_tag()). */
async function createOrderCard(tx: Tx, userId: number, type: string, orderId: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = newCardSlug(type, userId);
    const [taken] = await tx.select({ id: cards.id }).from(cards).where(eq(cards.slug, slug)).limit(1);
    if (taken) continue;
    const [card] = await tx.insert(cards).values({ slug, title: slug, type, ownerId: userId, autoDownloadVcard: true, orderId }).returning();
    return card;
  }
  throw new Error("Could not create a unique card address");
}

/** The order's discount split into the coupon's share and the rest, for the edit form. */
export async function discountParts(o: Order, items: Item[]) {
  const coupon = await couponCents(o.couponCode, items, o);
  return { couponCents: Math.min(coupon, o.discountCents), otherCents: otherDiscountOf(o.discountCents, coupon) };
}

/** Products staff can add: the shop's, then any hidden ones. */
export const productsToAdd = () =>
  db.select({ id: products.id, name: products.name, priceCents: products.priceCents, active: products.active }).from(products).orderBy(desc(products.active), asc(products.sortOrder), asc(products.name));
