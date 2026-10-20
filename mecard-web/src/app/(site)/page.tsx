import { WpPage, wpPageMetadata } from "@/components/site/WpPage";
import { HOME } from "./pages";

export const metadata = wpPageMetadata(HOME);

export default function HomePage() {
  return <WpPage page={HOME} home />;
}
