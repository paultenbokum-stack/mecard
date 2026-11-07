import { test } from "node:test";
import assert from "node:assert/strict";
import {
  changeLine, contactLabel, csvCell, daysAgo, parsePeriod, parseTeamSort, referrerDomain, saveRate, sortRows, sparkPoints, totals, usageGroup, visits,
  type AnalyticsEvent,
} from "./analytics-rules";

const at = (s: string) => new Date(`2026-11-05T${s}:00+02:00`);
const ev = (name: string, time: string, over: Partial<AnalyticsEvent> = {}): AnalyticsEvent => ({ name, sessionId: "a", source: "nfc", referrer: null, device: "phone", at: at(time), meta: null, ...over });

test("periods fall back to 30 days", () => {
  assert.equal(parsePeriod("7"), 7);
  assert.equal(parsePeriod("90"), 90);
  assert.equal(parsePeriod("365"), 30);
  assert.equal(parsePeriod(undefined), 30);
});

test("totals count events, and people as distinct browsers", () => {
  const t = totals([ev("profile_viewed", "09:00"), ev("profile_viewed", "09:05"), ev("profile_viewed", "10:00", { sessionId: "b" }), ev("vcard_downloaded", "09:01"), ev("contact_action", "09:02"), ev("contact_action", "09:03")]);
  assert.deepEqual(t, { views: 3, visitors: 2, saves: 1, contactTaps: 2, savers: 1, contacters: 1 });
});

test("changes read as counts, never percentages", () => {
  assert.equal(changeLine(8, 5, 30), "3 more views than the 30 days before");
  assert.equal(changeLine(4, 5, 7), "1 fewer view than the 7 days before");
  assert.equal(changeLine(5, 5, 7), "The same number of views as the 7 days before");
});

test("contact actions in the owner's words", () => {
  assert.equal(contactLabel({ kind: "whatsapp" }), "WhatsApp");
  assert.equal(contactLabel({ kind: "social", label: "linkedin" }), "LinkedIn");
  assert.equal(contactLabel({ kind: "social", label: "other" }), "Social link");
  assert.equal(contactLabel(null), null);
});

test("referrers leave out MeCard itself and bad URLs", () => {
  assert.equal(referrerDomain("https://www.linkedin.com/feed/"), "linkedin.com");
  assert.equal(referrerDomain("https://mecard.co.za/manage/"), null);
  assert.equal(referrerDomain("not a url"), null);
  assert.equal(referrerDomain(null), null);
});

test("a visit gathers what one browser did, newest visit first", () => {
  const log = visits([
    ev("profile_viewed", "09:00"),
    ev("vcard_downloaded", "09:00", { meta: { trigger: "auto" } }),
    ev("contact_action", "09:02", { meta: { kind: "call" } }),
    ev("contact_action", "09:03", { meta: { kind: "call" } }),
    ev("profile_viewed", "11:00", { sessionId: "b", source: null, referrer: "https://www.linkedin.com/in/x", device: "desktop" }),
  ]);
  assert.equal(log.length, 2);
  assert.deepEqual([log[0].via, log[0].from, log[0].device], ["link", "linkedin.com", "desktop"]);
  assert.deepEqual([log[1].via, log[1].saved, log[1].actions], ["card", "auto", ["Called you"]]);
});

test("the same browser returning later is a new visit", () => {
  assert.equal(visits([ev("profile_viewed", "09:00"), ev("profile_viewed", "09:20"), ev("profile_viewed", "10:30")]).length, 2);
});

test("a button press outranks the automatic save, in either order", () => {
  const auto = { meta: { trigger: "auto" } };
  assert.equal(visits([ev("vcard_downloaded", "09:00", auto), ev("vcard_downloaded", "09:01")])[0].saved, "button");
  assert.equal(visits([ev("vcard_downloaded", "09:00"), ev("vcard_downloaded", "09:01", auto)])[0].saved, "button");
});

test("usage groups go by the last 30 days", () => {
  const now = new Date("2026-11-07T12:00:00+02:00");
  assert.equal(usageGroup(new Date("2026-11-01T12:00:00+02:00"), now), "using");
  assert.equal(usageGroup(new Date("2026-09-01T12:00:00+02:00"), now), "quiet");
  assert.equal(usageGroup(null, now), "never");
});

test("days ago follow South African days", () => {
  const now = new Date("2026-11-07T08:00:00+02:00");
  assert.equal(daysAgo(new Date("2026-11-07T00:30:00+02:00"), now), "Today");
  assert.equal(daysAgo(new Date("2026-11-06T23:30:00+02:00"), now), "Yesterday");
  assert.equal(daysAgo(new Date("2026-11-02T12:00:00+02:00"), now), "5 days ago");
  assert.equal(daysAgo(null, now), "Never");
});

test("save rate handles no views and more saves than views", () => {
  assert.equal(saveRate(0, 0), "–");
  assert.equal(saveRate(40, 10), "25%");
  assert.equal(saveRate(2, 3), "100%");
});

test("free profiles sort last, whatever the column", () => {
  const stats = (views: number, saves: number) => ({ views, saves, contactTaps: 0, lastView: null });
  const rows = [{ name: "Free", stats: null }, { name: "Low", stats: stats(2, 2) }, { name: "High", stats: stats(9, 1) }];
  assert.deepEqual(sortRows(rows, "views").map((r) => r.name), ["High", "Low", "Free"]);
  assert.deepEqual(sortRows(rows, "rate").map((r) => r.name), ["Low", "High", "Free"]);
  assert.equal(parseTeamSort("nonsense"), "views");
});

test("sparkline stays inside its box", () => {
  assert.equal(sparkPoints([0, 5]), "1.0,22.0 75.0,2.0");
  assert.equal(sparkPoints([0, 0]), "1.0,22.0 75.0,22.0");
});

test("CSV cells are quoted and can't run as formulas", () => {
  assert.equal(csvCell("Jane, Doe"), '"Jane, Doe"');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell(12), "12");
});
