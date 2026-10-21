import { test } from "node:test";
import assert from "node:assert/strict";
import { trackingOutcome, type TrackingShipment } from "./tracking-rules";

// The shape api.bobgo.co.za/tracking returned for order 83562.
const delivered: TrackingShipment = {
  shipment_tracking_reference: "UAFWDXJTW",
  status: "delivered",
  status_friendly: "Delivered",
  courier_name: "Fastway",
  checkpoints: [
    { status: "delivered", time: "2026-10-19 15:12:05+02:00" },
    { status: "out-for-delivery", time: "2026-10-19 06:37:28+02:00" },
    { status: "collected", time: "2026-10-16 15:02:23+02:00" },
    { status: "collection-assigned", time: "2026-10-15 10:31:35+02:00" },
  ],
};

test("delivered when every shipment is delivered", () => {
  assert.deepEqual(trackingOutcome([delivered]), { state: "delivered", reference: "UAFWDXJTW", courier: "Fastway", statusFriendly: "Delivered" });
});

test("shipped once the courier has collected it; waiting before that", () => {
  assert.equal(trackingOutcome([{ ...delivered, status: "at-hub", checkpoints: [] }]).state, "shipped");
  assert.equal(trackingOutcome([{ ...delivered, status: "collection-assigned", checkpoints: [{ status: "collection-assigned", time: "" }] }]).state, "waiting");
  assert.equal(trackingOutcome([delivered, { ...delivered, status: "in-transit", shipment_tracking_reference: "B2" }]).state, "shipped");
});

test("no shipment, or only cancelled ones, means nothing to report", () => {
  assert.equal(trackingOutcome([]).state, "none");
  assert.equal(trackingOutcome([{ ...delivered, status: "cancelled" }]).state, "none");
});
