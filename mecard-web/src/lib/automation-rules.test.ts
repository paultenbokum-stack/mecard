import { test } from "node:test";
import assert from "node:assert/strict";
import { basketAction, DAY, HOUR, MINUTE, markSent, onHoldReminderDue, SENT } from "./automation-rules";

const basket = (ageMs: number, sent = 0, hasCards = true) => basketAction({ ageMs, sent, hasCards, empty: false });

test("a basket with cards gets the checkout reminder, then 1 day, then 5 days, then is emptied at 7 days", () => {
  assert.equal(basket(5 * MINUTE), null);
  assert.equal(basket(20 * MINUTE), "checkout");
  assert.equal(basket(2 * HOUR, SENT.checkout), null);
  assert.equal(basket(DAY + HOUR, SENT.checkout), "day1");
  assert.equal(basket(2 * DAY, markSent(0, "day1")), null);
  assert.equal(basket(5 * DAY + HOUR, markSent(0, "day1")), "day5");
  assert.equal(basket(6 * DAY, markSent(0, "day5")), null);
  assert.equal(basket(7 * DAY, markSent(0, "day5")), "expire");
});

test("a job that missed a few runs sends only the reminder that fits the basket's age", () => {
  assert.equal(basket(5 * DAY + HOUR, 0), "day5");
  assert.equal(markSent(0, "day5") & SENT.day1, SENT.day1);
});

test("baskets without cards get no reminders but still expire; empty baskets are left alone", () => {
  assert.equal(basket(2 * DAY, 0, false), null);
  assert.equal(basket(8 * DAY, 0, false), "expire");
  assert.equal(basketAction({ ageMs: 8 * DAY, sent: 0, hasCards: false, empty: true }), null);
});

test("on-hold reminders go between 2 and 7 days", () => {
  assert.equal(onHoldReminderDue(DAY), false);
  assert.equal(onHoldReminderDue(2 * DAY + MINUTE), true);
  assert.equal(onHoldReminderDue(30 * DAY), false);
});
