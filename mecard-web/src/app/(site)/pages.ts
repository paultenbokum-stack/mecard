import type { WpPageData } from "@/components/site/WpPage";
import cards from "@/content/pages/cards.json";
import contactUs from "@/content/pages/contact-us.json";
import forTeams from "@/content/pages/for-teams.json";
import free from "@/content/pages/free.json";
import gallery from "@/content/pages/gallery.json";
import home from "@/content/pages/home.json";
import howItWorks from "@/content/pages/how-it-works.json";
import tscPrivacy from "@/content/pages/tsc-privacy-policy.json";

// The exported WordPress pages (npm run export:pages), by URL slug.
export const HOME: WpPageData = home;
export const TSC_PRIVACY: WpPageData = tscPrivacy;
export const PAGES: Record<string, WpPageData> = {
  "how-it-works": howItWorks,
  "for-teams": forTeams,
  cards,
  free,
  gallery,
  "contact-us": contactUs,
};
