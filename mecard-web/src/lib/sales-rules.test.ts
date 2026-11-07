import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clickStillValid,
  commissionBase,
  commissionFor,
  creditFor,
  currentMonth,
  decodeClick,
  encodeClick,
  isBot,
  keepsExistingClick,
  monthRange,
  percentToBps,
  shiftMonth,
} from "./sales-rules";

const day = 864e5;
const base = {
  manual: null,
  quoteSalesUserIds: [] as (number | null)[],
  referredBy: null as number | null,
  referredAt: null as Date | null,
  placedAt: new Date("2026-06-01T10:00:00Z"),
  customerId: 50,
  isSales: () => true,
};

test("a signed click round-trips and can't be edited", () => {
  const click = { salesUserId: 7, clickedAt: new Date("2026-01-01T00:00:00Z") };
  const v = encodeClick(click, "s");
  assert.deepEqual(decodeClick(v, "s"), click);
  assert.equal(decodeClick(v.replace(/^7/, "8"), "s"), null);
  assert.equal(decodeClick(v, "other"), null);
  assert.equal(decodeClick("junk", "s"), null);
  assert.equal(decodeClick(undefined, "s"), null);
});

test("a click lasts 30 days and the first salesperson keeps it", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  const fresh = { salesUserId: 1, clickedAt: new Date(now.getTime() - 29 * day) };
  const old = { salesUserId: 1, clickedAt: new Date(now.getTime() - 31 * day) };
  assert.equal(clickStillValid(fresh, now), true);
  assert.equal(clickStillValid(old, now), false);
  assert.equal(keepsExistingClick(fresh, 2, now), true);
  assert.equal(keepsExistingClick(fresh, 1, now), false);
  assert.equal(keepsExistingClick(old, 2, now), false);
  assert.equal(keepsExistingClick(null, 2, now), false);
});

test("link previews are not clicks", () => {
  assert.equal(isBot("WhatsApp/2.23.20.0 A"), true);
  assert.equal(isBot(null), true);
  assert.equal(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148 Safari/604.1"), false);
});

test("a referred customer earns for 12 months from sign-up", () => {
  const referred = { ...base, referredBy: 7, referredAt: new Date("2025-06-02T10:00:00Z") };
  assert.deepEqual(creditFor(referred), { salesUserId: 7, source: "link" });
  assert.equal(creditFor({ ...referred, referredAt: new Date("2025-05-31T10:00:00Z") }), null);
  assert.equal(creditFor({ ...referred, referredAt: new Date("2026-06-02T10:00:00Z") }), null, "placed before the sign-up");
});

test("a quote beats the link that brought the customer in", () => {
  const c = creditFor({ ...base, quoteSalesUserIds: [9], referredBy: 7, referredAt: new Date("2026-01-01T00:00:00Z") });
  assert.deepEqual(c, { salesUserId: 9, source: "quote" });
});

test("a quote with no salesperson leaves the link's credit", () => {
  const c = creditFor({ ...base, quoteSalesUserIds: [null], referredBy: 7, referredAt: new Date("2026-01-01T00:00:00Z") });
  assert.deepEqual(c, { salesUserId: 7, source: "link" });
});

test("a quote earns whenever it is bought, with no 12-month limit", () => {
  assert.deepEqual(creditFor({ ...base, quoteSalesUserIds: [9] }), { salesUserId: 9, source: "quote" });
});

test("staff's choice wins, including choosing nobody", () => {
  assert.deepEqual(creditFor({ ...base, manual: { salesUserId: 3 }, quoteSalesUserIds: [9] }), { salesUserId: 3, source: "manual" });
  assert.equal(creditFor({ ...base, manual: { salesUserId: null }, quoteSalesUserIds: [9] }), null);
});

test("nobody earns on their own purchase, or after losing the role", () => {
  assert.equal(creditFor({ ...base, quoteSalesUserIds: [50] }), null);
  assert.equal(creditFor({ ...base, quoteSalesUserIds: [9], isSales: () => false }), null);
});

test("commission is on sales excluding shipping, after discount", () => {
  // A quote: R1,000 of cards plus a R100 Additional Shipping line, R50 off, R120 delivery on the order.
  const b = commissionBase({ subtotalCents: 110000, discountCents: 5000, shippingLineCents: 10000 });
  assert.equal(b, 95000);
  assert.equal(commissionFor(b, 2000), 19000);
  assert.equal(commissionFor(b, 1250), 11875);
  assert.equal(commissionBase({ subtotalCents: 1000, discountCents: 5000, shippingLineCents: 0 }), 0);
});

test("a rate is typed as a percentage", () => {
  assert.equal(percentToBps("20"), 2000);
  assert.equal(percentToBps("12.5%"), 1250);
  assert.equal(percentToBps("101"), null);
  assert.equal(percentToBps("abc"), null);
});

test("months are South African", () => {
  assert.equal(currentMonth(new Date("2026-10-31T22:30:00Z")), "2026-11");
  const { start, end } = monthRange("2026-11");
  assert.equal(start.toISOString(), "2026-10-31T22:00:00.000Z");
  assert.equal(end.toISOString(), "2026-11-30T22:00:00.000Z");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
