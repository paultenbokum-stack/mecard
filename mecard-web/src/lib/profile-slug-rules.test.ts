import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProfileSlug } from "./profile-slug-rules";

test("a typed profile address is tidied: case, spaces and a pasted URL", () => {
  assert.deepEqual(checkProfileSlug("  Jane-Doe "), { ok: true, slug: "jane-doe" });
  assert.deepEqual(checkProfileSlug("https://mecard.co.za/mecard-profile/jane-doe-2/"), { ok: true, slug: "jane-doe-2" });
  assert.deepEqual(checkProfileSlug("/jane/"), { ok: true, slug: "jane" });
});

test("profile addresses that can't be used are refused", () => {
  for (const bad of ["", "  ", "jane doe", "-jane", "jane-", "jane--doe", "jané", "jane_doe", "ja", "a/b", "x".repeat(181)]) {
    assert.equal(checkProfileSlug(bad).ok, false, bad);
  }
  assert.equal(checkProfileSlug("x".repeat(180)).ok, true);
});
