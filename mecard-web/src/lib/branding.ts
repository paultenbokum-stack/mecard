import { COMPANY_CSS_FIXES } from "./company-css-fixes";
import type { Company } from "./public-profile";

// Company branding on pro profiles, ported from
// Me\Profile_Renderer\Module::render_design_style() and Me\Preview\Module::font_to_stack().

// The var(--font-…) families are self-hosted by next/font (app/(card)/fonts.ts).
const FONT_STACKS: Record<string, string> = {
  opensans: 'var(--font-open-sans), "Open Sans", sans-serif',
  Montserrat: "var(--font-montserrat), Montserrat, sans-serif",
  Roboto: "var(--font-roboto), Roboto, sans-serif",
  playfairdisplay: 'var(--font-playfair), "Playfair Display", serif',
  Merriweather: "var(--font-merriweather), Merriweather, serif",
  Helvetica: "Helvetica, Arial, sans-serif",
};

/**
 * The company's chosen font, or "" when it chose none (the theme fonts apply).
 * WordPress printed these through esc_attr(), which turned the quotes in
 * "Open Sans" and "Playfair Display" into &quot; — invalid CSS, so browsers
 * ignored those choices and showed the theme font. They now apply.
 */
export function fontToStack(value: string): string {
  return FONT_STACKS[value] ?? value;
}

// Only plain colour and font-list values; anything that could break out of
// the declaration is left out.
const COLOUR = /^[#\w\s,.()%-]+$/;
const FONT = /^[\w\s,.()"'-]+$/;

function decl(prop: string, value: string) {
  const v = value.trim();
  if (!v || !(prop === "font-family" ? FONT : COLOUR).test(v)) return "";
  return `${prop}: ${v};`;
}

export interface Design {
  headingFont: string;
  headingColor: string;
  bodyFont: string;
  bodyColor: string;
  accent: string;
  buttonText: string;
  download: string;
  downloadText: string;
}

export function companyDesign(c: Company): Design {
  return {
    headingFont: fontToStack(c.headingFont),
    headingColor: c.headingColour || "#000000",
    bodyFont: fontToStack(c.bodyFont),
    bodyColor: c.bodyColour || "#333333",
    accent: c.accentColour || "#d3d3d3",
    buttonText: c.buttonTextColour || "#000000",
    download: c.downloadColour || "#30b030",
    downloadText: c.downloadTextColour || "#000000",
  };
}

/** The scoped <style> block for a pro profile with a company. */
export function designCss(profileId: number, company: Company): string {
  const d = companyDesign(company);
  const scope = `.pro-profile-container.post-${profileId}`;
  const h = ["h1", "h2", "h3", "h4", "h5", "h6"].map((t) => `${scope} ${t}`).join(", ");
  const rules = [
    `${scope} { ${decl("color", d.bodyColor)} ${decl("font-family", d.bodyFont)} }`,
    `${h} { ${decl("font-family", d.headingFont)} ${decl("color", d.headingColor)} }`,
    `${scope} :not(button) a { ${decl("color", d.accent)} }`,
    `${scope} button:not(.mecard-share-fab) { ${decl("background-color", d.accent)} ${decl("color", d.buttonText)} border: 0; }`,
    `#vcard-button-${profileId}.vcard-button { ${decl("background-color", d.download)} }`,
    `#vcard-button-${profileId}.vcard-button a { ${decl("color", d.downloadText)} ${decl("font-family", d.bodyFont)} text-decoration: none; }`,
  ];
  return [rules.join("\n"), scopeCss(company.customCss, scope), scopeCss(COMPANY_CSS_FIXES[company.id] ?? "", scope)].filter(Boolean).join("\n");
}

/**
 * Prefixes every selector in a company's custom CSS with `scope`, so it can
 * only style that profile. Same result as the WordPress scope_css() for plain
 * rules; @media and @supports blocks are scoped too (WordPress mangled them),
 * @font-face and @keyframes pass through, Google Fonts @imports are hoisted,
 * and anything else (other @imports, stray text) is dropped.
 */
export function scopeCss(css: string, scope: string): string {
  if (!css) return "";
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const imports: string[] = [];
  const body = scopeBlock(src, scope, imports);
  return [...imports, body].filter(Boolean).join("\n").replace(/<\/?style/gi, "");
}

function scopeBlock(src: string, scope: string, imports: string[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    const semi = src.indexOf(";", i);
    // @import / @charset statements end at a semicolon before any block.
    const head = src.slice(i, open === -1 ? undefined : open).trim();
    if (head.startsWith("@import") || head.startsWith("@charset")) {
      const end = semi === -1 ? src.length : semi + 1;
      const stmt = src.slice(i, end).trim();
      if (/^@import\s+(url\()?\s*["']?https:\/\/fonts\.googleapis\.com\//i.test(stmt)) imports.push(stmt.endsWith(";") ? stmt : stmt + ";");
      i = end;
      continue;
    }
    if (open === -1) break;
    const close = matchBrace(src, open);
    const inner = src.slice(open + 1, close === -1 ? src.length : close);
    const prelude = src.slice(i, open).trim();
    i = close === -1 ? src.length : close + 1;
    if (!prelude) continue;
    if (prelude.startsWith("@")) {
      const name = prelude.slice(1).split(/[\s(]/)[0].toLowerCase();
      if (name === "media" || name === "supports" || name === "container") {
        out.push(`${prelude} {\n${scopeBlock(inner, scope, imports)}\n}`);
      } else if (name === "font-face" || name.endsWith("keyframes")) {
        out.push(`${prelude} {${inner}}`);
      }
      continue;
    }
    // Stray text before a selector (a pasted paragraph, say) isn't CSS; WordPress
    // left it in and the browser ignored the rule. Drop the whole rule likewise.
    if (/[;}]/.test(prelude)) continue;
    const selectors = prelude
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => scopeSelector(s, scope));
    if (selectors.length) out.push(`${selectors.join(", ")} {${withFontFallback(inner)}}`);
  }
  return out.join("\n");
}

// Companies name fonts phones don't have ("Brandon", 'Calibri') with no
// fallback, which would drop to the browser's serif default now that their
// rules apply. Give such lists a sans-serif fallback.
const GENERIC = /\b(serif|sans-serif|monospace|cursive|fantasy|system-ui|inherit|initial|unset|var\()/i;
export function withFontFallback(declarations: string): string {
  return declarations.replace(/(font-family\s*:\s*)([^;}!]+?)(\s*!important)?(\s*)(?=;|}|$)/gi, (m, prop: string, value: string, imp = "", ws = "") =>
    GENERIC.test(value) ? m : `${prop}${value.trim()}, sans-serif${imp}${ws}`,
  );
}

// Company CSS was written before WordPress started scoping it, so many rules
// address the profile container itself ("div.pro-profile-container h1") or the
// page around it ("body", "div#content"). Prefixed blindly, as WordPress did,
// those never match; they apply to the profile instead. Rules for the theme
// footer (mostly hiding the copyright line) apply to the footer of this page,
// the only page the style block is on.
const SELF = /^(?:div)?\.pro-profile-container(?![\w-])/i;
const PAGE = /^(?:html|body|#page|(?:div)?#content|\.site-content|\.hfeed|(?:div)?\.mecard-public-card)(?![\w-])\s*/i;
const CHROME: [RegExp, string][] = [
  [/^\.ast-footer-copyright(?![\w-])/i, ".mc-site-footer__copy"],
  [/^(?:\.site-footer|footer|#colophon)(?![\w-])/i, ".mc-site-footer"],
  [/^(?:\.site-header|header|#masthead)(?![\w-])/i, ".mc-site-header"],
];

export function scopeSelector(selector: string, scope: string): string {
  let s = selector.trim();
  for (const [re, target] of CHROME) if (re.test(s)) return s.replace(re, target);
  let page = false;
  while (PAGE.test(s)) {
    s = s.replace(PAGE, "");
    page = true;
  }
  if (SELF.test(s)) return scope + s.replace(SELF, "");
  if (page) return s ? `${scope} ${s.replace(/^>\s*/, "> ")}` : scope;
  return `${scope} ${s}`;
}

function matchBrace(src: string, open: number): number {
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return j;
  }
  return -1;
}
