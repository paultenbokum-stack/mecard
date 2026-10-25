// First-touch acquisition (conversion plan 0.2 / 0.3). The browser saves where a
// visitor first came from in the mecard_ft cookie on their first page load;
// signup copies it to users.acquisition. A click on a profile's viral CTA adds
// that profile as ref_profile_id. Plain functions, used in the browser and on
// the server.

export const FIRST_TOUCH_COOKIE = "mecard_ft";
export const FIRST_TOUCH_DAYS = 365;

export interface Acquisition {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  /** Referrer host, without www.; absent for direct visits and same-site referrers. */
  referrer_domain?: string;
  landing_path?: string;
  /** The profile whose viral CTA brought the visitor (recipient_ad_clicked, post_save_cta_clicked). */
  ref_profile_id?: number;
  /** ISO time of the first visit. */
  first_seen?: string;
}

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const clip = (v: unknown, max: number) => String(v ?? "").replace(/[^\w\-.~/:@+% ]/g, "").slice(0, max);

/** The first-touch record for a page load at `href` that came from `referrer`. */
export function firstTouch(href: string, referrer: string, now = new Date()): Acquisition {
  const url = new URL(href);
  const a: Acquisition = { landing_path: clip(url.pathname, 200), first_seen: now.toISOString() };
  for (const k of UTM) {
    const v = url.searchParams.get(k) ?? (k === "utm_source" ? url.searchParams.get("me_source") : null);
    if (v) a[k] = clip(v, 100);
  }
  const ref = referrerDomain(referrer, url.hostname);
  if (ref) a.referrer_domain = ref;
  return a;
}

/** The referrer's host, or null when there is none or it is this site. */
export function referrerDomain(referrer: string, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    return host && host !== ownHost.toLowerCase().replace(/^www\./, "") ? host.slice(0, 100) : null;
  } catch {
    return null;
  }
}

export const encodeAcquisition = (a: Acquisition) => encodeURIComponent(JSON.stringify(a));

/** The cookie value read back, keeping only known, well-formed fields. */
export function parseAcquisition(raw: string | null | undefined): Acquisition | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw.startsWith("%7B") ? decodeURIComponent(raw) : raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const a: Acquisition = {};
  for (const k of [...UTM, "referrer_domain", "landing_path", "first_seen"] as const) {
    if (typeof o[k] === "string" && o[k]) a[k] = clip(o[k], k === "landing_path" ? 200 : 100);
  }
  const ref = Number(o.ref_profile_id);
  if (Number.isInteger(ref) && ref > 0 && ref <= 2147483647) a.ref_profile_id = ref;
  return Object.keys(a).length ? a : null;
}

/** The record with a viral referral added (the latest click wins). */
export const withReferral = (a: Acquisition | null, profileId: number): Acquisition => ({ ...(a ?? {}), ref_profile_id: profileId });

/**
 * Marketing pages that send page_viewed (0.7): home, the site pages (pricing is
 * /cards/, teams /for-teams/), the shop and product pages, and the sign-up
 * pages (so a visitor has a mecard_sid before signup links it, 0.1).
 */
export function isMarketingPath(path: string): boolean {
  const p = path.endsWith("/") ? path : path + "/";
  return p === "/" || p === "/shop/" || p.startsWith("/product/") || p.startsWith("/sign-up/") || /^\/(how-it-works|for-teams|cards|free|gallery|contact-us)\/$/.test(p);
}
