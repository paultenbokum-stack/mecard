import { WpPage, wpPageMetadata } from "@/components/site/WpPage";
import { TSC_PRIVACY } from "../../pages";

// A customer's (TSC) privacy policy that WordPress hosted at this address.
export const metadata = wpPageMetadata(TSC_PRIVACY);

export default function TscPrivacyPage() {
  return <WpPage page={TSC_PRIVACY} />;
}
