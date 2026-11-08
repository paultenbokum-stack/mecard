import type { WpPageData } from "@/components/site/WpPage";
import cards from "@/content/pages/cards.json";
import contactUs from "@/content/pages/contact-us.json";
import free from "@/content/pages/free.json";
import gallery from "@/content/pages/gallery.json";
import home from "@/content/pages/home.json";
import tscPrivacy from "@/content/pages/tsc-privacy-policy.json";

// The exported WordPress pages (npm run export:pages), by URL slug. /how-it-works/
// and /for-teams/ have their own routes, and only their metadata still comes from there.
export const HOME: WpPageData = home;
export const TSC_PRIVACY: WpPageData = tscPrivacy;
export const PAGES: Record<string, WpPageData> = {
  cards,
  free,
  gallery,
  "contact-us": contactUs,
};
