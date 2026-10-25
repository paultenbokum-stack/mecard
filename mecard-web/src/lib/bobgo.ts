import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orderItems, orderNotes, orders } from "@/db/schema";
import { deliveryOf } from "@/lib/addresses";
import {
  type BobgoRate,
  type DeliveryAddress,
  type OrderForBobgo,
  bobgoStatusFor,
  orderRequest,
  orderStatusRequest,
  orderUpdateRequest,
  parseRates,
  ratesRequest,
  type ShipLine,
} from "@/lib/bobgo-rules";
import { PICKUP_METHOD } from "@/lib/shipping";

// Bob Go API client. Set BOBGO_API_KEY (Bob Go → Settings → API keys) to turn
// it on; BOBGO_SANDBOX=1 uses the sandbox. Without a key nothing here is called.

const apiKey = () => process.env.BOBGO_API_KEY ?? "";
// BOBGO_API_URL overrides the base URL (e.g. a local stand-in for testing).
const baseUrl = () =>
  process.env.BOBGO_API_URL || (process.env.BOBGO_SANDBOX === "1" ? "https://api.sandbox.bobgo.co.za/v2" : "https://api.bobgo.co.za/v2");

export const bobgoEnabled = () => apiKey() !== "";

async function call(path: string, body: unknown, opts: { method?: "POST" | "PATCH"; timeoutMs?: number } = {}) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: opts.method ?? "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // keep the raw text for the error below
  }
  if (!res.ok) {
    const msg = (json as { message?: string; error?: string })?.message ?? (json as { error?: string })?.error ?? text.slice(0, 200);
    throw new Error(`Bob Go ${path} returned ${res.status}${msg ? `: ${msg}` : ""}`);
  }
  return json;
}

// Quotes are cached for 15 minutes per identical request (as Bob Go's plugin
// does): Bob Go can take several seconds, and placing the order then reuses
// the price the customer was shown.
const RATE_TTL_MS = 15 * 60 * 1000;
const rateCache = new Map<string, { at: number; rates: BobgoRate[] }>();

/** Bob Go rates at checkout for this address and basket; [] when Bob Go has none (or fails). */
export async function checkoutRates(address: DeliveryAddress, lines: ShipLine[], orderTotalCents: number): Promise<BobgoRate[]> {
  const body = ratesRequest(address, lines, orderTotalCents);
  const key = JSON.stringify(body);
  const hit = rateCache.get(key);
  if (hit && Date.now() - hit.at < RATE_TTL_MS) return hit.rates;
  try {
    const rates = parseRates(await call("/rates-at-checkout", body));
    if (rateCache.size > 500) rateCache.clear();
    rateCache.set(key, { at: Date.now(), rates });
    return rates;
  } catch (e) {
    console.error("[bobgo] rates at checkout failed", e instanceof Error ? e.message : e);
    return [];
  }
}

type OrderRow = typeof orders.$inferSelect;

async function loadOrder(o: OrderRow): Promise<OrderForBobgo> {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  // The courier goes to the delivery recipient ("Ship to a different address?"), contactable on the billing email and phone.
  const to = deliveryOf(o);
  return {
    id: o.id,
    firstName: to.firstName,
    lastName: to.lastName,
    email: o.billingEmail,
    phone: o.billingPhone,
    address: {
      company: to.company,
      street: [o.address1, o.address2].filter(Boolean).join(", "),
      suburb: o.suburb,
      city: o.city,
      province: o.province,
      postcode: o.postcode,
    },
    shippingMethod: o.shippingMethod,
    shippingCents: o.shippingCents,
    serviceCode: o.shippingServiceCode,
    discountCents: o.discountCents,
    placedAt: o.createdAt,
    note: o.notes,
    status: o.status,
    lines: items.map((i) => ({ productId: i.productId, name: i.name, qty: i.quantity, unitPriceCents: i.unitPriceCents })),
  };
}

/**
 * Creates the paid order in Bob Go so it can be fulfilled there (book the
 * courier, print the waybill). Pickup orders are skipped. An order already in
 * Bob Go is left alone, or with `force` its details are updated there (as the
 * plugin's resync does). Never throws: the outcome is recorded on the order
 * and its history.
 */
export async function sendOrderToBobgo(orderId: number, opts: { by?: number | null; force?: boolean } = {}) {
  if (!bobgoEnabled()) return { ok: false as const, error: "Bob Go is not set up (no BOBGO_API_KEY)." };
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) return { ok: false as const, error: "Order not found." };
  if (o.bobgoOrderId && !opts.force) return { ok: true as const, id: o.bobgoOrderId, updated: false };
  if (o.shippingMethod === PICKUP_METHOD.label) return { ok: false as const, error: "Local pickup orders aren't sent to Bob Go." };

  const order = await loadOrder(o);
  const existing = o.bobgoOrderId && /^\d+$/.test(o.bobgoOrderId) ? Number(o.bobgoOrderId) : null;
  try {
    let id: string;
    if (existing) {
      await call("/orders", orderUpdateRequest(existing, order), { method: "PATCH" });
      id = String(existing);
    } else {
      const res = (await call("/orders", orderRequest(order))) as { id?: unknown } | null;
      id = String(res?.id ?? "sent");
    }
    await db.update(orders).set({ bobgoOrderId: id, ...(existing ? {} : { bobgoStatus: "processing" }), bobgoError: null }).where(eq(orders.id, orderId));
    await db.insert(orderNotes).values({
      orderId,
      body: existing ? `Updated in Bob Go (Bob Go order ${id}).` : `Sent to Bob Go (Bob Go order ${id}).`,
      authorId: opts.by ?? null,
    });
    return { ok: true as const, id, updated: !!existing };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[bobgo] order ${orderId} not ${existing ? "updated" : "sent"}:`, error);
    await db.update(orders).set({ bobgoError: error }).where(eq(orders.id, orderId));
    await db
      .insert(orderNotes)
      .values({ orderId, body: `Couldn't ${existing ? "update the order in" : "send to"} Bob Go: ${error}`, authorId: opts.by ?? null });
    return { ok: false as const, error };
  }
}

/**
 * Keeps Bob Go in step after one of our status changes (runs after the
 * response). A newly paid order is created there; for an order already in Bob
 * Go, cancelled/failed/refunded, completed and back-to-processing are forwarded
 * (bobgoStatusFor), so cancelling an order here cancels its delivery order in
 * Bob Go. The result is kept in bobgoStatus / bobgoError and the history.
 * Never throws.
 */
export async function bobgoAfterStatusChange(orderId: number, next: string, opts: { by?: number | null; prev?: string } = {}) {
  if (!bobgoEnabled()) return;
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) return;
  const bobgoId = o.bobgoOrderId && /^\d+$/.test(o.bobgoOrderId) ? Number(o.bobgoOrderId) : null;
  if (!bobgoId) {
    if (next === "processing") await sendOrderToBobgo(orderId, opts);
    return;
  }
  const status = bobgoStatusFor(next, opts.prev);
  if (!status) return;
  try {
    await call("/orders", orderStatusRequest(bobgoId, await loadOrder(o), status), { method: "PATCH" });
    await db.update(orders).set({ bobgoStatus: status, bobgoError: null }).where(eq(orders.id, orderId));
    await db.insert(orderNotes).values({ orderId, body: `Bob Go order ${bobgoId} set to ${status}.`, authorId: opts.by ?? null });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[bobgo] order ${orderId} status not sent:`, error);
    await db.update(orders).set({ bobgoError: error }).where(eq(orders.id, orderId));
    await db.insert(orderNotes).values({
      orderId,
      body: `Couldn't set Bob Go order ${bobgoId} to ${status} (${error}). Change it in Bob Go itself.`,
      authorId: opts.by ?? null,
    });
  }
}
