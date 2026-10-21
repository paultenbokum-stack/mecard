import "server-only";
import type { DeliveryAddress, ShipLine } from "@/lib/bobgo-rules";
import { addressComplete } from "@/lib/bobgo-rules";
import { bobgoEnabled, checkoutRates } from "@/lib/bobgo";
import { isVirtual } from "@/lib/catalog";
import type { CouponResult } from "@/lib/coupon-rules";
import { PICKUP_METHOD, SHIPPING_METHODS } from "@/lib/shipping";

export type ShippingOption = { id: string; label: string; cents: number; note?: string; serviceCode?: string };

type Line = { productId: number; qty: number; product: { name: string; priceCents: number } };

/** Only Pro upgrades in the basket: nothing to deliver (mecard_force_no_shipping_for_profile_upgrades). */
export const NO_SHIPPING: ShippingOption = { id: "none", label: "No delivery needed", cents: 0 };
export const needsShipping = (lines: Pick<Line, "productId">[]) => lines.some((l) => !isVirtual(l.productId));

/**
 * The delivery options for this basket and address. With Bob Go set up these
 * are its rates at checkout (once the address is complete) plus local pickup;
 * otherwise the fixed methods in shipping.ts. A free-shipping coupon makes
 * delivery free, like the live "Free shipping" method that needs a coupon.
 * Checkout shows these, and placing the order looks the choice up again here,
 * so the price can't be changed in the browser.
 */
export async function shippingOptions(
  address: DeliveryAddress | null,
  lines: Line[],
  coupon: CouponResult | null,
): Promise<{ live: boolean; options: ShippingOption[] }> {
  if (!needsShipping(lines)) return { live: false, options: [NO_SHIPPING] };
  const freeShipping = !!(coupon?.ok && coupon.freeShipping);
  const pickup: ShippingOption = { id: PICKUP_METHOD.id, label: PICKUP_METHOD.label, cents: 0, note: PICKUP_METHOD.note };
  if (freeShipping) return { live: bobgoEnabled(), options: [{ id: "free", label: "Free shipping", cents: 0 }, pickup] };
  if (!bobgoEnabled()) return { live: false, options: SHIPPING_METHODS.map((m) => ({ id: m.id, label: m.label, cents: m.cents, note: m.note })) };
  if (!address || !addressComplete(address)) return { live: true, options: [pickup] };

  const ship: ShipLine[] = lines
    .filter((l) => !isVirtual(l.productId))
    .map((l) => ({ productId: l.productId, name: l.product.name, qty: l.qty, unitPriceCents: l.product.priceCents }));
  const goods = ship.reduce((n, l) => n + l.unitPriceCents * l.qty, 0) - (coupon?.ok ? coupon.discountCents : 0);
  const rates = await checkoutRates(address, ship, Math.max(0, goods));
  if (!rates.length) return { live: true, options: [pickup] };
  return {
    live: true,
    options: [
      ...rates.map((r) => ({ id: `bobgo:${r.serviceCode}`, label: r.label, cents: r.cents, note: r.description || undefined, serviceCode: r.serviceCode })),
      pickup,
    ],
  };
}

/** The address fields as posted by the checkout form. */
export function addressFromForm(get: (k: string) => string): DeliveryAddress {
  return {
    company: get("billing_company"),
    street: [get("billing_address_1"), get("billing_address_2")].filter(Boolean).join(", "),
    suburb: get("billing_suburb"),
    city: get("billing_city"),
    province: get("billing_state"),
    postcode: get("billing_postcode"),
  };
}
