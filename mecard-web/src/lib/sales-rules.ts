import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Salespeople and commission, the rules without the database (plain functions, tested).
//   click     /r/<code>/ counts once per visitor and leaves a signed cookie for 7 days
//             (the first salesperson clicked keeps it; their own new click restarts it)
//   sign-up   a new account within those 7 days is theirs: users.referred_by
//   order     through a salesperson's quote: that salesperson; otherwise whoever referred
//             the customer, if the first sale came within 1 month of sign-up and this
//             order within 12 months. One salesperson per order.
//   paid      the commission is written: a percentage of sales excluding shipping,
//             less any discount the salesperson gave on their quote,
//             paid out on the 25th for orders paid up to the 20th
//   reversed  a cancelled or refunded order takes it back (paid out already: a negative row)

export const SALES_REF_COOKIE = "mecard_sales_ref";
export const SALES_VISITOR_COOKIE = "mecard_vid";
export const SIGNUP_DAYS = 7;
export const FIRST_SALE_MONTHS = 1;
export const REFERRAL_MONTHS = 12;
export const PAYOUT_DAY = 25;
export const PAYOUT_CUTOFF_DAY = 20;
export const DEFAULT_RATE_BPS = 2000;

const DAY = 864e5;
const SAST = 2 * 60 * 60 * 1000; // Africa/Johannesburg, UTC+2, no daylight saving.

// ── Codes ────────────────────────────────────────────────────────────────────
const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // No 0/o/1/l/i: safe to read aloud.

export const isSalesCode = (code: string) => /^[a-z0-9]{4,16}$/.test(code);

export function newSalesCode(): string {
  return Array.from(randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

// ── The click cookie, signed so it can't be edited to credit someone else ────
const sign = (payload: string, secret: string) => createHmac("sha256", `sales-ref:${secret}`).update(payload).digest("base64url").slice(0, 22);

export type Click = { salesUserId: number; clickedAt: Date };

export function encodeClick(c: Click, secret: string): string {
  const payload = `${c.salesUserId}.${c.clickedAt.getTime()}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeClick(value: string | null | undefined, secret: string): Click | null {
  const parts = (value ?? "").split(".");
  if (parts.length !== 3) return null;
  const [id, ms, mac] = parts;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(`${id}.${ms}`, secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const salesUserId = Number(id);
  const t = Number(ms);
  if (!Number.isInteger(salesUserId) || salesUserId <= 0 || !Number.isFinite(t)) return null;
  return { salesUserId, clickedAt: new Date(t) };
}

export function clickStillValid(c: Click, now = new Date()): boolean {
  const age = now.getTime() - c.clickedAt.getTime();
  return age >= 0 && age <= SIGNUP_DAYS * DAY;
}

/** The first salesperson clicked keeps the visitor; only an expired click, or their own, is replaced. */
export function keepsExistingClick(existing: Click | null, salesUserId: number, now = new Date()): boolean {
  return !!existing && existing.salesUserId !== salesUserId && clickStillValid(existing, now);
}

// Link previews (WhatsApp pasting a link, Facebook, Slack...) and scripts are not clicks.
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|twitter|slack|linkedin|discord|skype|preview|embedly|pinterest|vkshare|google-|headless|lighthouse|curl|wget|python|httpclient|okhttp|axios|node-fetch|go-http/i;

export const isBot = (userAgent: string | null) => !userAgent || BOT.test(userAgent);

// ── Who an order credits ─────────────────────────────────────────────────────
function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export const referralEnds = (referredAt: Date) => addMonths(referredAt, REFERRAL_MONTHS);
export const firstSaleDeadline = (referredAt: Date) => addMonths(referredAt, FIRST_SALE_MONTHS);

export type Credit = { salesUserId: number; source: "quote" | "link" | "manual" };

export function creditFor(o: {
  /** What staff chose on the order, if they did (a null salesUserId means nobody). */
  manual: { salesUserId: number | null } | null;
  /** The salespeople of the quotes this order came from, oldest quote first. */
  quoteSalesUserIds: (number | null)[];
  referredBy: number | null;
  referredAt: Date | null;
  /** When the customer's first sale was placed, counting this order. */
  firstSaleAt: Date | null;
  placedAt: Date;
  customerId: number | null;
  /** Who can still earn: taking someone's sales role away stops new commission. */
  isSales: (userId: number) => boolean;
}): Credit | null {
  if (o.manual) return o.manual.salesUserId ? { salesUserId: o.manual.salesUserId, source: "manual" } : null;
  const earns = (id: number | null): id is number => !!id && id !== o.customerId && o.isSales(id);
  const quote = o.quoteSalesUserIds.find(earns);
  if (quote) return { salesUserId: quote, source: "quote" };
  const firstSaleInTime = !!o.referredAt && !!o.firstSaleAt && o.firstSaleAt < firstSaleDeadline(o.referredAt);
  if (earns(o.referredBy) && o.referredAt && firstSaleInTime && o.placedAt >= o.referredAt && o.placedAt < referralEnds(o.referredAt)) {
    return { salesUserId: o.referredBy, source: "link" };
  }
  return null;
}

// ── Money ────────────────────────────────────────────────────────────────────
/**
 * Sales excluding shipping: the items after discount, without delivery. Delivery
 * is either orders.shippingCents, which isn't in the subtotal, or the Additional
 * Shipping line a quote carries, which is.
 */
export function commissionBase(o: { subtotalCents: number; discountCents: number; shippingLineCents: number }): number {
  return Math.max(0, o.subtotalCents - o.shippingLineCents - o.discountCents);
}

export const commissionFor = (baseCents: number, rateBps: number) => Math.round((baseCents * rateBps) / 10000);

/**
 * A salesperson's own discount comes out of their commission: they earn on the sale
 * before it, less all of it, so MeCard nets the same as with no discount. Never below zero.
 */
export function commissionWithDiscount(o: { netBaseCents: number; salesDiscountCents: number; rateBps: number }) {
  const baseCents = o.netBaseCents + o.salesDiscountCents;
  return { baseCents, discountOffCents: o.salesDiscountCents, amountCents: Math.max(0, commissionFor(baseCents, o.rateBps) - o.salesDiscountCents) };
}

/** The run a payment falls in: the 25th of the same month up to and including the 20th (South African time), else of the next. */
export function payoutDateFor(paidAt: Date): string {
  const local = new Date(paidAt.getTime() + SAST);
  const next = local.getUTCDate() > PAYOUT_CUTOFF_DAY ? 1 : 0;
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + next, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${PAYOUT_DAY}`;
}

/** A run can be paid once its last day, the 20th, is over. */
export function payoutClosed(payoutDate: string, now = new Date()): boolean {
  const cutoff = Date.parse(`${payoutDate.slice(0, 8)}${PAYOUT_CUTOFF_DAY}T23:59:59.999+02:00`);
  return now.getTime() > cutoff;
}

export const bpsToPercent = (bps: number) => String(bps / 100);

/** "12.5" or "12.5%" typed by staff → basis points, or null when it isn't 0 to 100. */
export function percentToBps(v: string): number | null {
  const t = v.trim().replace(/%$/, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const bps = Math.round(Number(t) * 100);
  return bps <= 10000 ? bps : null;
}

// ── Report months, in South African time ─────────────────────────────────────
export function currentMonth(now = new Date()): string {
  const d = new Date(now.getTime() + SAST);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const isMonth = (v: string | undefined): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1) - SAST), end: new Date(Date.UTC(y, m, 1) - SAST) };
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
}

export const COMMISSION_SOURCE_LABEL: Record<string, string> = { quote: "Quote", link: "Link", manual: "Set by staff" };
export const COMMISSION_STATUS_LABEL: Record<string, string> = { due: "Due", paid: "Paid", reversed: "Reversed" };
