import { ForTeamsPage } from "@/components/site/ForTeamsPage";
import { wpPageMetadata, type WpPageData } from "@/components/site/WpPage";
import forTeams from "@/content/pages/for-teams.json";
import { productPriceCents } from "@/lib/product-prices";
import "../home.css";

export const metadata = wpPageMetadata(forTeams as WpPageData);

// Rendered on request, because the build has no database. The prices themselves are cached.
export const dynamic = "force-dynamic";

export default async function Page() {
  return <ForTeamsPage prices={await productPriceCents()} />;
}
