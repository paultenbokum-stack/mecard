import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { products, profiles } from "@/db/schema";
import { RichText } from "@/components/card/RichText";
import { ConfirmButton, Subnav } from "@/components/account/Bits";
import { Price } from "@/components/shop/Price";
import { editableProfilesWhere } from "@/lib/access";
import { isForProfile, PRODUCT } from "@/lib/catalog";
import { imageUrl } from "@/lib/images/paths";
import { addToCartAction } from "@/lib/shop-actions";
import { requireUserId } from "@/lib/session";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ profile_id?: string }> };

const bySlug = async (slug: string) => (await db.select().from(products).where(eq(products.slug, slug)).limit(1))[0];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await bySlug((await params).slug);
  return { title: { absolute: `${p?.name ?? "Product"} - MeCard` } };
}

// A WooCommerce product page: picture, price, description and "Add to basket".
export default async function ProductPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const userId = await requireUserId(`/product/${slug}/`);
  const p = await bySlug(slug);
  if (!p || !p.active) notFound();
  const forProfile = isForProfile(p.id);
  const choices = forProfile
    ? await db
        .select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName, type: profiles.type })
        .from(profiles)
        .where(and(editableProfilesWhere(userId), eq(profiles.archived, false)))
        .orderBy(asc(profiles.firstName), asc(profiles.lastName))
    : [];
  // An upgrade only makes sense for a standard profile.
  const pick = p.id === PRODUCT.proUpgrade ? choices.filter((c) => c.type === "standard") : choices;
  const img = imageUrl(p.imagePath, 960);

  return (
    <div className="acc__wrap acc__wrap--wide">
      <Subnav active="" />
      <p className="acc__muted" style={{ marginTop: 20 }}>
        <Link href="/shop/">Shop</Link> / {p.name}
      </p>
      <div className="shop-product">
        <div className="shop-product__image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img src={img} alt={p.name} /> : null}
        </div>
        <div>
          <h1 style={{ marginTop: 0 }}>{p.name}</h1>
          <Price cents={p.priceCents} regular={p.regularPriceCents} />
          <form action={addToCartAction} className="acc-form">
            <input type="hidden" name="product_id" value={p.id} />
            {forProfile ? (
              <div className="acc-field">
                <label htmlFor="profile_id">{p.id === PRODUCT.proUpgrade ? "Profile to upgrade" : "Profile for the Pro upgrade"}</label>
                <select id="profile_id" name="profile_id" defaultValue={sp.profile_id ?? (pick.length === 1 ? String(pick[0].id) : "")}>
                  <option value="">Choose later (apply it from the profile editor)</option>
                  {pick.map((c) => (
                    <option key={c.id} value={c.id}>
                      {`${c.firstName} ${c.lastName}`.trim() || `Profile ${c.id}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="acc-field">
                <label htmlFor="quantity">Quantity</label>
                <input id="quantity" name="quantity" type="number" min={1} max={500} defaultValue={1} className="shop-qty" />
              </div>
            )}
            {forProfile ? <input type="hidden" name="quantity" value="1" /> : null}
            <div>
              <ConfirmButton className="acc-btn acc-btn--primary">Add to basket</ConfirmButton>
            </div>
          </form>
          <div className="shop-product__desc" style={{ marginTop: 24 }}>
            <RichText html={p.description} />
          </div>
        </div>
      </div>
    </div>
  );
}
