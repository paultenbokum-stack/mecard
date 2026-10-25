import { createHash, randomUUID } from "node:crypto";

// The MeCard event store (events table), ported from Me\Tracking\Module.
// Events arrive from the browser through POST /api/track (sendBeacon) so the
// card pages themselves stay fully cacheable.

export const ALLOWED_EVENTS = new Set([
  // Engagement
  "profile_viewed", "share_intent", "vcard_downloaded", "contact_form_submitted", "recipient_ad_viewed",
  // A tap on the card's own contact links (call, email, WhatsApp, SMS, website, map, socials): meta { kind, label }
  "contact_action",
  // Onboarding
  "signup_started", "signup_completed", "profile_step1_saved", "profile_step2_saved", "look_confirmed",
  "a2hs_prompted", "a2hs_accepted", "a2hs_dismissed", "onboarding_completed",
  // PWA
  "pwa_launched", "pwa_signin_prompted", "pwa_signin_completed", "pwa_anonymous_view_chosen",
  // Conversion plan Phase 0: marketing page views { path }, onboarding step views { step }
  "page_viewed", "onboarding_step_viewed",
  // Monetisation. upsell_viewed / pro_upsell_clicked carry { offer, placement, trigger };
  // checkout_started, payment_cancelled and payment_failed are written on the server.
  "upsell_viewed", "purchase", "pro_upsell_clicked", "additional_profile_added", "team_company_created", "team_member_added",
  "team_invite_sent", "team_invite_accepted",
  // Viral surfaces
  "recipient_ad_clicked", "post_save_cta_viewed", "post_save_cta_clicked", "post_save_cta_dismissed",
  // Legacy
  "first_profile_created",
]);

export const SESSION_COOKIE = "mecard_sid";

/** WordPress sanitize_key(): lowercase letters, digits, _ and -. */
export const sanitizeKey = (s: unknown, max = 64) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, max);

const posInt = (v: unknown) => {
  const n = Math.abs(Math.trunc(Number(v)));
  return Number.isFinite(n) && n > 0 && n <= 2147483647 ? n : null;
};

const salt = () => process.env.TRACKING_SALT || process.env.AUTH_SECRET || "";
export const hashWithSalt = (v: string) => createHash("sha256").update(v + salt()).digest("hex");

export const newSessionId = () => randomUUID();

export interface TrackInput {
  body: Record<string, unknown>;
  sessionCookie: string | null;
  userId: number | null;
  ip: string;
  userAgent: string;
  country: string | null;
}

/** The row to insert for a /api/track call, or null if the event isn't allowed. */
export function eventRow({ body, sessionCookie, userId, ip, userAgent, country }: TrackInput) {
  const name = sanitizeKey(body.event_name);
  if (!ALLOWED_EVENTS.has(name)) return null;
  const sessionId = String(sessionCookie || body.session_id || "").slice(0, 64);
  const referrer = typeof body.referrer === "string" && /^https?:\/\//i.test(body.referrer) ? body.referrer.slice(0, 2048) : null;
  // Any meta is kept, including meta.exp, the experiment tag every event may carry (conversion plan 0.9).
  const meta = body.meta && typeof body.meta === "object" ? (body.meta as Record<string, unknown>) : null;
  return {
    name,
    sessionId,
    userId,
    profileId: posInt(body.profile_id),
    companyId: posInt(body.company_id),
    source: body.source ? sanitizeKey(body.source, 32) || null : null,
    referrer,
    country: country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null,
    uaHash: hashWithSalt(userAgent),
    device: deviceClass(userAgent),
    ipHash: hashWithSalt(ip),
    meta: meta && JSON.stringify(meta).length <= 4000 ? meta : null,
  };
}

/** Visitor IP and country from the load balancer headers. */
export function clientInfo(h: Headers) {
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  // The HTTPS load balancer adds X-Client-Region ({client_region}) once the
  // backend service is given that custom header; Cloudflare-style headers too.
  const country = h.get("x-client-region") || h.get("x-appengine-country") || h.get("cf-ipcountry") || null;
  return { ip, country, userAgent: h.get("user-agent") ?? "" };
}

/**
 * Crawlers, link-preview fetchers (a card link pasted into WhatsApp or
 * LinkedIn) and headless browsers: not people, so not counted.
 */
const BOT_UA = /\b(bot|crawler|spider)\b|[a-z]bot\/|crawl|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp\/|linkedinbot|slackbot|slack-imgproxy|twitterbot|telegrambot|discordbot|skypeuripreview|pinterestbot|embedly|quora link preview|redditbot|applebot|googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|google-pagerenderer|bingbot|bingpreview|yandex|baiduspider|duckduckbot|petalbot|semrush|ahrefs|mj12bot|dotbot|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|chrome-lighthouse|pagespeed|curl\/|wget\/|python-requests|python-urllib|go-http-client|node-fetch|axios\/|okhttp/i;

export const isBotUserAgent = (ua: string) => !ua.trim() || BOT_UA.test(ua);

/** phone | tablet | desktop, from the user agent (iPads asking for desktop sites read as desktop). */
export function deviceClass(ua: string): "phone" | "tablet" | "desktop" | null {
  if (!ua.trim()) return null;
  if (/ipad|tablet|playbook|silk|kindle|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i.test(ua)) return "phone";
  return "desktop";
}
