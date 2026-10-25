import { htmlToDOM, type DOMNode } from "html-react-parser";

// Company descriptions are HTML typed by company admins (WordPress's TinyMCE
// field, saved through wp_kses_post()). The same allowlist cleans them when
// they are saved (sanitizeRichHtml), pasted into the editor, and shown on the
// card (components/card/RichText).

export const ALLOWED_TAGS = new Set([
  "a", "abbr", "b", "blockquote", "br", "caption", "code", "div", "em", "figcaption", "figure", "h1", "h2", "h3",
  "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "s", "small", "span", "strong", "sub", "sup", "table",
  "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
]);
export const DROP_WITH_CONTENT = new Set([
  "script", "style", "iframe", "object", "embed", "form", "input", "button", "select", "textarea", "noscript",
  "template", "svg", "math", "head", "title",
]);
const ALLOWED_ATTRS = new Set(["href", "src", "alt", "title", "class", "style", "target", "rel", "width", "height", "colspan", "rowspan", "align"]);
const VOID = new Set(["br", "hr", "img"]);

export const safeUrl = (u: string) => /^(https?:|mailto:|tel:|\/(?!\/)|#)/i.test(u.trim());

/** Whether an attribute survives the allowlist. */
export function allowedAttr(name: string, value: string) {
  if (!ALLOWED_ATTRS.has(name)) return false;
  if ((name === "href" || name === "src") && !safeUrl(value)) return false;
  if (name === "style" && /expression|url\s*\(|@import|javascript:/i.test(value)) return false;
  return true;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => esc(s).replace(/"/g, "&quot;");

function serialize(nodes: DOMNode[]): string {
  let out = "";
  for (const n of nodes) {
    if (n.type === "text") out += esc((n as { data: string }).data);
    else if (n.type === "tag") {
      const el = n as unknown as { name: string; attribs: Record<string, string>; children: DOMNode[] };
      const tag = el.name.toLowerCase();
      if (DROP_WITH_CONTENT.has(tag)) continue;
      if (!ALLOWED_TAGS.has(tag)) {
        out += serialize(el.children);
        continue;
      }
      const attrs = Object.entries(el.attribs)
        .filter(([k, v]) => allowedAttr(k.toLowerCase(), v))
        .map(([k, v]) => ` ${k.toLowerCase()}="${escAttr(v)}"`)
        .join("");
      out += VOID.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>${serialize(el.children)}</${tag}>`;
    } else if (n.type === "script" || n.type === "style") continue;
    // Comments, doctypes and processing instructions are dropped.
  }
  return out;
}

/** The HTML kept: allowed tags and safe attributes; other tags are unwrapped, scripts and the like dropped. */
export function sanitizeRichHtml(html: string): string {
  if (!html.trim()) return "";
  const out = serialize(htmlToDOM(html)).trim();
  // An emptied editor leaves "<p><br></p>" behind.
  return out.replace(/<(p|div)>(\s|<br>|&nbsp;| )*<\/\1>/g, "").trim() ? out : "";
}

const BLOCK_START = /^<(h[1-6]|ul|ol|li|div|blockquote|table|thead|tbody|tr|pre|hr|figure|p)[\s>/]/i;

/**
 * WordPress's wpautop() in short: descriptions saved by TinyMCE keep their
 * paragraphs as blank lines (WordPress added the <p> tags when showing them).
 * HTML that already has paragraphs is left alone.
 */
export function autop(html: string): string {
  if (!html.includes("\n") || /<p[\s>]/i.test(html)) return html;
  return html
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => (BLOCK_START.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, "<br>\n")}</p>`))
    .join("\n");
}
