import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { Subnav } from "@/components/account/Bits";
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { cartView } from "@/lib/cart";
import { needsShipping, shippingOptions } from "@/lib/checkout-shipping";
import { couponForLines } from "@/lib/coupons";
import { rands } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Checkout - MeCard" } };

export default async function CheckoutPage() {
  const userId = await requireUserId("/checkout/");
  const cart = await cartView(userId);
  if (!cart.lines.length) {
    return (
      <div className="acc__wrap">
        <Subnav active="" />
        <h1>Checkout</h1>
        <div className="acc-panel">Your basket is currently empty.</div>
        <Link className="acc-btn acc-btn--primary" href="/shop/">
          Return to shop
        </Link>
      </div>
    );
  }
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  const lines = cart.lines.map((l) => ({ productId: l.productId, lineCents: l.lineCents }));
  const coupon = cart.couponCode ? await couponForLines(cart.couponCode, lines, userId) : null;
  const discount = coupon?.ok ? coupon.discountCents : 0;
  const shipping = await shippingOptions(null, cart.lines, coupon);

  const summary = (
    <table className="shop-table">
      <tbody>
        {cart.lines.map((l) => (
          <tr key={l.key}>
            <td>
              {l.product.name} <strong>× {l.qty}</strong>
            </td>
            <td className="shop-num">{rands(l.lineCents)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th>Subtotal</th>
          <td className="shop-num">{rands(cart.subtotalCents)}</td>
        </tr>
        {coupon?.ok ? (
          <tr>
            <th>Coupon: {coupon.code}</th>
            <td className="shop-num">-{rands(discount)}</td>
          </tr>
        ) : null}
        <tr>
          <th>Total before delivery</th>
          <td className="shop-num">
            <strong>{rands(cart.subtotalCents - discount)}</strong>
          </td>
        </tr>
      </tfoot>
    </table>
  );

  return (
    <div className="acc__wrap acc__wrap--wide">
      <Subnav active="" />
      <h1>Checkout</h1>
      {coupon && !coupon.ok ? <div className="acc-panel acc-panel--error">{coupon.error} Please remove the coupon in your basket to continue.</div> : null}
      <CheckoutForm
        defaults={{ firstName: u?.firstName ?? "", lastName: u?.lastName ?? "", email: u?.email ?? "", phone: u?.phone ?? "" }}
        methods={shipping.options.map((o) => ({ id: o.id, label: o.label, price: o.cents ? rands(o.cents) : "Free", note: o.note }))}
        summary={summary}
        liveRates={shipping.live}
        ships={needsShipping(cart.lines)}
      />
    </div>
  );
}
