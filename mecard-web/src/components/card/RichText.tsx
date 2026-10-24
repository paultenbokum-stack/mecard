import parse, { domToReact, Element, type DOMNode, type HTMLReactParserOptions } from "html-react-parser";

// Company descriptions are HTML typed by company admins. WordPress passed them
// through wp_kses_post(); this keeps the same idea: an allowlist of formatting
// tags and safe attributes, everything else unwrapped or dropped.

const ALLOWED_TAGS = new Set([
  "a", "abbr", "b", "blockquote", "br", "caption", "code", "div", "em", "figcaption", "figure", "h1", "h2", "h3", "h4",
  "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "s", "small", "span", "strong", "sub", "sup", "table", "tbody",
  "td", "tfoot", "th", "thead", "tr", "u", "ul",
]);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "form", "input", "button", "select", "textarea", "noscript", "template", "svg", "math"]);
const ALLOWED_ATTRS = new Set(["href", "src", "alt", "title", "class", "style", "target", "rel", "width", "height", "colspan", "rowspan", "align"]);

const safeUrl = (u: string) => /^(https?:|mailto:|tel:|\/(?!\/)|#)/i.test(u.trim());

const options: HTMLReactParserOptions = {
  replace(node) {
    if (!(node instanceof Element)) return undefined;
    const tag = node.name.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) return <></>;
    if (!ALLOWED_TAGS.has(tag)) return <>{domToReact(node.children as DOMNode[], options)}</>;
    for (const name of Object.keys(node.attribs)) {
      const v = node.attribs[name];
      if (!ALLOWED_ATTRS.has(name) || ((name === "href" || name === "src") && !safeUrl(v)) || (name === "style" && /expression|url\s*\(|@import/i.test(v))) {
        delete node.attribs[name];
      }
    }
    return undefined;
  },
};

export function RichText({ html }: { html: string }) {
  return <>{parse(html, options)}</>;
}
