import type { Company } from "./public-profile";

// Company branding on pro profiles, ported from
// Me\Profile_Renderer\Module::render_design_style() and Me\Preview\Module::font_to_stack().

// The var(--font-…) families are self-hosted by next/font (app/(card)/fonts.ts).
const FONT_STACKS: Record<string, string> = {
  opensans: '"Open Sans", sans-serif',
  Montserrat: "var(--font-montserrat), Montserrat, sans-serif",
  Roboto: "var(--font-roboto), Roboto, sans-serif",
  playfairdisplay: '"Playfair Display", serif',
  Merriweather: "var(--font-merriweather), Merriweather, serif",
  Helvetica: "Helvetica, Arial, sans-serif",
};

export function fontToStack(value: string): string {
  return FONT_STACKS[value] ?? (value || '"Montserrat", sans-serif');
}

// WordPress printed these values through esc_attr(), which turns `"` into
// &quot; — so any stack with a quoted family name ("Open Sans", the default
// "Montserrat") was invalid CSS and the browser dropped it, leaving the theme
// fonts. Visitors have only ever seen the unquoted stacks, so only those apply.
// Anything that isn't plainly a colour or font list is dropped too.
function cssValue(v: string): string | null {
  if (!v || v.includes('"')) return null;
  return /^[#\w\s,.()%-]+$/.test(v) ? v.trim() : null;
}

function decl(prop: string, value: string) {
  const v = cssValue(value);
  return v ? `${prop}: ${v};` : "";
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
  return [rules.join("\n"), scopeCss(company.customCss, scope)].filter(Boolean).join("\n");
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
      .map((s) => `${scope} ${s}`);
    if (selectors.length) out.push(`${selectors.join(", ")} {${inner}}`);
  }
  return out.join("\n");
}

function matchBrace(src: string, open: number): number {
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return j;
  }
  return -1;
}
