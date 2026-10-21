import { createHmac, timingSafeEqual } from "node:crypto";

// Pure rules for quotes (YITH Request a Quote, as set up on mecard.co.za):
// automatic quotes at shop prices, one "Additional Shipping" line when
// anything ships, valid for 10 days.

export const QUOTE_VALID_DAYS = 10;
export const ADDITIONAL_SHIPPING_PRODUCT = 57884;

export type QuoteItem = { productId: number; name: string; qty: number; unitPriceCents: number };

export function quoteTotals(items: QuoteItem[], discountCents = 0) {
  const subtotal = items.reduce((n, i) => n + i.unitPriceCents * i.qty, 0);
  return { subtotalCents: subtotal, discountCents: Math.min(discountCents, subtotal), totalCents: subtotal - Math.min(discountCents, subtotal) };
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
