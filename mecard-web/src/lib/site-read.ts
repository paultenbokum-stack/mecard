// Reads a company's details from its website's own code: its structured data,
// meta tags, header, links and stylesheets. Plain functions, so they can be
// tested without a network. lib/team.ts does the fetching.

export interface LogoCandidate {
  /** The image's address, or "" for a logo drawn inline in the page (svg). */
  url: string;
  svg?: string;
  source: "site-logo" | "header" | "labelled" | "structured" | "icon";
}

/** The company branding fields a profile uses, guessed from the site. "" leaves the template's own. */
export interface Palette {
  headingColour: string;
  bodyColour: string;
  accentColour: string;
  buttonTextColour: string;
  downloadColour: string;
  downloadTextColour: string;
  headingFont: string;
  bodyFont: string;
}

export interface SiteRead {
  name: string;
  /** Where the name came from. "title" means a guess: nothing on the page matched the domain. */
  nameFrom: "structured" | "domain" | "ai" | "title" | "none";
  /** Short texts the name could be, for the AI step when nameFrom is "title". */
  nameHints: string[];
  description: string;
  logos: LogoCandidate[];
  phone: string;
  email: string;
  address: string;
  palette: Palette;
  /** How many palette roles the site's code stated (variables, button and heading styles, fonts). */
  paletteFound: number;
  /** Colours to offer as swatches, the guessed ones first. */
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

// ── Text ────────────────────────────────────────────────────────────────────

const NAMED: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ensp: " ", emsp: " ", thinsp: " ", shy: "",
  ndash: "–", mdash: "—", hyphen: "-", dash: "‐", lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„",
  laquo: "«", raquo: "»", hellip: "…", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™", deg: "°", times: "×",
  vert: "|", verbar: "|", colon: ":", comma: ",", period: ".", excl: "!", quest: "?", num: "#", percnt: "%", plus: "+",
  aacute: "á", agrave: "à", acirc: "â", auml: "ä", aring: "å", atilde: "ã", aelig: "æ", ccedil: "ç",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", iacute: "í", igrave: "ì", icirc: "î", iuml: "ï", ntilde: "ñ",
  oacute: "ó", ograve: "ò", ocirc: "ô", ouml: "ö", otilde: "õ", oslash: "ø", uacute: "ú", ugrave: "ù", ucirc: "û", uuml: "ü",
  yacute: "ý", szlig: "ß", Aacute: "Á", Eacute: "É", Oacute: "Ó", Uacute: "Ú", Auml: "Ä", Ouml: "Ö", Uuml: "Ü",
};

/** Every HTML entity: numeric (&#8217; &#x27;) and the named ones sites use. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m;
  });
}

/** Page text as people read it: entities decoded (twice, as WordPress often double-encodes), tags and extra spaces gone. */
const decode = (s: string) =>
  decodeEntities(decodeEntities(s))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The value of a named attribute in one tag. */
function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? "") : "";
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
    if (/Organization|Corporation|LocalBusiness|Store|Company|LegalService|ProfessionalService/i.test(type)) found.push(o);
    if (o["@graph"]) walk(o["@graph"]);
    if (o.publisher) walk(o.publisher);
  };
  for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      // Sites often publish broken JSON-LD. The rest of the page still helps.
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

// ── Company name ────────────────────────────────────────────────────────────

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov", "edu", "nom", "web", "biz", "info", "ltd", "plc"]);

/** The name part of a website's address: app.guestwave.co → "guestwave", smith-jones.co.za → "smithjones". */
export function domainKey(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\d?\./, "");
  } catch {
    return "";
  }
  const labels = host.split(".");
  labels.pop();
  while (labels.length > 1 && SECOND_LEVEL.has(labels.at(-1)!)) labels.pop();
  return (labels.at(-1) ?? "").replace(/[^a-z0-9]/g, "");
}

const squash = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
const initials = (s: string) =>
  s
    .split(/[\s&+-]+/)
    .filter((w) => w && !/^(and|the|of|en|van|der|de)$/i.test(w))
    .map((w) => w[0].toLowerCase())
    .join("");

/** How well a candidate name matches the domain: 0 for not at all. */
export function domainScore(candidate: string, key: string): number {
  const n = squash(candidate);
  if (!n || !key || n.length > 60) return 0;
  if (n === key) return 5;
  if (n.startsWith(key)) return 4;
  if (key.length >= 4 && n.includes(key)) return 3;
  if (n.length >= 4 && key.startsWith(n)) return 3;
  const legal = squash(candidate.replace(/\b(\(?pty\)?|ltd|limited|inc|cc|llc|plc)\b\.?/gi, ""));
  if (legal && legal === key) return 5;
  if (key.length >= 2 && initials(candidate) === key) return 2;
  return 0;
}

const DRESSING = /^(home|homepage|home page|welcome|index|start|main)$/i;

/** A title's parts without its "Home | " or " - Welcome" dressing. */
function titleParts(title: string): string[] {
  return title
    .split(/\s[|\-–—:·•»]\s|\s?\|\s?/)
    .map((p) => p.trim().replace(/^welcome to\s+/i, ""))
    .filter((p) => p && !DRESSING.test(p));
}

/** The company name: stated, else the text matching the domain, else the title's first part (a guess). */
function companyName(html: string, base: string, org: Json | undefined, logoAlts: string[]): Pick<SiteRead, "name" | "nameFrom" | "nameHints"> {
  const key = domainKey(base);
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const structured = [asText(org?.name), meta(html, "og:site_name"), meta(html, "application-name"), meta(html, "apple-mobile-web-app-title")].filter(Boolean);
  const h1 = decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").replace(/^welcome to\s+/i, "");
  const copyright = [...html.matchAll(/(?:©|&copy;|&#169;|copyright)\s*(?:\d{4}\s*(?:[-–]\s*\d{4})?\s*)?([^<.,|]{2,60})/gi)]
    .map((m) => decode(m[1]).replace(/\b(all rights reserved|ltd)\b.*$/i, "").trim())
    .filter(Boolean);
  const others = [...titleParts(title), ...logoAlts.map((a) => a.replace(/\s*logo$/i, "").trim()), ...copyright, h1].filter((c) => c && c.length <= 60);
  const nameHints = [...new Set([...structured, title, ...others])].filter(Boolean).slice(0, 10);

  const best = (list: string[]) =>
    list
      .map((c) => ({ c, s: domainScore(c, key) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.c.length - b.c.length)[0]?.c;

  // og:site_name is sometimes just the address ("www.pnet.co.za"): that says nothing.
  const stated = structured.find((s) => !DRESSING.test(s) && !/^(www\.)?[\w-]+(\.[a-z]{2,})+$/i.test(s));
  const matched = best(others);
  if (stated && (domainScore(stated, key) > 0 || !matched)) return { name: stated, nameFrom: "structured", nameHints };
  if (matched) return { name: matched, nameFrom: "domain", nameHints };
  const guess = titleParts(title)[0] ?? "";
  return { name: guess, nameFrom: guess ? "title" : "none", nameHints };
}

// ── Logo ────────────────────────────────────────────────────────────────────

const NOT_LOGO = /pixel|spacer|blank\.gif|1x1|facebook\.com\/tr|gravatar|\bflag|cart|basket|search|hamburger|menu-icon|icon-(menu|close)|whatsapp|payfast|visa|mastercard|loader|spinner|placeholder|avatar/i;
const ICON_SVG = /class\s*=\s*["'][^"']*(icon|hamburger|menu|toggle|search|cart|chevron|arrow|close|caret|social)/i;

/** The best image address in one <img>: the largest srcset entry, lazy-load attributes, then src. */
function imgSrc(tag: string, base: string): string {
  const set = attr(tag, "srcset") || attr(tag, "data-srcset") || attr(tag, "data-lazy-srcset");
  let src = "";
  if (set) {
    const best = set
      .split(",")
      .map((x) => x.trim().split(/\s+/))
      .map(([u, w]) => ({ u, w: parseFloat(w ?? "0") || 0 }))
      .sort((a, b) => b.w - a.w)[0];
    src = best?.u ?? "";
  }
  src ||= attr(tag, "data-lazy-src") || attr(tag, "data-src") || attr(tag, "data-original") || attr(tag, "src");
  if (!src || src.startsWith("data:") || NOT_LOGO.test(src)) return "";
  return absolute(src, base);
}

/** An inline <svg> logo starting at index i, ready to rasterise, or "". */
function inlineSvg(html: string, i: number): string {
  const end = html.indexOf("</svg>", i);
  if (end < 0) return "";
  const svg = html.slice(i, end + 6);
  const open = svg.match(/^<svg\b[^>]*>/i)?.[0] ?? "";
  if (svg.length > 150_000 || ICON_SVG.test(open) || !/<(path|text|polygon|rect|circle|g)\b/i.test(svg)) return "";
  const w = parseFloat(attr(open, "width"));
  if (w && w <= 32) return "";
  return /\sxmlns=/i.test(open) ? svg : svg.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
}

/** The first logo-like image or inline svg in a stretch of the page. */
function firstLogoIn(html: string, from: number, to: number, base: string): { url: string; svg?: string; alt: string } | null {
  const region = html.slice(from, to);
  const re = /<img\b[^>]*>|<svg\b/gi;
  for (const m of region.matchAll(re)) {
    if (m[0].toLowerCase().startsWith("<svg")) {
      const svg = inlineSvg(html, from + (m.index ?? 0));
      if (svg) return { url: "", svg, alt: "" };
      continue;
    }
    const tag = m[0];
    if (NOT_LOGO.test(`${attr(tag, "class")} ${attr(tag, "alt")}`) || /promo|banner|hero|slide|campaign|thumb|menu-|product/i.test(`${attr(tag, "class")} ${attr(tag, "src")}`)) continue;
    const w = parseInt(attr(tag, "width"), 10);
    if (w && w < 40) continue;
    const url = imgSrc(tag, base);
    if (url) return { url, alt: attr(tag, "alt") };
  }
  return null;
}

/** The page's header: <header>, #masthead, .site-header, .navbar or a theme's header block. */
function headerRange(html: string): [number, number] | null {
  const body = Math.max(0, html.search(/<body\b/i));
  const re = /<header\b|<[a-z]+\b[^>]*(?:id\s*=\s*["'](?:masthead|header|site-header)["']|class\s*=\s*["'][^"']*\b(?:site-header|main-header|navbar|elementor-location-header|header-main|header-wrap|ast-primary-header|et-l--header)\b)/gi;
  re.lastIndex = body;
  const m = re.exec(html);
  if (!m) return null;
  const close = html.indexOf("</header>", m.index);
  return [m.index, close > 0 && close - m.index < 60_000 ? close : Math.min(html.length, m.index + 20_000)];
}

function logoCandidates(html: string, base: string, org: Json | undefined): { logos: LogoCandidate[]; alts: string[] } {
  const found: (LogoCandidate & { alt?: string })[] = [];
  const add = (c: (LogoCandidate & { alt?: string }) | null) => {
    if (!c || (!c.url && !c.svg)) return;
    if (found.some((f) => (c.url && f.url === c.url) || (c.svg && f.svg === c.svg))) return;
    found.push(c);
  };

  // 1. The theme's or page builder's own site-logo element.
  const marker = /custom-logo|site-logo|navbar-brand|theme-site-logo|logo-link|header-logo|brand-logo|site-branding/gi;
  for (const m of html.matchAll(marker)) {
    const tagStart = html.lastIndexOf("<", m.index ?? 0);
    const hit = firstLogoIn(html, tagStart, tagStart + 3000, base);
    if (hit) {
      add({ ...hit, source: "site-logo" });
      break;
    }
  }

  // 2. The header: the image or svg in a link to the home page, then its first one.
  const range = headerRange(html);
  if (range) {
    const [from, to] = range;
    const header = html.slice(from, to);
    const home = new URL(base).origin;
    for (const a of header.matchAll(/<a\b[^>]*>/gi)) {
      const href = attr(a[0], "href");
      const abs = absolute(href, base).replace(/\/$/, "");
      if (href === "/" || href === "./" || abs === home || abs === home.replace("://", "://www.") || abs === home.replace("://www.", "://")) {
        const start = from + (a.index ?? 0);
        const close = html.indexOf("</a>", start);
        const hit = firstLogoIn(html, start, close > 0 ? close : start + 3000, base);
        if (hit) {
          add({ ...hit, source: "header" });
          break;
        }
      }
    }
    const first = firstLogoIn(html, from, to, base);
    if (first) add({ ...first, source: "header" });
  }

  // 3. Any image that says it's the logo.
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(`${attr(tag, "class")} ${attr(tag, "id")} ${attr(tag, "alt")} ${attr(tag, "src")} ${attr(tag, "data-src")}`)) continue;
    if (/partner|client|award|footer|sponsor|member|accredit|bbbee|b-bbee/i.test(`${attr(tag, "class")} ${attr(tag, "alt")} ${attr(tag, "src")}`)) continue;
    const url = imgSrc(tag, base);
    if (url) {
      add({ url, alt: attr(tag, "alt"), source: "labelled" });
      break;
    }
  }

  // 4. The structured-data logo, then the home-screen icon.
  const logo = org?.logo;
  const orgLogo = typeof logo === "string" ? logo : logo && typeof logo === "object" ? asText((logo as Json).url) || asText((logo as Json).contentUrl) : "";
  if (orgLogo) add({ url: absolute(orgLogo, base), source: "structured" });
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (/apple-touch-icon/i.test(attr(m[0], "rel")) && attr(m[0], "href")) {
      add({ url: absolute(attr(m[0], "href"), base), source: "icon" });
      break;
    }
  }

  return {
    logos: found.slice(0, 4).map((c) => ({ url: c.url, source: c.source, ...(c.svg ? { svg: c.svg } : {}) })),
    alts: found.map((f) => f.alt ?? "").filter((a) => a && !/^logo$/i.test(a)),
  };
}

// ── Colours ─────────────────────────────────────────────────────────────────

type Rgb = [number, number, number];
const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")).join("")}`;
const rgbOf = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

const num = (s: string, max: number) => (s.trim().endsWith("%") ? (parseFloat(s) / 100) * max : parseFloat(s));

/** A CSS colour as #rrggbb, or null (transparent, unknown names, anything unreadable). */
export function parseColour(raw: string, vars: Map<string, string> = new Map(), depth = 0): string | null {
  const v = raw.trim().replace(/\s*!important$/i, "").toLowerCase();
  const ref = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
  if (ref) {
    if (depth > 4) return null;
    const found = vars.get(ref[1]);
    return (found && parseColour(found, vars, depth + 1)) || (ref[2] ? parseColour(ref[2], vars, depth + 1) : null);
  }
  const hex = v.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = h.split("").map((c) => c + c).join("");
    if (h.length === 8 && parseInt(h.slice(6), 16) < 128) return null;
    return `#${h.slice(0, 6)}`;
  }
  const fn = v.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    if (parts[3] !== undefined && num(parts[3], 1) < 0.5) return null;
    if (fn[1].startsWith("rgb")) return toHex([num(parts[0], 255), num(parts[1], 255), num(parts[2], 255)]);
    return toHex(hslToRgb(parseFloat(parts[0]), num(parts[1], 1) > 1 ? num(parts[1], 1) / 100 : num(parts[1], 1), num(parts[2], 1) > 1 ? num(parts[2], 1) / 100 : num(parts[2], 1)));
  }
  if (v === "white" || v === "#fff") return "#ffffff";
  if (v === "black") return "#000000";
  return null;
}

/** The first colour inside a value such as a background shorthand. */
function colourIn(value: string, vars: Map<string, string>): string | null {
  for (const m of value.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|var\([^()]*(?:\([^)]*\))?[^()]*\)|\b(?:white|black)\b/gi)) {
    const c = parseColour(m[0], vars);
    if (c) return c;
  }
  return null;
}

function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** White or a near-black, whichever reads better on the colour. */
export const textOn = (bg: string) => (contrast(bg, "#ffffff") >= contrast(bg, "#111111") ? "#ffffff" : "#111111");

/** How colourful a colour is: greys, near-whites and near-blacks score 0. */
function saturation(hex: string): number {
  const [r, g, b] = rgbOf(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 30 || min > 225) return 0;
  return max - min;
}

const nearWhite = (hex: string) => luminance(hex) > 0.75;

// Colours every WordPress or Bootstrap site ships, branded or not: they say nothing about the brand.
const STOCK = new Set([
  "#cf2e2e", "#ff6900", "#fcb900", "#7bdcb5", "#00d084", "#8ed1fc", "#0693e3", "#9b51e0", "#f78da7", "#abb8c3", "#32373c",
  "#0d6efd", "#6610f2", "#6f42c1", "#d63384", "#dc3545", "#fd7e14", "#ffc107", "#198754", "#20c997", "#0dcaf0",
  "#007bff", "#28a745", "#17a2b8", "#6c757d", "#e83e8c", "#0073aa", "#2271b1", "#135e96", "#d63638", "#00a32a",
  // Theme defaults (Astra, OceanWP, Divi, GeneratePress, WooCommerce) that unbranded sites keep.
  "#0170b9", "#046bd2", "#0274be", "#13aff0", "#2ea3f2", "#1e73be", "#96588a", "#7f54b3", "#a46497",
  // Share buttons in the networks' own colours.
  "#25d366", "#128c7e", "#1877f2", "#3b5998", "#0077b5", "#0a66c2", "#1da1f2", "#e4405f", "#ff0000",
]);

type Role = "button" | "buttonText" | "heading" | "text" | "link" | "header" | "primary" | "secondary" | "accent";

const VAR_ROLES: [RegExp, Role][] = [
  [/^--e-global-color-primary$|^--(?:bs-|theme-|brand-|color-|wp--preset--color--|global-)?primary(?:-colou?r)?$|^--brand(?:-colou?r)?$|^--main-colou?r$|^--colou?r-(?:brand|main)$|^--ast-global-color-0$|^--global-palette1$/, "primary"],
  [/^--e-global-color-secondary$|^--(?:bs-|theme-|brand-|color-|wp--preset--color--|global-)?secondary(?:-colou?r)?$|^--global-palette2$/, "secondary"],
  [/^--e-global-color-accent$|^--(?:bs-|theme-|color-|wp--preset--color--)?accent(?:-colou?r)?$/, "accent"],
  [/^--e-global-color-text$|^--(?:bs-)?body-colou?r$|^--text-colou?r$|^--colou?r-text$|^--wp--preset--color--(?:foreground|contrast)$|^--ast-global-color-3$|^--global-palette4$/, "text"],
  [/^--ast-global-color-2$|^--heading-colou?r$|^--colou?r-heading$|^--global-palette3$/, "heading"],
];

const SKIP_SELECTOR = /:hover|:focus|:active|:visited|:disabled|::|admin-?bar|cookie|consent|gdpr|notice|alert|error|warning|success|woocommerce-(?:message|info|error)|placeholder|selection|dark|footer|\.is-style-outline|outline|ghost|secondary|btn-(?:light|link|white|close|default|outline)|menu-toggle|search|slick|swiper|owl-|mfp-|pswp|lightbox|modal|popup|whatsapp|facebook|twitter|linkedin|instagram|youtube|social|share/i;
const BUTTON = /^(?:button|input\[type=["']?(?:submit|button)["']?\]|[a-z]*\.(?:btn|button|wp-block-button__link|elementor-button|wp-element-button|et_pb_button|fusion-button|ast-button|btn-primary|button-primary|cta-button|theme-btn|main-btn|sqs-block-button-element[\w-]*|wpcf7-submit))(?:[.#\[][^\s]*)?$/i;
const HEADING = /^(?:h[1-3]|\.entry-title|\.elementor-heading-title|\.page-title)$/i;
const TEXT = /^(?:body|html|p|\.entry-content|:root)$/i;
const HEADER = /^(?:header|\.site-header|#masthead|\.navbar|\.main-header|\.elementor-location-header)$/i;

interface Rule {
  sel: string;
  decls: [string, string][];
}

function cssRules(css: string): Rule[] {
  const out: Rule[] = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith("@")) continue;
    const decls: [string, string][] = [];
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i > 0) decls.push([d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim().replace(/\s*!important$/i, "")]);
    }
    out.push({ sel, decls });
  }
  return out;
}

/** CSS custom properties, preferring those set on :root, html, body or an Elementor kit. */
function cssVars(rules: Rule[]): Map<string, string> {
  const vars = new Map<string, string>();
  const global = /(^|,)\s*(:root|html|body|\*|\.elementor-kit-\d+)\s*(,|$)/;
  for (const pass of [true, false]) {
    for (const r of rules) {
      if (global.test(r.sel) !== pass) continue;
      for (const [p, v] of r.decls) if (p.startsWith("--") && !vars.has(p)) vars.set(p, v);
    }
  }
  return vars;
}

/** The first font family in a font-family value, unquoted. */
const firstFamily = (v: string, vars: Map<string, string>) => {
  const ref = v.match(/^var\(\s*(--[\w-]+)/);
  const value = ref ? (vars.get(ref[1]) ?? "") : v;
  return value.split(",")[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
};

const SERIF = /playfair|merriweather|lora|georgia|times|baskerville|cormorant|garamond|crimson|serif display|pt serif|noto serif|dm serif|libre caslon|bodoni|didot|prata|cinzel|spectral|source serif|roboto slab|zilla/i;
const GEOMETRIC = /montserrat|poppins|raleway|nunito(?! sans)|work sans|dm sans|outfit|jost|futura|gotham|avenir|manrope|urbanist|figtree|lexend|sora|plus jakarta|josefin|quicksand|questrial|century gothic|proxima/i;
const NEUTRAL = /roboto|inter\b|arimo|heebo|barlow|rubik|karla/i;
const HELVETICA = /helvetica|arial|system-ui|-apple-system|segoe/i;

/** One of the profile's fonts (company-edit FONT_CHOICES) closest to a site's font, or "" to keep the default. */
export function matchFont(family: string, role: "heading" | "body", fallbackSerif = false): string {
  const f = family.toLowerCase();
  if (!f || /^(inherit|initial|unset|var\()/.test(f) || /awesome|icon|dashicons|eicons/i.test(f)) return "";
  if (/open sans/.test(f)) return "opensans";
  if (/montserrat/.test(f)) return "Montserrat";
  if (/^roboto$|roboto(?! slab)/.test(f)) return "Roboto";
  if (/playfair/.test(f)) return "playfairdisplay";
  if (/merriweather/.test(f)) return "Merriweather";
  if (SERIF.test(f) || (fallbackSerif && f === "serif")) return role === "heading" ? "playfairdisplay" : "Merriweather";
  if (GEOMETRIC.test(f)) return "Montserrat";
  if (NEUTRAL.test(f)) return "Roboto";
  if (HELVETICA.test(f)) return "Helvetica";
  if (/sans|lato|source|mulish|pt sans|noto|ubuntu|hind|cabin|fira|oxygen|asap|mukta|titillium|exo|oswald|archivo/.test(f)) return "opensans";
  return "";
}

class Votes {
  private m = new Map<Role, Map<string, number>>();
  add(role: Role, hex: string | null, w: number) {
    if (!hex) return;
    const r = this.m.get(role) ?? new Map<string, number>();
    r.set(hex, (r.get(hex) ?? 0) + w);
    this.m.set(role, r);
  }
  ranked(role: Role): string[] {
    return [...(this.m.get(role)?.entries() ?? [])].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  }
}

const lastCompound = (part: string) => part.trim().split(/\s*[\s>+~]\s*/).at(-1) ?? "";

/**
 * The profile's colours and fonts, from the jobs the site's CSS gives its colours:
 * named variables first (Elementor, WordPress, Bootstrap, Astra), then the button,
 * heading, body and link styles, then how often each brand colour is used.
 */
export function guessPalette(css: string, themeColour = ""): { palette: Palette; found: number; colours: string[] } {
  const rules = cssRules(css);
  const vars = cssVars(rules);
  const votes = new Votes();
  const fonts = { heading: new Map<string, number>(), body: new Map<string, number>() };
  const addFont = (k: "heading" | "body", v: string) => {
    const f = firstFamily(v, vars);
    if (f) fonts[k].set(f, (fonts[k].get(f) ?? 0) + 1);
  };

  for (const [name, value] of vars) {
    const role = VAR_ROLES.find(([re]) => re.test(name))?.[1];
    const hex = role ? parseColour(value, vars) : null;
    if (role && hex && !STOCK.has(hex)) votes.add(role, hex, 6);
  }
  for (const [name, value] of vars) {
    if (/^--e-global-typography-primary-font-family$|^--wp--preset--font-family--heading$|^--heading-font/.test(name)) addFont("heading", value);
    if (/^--e-global-typography-text-font-family$|^--wp--preset--font-family--body$|^--body-font/.test(name)) addFont("body", value);
  }

  for (const r of rules) {
    if (SKIP_SELECTOR.test(r.sel)) continue;
    const parts = r.sel.split(",").map(lastCompound);
    const is = (re: RegExp) => parts.some((p) => re.test(p));
    for (const [prop, value] of r.decls) {
      const bg = prop === "background" || prop === "background-color";
      if (prop === "font-family") {
        if (is(HEADING)) addFont("heading", value);
        else if (is(TEXT)) addFont("body", value);
        continue;
      }
      if (!bg && prop !== "color") continue;
      const hex = colourIn(value, vars);
      if (!hex) continue;
      if (is(BUTTON)) votes.add(bg ? "button" : "buttonText", hex, 2);
      else if (bg && is(HEADER)) votes.add("header", hex, 2);
      else if (!bg && is(HEADING)) votes.add("heading", hex, 2);
      else if (!bg && is(TEXT)) votes.add("text", hex, 2);
      else if (!bg && parts.some((p) => p === "a")) votes.add("link", hex, 2);
    }
  }

  // How often each brand colour is used, for anything the CSS doesn't say.
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi)) {
    const hex = parseColour(m[0]);
    if (hex && saturation(hex) >= 40 && !STOCK.has(hex)) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const frequent = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const theme = parseColour(themeColour);

  let found = 0;
  const pick = (list: string[], ok: (h: string) => boolean) => list.find(ok) ?? "";
  const usable = (h: string) => !nearWhite(h);

  // A colour the site names as its primary or brand colour, then its buttons' colour.
  // A theme default on the buttons is only used when the site states nothing better.
  let accent = pick([...votes.ranked("primary"), ...votes.ranked("button").filter((h) => !STOCK.has(h)), ...votes.ranked("accent"), ...votes.ranked("button")], usable);
  if (accent) found++;
  if (!accent) accent = pick([...votes.ranked("link").filter((h) => saturation(h) >= 40), ...(theme && saturation(theme) >= 40 ? [theme] : []), ...frequent], usable);

  const second = pick([...votes.ranked("secondary"), ...votes.ranked("accent"), ...votes.ranked("primary")], (h) => usable(h) && h !== accent);
  const download = second || accent;

  const heading = pick([...votes.ranked("heading")], (h) => contrast(h, "#ffffff") >= 3);
  const body = pick([...votes.ranked("text")], (h) => contrast(h, "#ffffff") >= 4.5);
  if (heading) found++;
  if (body) found++;

  let buttonText = accent ? pick(votes.ranked("buttonText"), (h) => contrast(h, accent) >= 4.5) : "";
  if (buttonText) found++;
  if (accent && !buttonText) buttonText = textOn(accent);

  const best = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  const headingFont = best(fonts.heading).map((f) => matchFont(f, "heading", true)).find(Boolean) ?? "";
  const bodyFont = best(fonts.body).map((f) => matchFont(f, "body", true)).find(Boolean) ?? "";
  if (headingFont) found++;
  if (bodyFont) found++;

  const palette: Palette = {
    headingColour: heading,
    bodyColour: body,
    accentColour: accent,
    buttonTextColour: buttonText,
    downloadColour: download,
    downloadTextColour: download ? (download === accent ? buttonText : textOn(download)) : "",
    headingFont,
    bodyFont,
  };
  const colours = [...new Set([accent, download, ...votes.ranked("primary"), ...votes.ranked("secondary"), ...votes.ranked("accent"), ...votes.ranked("button"), ...frequent, ...votes.ranked("header"), heading].filter((h) => h && usable(h) && (h === accent || h === download || !STOCK.has(h))))].slice(0, 8);
  return { palette, found, colours };
}

/** Fill a palette that found no accent from the logo's main colour. */
export function paletteFromLogo(p: Palette, logoColour: string): Palette {
  if (p.accentColour || !logoColour || nearWhite(logoColour)) return p;
  const text = textOn(logoColour);
  return { ...p, accentColour: logoColour, buttonTextColour: text, downloadColour: logoColour, downloadTextColour: text };
}

/**
 * The main colour of a logo from its raw RGBA pixels (a small resize is plenty),
 * and whether it's mostly white, made for a dark header.
 */
export function logoColours(pixels: Uint8Array, channels = 4): { colour: string; light: boolean } {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  let opaque = 0;
  let light = 0;
  for (let i = 0; i + channels - 1 < pixels.length; i += channels) {
    if (channels === 4 && pixels[i + 3] < 128) continue;
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    opaque++;
    if (r > 225 && g > 225 && b > 225) light++;
    if (saturation(toHex([r, g, b])) < 50) continue;
    const k = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const x = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    buckets.set(k, { n: x.n + 1, r: x.r + r, g: x.g + g, b: x.b + b });
  }
  const top = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  return {
    colour: top && top.n >= Math.max(4, opaque * 0.03) ? toHex([top.r / top.n, top.g / top.n, top.b / top.n]) : "",
    light: opaque > 0 && light / opaque > 0.6,
  };
}

// ── Stylesheets and the whole read ──────────────────────────────────────────

/** Up to `max` stylesheets worth reading for colours: the theme's and page builder's first, then other same-site ones. */
export function stylesheets(html: string, base: string, max = 3): string[] {
  const host = new URL(base).hostname.replace(/^www\./, "");
  const all = [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter((m) => /stylesheet/i.test(attr(m[0], "rel")) && attr(m[0], "href"))
    .map((m) => absolute(attr(m[0], "href"), base))
    .filter((u) => u && !/fonts\.googleapis|font-?awesome|wp-includes|dashicons|\/plugins\/(?!elementor)/i.test(u));
  const sameSite = all.filter((u) => new URL(u).hostname.replace(/^www\./, "") === host);
  const rank = (u: string) => (/\/themes\//i.test(u) ? 0 : /elementor\/css\/(post|global)|uploads\/.*\.css/i.test(u) ? 1 : 2);
  const ordered = [...sameSite].sort((a, b) => rank(a) - rank(b));
  return [...new Set([...ordered, ...all])].slice(0, max);
}

export function parseCompanySite(html: string, baseUrl: string, extraCss = ""): SiteRead {
  const orgs = organisations(html);
  const org = orgs[0];

  const hrefs = [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => attr(m[0], "href"));
  const sameAs = ([] as unknown[]).concat(org?.sameAs ?? []).map(asText);
  let phone = asText(org?.telephone);
  if (!phone) {
    try {
      phone = decodeURIComponent(hrefs.find((h) => /^tel:/i.test(h))?.slice(4) ?? "").trim();
    } catch {
      phone = "";
    }
  }
  const email = asText(org?.email).replace(/^mailto:/i, "") || (hrefs.find((h) => /^mailto:/i.test(h))?.slice(7).split("?")[0] ?? "");

  const socials: SiteRead["socials"] = [];
  for (const [re, label, icon] of SOCIALS) {
    const url = [...sameAs, ...hrefs].find((h) => re.test(h) && /^https?:/i.test(h) && !/\/(share|sharer|intent)\b/i.test(h));
    if (url) socials.push({ label, url, icon });
  }

  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const styleAttrs = [...html.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)].map((m) => `.inline{${decodeEntities(m[1])}}`).join("\n");
  const { logos, alts } = logoCandidates(html, baseUrl, org);
  const { palette, found, colours } = guessPalette(`${extraCss}\n${inline}\n${styleAttrs}`, meta(html, "theme-color"));

  return {
    ...companyName(html, baseUrl, org, alts),
    description: asText(org?.description) || meta(html, "og:description") || meta(html, "description"),
    logos,
    phone,
    email,
    address: addressText(org?.address),
    palette,
    paletteFound: found,
    colours,
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
