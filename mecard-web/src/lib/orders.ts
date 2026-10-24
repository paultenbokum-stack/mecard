import "server-only";
import { after } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, orderItems, orderNotes, orders } from "@/db/schema";
import { bobgoAfterStatusChange, bobgoEnabled } from "@/lib/bobgo";
import { cancelOrderEntitlements, processPaidOrder } from "@/lib/entitlements";
import { refreshProfilePages } from "@/lib/manage";
import { ORDER_STATUS_LABEL, PAID_STATUSES as PAID } from "@/lib/money";
import { sendOrderStatusEmails } from "@/lib/order-emails";

/**
 * Order status changes, with what the plugin hung off WooCommerce's hooks:
 *   - on hold or paid: the order's cards leave the basket (remove_cart_item_key);
 *   - paid: entitlements are processed (process_paid_order), so a Pro upgrade
 *     or bundle bought for a profile takes effect;
 *   - shipped (the courier collected it, or staff marked it): the order's
 *     cards are marked packaged and shipped, and the shipped date recorded;
 *   - completed after shipped: delivered, so the delivery date is recorded;
 *   - cancelled: entitlements are cancelled and the order's cards removed
 *     (delete_tags / delink_cards_from_cancelled_order); refunded: entitlements refunded.
 * Each change is written to the order history and sends WooCommerce's
 * emails (opts.emails = false skips them, for a step the customer doesn't need
 * to hear about separately); Bob Go follows paid, completed and cancelled orders.
 * Returns false when the order is missing or already has that status.
 */
export async function setOrderStatus(
  orderId: number,
  next: string,
  extra: Partial<typeof orders.$inferInsert> = {},
  opts: { by?: number | null; note?: string; emails?: boolean } = {},
): Promise<boolean> {
  const prev = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o || o.status === next) return null;
    const now = new Date();
    const dates = {
      ...(next === "shipped" && !o.shippedAt ? { shippedAt: now } : {}),
      ...(next === "completed" && o.status === "shipped" && !o.deliveredAt ? { deliveredAt: now } : {}),
    };
    await tx.update(orders).set({ status: next, ...dates, ...extra }).where(eq(orders.id, orderId));
    if (["on-hold", ...PAID].includes(next)) {
      await tx.update(cards).set({ cartItemKey: null, updatedAt: new Date() }).where(eq(cards.orderId, orderId));
    }
    if (PAID.includes(next) && !PAID.includes(o.status)) await processPaidOrder(tx, orderId);
    if (next === "shipped") {
      await tx
        .update(cards)
        .set({ packaged: true, shipped: true, updatedAt: now })
        .where(and(eq(cards.orderId, orderId), eq(cards.archived, false)));
    }
    if (next === "cancelled" || next === "refunded") await cancelOrderEntitlements(tx, orderId, next === "refunded");
    if (next === "cancelled") {
      await tx
        .update(cards)
        .set({ archived: true, updatedAt: new Date() })
        .where(and(eq(cards.orderId, orderId), eq(cards.shipped, false), eq(cards.archived, false)));
    }
    const change = `Order status changed from ${ORDER_STATUS_LABEL[o.status] ?? o.status} to ${ORDER_STATUS_LABEL[next] ?? next}.`;
    await tx.insert(orderNotes).values({ orderId, body: opts.note ? `${opts.note} ${change}` : change, authorId: opts.by ?? null });
    return o.status;
  });
  if (prev === null) return false;
  // A Pro upgrade or bundle for a profile went live (or was taken back): refresh its public pages now.
  if ((PAID.includes(next) && !PAID.includes(prev)) || next === "cancelled" || next === "refunded") {
    const items = await db.select({ meta: orderItems.meta }).from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const id of new Set(items.map((i) => Number(i.meta.profileId)).filter((n) => n > 0))) await refreshProfilePages(id);
  }
  if (opts.emails !== false) await sendOrderStatusEmails(orderId, prev, next);
  if (bobgoEnabled()) after(() => bobgoAfterStatusChange(orderId, next, { by: opts.by, prev }));
  return true;
}

export async function orderTotalCents(orderId: number) {
  const [o] = await db.select({ t: orders.totalCents }).from(orders).where(eq(orders.id, orderId));
  return o?.t ?? null;
}

/** A customer's orders, newest first (quote requests, the ywraq statuses, are listed under Quotes). */
export async function customerOrders(userId: number, limit?: number) {
  const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  const list = rows.filter((o) => !o.status.startsWith("ywraq"));
  return limit ? list.slice(0, limit) : list;
}
