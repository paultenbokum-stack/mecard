import type { Metadata } from "next";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { Subnav } from "@/components/account/Bits";
import { Price } from "@/components/shop/Price";
import { SHOP_CATALOGUE } from "@/lib/catalog";
import { imageUrl } from "@/lib/images/paths";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Shop - MeCard" } };

// The WooCommerce shop page. As on WordPress, it is for logged-in customers
// ("You need to be logged in to view products").
export default async function ShopPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUserId("/shop/");
  const sp = await searchParams;
  const rows = await db.select().from(products).where(inArray(products.id, SHOP_CATALOGUE.map((c) => c.id)));
  const byId = new Map(rows.filter((p) => p.active).map((p) => [p.id, p]));

  return (
    <div className="acc__wrap acc__wrap--wide">
      <Subnav active="shop" />
      <h1>Shop</h1>
      {sp.error ? <div className="acc-panel acc-panel--error">That product isn&rsquo;t available any more.</div> : null}
      <div className="shop-grid">
        {SHOP_CATALOGUE.filter((c) => byId.has(c.id)).map(({ id, blurb }) => {
          const p = byId.get(id)!;
          const img = imageUrl(p.imagePath, 480);
          return (
            <div className="shop-card" key={id}>
              <Link className="shop-card__image" href={`/product/${p.slug}/`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img ? <img src={img} alt="" loading="lazy" /> : null}
              </Link>
              <div className="shop-card__body">
                <h2 className="shop-card__title">
                  <Link href={`/product/${p.slug}/`}>{p.name}</Link>
                </h2>
                <p className="shop-card__desc">{blurb}</p>
                <Price cents={p.priceCents} regular={p.regularPriceCents} />
                <Link className="acc-btn acc-btn--primary acc-btn--block" href={`/product/${p.slug}/`}>
                  {id === 41811 ? "Choose profile" : "Select"}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
