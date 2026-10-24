import { test } from "node:test";
import assert from "node:assert/strict";
import { offerPrice, upsellRules } from "./upsell-rules";

const base = { freeProfiles: 1, pendingUpgrade: false, upgradesReady: 0, bundleInBasket: false };

test("upsellRules: a free profile sees the Pro upsell, bundle offer and card offer", () => {
  assert.deepEqual(upsellRules(base), { journey: false, proUpsell: true, bundleOffer: true, cardOffer: true, eftPending: false });
});

test("upsellRules: all Pro or an upgrade pending hides the Pro upsell and bundle offer", () => {
  assert.deepEqual(upsellRules({ ...base, freeProfiles: 0 }), { journey: false, proUpsell: false, bundleOffer: false, cardOffer: true, eftPending: false });
  assert.deepEqual(upsellRules({ ...base, pendingUpgrade: true }), { journey: false, proUpsell: false, bundleOffer: false, cardOffer: true, eftPending: true });
  assert.equal(upsellRules({ ...base, pendingUpgrade: true, upgradesReady: 1 }).eftPending, false);
});

test("upsellRules: a bundle in the basket shows only the journey", () => {
  assert.deepEqual(upsellRules({ ...base, bundleInBasket: true, pendingUpgrade: true, upgradeInBasket: true }), { journey: true, proUpsell: false, bundleOffer: false, cardOffer: false, eftPending: false });
});

test("offerPrice: whole rands as the offers print them", () => {
  assert.equal(offerPrice(49900), "R499");
  assert.equal(offerPrice(19900), "R199");
  assert.equal(offerPrice(149900), "R1,499");
  assert.equal(offerPrice(49950), "R499.50");
});
