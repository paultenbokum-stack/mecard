import { test } from "node:test";
import assert from "node:assert/strict";
import { bestAutoCoupon, type CouponRule, describeCoupon, evaluateCoupon } from "./coupon-rules";

const base: CouponRule = {
  code: "SPRING10",
  discountType: "percent",
  amount: 10,
  freeShipping: false,
  minSpendCents: null,
  productIds: [],
  usageLimit: null,
  usageLimitPerUser: null,
  expiresAt: null,
  active: true,
};
const lines = [
  { productId: 1, lineCents: 29950 },
  { productId: 2, lineCents: 10000 },
];
const ctx = { code: "spring10", lines, usage: 0, userUsage: 0, now: new Date("2026-10-18T10:00:00Z") };

test("percentage off the whole basket, rounded to the cent", () => {
  assert.deepEqual(evaluateCoupon(base, ctx), { ok: true, code: "SPRING10", discountCents: 3995, freeShipping: false });
});

test("fixed discount never goes below zero", () => {
  const r = evaluateCoupon({ ...base, discountType: "fixed_cart", amount: 100000 }, ctx);
  assert.equal(r.ok && r.discountCents, 39950);
});

test("product restriction discounts only those lines", () => {
  const r = evaluateCoupon({ ...base, productIds: [2] }, ctx);
  assert.equal(r.ok && r.discountCents, 1000);
  assert.deepEqual(evaluateCoupon({ ...base, productIds: [9] }, ctx), {
    ok: false,
    error: "Sorry, this coupon is not applicable to selected products.",
  });
});

test("unknown, inactive, expired, used up and under minimum spend are rejected", () => {
  assert.deepEqual(evaluateCoupon(null, ctx), { ok: false, error: 'Coupon "spring10" does not exist!' });
  assert.equal(evaluateCoupon({ ...base, active: false }, ctx).ok, false);
  assert.deepEqual(evaluateCoupon({ ...base, expiresAt: new Date("2026-10-17T21:59:59Z") }, ctx), {
    ok: false,
    error: "This coupon has expired.",
  });
  assert.equal(evaluateCoupon({ ...base, expiresAt: new Date("2026-10-18T21:59:59Z") }, ctx).ok, true);
  assert.equal(evaluateCoupon({ ...base, usageLimit: 5 }, { ...ctx, usage: 5 }).ok, false);
  assert.equal(evaluateCoupon({ ...base, usageLimitPerUser: 1 }, { ...ctx, usage: 3, userUsage: 1 }).ok, false);
  assert.deepEqual(evaluateCoupon({ ...base, minSpendCents: 50000 }, ctx), {
    ok: false,
    error: "The minimum spend for this coupon is R500.00.",
  });
});

test("free-shipping-only coupons and descriptions", () => {
  const ship = { ...base, amount: 0, freeShipping: true };
  assert.deepEqual(evaluateCoupon(ship, ctx), { ok: true, code: "SPRING10", discountCents: 0, freeShipping: true });
  assert.equal(describeCoupon(ship), "free shipping");
  assert.equal(describeCoupon({ discountType: "fixed_cart", amount: 5000, freeShipping: true }), "R50.00 off + free shipping");
});

test("allowed accounts: only those users, and never a logged-out visitor", () => {
  const mine = { ...base, allowedUserIds: [7, 9] };
  assert.equal(evaluateCoupon(mine, { ...ctx, userId: 9 }).ok, true);
  assert.deepEqual(evaluateCoupon(mine, { ...ctx, userId: 8 }), { ok: false, error: "Sorry, it seems this coupon is not yours." });
  assert.equal(evaluateCoupon(mine, { ...ctx, userId: null }).ok, false);
  assert.equal(evaluateCoupon({ ...base, allowedUserIds: [] }, { ...ctx, userId: null }).ok, true);
});

test("bestAutoCoupon picks the most valuable qualifying coupon", () => {
  const r = (code: string, discountCents: number, freeShipping = false) => ({ ok: true as const, code, discountCents, freeShipping });
  assert.equal(bestAutoCoupon([r("A", 1000), r("B", 2000), { ok: false, error: "x" }], 15000)?.code, "B");
  assert.equal(bestAutoCoupon([r("A", 2000), r("SHIP", 0, true)], 15000)?.code, "SHIP");
  assert.equal(bestAutoCoupon([r("ZERO", 0)], 15000), undefined);
});
