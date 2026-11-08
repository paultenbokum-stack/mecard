import { createHmac, timingSafeEqual } from "node:crypto";
import { lineDiscountCents, type QuoteItem } from "./quote-lines";

// Pure rules for quotes (YITH Request a Quote, as set up on mecard.co.za):
// automatic quotes at shop prices, one "Additional Shipping" line when
// anything ships, valid for 10 days.

export const QUOTE_VALID_DAYS = 10;
export const ADDITIONAL_SHIPPING_PRODUCT = 57884;

export { lineDiscountCents, type QuoteItem };

const lineCents = (i: QuoteItem) => i.unitPriceCents * i.qty;

/** The price a line shows before its discount. */
export const linePriceShown = (i: QuoteItem) => (lineDiscountCents(i) ? (i.regularPriceCents as number) : i.unitPriceCents);

/**
 * A quote's parts as customers read them: products, then the discount, then shipping.
 * Shipping stays a line in quotes.items, so it reaches the basket and checkout as before.
 */
export function quoteParts<T extends QuoteItem>(items: T[]) {
  const products = items.filter((i) => i.productId !== ADDITIONAL_SHIPPING_PRODUCT);
  const shippingLines = items.filter((i) => i.productId === ADDITIONAL_SHIPPING_PRODUCT);
  return {
    products,
    productsCents: products.reduce((n, i) => n + lineCents(i), 0),
    shippingLine: shippingLines[0] ?? null,
    shippingCents: shippingLines.reduce((n, i) => n + lineCents(i), 0),
    hasLineDiscount: products.some((i) => lineDiscountCents(i) > 0),
  };
}

/** subtotalCents includes shipping, as the basket does. The discount comes off the products only. */
export function quoteTotals(items: QuoteItem[], discountCents = 0) {
  const { productsCents, shippingCents } = quoteParts(items);
  const discount = Math.min(discountCents, productsCents);
  return { subtotalCents: productsCents + shippingCents, discountCents: discount, totalCents: productsCents + shippingCents - discount };
}

/** Quotes past their expiry date show (and act) as expired, even before anything updates the row. */
export function effectiveStatus(q: { status: string; expiresAt: Date | null }, now = new Date()): string {
  if ((q.status === "sent" || q.status === "new") && q.expiresAt && q.expiresAt.getTime() < now.getTime()) return "expired";
  return q.status;
}

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  new: "New",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

const secret = () => process.env.AUTH_SECRET || "dev-secret";

/** The secret part of a quote link (/quote/<id>/<token>/), tied to the quote and its email. */
export function quoteToken(quoteId: number, email: string): string {
  return createHmac("sha256", secret()).update(`quote:${quoteId}:${email.toLowerCase()}`).digest("base64url").slice(0, 32);
}

export function verifyQuoteToken(quoteId: number, email: string, token: string): boolean {
  const a = Buffer.from(quoteToken(quoteId, email));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

type OrderAddress = { address1: string; address2: string; city: string; province: string; postcode: string; country: string };

/**
 * A quote staff start from a customer's account: their name, email and phone,
 * falling back to their latest order's billing details; the company (the one
 * asked for, else the order's billing company) and its VAT number; and the
 * latest order's billing address.
 */
export function quotePrefill(
  user: { email: string; firstName: string; lastName: string; displayName: string; phone: string },
  order?: ({ billingFirstName: string; billingLastName: string; billingEmail: string; billingPhone: string; billingCompany: string } & Partial<OrderAddress>) | null,
  company?: { name: string; phone: string; vatNumber?: string } | null,
) {
  const name = `${user.firstName} ${user.lastName}`.trim() || user.displayName.trim() || `${order?.billingFirstName ?? ""} ${order?.billingLastName ?? ""}`.trim();
  return {
    name: name.slice(0, 200),
    email: user.email || order?.billingEmail || "",
    phone: (user.phone.trim() || order?.billingPhone.trim() || company?.phone.trim() || "").slice(0, 50),
    company: (company?.name.trim() || order?.billingCompany.trim() || "").slice(0, 255),
    vatNumber: (company?.vatNumber ?? "").trim().slice(0, 30),
    address1: (order?.address1 ?? "").trim().slice(0, 255),
    address2: (order?.address2 ?? "").trim().slice(0, 255),
    city: (order?.city ?? "").trim().slice(0, 100),
    province: (order?.province ?? "").trim().slice(0, 100),
    postcode: (order?.postcode ?? "").trim().slice(0, 20),
    country: order?.address1?.trim() ? (order.country ?? "").trim().slice(0, 2) : "",
  };
}

const COUNTRY_NAME: Record<string, string> = { ZA: "South Africa" };

/** The customer's VAT number and billing address as the quote prints them, one line each. */
export function quoteBillingLines(q: { vatNumber: string } & OrderAddress): string[] {
  const place = [q.city, q.postcode].filter(Boolean).join(" ");
  return [
    q.address1,
    q.address2,
    place,
    q.province,
    q.country ? (COUNTRY_NAME[q.country] ?? q.country) : "",
    q.vatNumber ? `VAT number: ${q.vatNumber}` : "",
  ].map((l) => l.trim()).filter(Boolean);
}
