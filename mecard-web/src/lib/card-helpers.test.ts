import { test } from "node:test";
import assert from "node:assert/strict";
import { isPro, needsCanonicalRedirect, normalizeSlug, safeHref, shortLabel, telHref, whatsappDigits } from "./profile-format";
import { clientInfo, eventRow, hashWithSalt, sanitizeKey } from "./tracking";

test("slugs are looked up the way WordPress stored them", () => {
  assert.equal(normalizeSlug("ab12c-3de45"), "ab12c-3de45");
  assert.equal(normalizeSlug("AB12C-3DE45"), "ab12c-3de45");
  assert.equal(normalizeSlug("josé-ndlovu"), "jos%c3%a9-ndlovu");
  assert.equal(normalizeSlug("jos%C3%A9-ndlovu"), "jos%c3%a9-ndlovu");
  assert.equal(needsCanonicalRedirect("AB12C-3de45"), true);
  assert.equal(needsCanonicalRedirect("josé-ndlovu"), false);
  assert.equal(needsCanonicalRedirect("jos%C3%A9-nd"), false);
});

test("WhatsApp numbers: local 0 becomes +27, digits only (as the templates did)", () => {
  assert.equal(whatsappDigits("071 234 5678"), "27712345678");
  assert.equal(whatsappDigits("+27 82 555 0101"), "27825550101");
  assert.equal(whatsappDigits("+44 7700 900123"), "447700900123");
  assert.equal(whatsappDigits(""), "");
});

test("links", () => {
  assert.equal(safeHref("https://a.co/x"), "https://a.co/x");
  assert.equal(safeHref("www.example.co.za/list"), "https://www.example.co.za/list");
  assert.equal(safeHref("javascript:alert(1)"), "#");
  assert.equal(safeHref(""), "#");
  assert.equal(telHref("071 234 5678"), "tel:071%20234%205678");
  assert.equal(telHref(""), "#");
});

test("launcher labels are at most 12 characters", () => {
  assert.equal(shortLabel("Thandi Dube"), "Thandi Dube");
  assert.equal(shortLabel("Riverside Business Centre"), "Riverside B.");
  assert.equal(shortLabel("Bartholomewsky Smith"), "Bartholomew…");
});

test("profile types", () => {
  assert.equal(isPro({ type: "pro" }), true);
  assert.equal(isPro({ type: "professional" }), true);
  assert.equal(isPro({ type: "standard" }), false);
});

const base = { sessionCookie: null, userId: null, ip: "196.1.2.3", userAgent: "UA", country: "za" };

test("tracking: allowed events become rows like Me\\Tracking\\Module::log_event", () => {
  const row = eventRow({
    ...base,
    body: { event_name: "profile_viewed", session_id: "cs-abc", profile_id: "12345", company_id: 0, source: "NFC!", referrer: "https://wa.me/x", meta: { entry_url_pattern: "t" } },
  });
  assert.deepEqual(row, {
    name: "profile_viewed",
    sessionId: "cs-abc",
    userId: null,
    profileId: 12345,
    companyId: null,
    source: "nfc",
    referrer: "https://wa.me/x",
    country: "ZA",
    uaHash: hashWithSalt("UA"),
    ipHash: hashWithSalt("196.1.2.3"),
    meta: { entry_url_pattern: "t" },
  });
});

test("tracking: the session cookie wins over the client id; unknown events are refused", () => {
  assert.equal(eventRow({ ...base, sessionCookie: "4e43dd14-2dcd-4426-9e4b-d331399f7d14", body: { event_name: "share_intent", session_id: "cs-x" } })?.sessionId, "4e43dd14-2dcd-4426-9e4b-d331399f7d14");
  assert.equal(eventRow({ ...base, body: { event_name: "drop_tables" } }), null);
  assert.equal(eventRow({ ...base, body: { event_name: "profile_viewed", referrer: "javascript:x", country: "zzz" } })?.referrer, null);
  assert.equal(sanitizeKey("Profile_Viewed<script>"), "profile_viewedscript");
});

test("client IP and country come from the load balancer headers", () => {
  const h = new Headers({ "x-forwarded-for": "41.1.1.1, 10.0.0.1", "x-client-region": "ZA", "user-agent": "Phone" });
  assert.deepEqual(clientInfo(h), { ip: "41.1.1.1", country: "ZA", userAgent: "Phone" });
});
