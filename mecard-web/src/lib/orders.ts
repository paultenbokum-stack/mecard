import "server-only";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, orderNotes, orders } from "@/db/schema";
import { bobgoAfterStatusChange, bobgoEnabled } from "@/lib/bobgo";
import { cancelOrderEntitlements, processPaidOrder } from "@/lib/entitlements";
import { ORDER_STATUS_LABEL } from "@/lib/money";
import { sendOrderStatusEmails } from "@/lib/order-emails";

const PAID = ["processing", "completed"];

/**
 * Order status changes, with what the plugin hung off WooCommerce's hooks:
 *   - on hold or paid: the order's cards leave the basket (remove_cart_item_key);
 *   - paid: entitlements are processed (process_paid_order), so a Pro upgrade
 *     or bundle bought for a profile takes effect;
 *   - completed: the order's packaged cards are marked shipped;
 *   - cancelled: entitlements are cancelled and the order's cards removed
 *     (delete_tags / delink_cards_from_cancelled_order); refunded: entitlements refunded.
 * Each change is written to the order history and sends WooCommerce's
 * emails; Bob Go follows paid, completed and cancelled orders.
 * Returns false when the order is missing or already has that status.
 */
export async function setOrderStatus(
  orderId: number,
  next: string,
  extra: Partial<typeof orders.$inferInsert> = {},
  opts: { by?: number | null; note?: string } = {},
): Promise<boolean> {
  const prev = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o || o.status === next) return null;
    await tx.update(orders).set({ status: next, ...extra }).where(eq(orders.id, orderId));
    if (["on-hold", ...PAID].includes(next)) {
      await tx.update(cards).set({ cartItemKey: null, updatedAt: new Date() }).where(eq(cards.orderId, orderId));
    }
    if (PAID.includes(next) && !PAID.includes(o.status)) await processPaidOrder(tx, orderId);
    // Completed means sent: the order's packaged cards are on their way.
    if (next === "completed") {
      await tx
        .update(cards)
        .set({ shipped: true, updatedAt: new Date() })
        .where(and(eq(cards.orderId, orderId), eq(cards.packaged, true), eq(cards.archived, false)));
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
  await sendOrderStatusEmails(orderId, prev, next);
  if (bobgoEnabled()) after(() => bobgoAfterStatusChange(orderId, next, { by: opts.by, prev }));
  return true;
}

export async function orderTotalCents(orderId: number) {
  const [o] = await db.select({ t: orders.totalCents }).from(orders).where(eq(orders.id, orderId));
  return o?.t ?? null;
}
