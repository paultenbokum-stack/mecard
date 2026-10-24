import { test } from "node:test";
import assert from "node:assert/strict";
import { cardCartKey, cardTypesFor, entitlementTypesFor, isBundle, isForProfile, isVirtual, newCardSlug, PRODUCT } from "./catalog";

test("each product creates the cards me_product_array() created", () => {
  assert.deepEqual(cardTypesFor(PRODUCT.customCard), ["contactcard"]);
  assert.deepEqual(cardTypesFor(PRODUCT.classicCard), ["classiccard"]);
  assert.deepEqual(cardTypesFor(PRODUCT.classicCorporate), ["classiccard"]);
  assert.deepEqual(cardTypesFor(PRODUCT.classicBundle), ["classiccard", "phonetag"]);
  assert.deepEqual(cardTypesFor(PRODUCT.customBundle), ["contactcard", "phonetag"]);
  assert.deepEqual(cardTypesFor(PRODUCT.proUpgrade), []);
});

test("entitlement types and bundles match Me\Entitlements\Module", () => {
  assert.deepEqual(entitlementTypesFor(PRODUCT.classicBundle), ["pro_upgrade", "classic_card", "phone_tag"]);
  assert.deepEqual(entitlementTypesFor(PRODUCT.proUpgrade), ["pro_upgrade"]);
  assert.deepEqual(entitlementTypesFor(2980), []);
  assert.ok(isBundle(PRODUCT.customBundle) && !isBundle(PRODUCT.customCard));
  assert.ok(isVirtual(PRODUCT.proUpgrade) && !isVirtual(PRODUCT.phoneTag));
  assert.ok(isForProfile(PRODUCT.proUpgrade) && isForProfile(PRODUCT.classicBundle) && !isForProfile(PRODUCT.classicCard));
});

test("new card slugs and cart keys look like WordPress's", () => {
  assert.equal(newCardSlug("contactcard", 796, () => 0.50185), "contactcard-796-50185");
  assert.equal(newCardSlug("phonetag", 9, () => 0.00001), "phonetag-9-00001");
  assert.equal(cardCartKey("abc123", 796), "abc123-796");
});
