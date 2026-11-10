import assert from "node:assert/strict";
import { test } from "node:test";
import { judgeAssessment, RECAPTCHA_BLOCKS } from "./recaptcha-rules";

const body = (score: number, action = "SIGNUP", valid = true) => ({ tokenProperties: { valid, action }, riskAnalysis: { score } });

test("a valid token for the right action with a good score passes", () => {
  assert.deepEqual(judgeAssessment(body(0.9), "SIGNUP"), { pass: true, score: 0.9, reason: "ok" });
  assert.equal(judgeAssessment(body(0.5), "SIGNUP").pass, true);
});

test("low scores, wrong actions, invalid tokens and empty answers fail", () => {
  assert.equal(judgeAssessment(body(0.3), "SIGNUP").pass, false);
  assert.equal(judgeAssessment(body(0.9, "LOGIN"), "SIGNUP").pass, false);
  assert.equal(judgeAssessment(body(0.9, "SIGNUP", false), "SIGNUP").pass, false);
  assert.equal(judgeAssessment(null, "CONTACT").pass, false);
  assert.equal(judgeAssessment({ tokenProperties: { valid: true, action: "CONTACT" } }, "CONTACT").pass, false);
});

test("login and lost password never block, the public forms do", () => {
  assert.equal(RECAPTCHA_BLOCKS.LOGIN, false);
  assert.equal(RECAPTCHA_BLOCKS.PASSWORD_RESET, false);
  assert.equal(RECAPTCHA_BLOCKS.SIGNUP && RECAPTCHA_BLOCKS.CONTACT && RECAPTCHA_BLOCKS.QUOTE, true);
});
