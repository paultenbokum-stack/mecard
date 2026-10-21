import type { Metadata } from "next";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { ConfirmButton, Subnav } from "@/components/account/Bits";
import { cartView } from "@/lib/cart";
import { cardTypesFor } from "@/lib/catalog";
import { couponForLines } from "@/lib/coupons";
import { imageUrl } from "@/lib/images/paths";
import { rands } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { applyCouponAction, removeCouponAction, removeLineAction, updateBasketAction } from "@/lib/shop-actions";

export const metadata: Metadata = { title: { absolute: "Basket - MeCard" } };

type SP = { added?: string; updated?: string; removed?: string; coupon?: string; coupon_error?: string; cancelled?: string };

// The WooCommerce basket (/basket/), with MeCard's empty-basket message.
export default async function BasketPage({ searchParams }: { searchParams: Promise<SP> }) {
  const userId = await requireUserId("/basket/");
  const sp = await searchParams;
  const cart = await cartView(userId);
  const profileIds = cart.lines.map((l) => l.profileId).filter((x): x is number => !!x);
  const names = profileIds.length
    ? new Map((await db.select({ id: profiles.id, f: profiles.firstName, l: profiles.lastName }).from(profiles).where(inArray(profiles.id, profileIds))).map((p) => [p.id, `${p.f} ${p.l}`.trim()]))
    : new Map<number, string>();
  const lines = cart.lines.map((l) => ({ productId: l.productId, lineCents: l.lineCents }));
  const coupon = cart.couponCode ? await couponForLines(cart.couponCode, lines, userId) : null;
  const discount = coupon?.ok ? coupon.discountCents : 0;
  const hasCards = cart.lines.some((l) => cardTypesFor(l.productId).length);

  return (
    <div className="acc__wrap acc__wrap--wide">
      <Subnav active="" />
      <h1>Basket</h1>
      {sp.added ? <div className="acc-panel acc-panel--ok">Added to your basket.</div> : null}
      {sp.updated ? <div className="acc-panel acc-panel--ok">Basket updated.</div> : null}
      {sp.removed ? <div className="acc-panel acc-panel--ok">Item removed.</div> : null}
      {sp.coupon === "applied" ? <div className="acc-panel acc-panel--ok">Coupon code applied successfully.</div> : null}
      {sp.coupon === "removed" ? <div className="acc-panel acc-panel--ok">Coupon has been removed.</div> : null}
      {sp.coupon_error ? <div className="acc-panel acc-panel--error">{sp.coupon_error}</div> : null}
      {sp.cancelled ? <div className="acc-panel acc-panel--notice">Your payment was cancelled. Your order is still waiting for payment on My Account.</div> : null}

      {!cart.lines.length ? (
        <section className="acc-panel">
          <h2>Your basket is empty</h2>
          <p>There are no MeCard items waiting to be checked out right now.</p>
          <div className="acc-actions">
            <Link className="acc-btn acc-btn--primary" href="/shop/">
              Shop
            </Link>
            <Link className="acc-btn" href="/manage/">
              Back to My MeCard Home
            </Link>
          </div>
        </section>
      ) : (
        <div className="shop-checkout">
          <section className="acc-panel acc-panel--white">
            <form action={updateBasketAction}>
              <table className="shop-table">
                <thead>
                  <tr>
                    <th colSpan={2}>Product</th>
                    <th className="shop-num">Price</th>
                    <th>Quantity</th>
                    <th className="shop-num">Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cart.lines.map((l) => {
                    const img = imageUrl(l.product.imagePath, 160);
                    return (
                      <tr key={l.key}>
                        <td style={{ width: 64 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {img ? <img className="shop-thumb" src={img} alt="" /> : null}
                        </td>
                        <td>
                          <Link href={`/product/${l.product.slug}/`}>{l.product.name}</Link>
                          {l.profileId ? <div className="acc__muted">For {names.get(l.profileId) || "your profile"}</div> : null}
                        </td>
                        <td className="shop-num">{rands(l.product.priceCents)}</td>
                        <td>
                          {l.profileId ? (
                            <>1<input type="hidden" name={`qty_${l.key}`} value="1" /></>
                          ) : (
                            <input className="shop-qty" type="number" name={`qty_${l.key}`} min={0} max={500} defaultValue={l.qty} aria-label={`Quantity of ${l.product.name}`} />
                          )}
                        </td>
                        <td className="shop-num">{rands(l.lineCents)}</td>
                        <td>
                          <button type="submit" formAction={removeLineAction.bind(null, l.key)} className="acc-btn acc-btn--small acc-btn--danger" aria-label={`Remove ${l.product.name}`}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="acc-actions">
                <ConfirmButton className="acc-btn">Update basket</ConfirmButton>
              </div>
            </form>
            {hasCards ? (
              <p className="acc__muted" style={{ marginTop: 16, marginBottom: 0 }}>
                Your cards are ready to design now under <Link href="/manage/cards/?tab=new">My Cards</Link>; you can also do it after paying.
              </p>
            ) : null}
          </section>

          <section className="acc-panel acc-panel--white">
            <h2>Basket totals</h2>
            <table className="shop-table">
              <tbody>
                <tr>
                  <th>Subtotal</th>
                  <td className="shop-num">{rands(cart.subtotalCents)}</td>
                </tr>
                {coupon ? (
                  <tr>
                    <th>Coupon: {cart.couponCode}</th>
                    <td className="shop-num">
                      {coupon.ok ? `-${rands(discount)}${coupon.freeShipping ? " + free shipping" : ""}` : <span className="acc-error">{coupon.error}</span>}{" "}
                      <form action={removeCouponAction} style={{ display: "inline" }}>
                        <button type="submit" className="acc-link">
                          [Remove]
                        </button>
                      </form>
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <th>Total</th>
                  <td className="shop-num">
                    <strong>{rands(cart.subtotalCents - discount)}</strong>
                    <div className="acc__muted">Shipping is worked out at checkout.</div>
                  </td>
                </tr>
              </tbody>
            </table>
            {!coupon ? (
              <form action={applyCouponAction} className="acc-inline-form">
                <input type="text" name="coupon_code" placeholder="Coupon code" aria-label="Coupon code" />
                <ConfirmButton className="acc-btn acc-btn--small">Apply coupon</ConfirmButton>
              </form>
            ) : null}
            <div className="acc-actions">
              <Link className="acc-btn acc-btn--cta acc-btn--block" href="/checkout/">
                Proceed to checkout
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
