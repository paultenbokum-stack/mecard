// Browser side of the event store outside the card pages: one sendBeacon to
// /api/track/ (the card pages have their own copy in CardBehaviour).

export function beacon(eventName: string, data: { profile_id?: number | null; source?: string | null; meta?: Record<string, unknown> | null } = {}) {
  try {
    const body = JSON.stringify({ event_name: eventName, profile_id: data.profile_id ?? null, source: data.source ?? null, meta: data.meta ?? null, referrer: document.referrer || null });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track/", new Blob([body], { type: "application/json" }));
    else void fetch("/api/track/", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    // Tracking never gets in the way.
  }
}
