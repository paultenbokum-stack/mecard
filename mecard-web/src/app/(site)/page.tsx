import { HomePage } from "@/components/site/HomePage";
import { wpPageMetadata } from "@/components/site/WpPage";
import { PRODUCT } from "@/lib/catalog";
import { productPriceWords } from "@/lib/product-prices";
import { HOME } from "./pages";
import "./home.css";

export const metadata = wpPageMetadata(HOME);

// Rendered on request, because the build has no database. The prices themselves are cached.
export const dynamic = "force-dynamic";

export default async function Page() {
  const words = await productPriceWords();
  return <HomePage prices={{ pro: words[PRODUCT.proUpgrade], classic: words[PRODUCT.classicCard], custom: words[PRODUCT.customCard], bundle: words[PRODUCT.classicBundle] }} />;
}
