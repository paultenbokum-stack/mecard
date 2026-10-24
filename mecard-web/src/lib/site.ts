// Absolute URLs for things that leave the site: vCards, share links, manifests, OG tags.
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://mecard.co.za").replace(/\/+$/, "");

export const siteUrl = (path: string) => SITE_URL + (path.startsWith("/") ? path : `/${path}`);
