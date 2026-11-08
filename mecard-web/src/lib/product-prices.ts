import "server-only";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { rands } from "./money";

// Prices for pages that quote them in their copy, such as the home page. Cached so
// a page view doesn't query the database each time. A save in admin refreshes the
// server it ran on; any other server catches up within 5 minutes.

export const PRODUCT_PRICES_TAG = "product-prices";

const load = unstable_cache(
  async () => {
    const rows = await db.select({ id: products.id, cents: products.priceCents }).from(products).where(eq(products.active, true));
    return Object.fromEntries(rows.map((r) => [r.id, r.cents])) as Record<number, number>;
  },
  ["product-prices"],
  { tags: [PRODUCT_PRICES_TAG], revalidate: 300 },
);

/** "R199" for whole rands, else "R199.50". */
export const priceWords = (cents: number) => rands(cents).replace(/\.00$/, "");

/** Each shown product's price as text, by product id. Empty if the database can't be read, so a page still renders. */
export async function productPriceWords(): Promise<Record<number, string>> {
  const prices = await load().catch((e) => {
    console.error("[products] loading prices", e);
    return {} as Record<number, number>;
  });
  return Object.fromEntries(Object.entries(prices).map(([id, cents]) => [id, priceWords(cents)]));
}
