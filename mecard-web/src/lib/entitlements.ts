import "server-only";
import { and, asc, eq, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, entitlements, orderItems, orders, profiles } from "@/db/schema";
import { entitlementTypesFor, isBundle } from "./catalog";

// Paid and cancelled orders (Me\Entitlements\Module::process_paid_order and
// cancel_order_entitlements). A paid Pro upgrade for a profile makes it Pro
// at once; one bought without a profile waits as "paid_unassigned" until it
// is applied in the profile editor.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function processPaidOrder(tx: Tx, orderId: number) {
  const [o] = await tx.select({ userId: orders.userId }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o?.userId) return;
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const item of items) {
    const types = entitlementTypesFor(item.productId);
    if (!types.length) continue;
    const key = item.meta.cartItemKey ?? "";
    const profileId = Number(item.meta.profileId) || null;
    let rows = key
      ? await tx
          .select()
          .from(entitlements)
          .where(and(eq(entitlements.ownerId, o.userId), eq(entitlements.sourceProductId, item.productId), eq(entitlements.cartItemKey, key), eq(entitlements.status, "in_cart")))
          .orderBy(asc(entitlements.id))
      : [];
    if (!rows.length) {
      rows = await tx
        .select()
        .from(entitlements)
        .where(and(eq(entitlements.ownerId, o.userId), eq(entitlements.sourceOrderItemId, item.id), notInArray(entitlements.status, ["cancelled", "refunded"])))
        .orderBy(asc(entitlements.id));
    }
    if (!rows.length) rows = await createPaidRows(tx, o.userId, item.productId, Math.max(1, item.quantity), profileId);

    for (const row of rows) {
      if (["consumed", "refunded", "cancelled"].includes(row.status)) continue;
      const assigned = profileId ?? row.assignedProfileId;
      const status = row.type === "pro_upgrade" ? (assigned ? "paid_assigned" : "paid_unassigned") : "paid_assigned";
      await tx
        .update(entitlements)
        .set({ sourceOrderId: orderId, sourceOrderItemId: item.id, sourceProductId: item.productId, assignedProfileId: assigned, status, updatedAt: new Date() })
        .where(eq(entitlements.id, row.id));
      if (assigned && row.type !== "pro_upgrade") await linkCardToProfile(tx, row, assigned);
      if (row.type === "pro_upgrade" && assigned) {
        await consumeProUpgrade(tx, row.id, assigned);
        if (row.groupKey) {
          // The bundle's card and tag go to the same profile (assign_bundle_companions).
          const companions = await tx
            .select()
            .from(entitlements)
            .where(and(eq(entitlements.ownerId, o.userId), eq(entitlements.groupKey, row.groupKey), ne(entitlements.type, "pro_upgrade")));
          for (const c of companions) {
            await tx.update(entitlements).set({ assignedProfileId: assigned, updatedAt: new Date() }).where(eq(entitlements.id, c.id));
            await linkCardToProfile(tx, c, assigned);
          }
        }
      }
    }
  }
}

async function createPaidRows(tx: Tx, ownerId: number, productId: number, qty: number, profileId: number | null) {
  const types = entitlementTypesFor(productId);
  const created = [];
  for (let i = 0; i < qty; i++) {
    const groupKey = isBundle(productId) ? crypto.randomUUID() : null;
    for (const type of types) {
      const [r] = await tx
        .insert(entitlements)
        .values({ ownerId, type, status: type === "pro_upgrade" && !profileId ? "paid_unassigned" : "paid_assigned", groupKey, sourceProductId: productId, assignedProfileId: profileId })
        .returning();
      created.push(r);
    }
  }
  return created;
}

async function linkCardToProfile(tx: Tx, row: typeof entitlements.$inferSelect, profileId: number) {
  const cardId = row.type === "phone_tag" ? row.assignedTagId : row.assignedCardId;
  if (!cardId) return;
  const [p] = await tx.select({ companyId: profiles.companyId }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
  await tx
    .update(cards)
    .set({ profileId, ...(p?.companyId ? { companyId: p.companyId } : {}), updatedAt: new Date() })
    .where(eq(cards.id, cardId));
}

async function consumeProUpgrade(tx: Tx, rowId: number, profileId: number) {
  const now = new Date();
  await tx.update(profiles).set({ type: "pro", updatedAt: now }).where(eq(profiles.id, profileId));
  await tx.update(entitlements).set({ status: "consumed", consumedAt: now, updatedAt: now }).where(eq(entitlements.id, rowId));
}

/** Cancelled or refunded order: its rows are cancelled, and a Pro upgrade it gave is taken back. */
export async function cancelOrderEntitlements(tx: Tx, orderId: number, refunded: boolean) {
  const [o] = await tx.select({ userId: orders.userId }).from(orders).where(eq(orders.id, orderId)).limit(1);
  const keys = (await tx.select({ meta: orderItems.meta }).from(orderItems).where(eq(orderItems.orderId, orderId))).map((i) => i.meta.cartItemKey).filter(Boolean);
  const rows = await tx
    .select()
    .from(entitlements)
    .where(
      and(
        notInArray(entitlements.status, ["cancelled", "refunded"]),
        or(
          eq(entitlements.sourceOrderId, orderId),
          // EFT orders that were never paid still have their basket rows.
          o?.userId && keys.length ? and(eq(entitlements.ownerId, o.userId), eq(entitlements.status, "in_cart"), inArray(entitlements.cartItemKey, keys)) : sql`false`,
        ),
      ),
    );
  for (const row of rows) {
    if (row.type === "pro_upgrade" && row.status === "consumed" && row.assignedProfileId) {
      await tx.update(profiles).set({ type: "standard", updatedAt: new Date() }).where(eq(profiles.id, row.assignedProfileId));
    }
    await tx.update(entitlements).set({ status: refunded ? "refunded" : "cancelled", updatedAt: new Date() }).where(eq(entitlements.id, row.id));
  }
}
