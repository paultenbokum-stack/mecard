"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { cards, orderItems, orderNotes, orders, products, profiles, quotes, users } from "@/db/schema";
import { canEditProfile, viewer } from "@/lib/access";
import { addressFromFields, addressLines } from "@/lib/addresses";
import { addToCart, cardCartKeysFor, cartView, clearCart, removeLine, setCouponCode, setLineQty } from "@/lib/cart";
import { isForProfile, isVirtual, PRODUCT } from "@/lib/catalog";
import { addressFromForm, shippingOptions } from "@/lib/checkout-shipping";
import { couponForLines } from "@/lib/coupons";
import { rands } from "@/lib/money";
import { setOrderStatus } from "@/lib/orders";
import { EMPTY_MINI_CART, miniCart, type MiniCart } from "@/lib/mini-cart";
import { currentUserId, requireUserId } from "@/lib/session";

export type ShopState = { error?: string } | null;

/** Add to basket (the shop, product pages, and the Pro / bundle offers on /manage/). */
export async function addToCartAction(form: FormData) {
  const userId = await requireUserId("/shop/");
  const productId = Number(form.get("product_id"));
  const qty = Math.max(1, Math.min(500, Math.floor(Number(form.get("quantity") ?? 1)) || 1));
  const [p] = await db.select({ id: products.id, active: products.active }).from(products).where(eq(products.id, productId)).limit(1);
  if (!p?.active) redirect("/shop/?error=unavailable");

  let profileId = Number(form.get("profile_id")) || null;
  if (profileId && !(await canEditProfile(await viewer(userId), profileId))) profileId = null;
  // A Pro upgrade is for one profile: one per line, and only for a standard profile.
  if (productId === PRODUCT.proUpgrade && profileId) {
    const [pr] = await db.select({ type: profiles.type }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
    if (pr && pr.type !== "standard") redirect(`/manage/profile/${profileId}/?done=already-pro`);
  }
  await addToCart(userId, productId, isForProfile(productId) && profileId ? 1 : qty, isForProfile(productId) ? profileId : null);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/basket/?added=1");
}

export async function updateBasketAction(form: FormData) {
  const userId = await requireUserId("/basket/");
  for (const [k, v] of form.entries()) {
    if (k.startsWith("qty_")) await setLineQty(userId, k.slice(4), Number(v));
  }
  redirect("/basket/?updated=1");
}

export async function removeLineAction(key: string) {
  const userId = await requireUserId("/basket/");
  await removeLine(userId, key);
  redirect("/basket/?removed=1");
}

/** Remove from the header's mini basket: stays on the page and returns the updated basket. */
export async function miniCartRemoveAction(key: string): Promise<MiniCart> {
  const userId = await currentUserId();
  if (!userId) return EMPTY_MINI_CART;
  await removeLine(userId, String(key));
  revalidatePath("/basket/");
  return miniCart(userId);
}

export async function applyCouponAction(form: FormData) {
  const userId = await requireUserId("/basket/");
  const code = String(form.get("coupon_code") ?? "").trim();
  if (!code) redirect(`/basket/?coupon_error=${encodeURIComponent("Please enter a coupon code.")}`);
  const cart = await cartView(userId);
  const result = await couponForLines(code, cart.lines.map((l) => ({ productId: l.productId, lineCents: l.lineCents })), userId);
  if (!result.ok) redirect(`/basket/?coupon_error=${encodeURIComponent(result.error)}`);
  await setCouponCode(userId, result.code);
  redirect("/basket/?coupon=applied");
}

export async function removeCouponAction() {
  const userId = await requireUserId("/basket/");
  await setCouponCode(userId, "");
  redirect("/basket/?coupon=removed");
}

const REQUIRED: [string, string][] = [
  ["billing_first_name", "First name"],
  ["billing_last_name", "Last name"],
  ["billing_phone", "Phone"],
  ["billing_email", "Email address"],
];
const ADDRESS_REQUIRED: [string, string][] = [
  ["billing_address_1", "Street address"],
  ["billing_suburb", "Suburb"],
  ["billing_city", "Town / City"],
  ["billing_state", "Province"],
  ["billing_postcode", "Postcode / ZIP"],
];

export async function placeOrderAction(_: ShopState, form: FormData): Promise<ShopState> {
  const userId = await requireUserId("/checkout/");
  const cart = await cartView(userId);
  if (!cart.lines.length) return { error: "Your basket is currently empty." };
  const v = (k: string) => String(form.get(k) ?? "").trim();
  const ships = cart.lines.some((l) => !isVirtual(l.productId));
  // "Ship to a different address?": the shipping_* fields are where it goes; billing_* stays the billing address.
  const shipElsewhere = ships && !!form.get("ship_to_different_address");
  const shippingRequired: [string, string][] = shipElsewhere
    ? [["shipping_first_name", "First name"], ["shipping_last_name", "Last name"], ...ADDRESS_REQUIRED].map(([k, label]) => [k.replace(/^billing_/, "shipping_"), `Shipping ${label[0].toLowerCase()}${label.slice(1)}`])
    : [];
  const missing = [...REQUIRED, ...(ships ? ADDRESS_REQUIRED : []), ...shippingRequired].filter(([k]) => !v(k)).map(([, label]) => `${label} is a required field.`);
  if (missing.length) return { error: missing.join(" ") };
  const billing = addressFromFields(v, "billing");
  const delivery = shipElsewhere ? addressFromFields(v, "shipping") : billing;
  const d = (k: string) => (shipElsewhere ? v(k.replace(/^billing_/, "shipping_")) : v(k));
  if (!form.get("terms")) return { error: "Please read and accept the terms and conditions to proceed with your order." };
  const payment = v("payment_method") === "bacs" ? "bacs" : "payfast";

  const lines = cart.lines.map((l) => ({ productId: l.productId, lineCents: l.lineCents }));
  const coupon = cart.couponCode ? await couponForLines(cart.couponCode, lines, userId) : null;
  if (coupon && !coupon.ok) return { error: `${coupon.error} Please remove the coupon in your basket to continue.` };
  const discount = Math.min(cart.subtotalCents, (coupon?.ok ? coupon.discountCents : 0) + cart.quoteDiscountCents);
  // The delivery option is looked up again for this address (with Bob Go, a fresh quote), so its price is trusted.
  const { options } = await shippingOptions(addressFromForm(d), cart.lines, coupon);
  const shipping = options.find((o) => o.id === v("shipping_method")) ?? (options.length === 1 ? options[0] : undefined);
  if (!shipping) return { error: "Please choose a delivery option. If none are listed, check your address, including the suburb." };
  const total = cart.subtotalCents - discount + shipping.cents;

  const orderId = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({
        userId,
        status: "pending",
        subtotalCents: cart.subtotalCents,
        shippingCents: shipping.cents,
        discountCents: discount,
        couponCode: coupon?.ok ? coupon.code : "",
        totalCents: total,
        shippingMethod: shipping.id === "none" ? "" : shipping.label,
        shippingServiceCode: shipping.serviceCode ?? "",
        paymentMethod: payment,
        billingFirstName: v("billing_first_name"),
        billingLastName: v("billing_last_name"),
        billingCompany: v("billing_company"),
        billingEmail: v("billing_email"),
        billingPhone: v("billing_phone"),
        ...addressLines(delivery),
        ...(shipElsewhere
          ? { shippingFirstName: delivery.firstName, shippingLastName: delivery.lastName, shippingCompany: delivery.company, billingAddress: addressLines(billing) }
          : {}),
        notes: v("order_comments"),
      })
      .returning({ id: orders.id });
    await tx.insert(orderItems).values(
      cart.lines.map((l) => ({
        orderId: o.id,
        productId: l.productId,
        name: l.product.name,
        quantity: l.qty,
        unitPriceCents: l.product.priceCents,
        // What the entitlements and cards are matched on when the order is paid.
        meta: { cartItemKey: l.key, ...(l.profileId ? { profileId: String(l.profileId) } : {}) },
      })),
    );
    // link_cards_to_order(): the basket cards now belong to the order.
    const keys = cardCartKeysFor(cart.lines, userId);
    if (keys.length) await tx.update(cards).set({ orderId: o.id, updatedAt: new Date() }).where(and(inArray(cards.cartItemKey, keys), eq(cards.archived, false)));
    if (cart.quoteIds.length) {
      await tx.update(quotes).set({ orderId: o.id, updatedAt: new Date() }).where(inArray(quotes.id, cart.quoteIds));
      await tx.insert(orderNotes).values({
        orderId: o.id,
        body: `From quote ${cart.quoteIds.map((id) => `#${id}`).join(", ")}${cart.quoteDiscountCents ? `, with its discount of -${rands(cart.quoteDiscountCents)}` : ""}.`,
      });
    }
    if (coupon?.ok) {
      await tx.insert(orderNotes).values({ orderId: o.id, body: `Coupon ${coupon.code} applied: -${rands(coupon.discountCents)}${coupon.freeShipping ? ", free shipping" : ""}.` });
    }
    await clearCart(tx, userId);
    return o.id;
  });

  // Remember the details for next time, like WooCommerce's saved billing and shipping addresses
  // (it copies billing to shipping when the order isn't shipped elsewhere).
  const [u] = await db.select({ firstName: users.firstName, phone: users.phone }).from(users).where(eq(users.id, userId));
  if (u) {
    await db
      .update(users)
      .set({
        ...(!u.firstName || !u.phone ? { firstName: u.firstName || billing.firstName, lastName: billing.lastName, phone: u.phone || billing.phone } : {}),
        ...(ships ? { billingAddress: billing, shippingAddress: { ...delivery, phone: shipElsewhere ? "" : billing.phone } } : {}),
      })
      .where(eq(users.id, userId));
  }

  // Nothing to pay (a 100% coupon with free or no shipping): WooCommerce skips the gateway.
  if (total <= 0) {
    await setOrderStatus(orderId, "processing", { paidAt: new Date() }, { note: "No payment needed (order total R0.00)." });
    redirect(`/checkout/order-received/${orderId}/`);
  }
  if (payment === "bacs") {
    await setOrderStatus(orderId, "on-hold", {}, { note: "Awaiting EFT payment." });
    redirect(`/checkout/order-received/${orderId}/`);
  }
  redirect(`/checkout/pay/${orderId}/`);
}

/** Local development only: mark an order paid without going through PayFast. */
export async function devMarkPaidAction(form: FormData) {
  if (process.env.NODE_ENV !== "development") throw new Error("Not available");
  const userId = await requireUserId();
  const id = Number(form.get("order_id"));
  const [o] = await db.select({ userId: orders.userId }).from(orders).where(eq(orders.id, id)).limit(1);
  if (o?.userId !== userId) throw new Error("Not your order");
  await setOrderStatus(id, "processing", { paidAt: new Date(), payfastPaymentId: "dev" }, { note: "Marked paid locally (development only)." });
  redirect(`/checkout/order-received/${id}/`);
}
