import { Merriweather, Montserrat, Roboto, Source_Sans_3 } from "next/font/google";

// Self-hosted versions of the fonts the WordPress pages used: Source Sans Pro
// (Astra body), Montserrat (headings), plus the company branding choices that
// actually rendered (see lib/branding.ts). Roboto and Merriweather are only
// downloaded by browsers on profiles whose branding uses them.

export const sourceSans = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-source-sans", display: "swap" });
export const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "600", "700"], variable: "--font-montserrat", display: "swap" });
export const roboto = Roboto({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-roboto", display: "swap", preload: false });
export const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-merriweather", display: "swap", preload: false });

export const fontVariables = [sourceSans, montserrat, roboto, merriweather].map((f) => f.variable).join(" ");
