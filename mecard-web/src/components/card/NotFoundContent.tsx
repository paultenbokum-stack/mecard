import { SiteFooter, SiteHeader } from "./SiteChrome";

// The Astra 404 page, minus its search form (there is no site search yet).
export function NotFoundContent() {
  return (
    <>
      <SiteHeader />
      <main id="content" className="mc-not-found">
        <h1>This page doesn&apos;t seem to exist.</h1>
        <p>It looks like the link pointing here was faulty.</p>
      </main>
      <SiteFooter />
    </>
  );
}
