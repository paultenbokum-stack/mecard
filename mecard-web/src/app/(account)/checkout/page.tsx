import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, profiles, users } from "@/db/schema";
import { Subnav } from "@/components/account/Bits";
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { EMPTY_ADDRESS, hasLines, sameLines } from "@/lib/addresses";
import { cartView } from "@/lib/cart";
import { checkoutStarted } from "@/lib/checkout-events";
import { needsShipping, shippingOptions } from "@/lib/checkout-shipping";
import { couponForLines } from "@/lib/coupons";
import { rands } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Checkout - MeCard" } };

/** The saved billing address (or the account's name and phone), and the saved shipping address when it differs. */
function checkoutDefaults(u: typeof users.$inferSelect | undefined) {
  const saved = u?.billingAddress;
  const billing = { ...EMPTY_ADDRESS, ...saved, firstName: saved?.firstName || u?.firstName || "", lastName: saved?.lastName || u?.lastName || "", phone: saved?.phone || u?.phone || "" };
  const shipping = hasLines(u?.shippingAddress) ? { ...EMPTY_ADDRESS, ...u!.shippingAddress } : null;
  const shipElsewhere =
    !!shipping && hasLines(saved) && (!sameLines(shipping, billing) || `${shipping.firstName} ${shipping.lastName}`.trim().toLowerCase() !== `${billing.firstName} ${billing.lastName}`.trim().toLowerCase());
  return { email: u?.email ?? "", billing, shipping, shipElsewhere };
}

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
  await checkoutStarted(userId, cart.lines.map((l) => l.productId), cart.subtotalCents).catch(() => undefined);
  const [[u], companyRows] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    // "Copy from my profile": the company on the user's own profiles (its record, or the name typed on a standard profile).
    db
      .select({ name: profiles.companyName, companyName: companies.name, address: companies.address })
      .from(profiles)
      .leftJoin(companies, eq(companies.id, profiles.companyId))
      .where(and(or(eq(profiles.ownerId, userId), eq(profiles.managerId, userId)), eq(profiles.archived, false)))
      .orderBy(profiles.id)
      .limit(20),
  ]);
  // One per company name, the one with an address if there is one.
  const byName = new Map<string, { name: string; address: string }>();
  for (const r of companyRows) {
    const c = { name: (r.companyName || r.name).trim(), address: (r.address ?? "").trim() };
    const key = c.name.toLowerCase();
    if (c.name && (!byName.has(key) || (!byName.get(key)!.address && c.address))) byName.set(key, c);
  }
  const profileCompanies = [...byName.values()].slice(0, 3);
  const lines = cart.lines.map((l) => ({ productId: l.productId, lineCents: l.lineCents }));
  const coupon = cart.couponCode ? await couponForLines(cart.couponCode, lines, userId) : null;
  const discount = Math.min(cart.subtotalCents, (coupon?.ok ? coupon.discountCents : 0) + cart.quoteDiscountCents);
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
        {cart.quoteDiscountCents > 0 ? (
          <tr>
            <th>Quote discount</th>
            <td className="shop-num">-{rands(cart.quoteDiscountCents)}</td>
          </tr>
        ) : null}
        {coupon?.ok ? (
          <tr>
            <th>Coupon: {coupon.code}</th>
            <td className="shop-num">-{rands(coupon.discountCents)}</td>
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
        defaults={checkoutDefaults(u)}
        methods={shipping.options.map((o) => ({ id: o.id, label: o.label, price: o.cents ? rands(o.cents) : "Free", note: o.note }))}
        summary={summary}
        liveRates={shipping.live}
        ships={needsShipping(cart.lines)}
        profileCompanies={profileCompanies}
      />
    </div>
  );
}
