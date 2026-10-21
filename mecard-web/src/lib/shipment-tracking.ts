import "server-only";
import { SITE_URL } from "./site";
import { trackingOutcome, type TrackingShipment } from "./tracking-rules";

// Bob Go's public tracking API: no key, looked up by the shop's domain (the
// "channel") and our order number. Bob Go doesn't send us tracking webhooks,
// so the hourly job polls this (src/lib/automations.ts).

function channel() {
  const host = new URL(SITE_URL).hostname.replace(/^www\./, "");
  return process.env.BOBGO_TRACKING_CHANNEL || (host.includes(".") ? host : "mecard.co.za");
}

/** The order's shipments, or null when Bob Go can't be reached. */
export async function fetchTracking(orderId: number): Promise<TrackingShipment[] | null> {
  const url = `https://api.bobgo.co.za/tracking?${new URLSearchParams({ channel: channel(), tracking_reference: String(orderId) })}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000), next: { revalidate: 600 } });
    if (res.status === 404) return [];
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    return Array.isArray(body) ? (body as TrackingShipment[]) : [];
  } catch {
    return null;
  }
}

export async function trackOrder(orderId: number) {
  const shipments = await fetchTracking(orderId);
  return shipments ? { shipments, ...trackingOutcome(shipments) } : null;
}
