import "server-only";
import { and, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, orders } from "@/db/schema";
import { setOrderStatus } from "./orders";
import { trackOrder } from "./shipment-tracking";
import { PICKUP_METHOD } from "./shipping";

// Processing → Shipped (the courier has it) → Completed (delivered). Local
// pickup goes straight to Completed when it's collected. Bob Go's tracking
// moves orders along on its own (hourly); staff can do each step by hand.

type By = { by?: number | null };

export async function markOrderShipped(orderId: number, opts: By & { reference?: string; courier?: string; note?: string; emails?: boolean } = {}) {
  const extra = {
    ...(opts.reference ? { trackingReference: opts.reference.slice(0, 64) } : {}),
    ...(opts.courier ? { courierName: opts.courier.slice(0, 100) } : {}),
  };
  return setOrderStatus(orderId, "shipped", extra, { by: opts.by, note: opts.note, emails: opts.emails });
}

export const markOrderDelivered = (orderId: number, opts: By & { note?: string } = {}) => setOrderStatus(orderId, "completed", {}, { by: opts.by, note: opts.note });

/** Local pickup: collected is delivered. The cards are marked shipped on the way through, without a "shipped" email. */
export async function markOrderCollected(orderId: number, opts: By = {}) {
  await setOrderStatus(orderId, "shipped", {}, { by: opts.by, note: "Collected by the customer.", emails: false });
  return setOrderStatus(orderId, "completed", {}, { by: opts.by });
}

/** After staff tick Shipped on cards: once every card on a paid order is shipped, the order is too. */
export async function shipOrderIfCardsShipped(orderId: number | null, opts: By = {}) {
  if (!orderId) return false;
  const [o] = await db.select({ status: orders.status, method: orders.shippingMethod }).from(orders).where(eq(orders.id, orderId));
  if (o?.status !== "processing") return false;
  const live = await db.select({ shipped: cards.shipped }).from(cards).where(and(eq(cards.orderId, orderId), eq(cards.archived, false)));
  if (!live.length || live.some((c) => !c.shipped)) return false;
  return o.method === PICKUP_METHOD.label ? markOrderCollected(orderId, opts) : markOrderShipped(orderId, { ...opts, note: "All cards ticked as shipped." });
}

/**
 * Bob Go tracking for one order: shipped once the courier collects it,
 * completed once delivered. Returns what happened, for the job's log and the
 * admin's "check tracking" button.
 */
export async function syncOrderTracking(orderId: number): Promise<string> {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) return "not found";
  const t = await trackOrder(orderId);
  if (!t) return "Bob Go tracking couldn't be reached";
  if (t.state === "none") return "no shipment in Bob Go yet";
  if (t.state === "waiting") return `waiting for the courier (${t.statusFriendly})`;
  const details = { reference: t.reference, courier: t.courier };
  if (o.status === "processing") {
    // Delivered before we looked: one email (delivered), not two.
    await markOrderShipped(orderId, { ...details, note: `Bob Go: ${t.statusFriendly}.`, emails: t.state !== "delivered" });
  } else if (o.status === "shipped" && (t.reference !== o.trackingReference || t.courier !== o.courierName)) {
    await db.update(orders).set({ trackingReference: t.reference, courierName: t.courier }).where(eq(orders.id, orderId));
  }
  if (t.state === "delivered" && ["processing", "shipped"].includes(o.status)) {
    await markOrderDelivered(orderId, { note: "Bob Go: delivered." });
    return `delivered (${t.reference})`;
  }
  return o.status === "processing" ? `shipped (${t.reference}, ${t.statusFriendly})` : `in transit (${t.statusFriendly})`;
}

/** Orders the hourly job follows: paid, sent by courier, from the last 60 days. */
export function ordersToTrack(now: Date) {
  return db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        inArray(orders.status, ["processing", "shipped"]),
        ne(orders.shippingMethod, ""),
        ne(orders.shippingMethod, PICKUP_METHOD.label),
        gte(orders.createdAt, new Date(now.getTime() - 60 * 24 * 3600_000)),
      ),
    );
}
