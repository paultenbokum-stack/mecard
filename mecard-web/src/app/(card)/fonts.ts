import { IBM_Plex_Mono, Merriweather, Montserrat, Open_Sans, Playfair_Display, Roboto, Source_Sans_3 } from "next/font/google";

// Self-hosted versions of the fonts the WordPress pages used: Source Sans Pro
// (Astra body), Montserrat (headings), plus every font a company can pick for
// its branding (see lib/branding.ts). The branding fonts are only downloaded by
// browsers on profiles that use them.

export const sourceSans = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-source-sans", display: "swap" });
export const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "600", "700"], variable: "--font-montserrat", display: "swap" });
// IBM Plex Mono: the design system's `mono` family (profile URLs, card IDs) on site and account pages.
export const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-plex-mono", display: "swap", preload: false });
export const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-open-sans", display: "swap", preload: false });
export const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-playfair", display: "swap", preload: false });
export const roboto = Roboto({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-roboto", display: "swap", preload: false });
export const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-merriweather", display: "swap", preload: false });

export const fontVariables = [sourceSans, montserrat, plexMono, openSans, playfair, roboto, merriweather].map((f) => f.variable).join(" ");
