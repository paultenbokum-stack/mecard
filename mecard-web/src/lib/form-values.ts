// Cleaning what people type into the editors, like the plugin's
// sanitize_field_value() (sanitize_text_field, sanitize_email, esc_url_raw).

/** One line of plain text: tags and control characters removed, spaces collapsed. */
export function cleanText(v: unknown, max = 255): string {
  return String(v ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * A link people can click: blank stays blank, "www.site.com" and "site.com/x"
 * get https://, and only http(s), mailto and tel survive (esc_url_raw).
 */
export function cleanUrl(v: unknown, max = 500): string {
  const s = cleanText(v, 2000).replace(/\s/g, "");
  if (!s) return "";
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s.slice(0, max);
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return "";
  if (/^\/\//.test(s)) return `https:${s}`.slice(0, max);
  return /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(s) ? `https://${s}`.slice(0, max) : "";
}

const SOCIAL_HOSTS: Record<string, string> = {
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  twitter: "https://x.com/",
  tiktok: "https://www.tiktok.com/@",
  youtube: "https://www.youtube.com/@",
  linkedin: "https://www.linkedin.com/in/",
};

/** A social profile: a full URL, or a bare @handle turned into the network's URL. */
export function cleanSocial(network: string, v: unknown): string {
  const s = cleanText(v, 500).replace(/\s/g, "");
  if (!s) return "";
  const handle = s.match(/^@?([A-Za-z0-9._-]{1,60})$/);
  if (handle && !/\.(com|net|org|co|za|io)$/i.test(handle[1]) && SOCIAL_HOSTS[network]) return SOCIAL_HOSTS[network] + handle[1];
  return cleanUrl(s);
}

export function cleanEmail(v: unknown): string {
  const s = cleanText(v, 255).replace(/\s/g, "");
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : "";
}

/** Phone numbers keep digits, spaces, +, brackets and dashes. */
export function cleanPhone(v: unknown): string {
  return cleanText(v, 50).replace(/[^\d\s+()-]/g, "").trim();
}

/** A CSS colour from the colour pickers (#rgb / #rrggbb), or "" for the default. */
export function cleanColour(v: unknown): string {
  const s = cleanText(v, 20);
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s.toLowerCase() : "";
}
