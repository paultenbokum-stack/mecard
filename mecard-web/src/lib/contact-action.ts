// What a tap on a card's link was, for the contact_action event: the kind of
// action and a short label. Pure, so it runs in the browser and in tests.

export type ContactKind = "call" | "email" | "whatsapp" | "sms" | "map" | "social" | "website";

const SOCIAL: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)(facebook|fb)\.com$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(twitter|x)\.com$/, "twitter"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
];

/**
 * `field` is the link's data-me-field (call, email, wa, company-phone, …), `text`
 * its visible label. Returns null for links that aren't the card's contact
 * details (empty "#" placeholders, other pages).
 */
export function classifyContactLink(href: string, field = "", text = ""): { kind: ContactKind; label: string } | null {
  const h = href.trim();
  if (!h || h === "#" || h.startsWith("javascript:")) return null;
  const label = (field || text).trim().replace(/\s+/g, " ").slice(0, 60);
  const lower = h.toLowerCase();
  if (lower.startsWith("tel:")) return { kind: "call", label: label || "phone" };
  if (lower.startsWith("mailto:")) return { kind: "email", label: label || "email" };
  if (lower.startsWith("sms:")) return { kind: "sms", label: label || "sms" };
  let url: URL;
  try {
    url = new URL(h, "https://mecard.co.za");
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "wa.me" || host === "api.whatsapp.com" || host === "chat.whatsapp.com") return { kind: "whatsapp", label: label || "whatsapp" };
  if (/(^|\.)google\.[a-z.]+$/.test(host) && url.pathname.startsWith("/maps")) return { kind: "map", label: label || "map" };
  if (host === "maps.google.com" || host === "maps.apple.com" || host === "goo.gl" || host === "waze.com" || host === "maps.app.goo.gl") return { kind: "map", label: label || "map" };
  for (const [re, net] of SOCIAL) if (re.test(host)) return { kind: "social", label: net };
  return { kind: "website", label: label || host };
}
