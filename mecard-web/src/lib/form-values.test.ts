import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanColour, cleanEmail, cleanPhone, cleanSocial, cleanText, cleanUrl } from "./form-values";
import { legacyLoginRedirect, safeNext } from "./auth-paths";
import { inviteToken, verifyInviteToken } from "./invite-token";
import { nextFreeSlug, slugify } from "./slug";

test("cleanText strips tags and control characters", () => {
  assert.equal(cleanText("  Jane <b>Doe</b>\n\t "), "Jane Doe");
  assert.equal(cleanText("x".repeat(300), 10), "xxxxxxxxxx");
  assert.equal(cleanText(null), "");
});

test("cleanUrl adds https and drops unsafe schemes", () => {
  assert.equal(cleanUrl("www.mecard.co.za"), "https://www.mecard.co.za");
  assert.equal(cleanUrl("mecard.co.za/shop?x=1"), "https://mecard.co.za/shop?x=1");
  assert.equal(cleanUrl("http://a.b/c d"), "http://a.b/cd");
  assert.equal(cleanUrl("mailto:jo@x.com"), "mailto:jo@x.com");
  assert.equal(cleanUrl("javascript:alert(1)"), "");
  assert.equal(cleanUrl("not a link"), "");
  assert.equal(cleanUrl(""), "");
});

test("cleanSocial turns handles into profile links", () => {
  assert.equal(cleanSocial("instagram", "@jane.doe"), "https://www.instagram.com/jane.doe");
  assert.equal(cleanSocial("tiktok", "janedoe"), "https://www.tiktok.com/@janedoe");
  assert.equal(cleanSocial("linkedin", "https://www.linkedin.com/in/jane"), "https://www.linkedin.com/in/jane");
  assert.equal(cleanSocial("facebook", "facebook.com/jane"), "https://facebook.com/jane");
});

test("email, phone and colour values", () => {
  assert.equal(cleanEmail(" jo@x.co.za "), "jo@x.co.za");
  assert.equal(cleanEmail("nope"), "");
  assert.equal(cleanPhone("+27 (82) 555-1234 ext"), "+27 (82) 555-1234");
  assert.equal(cleanColour("#ABCDEF"), "#abcdef");
  assert.equal(cleanColour("red;}body{"), "");
});

test("slugs follow WordPress sanitize_title and stay unique", () => {
  assert.equal(slugify("José  Ndlovu-Smith"), "jose-ndlovu-smith");
  assert.equal(slugify("  &&  "), "profile");
  assert.equal(slugify("Acme & Co.", "company"), "acme-co");
  assert.equal(nextFreeSlug("jane-doe", []), "jane-doe");
  assert.equal(nextFreeSlug("jane-doe", ["jane-doe", "jane-doe-2"]), "jane-doe-3");
});

test("safeNext only allows paths on this site", () => {
  assert.equal(safeNext("/manage/?activate=abc"), "/manage/?activate=abc");
  assert.equal(safeNext("//evil.com/"), "/manage/");
  assert.equal(safeNext("/\\evil.com"), "/manage/");
  assert.equal(safeNext("https://evil.com/"), "/manage/");
  assert.equal(safeNext(undefined), "/manage/");
});

test("old WordPress login URLs map onto the new pages", () => {
  const o = "https://mecard.co.za";
  const r = (path: string, q = "") => legacyLoginRedirect(path, new URLSearchParams(q), o);
  assert.equal(r("/wp-login.php"), "/my-account/");
  assert.equal(r("/wp-login.php", "action=lostpassword"), "/my-account/lost-password/");
  assert.equal(r("/wp-login.php", "action=rp&key=abc&login=jo"), "/my-account/lost-password/");
  assert.equal(r("/wp-login.php", "action=logout&_wpnonce=1"), "/my-account/customer-logout/");
  assert.equal(r("/wp-login.php", "redirect_to=https%3A%2F%2Fmecard.co.za%2Fmanage%2Fcards%2F"), "/my-account/?next=%2Fmanage%2Fcards%2F");
  assert.equal(r("/wp-login.php", "redirect_to=https%3A%2F%2Fevil.com%2Fx"), "/my-account/");
  assert.equal(r("/wp-login.php", "redirect_to=%2Fwp-admin%2F"), "/my-account/");
  assert.equal(r("/login/"), "/my-account/");
  assert.equal(r("/password-recovery/"), "/my-account/lost-password/");
  assert.equal(r("/my-account/"), null);
});

test("invite tokens are tied to the invite and its email", () => {
  const t = inviteToken(12, "Jo@X.com");
  assert.equal(t.length, 32);
  assert.ok(verifyInviteToken(12, "jo@x.com", t));
  assert.ok(!verifyInviteToken(13, "jo@x.com", t));
  assert.ok(!verifyInviteToken(12, "other@x.com", t));
  assert.ok(!verifyInviteToken(12, "jo@x.com", "short"));
});
