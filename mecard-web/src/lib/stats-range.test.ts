import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketKeys, change, statsRange } from "./stats-range";

const now = new Date("2026-10-22T12:00:00Z");

test("presets look back from now and compare with the period before", () => {
  const r = statsRange({ range: "30d" }, now);
  assert.equal(r.days, 30);
  assert.equal(r.bucket, "day");
  assert.equal(r.prevTo.getTime(), r.from.getTime());
  assert.equal(r.from.getTime() - r.prevFrom.getTime(), r.to.getTime() - r.from.getTime());
  assert.equal(statsRange({ range: "12m" }, now).bucket, "week");
  assert.equal(statsRange({}, now).key, "90d");
});

test("a custom range covers whole South African days; a bad one falls back to 90 days", () => {
  const r = statsRange({ range: "custom", from: "2026-10-01", to: "2026-10-07" }, now);
  assert.equal(r.from.toISOString(), "2026-09-30T22:00:00.000Z");
  assert.equal(r.to.toISOString(), "2026-10-07T21:59:59.999Z");
  assert.equal(r.days, 7);
  assert.equal(statsRange({ range: "custom", from: "2026-10-07", to: "2026-10-01" }, now).key, "90d");
});

test("buckets include empty days, and weeks start on Monday", () => {
  assert.deepEqual(bucketKeys({ from: new Date("2026-10-01T00:00:00+02:00"), to: new Date("2026-10-03T20:00:00+02:00"), bucket: "day" }), ["2026-10-01", "2026-10-02", "2026-10-03"]);
  assert.deepEqual(bucketKeys({ from: new Date("2026-10-07T10:00:00+02:00"), to: new Date("2026-10-20T10:00:00+02:00"), bucket: "week" }), ["2026-10-05", "2026-10-12", "2026-10-19"]);
});

test("change is a whole percentage, or null with nothing before", () => {
  assert.equal(change(150, 100), 50);
  assert.equal(change(50, 100), -50);
  assert.equal(change(5, 0), null);
});
