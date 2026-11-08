import { HowItWorksPage } from "@/components/site/HowItWorksPage";
import { wpPageMetadata, type WpPageData } from "@/components/site/WpPage";
import howItWorks from "@/content/pages/how-it-works.json";
import "../home.css";

export const metadata = wpPageMetadata(howItWorks as WpPageData);

export default function Page() {
  return <HowItWorksPage />;
}
