import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { ConfirmButton } from "@/components/account/Bits";
import { Price } from "@/components/shop/Price";
import { viewer } from "@/lib/access";
import { isForProfile, PRODUCT, SHOP_CATALOGUE } from "@/lib/catalog";
import { imageUrl } from "@/lib/images/paths";
import { profileChoices } from "@/lib/manage";
import { requireUserId } from "@/lib/session";
import { addToCartAction } from "@/lib/shop-actions";

// Buying a card from My Cards: pick the card or tag and it goes in the basket.
// The basket creates its card straight away (as the shop does), so it shows
// under My Cards, ready to design before checkout.

const CARD_PRODUCTS = SHOP_CATALOGUE.filter((c) => c.id !== PRODUCT.proUpgrade);
const AFTER = "/manage/cards/?tab=new&done=card-added";

export async function loadBuyCard(profileId?: string) {
  const v = await viewer(await requireUserId("/manage/cards/new/"));
  const [rows, choices] = await Promise.all([db.select().from(products).where(inArray(products.id, CARD_PRODUCTS.map((c) => c.id))), profileChoices(v)]);
  const byId = new Map(rows.filter((p) => p.active).map((p) => [p.id, p]));
  const items = CARD_PRODUCTS.filter((c) => byId.has(c.id)).map((c) => ({ ...c, product: byId.get(c.id)! }));
  const preselect = choices.some((p) => String(p.id) === profileId) ? Number(profileId) : choices.length === 1 ? choices[0].id : null;
  return { items, choices, preselect };
}

export function BuyCard({ items, choices, preselect }: Awaited<ReturnType<typeof loadBuyCard>>) {
  return (
    <>
      <p className="acc__lead" style={{ marginTop: 0 }}>
        Choose a card or tag. It goes in your basket and shows under My Cards straight away, so you can design it before you check out.
      </p>
      <ul className="acc-buy">
        {items.map(({ id, blurb, product: p }) => {
          const img = imageUrl(p.imagePath, 320);
          const bundle = isForProfile(id);
          return (
            <li className="acc-buy__item" key={id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {img ? <img className="acc-buy__img" src={img} alt="" loading="lazy" /> : <span className="acc-buy__img" />}
              <div className="acc-buy__text">
                <h3 className="acc-buy__name">{p.name}</h3>
                <p className="acc-buy__blurb">{blurb}</p>
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
