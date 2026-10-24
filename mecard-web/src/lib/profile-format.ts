// Small formatting rules from the WordPress templates, kept pure for tests.

/** WordPress stored "professional"; the import maps it to "pro". */
export const isPro = (p: { type: string }) => p.type === "pro" || p.type === "professional";

// WordPress slugs are lowercase, with any non-ASCII letters stored
// percent-encoded in lowercase ("jos%c3%a9-ndlovu"); WordPress also matched
// /t/ABC/ to /t/abc/. Next.js hands over the decoded slug.
export function normalizeSlug(slug: string): string {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    // keep as given
  }
  return encodeURIComponent(s.toLowerCase()).toLowerCase();
}

/** True when the slug in the URL isn't the canonical one (e.g. /t/ABC/). */
export function needsCanonicalRedirect(slug: string): boolean {
  try {
    return /[A-Z]/.test(decodeURIComponent(slug));
  } catch {
    return /[A-Z]/.test(slug);
  }
}

/** wa.me number: spaces removed, a leading 0 becomes +27, then digits only. */
export function whatsappDigits(raw: string): string {
  if (!raw) return "";
  let n = raw.replace(/\s+/g, "");
  if (n.startsWith("0")) n = "+27" + n.slice(1);
  return n.replace(/[^\d]/g, "");
}

/** Google Maps search link for an address. */
export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** Launcher label of at most 12 characters (mecard_make_short_label). */
export function shortLabel(s: string, limit = 12): string {
  const t = s.trim().replace(/\s+/g, " ");
  const chars = [...t];
  if (chars.length <= limit) return t;
  const parts = t.split(" ");
  if (parts.length >= 2) {
    const cand = `${parts[0]} ${[...parts[1]][0]}.`;
    if ([...cand].length <= limit) return cand;
  }
  return chars.slice(0, Math.max(1, limit - 1)).join("").trimEnd() + "…";
}

/** Only http(s), mailto and tel links are rendered as links; anything else becomes "#". */
export function safeHref(url: string | null | undefined): string {
  const u = (url ?? "").trim();
  if (!u) return "#";
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  // WordPress let people save "www.example.com"; browsers treated it as relative.
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return `https://${u}`;
  return "#";
}

/** WordPress esc_url() on tel: links keeps the number as typed, spaces encoded. */
export const telHref = (n: string) => (n ? `tel:${n.replace(/\s/g, "%20")}` : "#");
