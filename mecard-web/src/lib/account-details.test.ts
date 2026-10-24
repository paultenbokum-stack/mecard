import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAccountDetails } from "./account-details";

const form = (v: Record<string, string>) => ({ get: (k: string) => v[k] ?? null });
const base = { account_first_name: "Jane", account_last_name: "Doe", account_display_name: "Jane Doe", account_email: " Jane@Example.com " };

test("parseAccountDetails cleans names and the email", () => {
  const r = parseAccountDetails(form({ ...base, account_first_name: " <b>Jane</b> " }), true);
  assert.deepEqual(r, { ok: true, details: { firstName: "Jane", lastName: "Doe", displayName: "Jane Doe", email: "Jane@Example.com", newPassword: "", currentPassword: "" } });
});

test("parseAccountDetails requires names and a valid email", () => {
  assert.equal(parseAccountDetails(form({ ...base, account_last_name: "" }), true).ok, false);
  assert.deepEqual(parseAccountDetails(form({ ...base, account_email: "nope" }), true), { ok: false, error: "Please provide a valid email address." });
});

test("parseAccountDetails needs the current password to change it, unless there is none yet", () => {
  const change = { ...base, password_1: "new-secret-1", password_2: "new-secret-1" };
  assert.deepEqual(parseAccountDetails(form(change), true), { ok: false, error: "Please enter your current password." });
  assert.equal(parseAccountDetails(form({ ...change, password_current: "old" }), true).ok, true);
  const google = parseAccountDetails(form(change), false);
  assert.ok(google.ok && google.details.newPassword === "new-secret-1");
});

test("parseAccountDetails checks the new password", () => {
  const p = { ...base, password_current: "old" };
  assert.equal(parseAccountDetails(form({ ...p, password_1: "short", password_2: "short" }), true).ok, false);
  assert.deepEqual(parseAccountDetails(form({ ...p, password_1: "new-secret-1", password_2: "new-secret-2" }), true), { ok: false, error: "New passwords do not match." });
  assert.deepEqual(parseAccountDetails(form(p), true), { ok: false, error: "Please enter your new password." });
});
