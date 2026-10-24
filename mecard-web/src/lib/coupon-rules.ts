// Coupon validation and discount maths (WooCommerce rules, error messages
// worded as WooCommerce shows them). Pure, so it can be unit tested.
import { rands } from "./money";

export type CouponRule = {
  code: string;
  discountType: string; // "percent" | "fixed_cart"
  amount: number; // percent, or cents for fixed_cart
  freeShipping: boolean;
  minSpendCents: number | null;
  productIds: number[];
  // Empty = any customer
  allowedUserIds?: number[];
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  expiresAt: Date | null;
  active: boolean;
};

export type CouponLine = { productId: number; lineCents: number };

export type CouponResult = { ok: true; code: string; discountCents: number; freeShipping: boolean } | { ok: false; error: string };

export function evaluateCoupon(
  coupon: CouponRule | null,
  ctx: { code: string; lines: CouponLine[]; usage: number; userUsage: number; userId?: number | null; now?: Date },
): CouponResult {
  if (!coupon || !coupon.active) return { ok: false, error: `Coupon "${ctx.code}" does not exist!` };
  const now = ctx.now ?? new Date();
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return { ok: false, error: "This coupon has expired." };
  if (coupon.allowedUserIds?.length && !(ctx.userId && coupon.allowedUserIds.includes(ctx.userId))) {
    return { ok: false, error: "Sorry, it seems this coupon is not yours." };
  }
  if (coupon.usageLimit !== null && ctx.usage >= coupon.usageLimit) return { ok: false, error: "Coupon usage limit has been reached." };
  if (coupon.usageLimitPerUser !== null && ctx.userUsage >= coupon.usageLimitPerUser) {
    return { ok: false, error: "Coupon usage limit has been reached." };
  }
  const subtotal = ctx.lines.reduce((n, l) => n + l.lineCents, 0);
  if (coupon.minSpendCents !== null && subtotal < coupon.minSpendCents) {
    return { ok: false, error: `The minimum spend for this coupon is ${rands(coupon.minSpendCents)}.` };
  }
  const eligible = coupon.productIds.length ? ctx.lines.filter((l) => coupon.productIds.includes(l.productId)) : ctx.lines;
  if (!eligible.length) return { ok: false, error: "Sorry, this coupon is not applicable to selected products." };
  const base = eligible.reduce((n, l) => n + l.lineCents, 0);

  let discountCents = 0;
  if (coupon.discountType === "percent") discountCents = Math.round((base * Math.min(Math.max(coupon.amount, 0), 100)) / 100);
  else if (coupon.discountType === "fixed_cart") discountCents = Math.min(Math.max(coupon.amount, 0), base);
  return { ok: true, code: coupon.code, discountCents, freeShipping: coupon.freeShipping };
}

export function describeCoupon(c: Pick<CouponRule, "discountType" | "amount" | "freeShipping">): string {
  const parts = [];
  if (c.amount > 0) parts.push(c.discountType === "percent" ? `${c.amount}% off` : `${rands(c.amount)} off`);
  if (c.freeShipping) parts.push("free shipping");
  return parts.join(" + ") || "no discount";
}

/** Codes are matched case-insensitively and without surrounding spaces, like WooCommerce. */
export const normalizeCode = (code: string) => code.trim().toLowerCase();

/** For the admin list: why a coupon can't be used right now, if it can't. */
export function couponState(c: Pick<CouponRule, "active" | "expiresAt" | "usageLimit">, usage: number, now = new Date()) {
  if (!c.active) return "inactive" as const;
  if (c.expiresAt && c.expiresAt.getTime() <= now.getTime()) return "expired" as const;
  if (c.usageLimit !== null && usage >= c.usageLimit) return "used-up" as const;
  return "active" as const;
}

/**
 * Of the auto-apply coupons the basket qualifies for, the one worth most to the
 * customer: biggest discount, then free shipping (valued at the shipping fee).
 */
export function bestAutoCoupon(results: CouponResult[], shippingCents: number) {
  const value = (r: Extract<CouponResult, { ok: true }>) => r.discountCents + (r.freeShipping ? shippingCents : 0);
  return results
    .filter((r): r is Extract<CouponResult, { ok: true }> => r.ok)
    .filter((r) => value(r) > 0)
    .sort((a, b) => value(b) - value(a))[0];
}
