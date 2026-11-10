import { HomePage } from "@/components/site/HomePage";
import { wpPageMetadata } from "@/components/site/WpPage";
import { PRODUCT } from "@/lib/catalog";
import { priceWords, productPriceCents } from "@/lib/product-prices";
import { packageEachCents, teamPackage, wholeRands } from "@/lib/team-packages";
import { HOME } from "./pages";
import "./home.css";

export const metadata = wpPageMetadata(HOME);

// Rendered on request, because the build has no database. The prices themselves are cached.
export const dynamic = "force-dynamic";

export default async function Page() {
  const cents = await productPriceCents();
  // Per person, as the team packages on /for-teams/ charge them.
  const each = (id: "custom" | "classic" | "pro") => {
    const c = packageEachCents(teamPackage(id), cents);
    return c === null ? undefined : wholeRands(c);
  };
  const classic = cents[PRODUCT.classicCard];
  return (
    <HomePage
      prices={{ classic: typeof classic === "number" ? priceWords(classic) : undefined }}
      team={{ custom: each("custom"), classic: each("classic"), pro: each("pro") }}
    />
  );
}
