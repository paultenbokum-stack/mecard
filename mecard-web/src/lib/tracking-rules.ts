// Reading Bob Go's public tracking (api.bobgo.co.za/tracking, as the uAfrica
// Shipping plugin's tracking page used it). Pure, so it can be unit tested.

export type TrackingCheckpoint = { status: string; status_friendly?: string; location?: string; message?: string; time: string };
export type TrackingShipment = {
  shipment_tracking_reference?: string;
  status: string;
  status_friendly?: string;
  courier_name?: string;
  checkpoints?: TrackingCheckpoint[];
};

/** Statuses that mean the courier has the parcel. Before them it is still with us (collection-assigned and the like). */
const MOVING = ["collected", "in-transit", "at-hub", "at-destination-hub", "out-for-delivery", "delivery-assigned", "failed-delivery", "delivered"];

export type TrackingOutcome = {
  state: "none" | "waiting" | "shipped" | "delivered";
  reference: string;
  courier: string;
  statusFriendly: string;
};

/** Where an order's parcels are: delivered only when every shipment is. */
export function trackingOutcome(shipments: TrackingShipment[]): TrackingOutcome {
  const live = shipments.filter((s) => s.status !== "cancelled");
  if (!live.length) return { state: "none", reference: "", courier: "", statusFriendly: "" };
  const first = live[0];
  const moving = (s: TrackingShipment) => MOVING.includes(s.status) || (s.checkpoints ?? []).some((c) => c.status === "collected");
  const state = live.every((s) => s.status === "delivered") ? "delivered" : live.some(moving) ? "shipped" : "waiting";
  return {
    state,
    reference: live.map((s) => s.shipment_tracking_reference ?? "").filter(Boolean).join(", ").slice(0, 64),
    courier: (first.courier_name ?? "").slice(0, 100),
    statusFriendly: first.status_friendly ?? first.status,
  };
}
