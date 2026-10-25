import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeAcquisition, firstTouch, isMarketingPath, parseAcquisition, referrerDomain, withReferral } from "./acquisition";

const now = new Date("2026-10-25T10:00:00Z");

test("first touch keeps UTMs, the landing path and an outside referrer", () => {
  const a = firstTouch("https://mecard.co.za/cards/?utm_source=linkedin&utm_medium=social&x=1", "https://www.linkedin.com/feed/", now);
  assert.deepEqual(a, { landing_path: "/cards/", first_seen: now.toISOString(), utm_source: "linkedin", utm_medium: "social", referrer_domain: "linkedin.com" });
});

test("me_source counts as utm_source; a same-site referrer is no source", () => {
  const a = firstTouch("https://mecard.co.za/t/abc/?me_source=nfc", "https://mecard.co.za/", now);
  assert.equal(a.utm_source, "nfc");
  assert.equal(a.referrer_domain, undefined);
  assert.equal(referrerDomain("", "mecard.co.za"), null);
  assert.equal(referrerDomain("not a url", "mecard.co.za"), null);
});

test("the cookie round-trips and drops anything unexpected", () => {
  const a = withReferral(firstTouch("https://mecard.co.za/", "", now), 42);
  assert.deepEqual(parseAcquisition(encodeAcquisition(a)), a);
  assert.deepEqual(parseAcquisition(JSON.stringify({ utm_source: "x", email: "a@b.c", ref_profile_id: "-3" })), { utm_source: "x" });
  assert.equal(parseAcquisition("garbage"), null);
  assert.equal(parseAcquisition(undefined), null);
});

test("marketing paths", () => {
  for (const p of ["/", "/cards/", "/for-teams", "/shop/", "/product/classic-card/", "/sign-up/email/"]) assert.ok(isMarketingPath(p), p);
  for (const p of ["/t/abc/", "/manage/", "/admin/", "/checkout/", "/my-account/"]) assert.ok(!isMarketingPath(p), p);
});
