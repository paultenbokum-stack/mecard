// Reads a company's details from its website's own code: its structured data,
// meta tags, links and colours. Plain functions, so they can be tested without
// a network. lib/team.ts does the fetching.

export interface SiteRead {
  name: string;
  description: string;
  logoUrl: string;
  phone: string;
  email: string;
  address: string;
  colours: string[];
  socials: { label: string; url: string; icon: string }[];
}

const SOCIALS: [RegExp, string, string][] = [
  [/linkedin\.com/i, "LinkedIn", "fa-brands fa-linkedin"],
  [/facebook\.com/i, "Facebook", "fa-brands fa-facebook"],
  [/instagram\.com/i, "Instagram", "fa-brands fa-instagram"],
  [/youtube\.com/i, "YouTube", "fa-brands fa-youtube"],
  [/(twitter|x)\.com/i, "X", "fa-brands fa-x-twitter"],
];

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;|&#8211;/g, "-")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/** The value of a named attribute in one tag. */
function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? decode(m[2] ?? m[3] ?? "") : "";
}

function meta(html: string, key: string): string {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    if (attr(tag, "property").toLowerCase() === key || attr(tag, "name").toLowerCase() === key) return attr(tag, "content");
  }
  return "";
}

const absolute = (href: string, base: string) => {
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
};

type Json = Record<string, unknown>;
const asText = (v: unknown) => (typeof v === "string" ? decode(v) : "");

/** Organisation-like objects in the page's JSON-LD, however deeply they're nested. */
function organisations(html: string): Json[] {
  const found: Json[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Json;
    const type = ([] as unknown[]).concat(o["@type"] ?? []).join(" ");
    if (/Organization|Corporation|LocalBusiness|Store|Company/i.test(type)) found.push(o);
    if (o["@graph"]) walk(o["@graph"]);
  };
  for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      // Sites often publish broken JSON-LD. The meta tags still help.
    }
  }
  return found;
}

function addressText(v: unknown): string {
  if (typeof v === "string") return decode(v);
  if (!v || typeof v !== "object") return "";
  const a = v as Json;
  return [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].map(asText).filter(Boolean).join(", ");
}

function logoFromOrg(org: Json | undefined, base: string): string {
  const logo = org?.logo;
  const url = typeof logo === "string" ? logo : logo && typeof logo === "object" ? asText((logo as Json).url) : "";
  return url ? absolute(url, base) : "";
}

function logoFromImages(html: string, base: string): string {
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const hay = `${attr(tag, "class")} ${attr(tag, "id")} ${attr(tag, "alt")} ${attr(tag, "src")}`;
    const src = attr(tag, "src") || attr(tag, "data-src");
    if (/logo/i.test(hay) && src && !src.startsWith("data:")) return absolute(src, base);
  }
  return "";
}

function logoFromIcons(html: string, base: string): string {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (/apple-touch-icon/i.test(attr(m[0], "rel")) && attr(m[0], "href")) return absolute(attr(m[0], "href"), base);
  }
  return "";
}

/** A title without its "Home | " or " - Welcome" dressing. */
function cleanTitle(title: string): string {
  const parts = title.split(/\s[|\-–—:]\s/).map((p) => p.trim()).filter(Boolean);
  const named = parts.filter((p) => !/^(home|homepage|welcome)$/i.test(p));
  return named.at(-1) ?? parts[0] ?? "";
}

const expand = (hex: string) => (hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex).toLowerCase();

/** How colourful a hex colour is: greys, near-whites and near-blacks score 0. */
function saturation(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 30 || min > 225) return 0;
  return max - min;
}

/** Brand-like colours, most used first, with the page's theme colour leading. */
export function brandColours(css: string, themeColour = ""): string[] {
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const hex = expand(m[0]);
    if (saturation(hex) >= 40) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  const theme = /^#(?:[0-9a-f]{6}|[0-9a-f]{3})$/i.test(themeColour) ? expand(themeColour) : "";
  return [...new Set([...(theme && saturation(theme) >= 40 ? [theme] : []), ...ranked])].slice(0, 4);
}

/** The first same-origin-or-not stylesheet, to read its colours too. */
export function firstStylesheet(html: string, base: string): string {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (/stylesheet/i.test(attr(m[0], "rel")) && attr(m[0], "href") && !/fonts\.googleapis/i.test(attr(m[0], "href"))) return absolute(attr(m[0], "href"), base);
  }
  return "";
}

export function parseCompanySite(html: string, baseUrl: string, extraCss = ""): SiteRead {
  const orgs = organisations(html);
  const org = orgs[0];
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");

  const hrefs = [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => attr(m[0], "href"));
  const sameAs = ([] as unknown[]).concat(org?.sameAs ?? []).map(asText);
  const phone = asText(org?.telephone) || decodeURIComponent(hrefs.find((h) => /^tel:/i.test(h))?.slice(4) ?? "").trim();
  const email = asText(org?.email).replace(/^mailto:/i, "") || (hrefs.find((h) => /^mailto:/i.test(h))?.slice(7).split("?")[0] ?? "");

  const socials: SiteRead["socials"] = [];
  for (const [re, label, icon] of SOCIALS) {
    const url = [...sameAs, ...hrefs].find((h) => re.test(h) && /^https?:/i.test(h) && !/\/(share|sharer|intent)\b/i.test(h));
    if (url) socials.push({ label, url, icon });
  }

  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const styleAttrs = [...html.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join("\n");

  return {
    name: asText(org?.name) || meta(html, "og:site_name") || cleanTitle(title),
    description: asText(org?.description) || meta(html, "og:description") || meta(html, "description"),
    logoUrl: logoFromOrg(org, baseUrl) || logoFromImages(html, baseUrl) || logoFromIcons(html, baseUrl),
    phone,
    email,
    address: addressText(org?.address),
    colours: brandColours(`${inline}\n${styleAttrs}\n${extraCss}`, meta(html, "theme-color")),
    socials,
  };
}

/** A website as typed ("acme.co.za") with its scheme, or null if it isn't one. */
export function normaliseSiteUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s || s.length > 300 || /\s/.test(s)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname.includes(".") || u.username || u.password) return null;
    if (u.port && u.port !== "80" && u.port !== "443") return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Addresses the server must never fetch: its own machine, private networks, cloud metadata. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [a, b] = v4.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff");
}
