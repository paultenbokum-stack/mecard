import parse, { Element, type HTMLReactParserOptions } from "html-react-parser";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
import { ContactForm } from "./ContactForm";
import { Gallery } from "./Gallery";
import { PageScripts } from "./PageScripts";

// A public site page exported from WordPress (scripts/export-pages.ts), in the
// same Astra wrappers the live page had so the extracted CSS (site.css) applies.

export interface WpPageData {
  id: number;
  path: string;
  title: string;
  seoTitle: string;
  description: string;
  showTitle: boolean;
  container: string;
  html: string;
}

const SLOTS: Record<string, () => React.ReactNode> = {
  "contact-form": () => <ContactForm />,
  gallery: () => <Gallery />,
};

const options: HTMLReactParserOptions = {
  replace(node) {
    if (node instanceof Element && node.attribs["data-mc-slot"]) {
      const slot = SLOTS[node.attribs["data-mc-slot"]];
      return slot ? <>{slot()}</> : <></>;
    }
    return undefined;
  },
};

export function wpPageMetadata(page: WpPageData): Metadata {
  return {
    title: { absolute: page.seoTitle },
    description: page.description || undefined,
    alternates: { canonical: siteUrl(page.path) },
    openGraph: { title: page.seoTitle, description: page.description || undefined, url: siteUrl(page.path), siteName: "MeCard", type: "website" },
  };
}

export function WpPage({ page, home = false }: { page: WpPageData; home?: boolean }) {
  // The live <body> classes the CSS was scoped with (see site.css).
  const bodyClasses = ["mc-wp", "wp-singular", "page", `page-id-${page.id}`, "woocommerce-js", page.container, "ast-no-sidebar", "ast-single-post", home ? "home" : "", page.showTitle ? "ast-normal-title-enabled" : ""];
  return (
    <div className={bodyClasses.filter(Boolean).join(" ")} id="mc-wp">
      <div id="content" className="site-content">
        <div className="ast-container mc-wp-container">
          <div id="primary" className="content-area primary">
            <main id="main" className="site-main">
              <article className={`post-${page.id} page type-page status-publish ast-article-single`} id={`post-${page.id}`}>
                {page.showTitle ? (
                  <header className="entry-header">
                    <h1 className="entry-title">{page.title}</h1>
                  </header>
                ) : null}
                <div className="entry-content clear">{parse(page.html, options)}</div>
              </article>
            </main>
          </div>
        </div>
      </div>
      <PageScripts />
    </div>
  );
}
