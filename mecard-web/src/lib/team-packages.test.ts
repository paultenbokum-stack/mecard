import assert from "node:assert/strict";
import { test } from "node:test";
import { PRODUCT } from "./catalog";
import { cardTypesFor, PRODUCT as P } from "./catalog";
import { clampPeople, MAIN_PACKAGES, MORE_PACKAGES, otherPackageProducts, packageEachCents, teamPackage, wholeRands } from "./team-packages";

const prices = { [PRODUCT.customCard]: 39900, [PRODUCT.proUpgrade]: 19900, [PRODUCT.classicBundle]: 49900, [PRODUCT.classicCard]: 29900 };

test("a package's price adds up its products", () => {
  assert.equal(packageEachCents(teamPackage("custom"), prices), 59800);
  assert.equal(packageEachCents(teamPackage("classic"), prices), 49900);
  assert.equal(packageEachCents(teamPackage("pro"), prices), 19900);
  assert.equal(packageEachCents(teamPackage("custom-card"), prices), 39900);
  assert.equal(packageEachCents(teamPackage("classic-card"), prices), 29900);
});

test("card-only packages sit behind more options, buy one card each and no Pro", () => {
  assert.deepEqual(MAIN_PACKAGES.map((p) => p.id), ["custom", "classic", "pro"]);
  assert.deepEqual(MORE_PACKAGES.map((p) => p.id), ["custom-card", "classic-card"]);
  assert.deepEqual(teamPackage("custom-card").products, [P.customCard]);
  assert.deepEqual(teamPackage("classic-card").products, [P.classicCard]);
  assert.deepEqual(cardTypesFor(P.customCard), ["contactcard"]);
  assert.deepEqual(cardTypesFor(P.classicCard), ["classiccard"]);
  for (const p of MORE_PACKAGES) assert.ok(p.ships && !p.products.includes(P.proUpgrade));
});

test("changing package drops the other packages' products", () => {
  assert.deepEqual(otherPackageProducts(teamPackage("custom-card")).sort(), [P.proUpgrade, P.classicBundle, P.classicCard].sort());
  assert.deepEqual(otherPackageProducts(teamPackage("custom")).sort(), [P.classicBundle, P.classicCard].sort());
  assert.ok(!otherPackageProducts(teamPackage("pro")).includes(P.proUpgrade));
});

test("a missing price gives no total rather than a wrong one", () => {
  assert.equal(packageEachCents(teamPackage("custom"), { [PRODUCT.proUpgrade]: 19900 }), null);
});

test("unknown packages fall back to custom", () => {
  assert.equal(teamPackage("nonsense").id, "custom");
});

test("team size stays in range", () => {
  assert.equal(clampPeople(0), 1);
  assert.equal(clampPeople(1), 1);
  assert.equal(clampPeople("7"), 7);
  assert.equal(clampPeople("abc"), 1);
  assert.equal(clampPeople(9999), 500);
});

test("whole rands use commas", () => {
  assert.equal(wholeRands(299000), "R2,990");
  assert.equal(wholeRands(19900), "R199");
});
