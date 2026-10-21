// Bob Go request/response shapes for rates at checkout and order creation
// (api-docs.bob.co.za/bobgo; fields as Bob Go's own WooCommerce plugin sends
// them). Pure, so it can be unit tested.
import { HANDLING_DAYS, MIN_PARCEL_WEIGHT_KG, ORDER_PARCEL, SHIPPING_ORIGIN, unitWeightKg } from "./shipping";

/** WooCommerce's South African province codes, which Bob Go takes as "zone". */
export const PROVINCE_ZONE: Record<string, string> = {
  "Eastern Cape": "EC",
  "Free State": "FS",
  Gauteng: "GP",
  "KwaZulu-Natal": "KZN",
  Limpopo: "LP",
  Mpumalanga: "MP",
  "Northern Cape": "NC",
  "North West": "NW",
  "Western Cape": "WC",
};

export type DeliveryAddress = {
  company?: string;
  street: string;
  suburb: string;
  city: string;
  province: string;
  postcode: string;
};

export type ShipLine = { productId: number; name: string; qty: number; unitPriceCents: number };

export type BobgoRate = { serviceCode: string; label: string; cents: number; description: string };

const rands = (cents: number) => Math.round(cents) / 100;

export function bobgoAddress(a: DeliveryAddress) {
  return {
    company: a.company ?? "",
    street_address: a.street.trim(),
    local_area: a.suburb.trim(),
    city: a.city.trim(),
    zone: PROVINCE_ZONE[a.province] ?? a.province,
    country: "ZA",
    code: a.postcode.trim(),
  };
}

/** Enough of an address for Bob Go to quote: street, suburb, city, province and postcode. */
export function addressComplete(a: DeliveryAddress): boolean {
  return [a.street, a.suburb, a.city, a.province, a.postcode].every((v) => v.trim() !== "");
}

/** POST /rates-at-checkout body. orderTotalCents is what the buyer pays for the goods after discounts. */
export function ratesRequest(address: DeliveryAddress, lines: ShipLine[], orderTotalCents: number) {
  const declared = lines.reduce((n, l) => n + l.unitPriceCents * l.qty, 0);
  return {
    collection_address: SHIPPING_ORIGIN,
    delivery_address: bobgoAddress(address),
    // The whole order goes in one box, so it is quoted as a single parcel.
    items: [
      {
        description: lines.map((l) => `${l.name} × ${l.qty}`).join(", "),
        sku: "mecard-order",
        price: rands(declared),
        quantity: 1,
        ...ORDER_PARCEL,
        weight_kg: Math.max(
          MIN_PARCEL_WEIGHT_KG,
          Math.round(lines.reduce((n, l) => n + unitWeightKg(l.productId) * l.qty, 0) * 1000) / 1000,
        ),
      },
    ],
    declared_value: rands(declared),
    order_total_price: rands(orderTotalCents),
    handling_time: HANDLING_DAYS,
  };
}

/** The response's rates, skipping anything malformed (as the plugin does). */
export function parseRates(body: unknown): BobgoRate[] {
  const rates = (body as { rates?: unknown })?.rates;
  if (!Array.isArray(rates)) return [];
  return rates.flatMap((r) => {
    const name = (r as { service_name?: unknown }).service_name;
    const code = (r as { service_code?: unknown }).service_code;
    const price = Number((r as { total_price?: unknown }).total_price);
    if (typeof name !== "string" || !name || typeof code !== "string" || !code || !Number.isFinite(price) || price < 0) return [];
    const description = (r as { description?: unknown }).description;
    return [
      { serviceCode: code, label: name, cents: Math.round(price * 100), description: typeof description === "string" ? description : "" },
    ];
  });
}

export type OrderForBobgo = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: DeliveryAddress;
  shippingMethod: string;
  shippingCents: number;
  // Bob Go service code of the chosen rate ("" for pickup / fixed rates)
  serviceCode?: string;
  discountCents?: number;
  placedAt?: Date;
  note?: string;
  // Our order status; sets Bob Go's payment_status (default: paid)
  status?: string;
  lines: ShipLine[];
};

/**
 * POST /orders body for a paid order, with the same extras Bob Go's WooCommerce
 * plugin sends: the discount (so Bob Go's order total matches what the buyer
 * paid), the chosen service code, the order date and the customer's note.
 */
export function orderRequest(o: OrderForBobgo) {
  return {
    channel_order_number: String(o.id),
    channel_ref_id: String(o.id),
    customer_name: o.firstName,
    customer_surname: o.lastName,
    customer_email: o.email,
    customer_phone: o.phone,
    currency: "ZAR",
    buyer_selected_shipping_cost: rands(o.shippingCents),
    buyer_selected_shipping_method: o.shippingMethod,
    delivery_address: bobgoAddress(o.address),
    order_items: o.lines.map((l) => ({
      description: l.name,
      sku: String(l.productId),
      unit_price: rands(l.unitPriceCents),
      qty: l.qty,
      unit_weight_kg: unitWeightKg(l.productId),
    })),
    payment_status: paymentStatusFor(o.status ?? "processing"),
    ...(o.discountCents ? { total_discount: rands(o.discountCents) } : {}),
    ...(o.serviceCode ? { buyer_selected_service_code: o.serviceCode } : {}),
    ...(o.placedAt ? { date_placed_on_channel: o.placedAt.toISOString() } : {}),
    ...(o.note ? { note: o.note } : {}),
  };
}

/** PATCH /orders body: corrects an order already in Bob Go (items left as they are, as the plugin does). */
export function orderUpdateRequest(bobgoId: number, o: OrderForBobgo) {
  const { order_items: _items, ...rest } = orderRequest(o);
  void _items;
  return { id: bobgoId, ...rest };
}

/** Bob Go's payment_status for our order status (the plugin's get_payment_status()). */
export function paymentStatusFor(status: string): string {
  if (["processing", "shipped", "completed"].includes(status)) return "paid";
  if (status === "on-hold") return "pending";
  if (status === "refunded") return "refunded";
  return "unpaid";
}

export type BobgoStatus = "cancelled" | "completed" | "processing";

/**
 * The Bob Go status to forward for one of our status changes on an order
 * already in Bob Go, or null to leave Bob Go alone. Cancelled, Failed and
 * Refunded cancel the Bob Go order (a refund after Completed doesn't: that
 * parcel has gone), Completed completes it, and Processing takes it back out
 * of cancelled.
 */
export function bobgoStatusFor(next: string, prev?: string): BobgoStatus | null {
  if (next === "cancelled" || next === "failed") return "cancelled";
  // Once the courier has it, a refund is between us and the customer.
  if (next === "refunded") return prev === "completed" || prev === "shipped" ? null : "cancelled";
  if (next === "completed" || next === "processing") return next;
  return null;
}

/** PATCH /orders body that moves a Bob Go order to `status` (items left as they are). */
export function orderStatusRequest(bobgoId: number, o: OrderForBobgo, status: BobgoStatus) {
  return { ...orderUpdateRequest(bobgoId, o), status };
}
