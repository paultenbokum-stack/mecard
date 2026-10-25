import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { events, orders } from "@/db/schema";
import { SESSION_COOKIE } from "./tracking";

// Checkout events, written on the server because the PayFast round trip and
// its failures happen only once (conversion plan 0.6):
//   checkout_started  the checkout page is shown with a basket { products, subtotal_cents }
//   payment_cancelled the customer came back from PayFast without paying, or PayFast said so { order_id, via }
//   payment_failed    PayFast reported anything but COMPLETE / CANCELLED { order_id, status }

const sessionId = async () => {
  try {
    return (await cookies()).get(SESSION_COOKIE)?.value?.slice(0, 64) || null;
  } catch {
    return null; // not in a request (the ITN has no browser session anyway)
  }
};

/** Once per user per half hour, so reloads and form errors don't each count. */
export async function checkoutStarted(userId: number, productIds: number[], subtotalCents: number) {
  const [recent] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.name, "checkout_started"), eq(events.userId, userId), gt(events.createdAt, sql`now() - interval '30 minutes'`)))
    .limit(1);
  if (recent) return;
  await db.insert(events).values({ name: "checkout_started", userId, sessionId: await sessionId(), source: "checkout", meta: { products: productIds, subtotal_cents: subtotalCents } });
}

async function orderEvent(name: "payment_cancelled" | "payment_failed", orderId: number, meta: Record<string, unknown>) {
  const [o] = await db.select({ userId: orders.userId }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) return;
  // Once per order and kind (PayFast re-sends ITNs; people reload the basket).
  const [seen] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.name, name), sql`${events.meta}->>'order_id' = ${String(orderId)}`))
    .limit(1);
  if (seen) return;
  await db.insert(events).values({ name, userId: o.userId, sessionId: await sessionId(), source: "payfast", meta: { order_id: orderId, ...meta } });
}

/** Back from PayFast's cancel link (/basket/?cancelled=<order>), for the customer's own order. */
export async function paymentCancelledReturn(userId: number, orderId: number) {
  const [o] = await db.select({ userId: orders.userId }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (o?.userId === userId) await orderEvent("payment_cancelled", orderId, { via: "return" });
}

export const paymentCancelledItn = (orderId: number) => orderEvent("payment_cancelled", orderId, { via: "itn" });
export const paymentFailedItn = (orderId: number, status: string) => orderEvent("payment_failed", orderId, { status: status.slice(0, 20) });
