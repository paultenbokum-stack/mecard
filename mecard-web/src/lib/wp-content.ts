// Turns a WordPress page's post_content (block editor markup with Toolset
// blocks and shortcodes) into the HTML WordPress rendered for it, so the site
// pages can be served without WordPress. Used by scripts/export-pages.ts.
//
// What WordPress added at render time and this does too:
//   - the layout classes the block library's CSS hangs off (is-layout-flex …),
//   - closed accordion panels hidden,
//   - Toolset conditionals turned into "logged in" / "logged out" wrappers
//     (shown or hidden in the browser: the pages are cached for everyone),
//   - [cred-form contact-us] and [instagram-feed] replaced by slots the app
//     fills with its own contact form and gallery.

/** Old and dead links mapped to where the new site answers them. */
const LINK_MAP: [RegExp, string][] = [
  [/^\/get-started-teams\/?$/, "/sign-up/"],
  [/^\/get-started\/?$/, "/sign-up/"],
  [/^\/teams\/?$/, "/for-teams/"],
  [/^\/contact\/?$/, "/contact-us/"],
  [/^\/onboarding\/?$/, "/sign-up/"],
  [/^\/manage-mecard-profiles\/new-cards-and-tags\/?$/, "/manage/cards/?tab=new"],
  [/^\/manage-mecard-profiles\/live-cards-and-tags\/?$/, "/manage/cards/"],
  [/^\/manage-mecard-profiles(\/dashboard|\/profiles)?\/?$/, "/manage/"],
  [/^\/manage\/?$/, "/manage/"],
];

const OWN_ORIGIN = /^(?:https?:)?\/\/(?:www\.)?(?:mecard\.co\.za|localhost\/mecard)(?=\/|$)/i;

export function mapLink(url: string): string {
  let u = url.trim().replace(OWN_ORIGIN, "");
  if (u === "") u = "/";
  if (!u.startsWith("/")) return url;
  const [path, rest = ""] = u.split(/(?=[?#])/, 2);
  for (const [re, to] of LINK_MAP) if (re.test(path)) return to + (to.includes("?") ? "" : rest);
  // Pages end in a slash on the new site (and did on WordPress); files don't.
  return (/\.[a-z0-9]{2,5}$/i.test(path) || path.endsWith("/") ? path : `${path}/`) + rest;
}

type Attrs = Record<string, unknown>;

/** Classes WordPress's block renderer adds to a block's wrapper element. */
function layoutClasses(block: string, attrs: Attrs): string[] {
  const layout = (attrs.layout ?? {}) as { type?: string; justifyContent?: string };
  const out: string[] = [];
  switch (block) {
    case "buttons":
      out.push("is-layout-flex", "wp-block-buttons-is-layout-flex");
      if (layout.justifyContent) out.push(`is-content-justification-${layout.justifyContent}`);
      break;
    case "columns":
      out.push("is-layout-flex", "wp-block-columns-is-layout-flex");
      if (attrs.isStackedOnMobile === false) out.push("is-not-stacked-on-mobile");
      break;
    case "column":
      out.push("is-layout-flow", "wp-block-column-is-layout-flow");
      break;
    case "group":
      // Groups without a layout get an inner container instead (see wrapLegacyGroups).
      if (layout.type === "flex") {
        out.push("is-layout-flex", "wp-block-group-is-layout-flex");
        if (layout.justifyContent) out.push(`is-content-justification-${layout.justifyContent}`);
      } else if (layout.type === "constrained") out.push("is-layout-constrained", "wp-block-group-is-layout-constrained");
      else if (layout.type) out.push("is-layout-flow", "wp-block-group-is-layout-flow");
      break;
  }
  return out;
}

function parseAttrs(json: string | undefined): Attrs {
  if (!json) return {};
  try {
    return JSON.parse(json) as Attrs;
  } catch {
    return {};
  }
}

/** Which visitors a Toolset condition was for: "out" (no role / no user id) or "in". */
export function conditionAudience(cond: string): "in" | "out" {
  const c = cond.replace(/\s+/g, " ");
  if (/^\s*\(?\s*NOT\s*\(/i.test(c)) return "in";
  if (/info=\\?"?(role|id)\\?"?\]'\s*\)?\s*eq\s*''/.test(c) || /\(\s*empty\(/i.test(c)) return "out";
  return "in";
}

/**
 * Group blocks saved without a layout: on themes without theme.json (Astra)
 * WordPress renders their content inside <div class="wp-block-group__inner-container">.
 */
export function wrapLegacyGroups(html: string): string {
  const token = /<!-- (\/?)wp:([a-z0-9/-]+)(?:\s+(\{(?:(?!-->)[\s\S])*?\}))?\s*(\/)?-->/g;
  const stack: { name: string; legacy: boolean; innerStart: number }[] = [];
  const edits: [number, string][] = [];
  for (let m: RegExpExecArray | null; (m = token.exec(html)); ) {
    const [, closing, name, json, selfClosing] = m;
    if (selfClosing) continue;
    if (!closing) {
      const legacy = name.replace(/^core\//, "") === "group" && !(parseAttrs(json).layout as { type?: string } | undefined)?.type;
      const open = legacy ? /^\s*<div[^>]*>/.exec(html.slice(token.lastIndex)) : null;
      stack.push({ name, legacy: !!open, innerStart: open ? token.lastIndex + open[0].length : -1 });
      continue;
    }
    const top = stack.pop();
    if (!top || top.name !== name || !top.legacy) continue;
    const end = html.lastIndexOf("</div>", m.index);
    if (end <= top.innerStart) continue;
    edits.push([top.innerStart, '<div class="wp-block-group__inner-container">'], [end, "</div>"]);
  }
  for (const [at, text] of edits.sort((a, b) => b[0] - a[0])) html = html.slice(0, at) + text + html.slice(at);
  return html;
}

export interface ConvertResult {
  html: string;
  /** Shortcodes and blocks that weren't recognised (for the export log). */
  dropped: string[];
}

export function convertPostContent(content: string): ConvertResult {
  const dropped: string[] = [];
  let html = content.replace(/\r\n/g, "\n");

  // 1. Layout classes, from each block comment onto the element right after it.
  html = html.replace(/<!-- wp:([a-z0-9/-]+)(?:\s+(\{(?:(?!-->)[\s\S])*?\}))?\s*(\/)?-->(\s*)<([a-z0-9]+)([^>]*?)class="([^"]*)"/g, (m, name: string, json: string | undefined, _self, ws: string, tag: string, before: string, cls: string) => {
    const block = name.replace(/^core\//, "");
    const extra = layoutClasses(block, parseAttrs(json));
    if (!extra.length) return m;
    return `<!-- wp:${name}${json ? ` ${json}` : ""} -->${ws}<${tag}${before}class="${[cls, ...extra].join(" ")}"`;
  });

  // 2. Toolset conditionals → wrappers the page script shows or hides.
  html = html.replace(/\[wpv-conditional if="([\s\S]*?\))\s*"\s*\]([\s\S]*?)\[\/wpv-conditional\]/g, (_m, cond: string, body: string) => `<div class="mc-when-${conditionAudience(cond)}">${body}</div>`);

  // 3. Shortcodes the app replaces with its own components.
  html = html.replace(/\[cred[-_]form[^\]]*\]/g, '<div data-mc-slot="contact-form"></div>');
  html = html.replace(/\[instagram-feed[^\]]*\]/g, '<div data-mc-slot="gallery"></div>');

  // 4. Block comments go; any other shortcode is reported and dropped.
  html = html.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, "");
  html = html.replace(/\[\/?([a-z][a-z0-9_-]*)(?:\s[^\]]*)?\]/g, (m, name: string) => {
    dropped.push(m.slice(0, 80));
    void name;
    return "";
  });

  // 5. Closed accordion panels start hidden, as the block's script left them.
  html = html.replace(/(<div[^>]*class="wp-block-accordion-item(?![^"]*\bis-open\b)[^"]*"[^>]*>[\s\S]*?<div[^>]*role="region"[^>]*class="wp-block-accordion-panel")/g, "$1 hidden");

  // 6. Links and images: own-site URLs made relative, old paths mapped.
  html = html.replace(/\b(href|src)="([^"]*)"/g, (_m, attr: string, url: string) => `${attr}="${attr === "href" ? mapLink(url) : url.replace(OWN_ORIGIN, "")}"`);

  // 7. Tidy up: empty paragraphs and the blank lines the comments left.
  html = html.replace(/<p>\s*<\/p>/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return { html, dropped };
}
