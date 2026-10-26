// Editing an order's items, discount and shipping from the staff order screen
// (WooCommerce's editable order: add and remove items, change quantities,
// apply a coupon, recalculate). Pure, so it can be unit tested.
import { randsToCents } from "./money";

/** WooCommerce only lets staff edit an order before it is paid; here, EFT orders on hold. */
export const isEditableOrder = (status: string) => status === "on-hold";

/** Imported WooCommerce orders can hold several codes ("a, b"). */
export const couponCodesOf = (couponCode: string) =>
  couponCode
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

/**
 * The order's discount is the coupon's (recalculated from the items) plus any
 * other discount: staff's own, or a quote's. The other part is what is left of
 * the stored discount once the coupon's share of it is taken off.
 */
export const otherDiscountOf = (discountCents: number, couponCents: number) => Math.max(0, discountCents - couponCents);

export function orderTotals(t: { lineCents: number[]; couponCents: number; otherCents: number; shippingCents: number }) {
  const subtotalCents = t.lineCents.reduce((n, c) => n + c, 0);
  const discountCents = Math.min(subtotalCents, Math.max(0, t.couponCents) + Math.max(0, t.otherCents));
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents + Math.max(0, t.shippingCents) };
}

/** "10%" of the subtotal, or an amount ("R50", "49.50"); "" is no discount; anything else is NaN. */
export function parseDiscount(input: string, subtotalCents: number): number {
  const t = input.trim();
  if (!t) return 0;
  const pct = /^(\d+(?:\.\d+)?)\s*%$/.exec(t);
  if (pct) return Number(pct[1]) <= 100 ? Math.round((subtotalCents * Number(pct[1])) / 100) : NaN;
  return randsToCents(t) ?? 0;
}

/** A quantity typed by staff: a whole number from 0 (remove) to 999. */
export function parseQty(v: string): number {
  const t = v.trim();
  return /^\d{1,3}$/.test(t) ? Number(t) : NaN;
}

/** Of a line's cards of one type (oldest first), which to keep and how many to add for the quantity; the newest go first. */
export function cardsForQty<T>(ofType: T[], qty: number): { keep: T[]; archive: T[]; add: number } {
  return { keep: ofType.slice(0, qty), archive: ofType.slice(qty), add: Math.max(0, qty - ofType.length) };
}
