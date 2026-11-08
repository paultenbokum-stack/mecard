import assert from "node:assert/strict";
import { test } from "node:test";
import { PRODUCT } from "./catalog";
import { clampPeople, packageEachCents, teamPackage, wholeRands } from "./team-packages";

const prices = { [PRODUCT.customCard]: 39900, [PRODUCT.proUpgrade]: 19900, [PRODUCT.classicBundle]: 49900 };

test("a package's price adds up its products", () => {
  assert.equal(packageEachCents(teamPackage("custom"), prices), 59800);
  assert.equal(packageEachCents(teamPackage("classic"), prices), 49900);
  assert.equal(packageEachCents(teamPackage("pro"), prices), 19900);
});

test("a missing price gives no total rather than a wrong one", () => {
  assert.equal(packageEachCents(teamPackage("custom"), { [PRODUCT.proUpgrade]: 19900 }), null);
});

test("unknown packages fall back to custom", () => {
  assert.equal(teamPackage("nonsense").id, "custom");
});

test("team size stays in range", () => {
  assert.equal(clampPeople(1), 2);
  assert.equal(clampPeople("7"), 7);
  assert.equal(clampPeople("abc"), 2);
  assert.equal(clampPeople(9999), 500);
});

test("whole rands use commas", () => {
  assert.equal(wholeRands(299000), "R2,990");
  assert.equal(wholeRands(19900), "R199");
});
