import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { commissions, orderItems, orders, quotes, salesLinkClicks, users } from "@/db/schema";
import { PAID_STATUSES } from "./money";
import { ADDITIONAL_SHIPPING_PRODUCT } from "./quote-rules";
import { clickStillValid, commissionBase, commissionWithDiscount, creditFor, decodeClick, isSalesCode, monthRange, newSalesCode, payoutDateFor, SALES_REF_COOKIE } from "./sales-rules";

// Salespeople and commission against the database. The rules are in sales-rules.ts.

const secret = () => process.env.AUTH_SECRET || "dev-secret";
export const salesCookieSecret = secret;

const nameOf = sql<string>`coalesce(nullif(${users.displayName}, ''), ${users.email})`;

/** The salesperson's link code, made the first time they need it. */
export async function ensureSalesCode(userId: number): Promise<string | null> {
  const [u] = await db.select({ code: users.salesCode, isSales: users.isSales }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.isSales) return null;
  if (u.code) return u.code;
  for (let i = 0; i < 5; i++) {
    const code = newSalesCode();
    const taken = await db.update(users).set({ salesCode: code }).where(eq(users.id, userId)).returning({ id: users.id }).catch(() => []);
    if (taken.length) return code;
  }
  return null;
}

export async function salesUserByCode(code: string) {
  if (!isSalesCode(code)) return null;
  const [u] = await db.select({ id: users.id, isSales: users.isSales }).from(users).where(eq(users.salesCode, code)).limit(1);
  return u?.isSales ? u : null;
}

export function listSalespeople() {
  return db
    .select({ id: users.id, name: nameOf, email: users.email, code: users.salesCode, rateBps: users.commissionRateBps })
    .from(users)
    .where(eq(users.isSales, true))
    .orderBy(asc(nameOf));
}

/** A new account from a salesperson's link: the live click cookie makes it theirs. Sign-up never fails over this. */
export async function salesReferralForSignup(): Promise<{ referredBy: number; referredAt: Date } | null> {
  try {
    const click = decodeClick((await cookies()).get(SALES_REF_COOKIE)?.value, secret());
    if (!click || !clickStillValid(click)) return null;
    const [u] = await db.select({ isSales: users.isSales }).from(users).where(eq(users.id, click.salesUserId)).limit(1);
    return u?.isSales ? { referredBy: click.salesUserId, referredAt: new Date() } : null;
  } catch (e) {
    console.error("[sales] referral at sign-up", e);
    return null;
  }
}

/** Who this order credits now. Stamped on the order, and worked out again when it's paid. */
export async function attributeOrder(orderId: number) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) return null;
  const [fromQuotes, [customer]] = await Promise.all([
    db.select({ salesUserId: quotes.salesUserId }).from(quotes).where(eq(quotes.orderId, orderId)).orderBy(asc(quotes.id)),
    o.userId ? db.select({ referredBy: users.referredBy, referredAt: users.referredAt }).from(users).where(eq(users.id, o.userId)).limit(1) : Promise.resolve([]),
  ]);
  // The customer's first sale, counting this order if it's the first.
  const [first] = o.userId
    ? await db
        .select({ at: sql<Date>`min(${orders.createdAt})`.mapWith((v) => new Date(v)) })
        .from(orders)
        .where(and(eq(orders.userId, o.userId), or(eq(orders.id, orderId), inArray(orders.status, PAID_STATUSES))))
    : [];
  const candidates = [...fromQuotes.map((q) => q.salesUserId), customer?.referredBy].filter((id): id is number => !!id);
  const sales = candidates.length ? await db.select({ id: users.id }).from(users).where(and(inArray(users.id, candidates), eq(users.isSales, true))) : [];
  const credit = creditFor({
    manual: o.salesSource === "manual" ? { salesUserId: o.salesUserId } : null,
    quoteSalesUserIds: fromQuotes.map((q) => q.salesUserId),
    referredBy: customer?.referredBy ?? null,
    referredAt: customer?.referredAt ?? null,
    firstSaleAt: first?.at ?? null,
    placedAt: o.createdAt,
    customerId: o.userId,
    isSales: (id) => sales.some((s) => s.id === id),
  });
  if (credit && o.salesSource !== "manual" && (credit.salesUserId !== o.salesUserId || credit.source !== o.salesSource)) {
    await db.update(orders).set({ salesUserId: credit.salesUserId, salesSource: credit.source }).where(eq(orders.id, orderId));
  }
  return credit;
}

/** What the order earns on: items after discount, without delivery. */
async function baseCents(o: typeof orders.$inferSelect) {
  const [ship] = await db
    .select({ cents: sql<number>`coalesce(sum(${orderItems.unitPriceCents} * ${orderItems.quantity}), 0)::int` })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, o.id), eq(orderItems.productId, ADDITIONAL_SHIPPING_PRODUCT)));
  return commissionBase({ subtotalCents: o.subtotalCents, discountCents: o.discountCents, shippingLineCents: ship?.cents ?? 0 });
}

/** The commission line for a paid order, at the salesperson's rate today. */
async function commissionValues(o: typeof orders.$inferSelect, salesUserId: number, source: string) {
  const [u] = await db.select({ rate: users.commissionRateBps }).from(users).where(eq(users.id, salesUserId)).limit(1);
  const rateBps = u?.rate ?? 0;
  const netBaseCents = await baseCents(o);
  // Only this salesperson's own discount comes off, not one from staff or a coupon.
  const [own] = await db
    .select({ cents: sql<number>`coalesce(sum(${quotes.salesDiscountCents}), 0)::int` })
    .from(quotes)
    .where(and(eq(quotes.orderId, o.id), eq(quotes.salesUserId, salesUserId)));
  const salesDiscountCents = Math.min(own?.cents ?? 0, o.discountCents);
  const earnedAt = o.paidAt ?? new Date();
  return { salesUserId, orderId: o.id, source, rateBps, ...commissionWithDiscount({ netBaseCents, salesDiscountCents, rateBps }), earnedAt, payoutDate: payoutDateFor(earnedAt) };
}

/** A paid order's commission. Idempotent, and a problem here never stops a payment going through. */
export async function recordCommission(orderId: number): Promise<void> {
  try {
    const credit = await attributeOrder(orderId);
    if (!credit) return;
    const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!o) return;
    const [line] = await db.select().from(commissions).where(and(eq(commissions.orderId, orderId), isNull(commissions.reversesId))).limit(1);
    if (line) {
      // Cancelled, then paid after all: the commission stands again.
      if (line.status === "reversed") await db.update(commissions).set({ status: "due" }).where(eq(commissions.id, line.id));
      else await db.delete(commissions).where(and(eq(commissions.reversesId, line.id), eq(commissions.status, "due")));
      return;
    }
    const values = await commissionValues(o, credit.salesUserId, credit.source);
    if (values.baseCents > 0) await db.insert(commissions).values(values).onConflictDoNothing();
  } catch (e) {
    console.error(`[sales] commission for order ${orderId}`, e);
  }
}

/** A cancelled or refunded order: unpaid commission falls away, paid-out commission is taken back from the next payout. */
export async function reverseCommission(orderId: number): Promise<void> {
  try {
    const [line] = await db.select().from(commissions).where(and(eq(commissions.orderId, orderId), isNull(commissions.reversesId))).limit(1);
    if (!line || line.status === "reversed") return;
    if (line.status === "due") {
      await db.update(commissions).set({ status: "reversed" }).where(eq(commissions.id, line.id));
      return;
    }
    const [already] = await db.select({ id: commissions.id }).from(commissions).where(eq(commissions.reversesId, line.id)).limit(1);
    if (already) return;
    await db.insert(commissions).values({
      salesUserId: line.salesUserId,
      orderId,
      source: line.source,
      baseCents: -line.baseCents,
      discountOffCents: -line.discountOffCents,
      rateBps: line.rateBps,
      amountCents: -line.amountCents,
      earnedAt: new Date(),
      payoutDate: payoutDateFor(new Date()),
      reversesId: line.id,
    });
  } catch (e) {
    console.error(`[sales] reversing commission for order ${orderId}`, e);
  }
}

/** Staff set or clear the salesperson on an order. A commission already paid out can't be moved. */
export async function setOrderSalesperson(orderId: number, salesUserId: number | null): Promise<string | null> {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) return "Order not found.";
  const [line] = await db.select().from(commissions).where(and(eq(commissions.orderId, orderId), isNull(commissions.reversesId))).limit(1);
  if (line?.status === "paid") return "This order's commission has already been paid out.";
  await db.update(orders).set({ salesUserId, salesSource: "manual" }).where(eq(orders.id, orderId));
  if (line) await db.delete(commissions).where(eq(commissions.id, line.id));
  if (salesUserId && PAID_STATUSES.includes(o.status)) {
    const values = await commissionValues(o, salesUserId, "manual");
    if (values.baseCents > 0) await db.insert(commissions).values(values);
  }
  return null;
}

/** What each salesperson is owed in a payout run, with anything left over from earlier runs. */
export function payoutRun(payoutDate: string) {
  return db
    .select({ salesUserId: commissions.salesUserId, name: nameOf, cents: sql<number>`sum(${commissions.amountCents})::int` })
    .from(commissions)
    .leftJoin(users, eq(users.id, commissions.salesUserId))
    .where(and(eq(commissions.status, "due"), lte(commissions.payoutDate, payoutDate)))
    .groupBy(commissions.salesUserId, users.displayName, users.email)
    .orderBy(asc(nameOf));
}

/** A salesperson's run marked paid, as it stood at `through`. Returns the total, or null if nothing is owed. */
export async function payCommissions(salesUserId: number, payoutDate: string, through: Date, ref: string, by: number): Promise<number | null> {
  const where = and(eq(commissions.salesUserId, salesUserId), eq(commissions.status, "due"), lte(commissions.payoutDate, payoutDate), lt(commissions.createdAt, through));
  const [{ cents }] = await db.select({ cents: sql<number>`coalesce(sum(${commissions.amountCents}), 0)::int` }).from(commissions).where(where);
  if (cents <= 0) return null;
  await db.update(commissions).set({ status: "paid", paidAt: new Date(), paidRef: ref, paidBy: by }).where(where);
  return cents;
}

export type SalesRow = {
  id: number;
  name: string;
  rateBps: number;
  clicks: number;
  signups: number;
  linkOrders: number;
  quotesSent: number;
  quotesAccepted: number;
  quoteOrders: number;
  salesCents: number;
  earnedCents: number;
  paidCents: number;
  dueCents: number;
};

type Counted = { id: number | null; n: number };
const toMap = (rows: Counted[]) => new Map(rows.filter((r) => r.id).map((r) => [r.id as number, Number(r.n)]));

/**
 * One row per salesperson for a month. Each step counts in the month it
 * happened: clicks, sign-ups, quotes sent and accepted, then orders and
 * commission in the month paid. What's still due is the balance today.
 */
export async function salesReport(month: string, salesUserId?: number): Promise<SalesRow[]> {
  const { start, end } = monthRange(month);
  const people = (await listSalespeople()).filter((p) => !salesUserId || p.id === salesUserId);
  if (!people.length) return [];
  const ids = people.map((p) => p.id);
  const n = sql<number>`count(*)::int`;
  const orderCount = (source: SQL) =>
    db
      .select({ id: commissions.salesUserId, n })
      .from(commissions)
      .where(and(inArray(commissions.salesUserId, ids), isNull(commissions.reversesId), ne(commissions.status, "reversed"), gte(commissions.earnedAt, start), lt(commissions.earnedAt, end), source))
      .groupBy(commissions.salesUserId);

  const [clicks, signups, sent, accepted, linkOrders, quoteOrders, money, paid, due] = await Promise.all([
    db.select({ id: salesLinkClicks.salesUserId, n }).from(salesLinkClicks).where(and(inArray(salesLinkClicks.salesUserId, ids), gte(salesLinkClicks.createdAt, start), lt(salesLinkClicks.createdAt, end))).groupBy(salesLinkClicks.salesUserId),
    db.select({ id: users.referredBy, n }).from(users).where(and(inArray(users.referredBy, ids), gte(users.referredAt, start), lt(users.referredAt, end))).groupBy(users.referredBy),
    db.select({ id: quotes.salesUserId, n }).from(quotes).where(and(inArray(quotes.salesUserId, ids), gte(quotes.sentAt, start), lt(quotes.sentAt, end))).groupBy(quotes.salesUserId),
    db.select({ id: quotes.salesUserId, n }).from(quotes).where(and(inArray(quotes.salesUserId, ids), gte(quotes.acceptedAt, start), lt(quotes.acceptedAt, end))).groupBy(quotes.salesUserId),
    orderCount(sql`${commissions.source} <> 'quote'`),
    orderCount(eq(commissions.source, "quote")),
    db
      .select({ id: commissions.salesUserId, base: sql<number>`coalesce(sum(${commissions.baseCents}), 0)::int`, amount: sql<number>`coalesce(sum(${commissions.amountCents}), 0)::int` })
      .from(commissions)
      .where(and(inArray(commissions.salesUserId, ids), ne(commissions.status, "reversed"), gte(commissions.earnedAt, start), lt(commissions.earnedAt, end)))
      .groupBy(commissions.salesUserId),
    db
      .select({ id: commissions.salesUserId, n: sql<number>`coalesce(sum(${commissions.amountCents}), 0)::int` })
      .from(commissions)
      .where(and(inArray(commissions.salesUserId, ids), eq(commissions.status, "paid"), gte(commissions.paidAt, start), lt(commissions.paidAt, end)))
      .groupBy(commissions.salesUserId),
    db
      .select({ id: commissions.salesUserId, n: sql<number>`coalesce(sum(${commissions.amountCents}), 0)::int` })
      .from(commissions)
      .where(and(inArray(commissions.salesUserId, ids), eq(commissions.status, "due")))
      .groupBy(commissions.salesUserId),
  ]);
  const [mClicks, mSignups, mSent, mAccepted, mLink, mQuote, mPaid, mDue] = [clicks, signups, sent, accepted, linkOrders, quoteOrders, paid, due].map(toMap);
  const mMoney = new Map(money.map((m) => [m.id, m]));
  return people.map((p) => ({
    id: p.id,
    name: p.name,
    rateBps: p.rateBps,
    clicks: mClicks.get(p.id) ?? 0,
    signups: mSignups.get(p.id) ?? 0,
    linkOrders: mLink.get(p.id) ?? 0,
    quotesSent: mSent.get(p.id) ?? 0,
    quotesAccepted: mAccepted.get(p.id) ?? 0,
    quoteOrders: mQuote.get(p.id) ?? 0,
    salesCents: Number(mMoney.get(p.id)?.base ?? 0),
    earnedCents: Number(mMoney.get(p.id)?.amount ?? 0),
    paidCents: mPaid.get(p.id) ?? 0,
    dueCents: mDue.get(p.id) ?? 0,
  }));
}

/** The sales behind a month's figures, newest first. */
export function commissionLines(month: string, salesUserId?: number) {
  const { start, end } = monthRange(month);
  const customer = sql<string>`coalesce(nullif(trim(${orders.billingFirstName} || ' ' || ${orders.billingLastName}), ''), ${orders.billingEmail})`;
  return db
    .select({ c: commissions, customer, company: orders.billingCompany, salesperson: nameOf })
    .from(commissions)
    .innerJoin(orders, eq(orders.id, commissions.orderId))
    .leftJoin(users, eq(users.id, commissions.salesUserId))
    .where(and(gte(commissions.earnedAt, start), lt(commissions.earnedAt, end), salesUserId ? eq(commissions.salesUserId, salesUserId) : undefined))
    .orderBy(desc(commissions.earnedAt), desc(commissions.id));
}

/** The order page's salesperson card. */
export async function orderCommission(orderId: number) {
  const [row] = await db.select().from(commissions).where(and(eq(commissions.orderId, orderId), isNull(commissions.reversesId))).limit(1);
  return row ?? null;
}
