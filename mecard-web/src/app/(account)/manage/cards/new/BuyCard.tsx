import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { ConfirmButton } from "@/components/account/Bits";
import { BundleOffer, CardOffer } from "@/components/account/Upsells";
import { Price } from "@/components/shop/Price";
import { viewer } from "@/lib/access";
import { isForProfile, PRODUCT, SHOP_CATALOGUE } from "@/lib/catalog";
import { imageUrl } from "@/lib/images/paths";
import { profileChoices } from "@/lib/manage";
import { requireUserId } from "@/lib/session";
import { addToCartAction } from "@/lib/shop-actions";
import { loadUpsells } from "@/lib/upsells";

// Buying a card from My Cards: pick the card or tag and it goes in the basket.
// The basket creates its card straight away (as the shop does), so it shows
// under My Cards, ready to design before checkout.

const CARD_PRODUCTS = SHOP_CATALOGUE.filter((c) => c.id !== PRODUCT.proUpgrade);
const AFTER = "/manage/cards/?tab=design&done=card-added";

/** The WordPress offers' artwork and wording for each tile (the product's own image otherwise). */
const ART: Record<number, { src: string; width: number; height: number; alt: string; text: string }> = {
  [PRODUCT.classicCard]: { src: "/images/upsell/mecard-classic-front-300x200.webp", width: 300, height: 200, alt: "Classic MeCard front with a logo, name and job title", text: "Fastest option. We’ll use the details already on your profile." },
  [PRODUCT.customCard]: { src: "/images/upsell/alessio-card-rounded_front.webp", width: 640, height: 400, alt: "Custom MeCard front example with a full-colour design", text: "Your own front and back design, 856 x 540px, PNG or JPG. QR code generated automatically." },
  [PRODUCT.classicBundle]: { src: "/images/upsell/classic_bundle_new_250_v2.webp", width: 250, height: 289, alt: "Classic bundle: a classic MeCard, a phone tag and a Pro profile", text: "Includes a classic card, a phone tag and the Pro upgrade. No design files required." },
  [PRODUCT.customBundle]: { src: "/images/upsell/custom_bundle_new.webp", width: 640, height: 754, alt: "Custom bundle: a custom-designed MeCard, a phone tag and a Pro profile", text: "Includes a custom card, a phone tag and the Pro upgrade." },
  [PRODUCT.phoneTag]: { src: "/images/home/phone-tag.webp", width: 400, height: 403, alt: "MeCard smart tag stuck on the back of a phone", text: "Stick it on your phone: tap to share." },
};

export async function loadBuyCard(profileId?: string) {
  const v = await viewer(await requireUserId("/manage/cards/new/"));
  const [rows, choices, upsells] = await Promise.all([db.select().from(products).where(inArray(products.id, CARD_PRODUCTS.map((c) => c.id))), profileChoices(v), loadUpsells(v)]);
  const byId = new Map(rows.filter((p) => p.active).map((p) => [p.id, p]));
  const items = CARD_PRODUCTS.filter((c) => byId.has(c.id)).map((c) => ({ ...c, product: byId.get(c.id)! }));
  const preselect = choices.some((p) => String(p.id) === profileId) ? Number(profileId) : choices.length === 1 ? choices[0].id : null;
  return { items, choices, preselect, upsells };
}

export function BuyCard({ items, choices, preselect, upsells }: Awaited<ReturnType<typeof loadBuyCard>>) {
  return (
    <>
      <BundleOffer u={upsells} showManageCards={false} />
      <CardOffer u={upsells} />
      <h2>All cards and tags</h2>
      <p className="acc__lead" style={{ marginTop: 0 }}>
        Choose a card or tag. It goes in your basket and shows under My Cards straight away, so you can design it before you check out.
      </p>
      <ul className="acc-buy">
        {items.map(({ id, blurb, product: p }) => {
          const art = ART[id];
          const img = art?.src ?? imageUrl(p.imagePath, 320);
          const bundle = isForProfile(id);
          return (
            <li className="acc-buy__item" key={id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {img ? <img className="acc-buy__img" src={img} width={art?.width} height={art?.height} alt={art?.alt ?? ""} loading="lazy" /> : <span className="acc-buy__img" />}
              <div className="acc-buy__text">
                <h3 className="acc-buy__name">{p.name}</h3>
                <p className="acc-buy__blurb">{art?.text ?? blurb}</p>
                <Price cents={p.priceCents} regular={p.regularPriceCents} />
              </div>
              <form action={addToCartAction} className="acc-buy__form">
                <input type="hidden" name="product_id" value={id} />
                <input type="hidden" name="next" value={AFTER} />
                {bundle ? (
                  <>
                    <input type="hidden" name="quantity" value="1" />
                    <label className="acc-buy__label" htmlFor={`buy-p-${id}`}>
                      Pro profile
                    </label>
                    <select id={`buy-p-${id}`} name="profile_id" defaultValue={preselect ?? ""}>
                      <option value="">Choose later</option>
                      {choices.map((c) => (
                        <option key={c.id} value={c.id}>
                          {`${c.firstName} ${c.lastName}`.trim() || c.slug}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="acc-buy__label" htmlFor={`buy-q-${id}`}>
                      Quantity
                    </label>
                    <input id={`buy-q-${id}`} className="shop-qty" type="number" name="quantity" min={1} max={500} defaultValue={1} />
                  </>
                )}
                <ConfirmButton className="acc-btn acc-btn--primary">Add to basket</ConfirmButton>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
