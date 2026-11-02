import Script from "next/script";

// The Google tag (gtag.js, no GTM) as on WordPress: GA4 plus the Google Ads
// account, so ad clicks and the purchase conversion are measured. Both IDs are
// inlined at build time; blank = off (local and test builds).
export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
/** "AW-<account>/<label>" of the MeCard Purchase conversion. */
export const ADS_PURCHASE = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE;
const ADS_ID = ADS_PURCHASE?.split("/")[0];

export function GoogleTag() {
  const ids = [GA_ID, ADS_ID].filter(Boolean);
  if (!ids.length) return null;
  const config = ids.map((id) => `gtag('config','${id}');`).join("");
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${ids[0]}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag('js',new Date());${config}`}
      </Script>
    </>
  );
}
