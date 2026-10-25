import { test } from "node:test";
import assert from "node:assert/strict";
import { routeEmail } from "./email-test-mode";

const msg = { to: "customer@example.test", subject: "Your order", text: "Hi", replyTo: "admin@example.test" };

test("routeEmail: no test settings sends as it is", () => {
  assert.deepEqual(routeEmail(msg, {}), { action: "send", msg });
});

test("routeEmail: EMAIL_REDIRECT_TO sends to that address, the real recipient in the subject", () => {
  const r = routeEmail(msg, { EMAIL_REDIRECT_TO: " paul@example.test " });
  assert.equal(r.action, "send");
  assert.equal(r.msg.to, "paul@example.test");
  assert.equal(r.msg.subject, "[TEST, for customer@example.test] Your order");
  assert.equal(r.msg.replyTo, undefined);
});

test("routeEmail: EMAIL_MODE=log only logs, even with a redirect", () => {
  assert.equal(routeEmail(msg, { EMAIL_MODE: "log", EMAIL_REDIRECT_TO: "paul@example.test" }).action, "log");
});
