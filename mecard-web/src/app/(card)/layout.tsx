import type { Viewport } from "next";
import Script from "next/script";
import { CardShell } from "@/components/card/CardShell";

export const viewport: Viewport = { themeColor: "#ffffff" };

// GA4 (gtag.js, no GTM) as on WordPress. CardBehaviour sends the profile events.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function CardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CardShell>
      {children}
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
