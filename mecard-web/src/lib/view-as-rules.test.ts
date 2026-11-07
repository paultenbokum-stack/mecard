import assert from "node:assert/strict";
import { test } from "node:test";
import { readOnlyReturnPath, viewAsBlocks } from "./view-as-rules";
import { readViewAsToken, signViewAsToken } from "./view-as-token";

test("reads are never blocked", () => {
  for (const m of ["GET", "HEAD", "OPTIONS", "get"]) assert.equal(viewAsBlocks(m, "/manage/"), false);
});

test("writes are blocked by default, on pages and APIs alike", () => {
  for (const p of ["/manage/", "/basket/", "/api/upload/", "/api/track/", "/my-account/edit-account/", "/", "/administrator/", "/api/authors/"]) {
    assert.equal(viewAsBlocks("POST", p), true, p);
  }
  for (const m of ["PUT", "PATCH", "DELETE"]) assert.equal(viewAsBlocks(m, "/api/media/"), true);
});

test("staff screens, sign-in and leaving view-as still work", () => {
  for (const p of ["/admin/", "/admin/users/5/", "/sales/quotes/", "/api/auth/signout/", "/api/view-as/stop/"]) assert.equal(viewAsBlocks("POST", p), false, p);
});

test("a refused form returns to the page it came from", () => {
  assert.equal(readOnlyReturnPath("https://mecard.co.za/manage/cards/?tab=2", "/x/"), "/manage/cards/?tab=2&read_only=1");
  assert.equal(readOnlyReturnPath(null, "/manage/"), "/manage/?read_only=1");
  assert.equal(readOnlyReturnPath("not a url", "/manage/"), "/manage/?read_only=1");
});

test("a refused form can't be sent to another site", () => {
  assert.equal(readOnlyReturnPath("https://evil.example/phish/", "/manage/"), "/phish/?read_only=1");
});

const SECRET = "test-secret";
const token = { actorId: 1, targetId: 42, expiresAt: 2000 };

test("a signed token reads back until it expires", () => {
  const raw = signViewAsToken(token, SECRET);
  assert.deepEqual(readViewAsToken(raw, SECRET, 1999), token);
  assert.equal(readViewAsToken(raw, SECRET, 2000), null);
});

test("an edited or wrongly signed token is refused", () => {
  const raw = signViewAsToken(token, SECRET);
  assert.equal(readViewAsToken(raw.replace("1.42.", "1.43."), SECRET, 1000), null);
  assert.equal(readViewAsToken(raw.replace(".2000.", ".9999."), SECRET, 1000), null);
  assert.equal(readViewAsToken(raw, "another-secret", 1000), null);
  assert.equal(readViewAsToken("1.42.2000", SECRET, 1000), null);
  assert.equal(readViewAsToken("", SECRET, 1000), null);
});

test("no secret means no view-as", () => {
  assert.equal(readViewAsToken(signViewAsToken(token, SECRET), "", 1000), null);
  assert.throws(() => signViewAsToken(token, ""));
});
