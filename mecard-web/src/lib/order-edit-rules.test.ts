import { test } from "node:test";
import assert from "node:assert/strict";
import { cardsForQty, couponCodesOf, isEditableOrder, orderTotals, otherDiscountOf, parseDiscount, parseQty } from "./order-edit-rules";

test("only orders on hold can be edited", () => {
  assert.equal(isEditableOrder("on-hold"), true);
  for (const s of ["pending", "processing", "shipped", "completed", "cancelled"]) assert.equal(isEditableOrder(s), false);
});

test("imported orders can carry several coupon codes", () => {
  assert.deepEqual(couponCodesOf("spring10, welcome"), ["spring10", "welcome"]);
  assert.deepEqual(couponCodesOf(""), []);
});

test("totals: subtotal less the discount plus shipping", () => {
  assert.deepEqual(orderTotals({ lineCents: [29900, 15000], couponCents: 4490, otherCents: 1000, shippingCents: 9900 }), {
    subtotalCents: 44900,
    discountCents: 5490,
    totalCents: 49310,
  });
});

test("the discount never takes the items below zero", () => {
  assert.deepEqual(orderTotals({ lineCents: [10000], couponCents: 8000, otherCents: 5000, shippingCents: 9900 }), {
    subtotalCents: 10000,
    discountCents: 10000,
    totalCents: 9900,
  });
});

test("the other discount is what the coupon doesn't account for", () => {
  assert.equal(otherDiscountOf(5000, 3000), 2000);
  assert.equal(otherDiscountOf(3000, 4500), 0);
});

test("a discount is an amount or a percentage of the subtotal", () => {
  assert.equal(parseDiscount("R50", 100000), 5000);
  assert.equal(parseDiscount("49.50", 100000), 4950);
  assert.equal(parseDiscount("10%", 44900), 4490);
  assert.equal(parseDiscount("", 44900), 0);
  assert.ok(Number.isNaN(parseDiscount("120%", 44900)));
  assert.ok(Number.isNaN(parseDiscount("ten", 44900)));
});

test("quantities are whole numbers from 0 to 999", () => {
  assert.equal(parseQty("0"), 0);
  assert.equal(parseQty(" 12 "), 12);
  for (const v of ["-1", "1.5", "1000", ""]) assert.ok(Number.isNaN(parseQty(v)));
});

test("a lower quantity archives the newest cards, a higher one adds", () => {
  assert.deepEqual(cardsForQty([1, 2, 3], 1), { keep: [1], archive: [2, 3], add: 0 });
  assert.deepEqual(cardsForQty([1], 3), { keep: [1], archive: [], add: 2 });
  assert.deepEqual(cardsForQty([1, 2], 0), { keep: [], archive: [1, 2], add: 0 });
});
