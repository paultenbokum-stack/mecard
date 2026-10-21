import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveStatus, quoteToken, quoteTotals, verifyQuoteToken } from "./quote-rules";

const now = new Date("2026-10-21T12:00:00Z");

test("quote totals add the lines and cap the discount at the subtotal", () => {
  const items = [
    { productId: 706, name: "Card", qty: 3, unitPriceCents: 39900 },
    { productId: 57884, name: "Additional Shipping", qty: 1, unitPriceCents: 10000 },
  ];
  assert.deepEqual(quoteTotals(items), { subtotalCents: 129700, discountCents: 0, totalCents: 129700 });
  assert.deepEqual(quoteTotals(items, 200000), { subtotalCents: 129700, discountCents: 129700, totalCents: 0 });
});

test("a sent quote past its date shows as expired", () => {
  assert.equal(effectiveStatus({ status: "sent", expiresAt: new Date("2026-10-20T00:00:00Z") }, now), "expired");
  assert.equal(effectiveStatus({ status: "sent", expiresAt: new Date("2026-10-30T00:00:00Z") }, now), "sent");
});

test("accepted and rejected quotes keep their status", () => {
  assert.equal(effectiveStatus({ status: "accepted", expiresAt: new Date("2026-10-01T00:00:00Z") }, now), "accepted");
  assert.equal(effectiveStatus({ status: "rejected", expiresAt: null }, now), "rejected");
});

test("quote tokens are tied to the quote and its email (case-insensitive)", () => {
  const t = quoteToken(12, "A@Example.com");
  assert.equal(verifyQuoteToken(12, "a@example.com", t), true);
  assert.equal(verifyQuoteToken(13, "a@example.com", t), false);
  assert.equal(verifyQuoteToken(12, "b@example.com", t), false);
  assert.equal(verifyQuoteToken(12, "a@example.com", "short"), false);
});
