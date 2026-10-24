import Script from "next/script";
import { CardShell } from "@/components/card/CardShell";
import { SiteFooter, SiteHeader } from "@/components/card/SiteChrome";
import "./site.css";

// The public site pages, in the same Astra shell as the card and account pages.
// They are static (built from src/content/pages), so the header works out the
// logged-in menu in the browser.

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CardShell>
      <SiteHeader detect tagline />
      {children}
      <SiteFooter />
      {GA_ID ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      ) : null}
    </CardShell>
  );
}
