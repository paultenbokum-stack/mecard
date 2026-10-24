import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { coupons, orders } from "@/db/schema";
import { type CouponLine, type CouponResult, evaluateCoupon, normalizeCode } from "@/lib/coupon-rules";

// WooCommerce coupons: the code applied in the basket is kept on the basket
// (carts.coupon_code) and checked again at checkout.

export async function findCoupon(code: string) {
  const [c] = await db
    .select()
    .from(coupons)
    .where(sql`lower(${coupons.code}) = ${normalizeCode(code)}`)
    .limit(1);
  return c ?? null;
}

// Imported WooCommerce orders can hold several codes ("a, b"), hence the list match.
export const ordersUsingCode = (code: string) =>
  sql`',' || replace(lower(${orders.couponCode}), ' ', '') || ',' like ${"%," + normalizeCode(code).replace(/[%_\\]/g, "\\$&") + ",%"}`;
const counted = sql`${orders.status} not in ('cancelled', 'failed')`;

/** Orders that used the code (not cancelled or failed), in total and by this user. */
export async function couponUsage(code: string, userId: number | null) {
  const [row] = await db
    .select({
      usage: sql<number>`count(*)::int`,
      userUsage: sql<number>`count(*) filter (where ${orders.userId} = ${userId ?? -1})::int`,
    })
    .from(orders)
    .where(sql`${ordersUsingCode(code)} and ${counted}`);
  return row ?? { usage: 0, userUsage: 0 };
}

/** Checks a code against the basket lines for this user. */
export async function couponForLines(code: string, lines: CouponLine[], userId: number | null): Promise<CouponResult> {
  const coupon = await findCoupon(code);
  const { usage, userUsage } = coupon ? await couponUsage(coupon.code, userId) : { usage: 0, userUsage: 0 };
  return evaluateCoupon(coupon, { code: code.trim(), lines, usage, userUsage, userId });
}
