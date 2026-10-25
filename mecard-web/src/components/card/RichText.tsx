import parse, { domToReact, Element, type DOMNode, type HTMLReactParserOptions } from "html-react-parser";
import { ALLOWED_TAGS, allowedAttr, autop, DROP_WITH_CONTENT } from "@/lib/rich-text";

// Company descriptions are HTML typed by company admins. WordPress passed them
// through wp_kses_post(); they are cleaned when saved (sanitizeRichHtml), and
// again here for anything saved before that: the same allowlist of formatting
// tags and safe attributes, everything else unwrapped or dropped.

const options: HTMLReactParserOptions = {
  replace(node) {
    if (!(node instanceof Element)) return undefined;
    const tag = node.name.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) return <></>;
    if (!ALLOWED_TAGS.has(tag)) return <>{domToReact(node.children as DOMNode[], options)}</>;
    for (const name of Object.keys(node.attribs)) {
      if (!allowedAttr(name, node.attribs[name])) delete node.attribs[name];
    }
    return undefined;
  },
};

export function RichText({ html }: { html: string }) {
  return <>{parse(autop(html), options)}</>;
}
