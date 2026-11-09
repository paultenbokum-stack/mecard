import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { cards, companies, orderItems, orders, users } from "@/db/schema";
import { ADS_PURCHASE } from "@/components/GoogleTag";
import { GtagEvents, type GtagEvent } from "@/components/GtagEvents";
import { BankDetails, OrderDetails } from "@/components/shop/OrderDetails";
import { cardTypesFor, PRODUCT } from "@/lib/catalog";
import { formatDate, ORDER_STATUS_LABEL, PAID_STATUSES, rands } from "@/lib/money";
import { hasInvoice } from "@/lib/invoice";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Order received - MeCard" } };

// The thank-you page, with MeCard's "What's next?" steps (woo_change_order_received_text).
export default async function OrderReceivedPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const userId = await requireUserId(`/checkout/order-received/${id}/`);
  const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
  if (!order) notFound();
  const [items, orderCards] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db.select({ designSubmitted: cards.designSubmitted, type: cards.type }).from(cards).where(and(eq(cards.orderId, id), eq(cards.archived, false))),
  ]);
  const paid = PAID_STATUSES.includes(order.status);
  const hasCards = items.some((i) => cardTypesFor(i.productId).length);
  const hasUpgrades = items.some((i) => i.productId === PRODUCT.proUpgrade);
  // Several people's worth of cards or upgrades, bought without naming them yet.
  // A team account's order counts from one person, since a team may start with one.
  const [buyer] = await db.select({ mode: users.accountMode }).from(users).where(eq(users.id, userId)).limit(1);
  const forNobodyYet = (i: (typeof items)[number]) => !i.meta.profileId && (cardTypesFor(i.productId).length > 0 || i.productId === PRODUCT.proUpgrade);
  const teamOrder = items.some((i) => forNobodyYet(i) && (i.quantity >= 2 || buyer?.mode === "teams"));
  // Team setup runs after paying: the company first, then its people.
  const [hasCompany] = teamOrder ? await db.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, userId)).limit(1) : [];
  const designable = orderCards.filter((c) => c.type !== "phonetag");
  const done = designable.filter((c) => c.designSubmitted).length;
  const allDone = designable.length > 0 && done >= designable.length;
  // The sale for GA4 and Google Ads: paid, or back from PayFast before its ITN
  // arrived. An EFT order on hold isn't counted until it is paid.
  const value = order.totalCents / 100;
  const purchase: GtagEvent[] =
    paid || (order.status === "pending" && order.paymentMethod === "payfast")
      ? [
          ["purchase", { transaction_id: String(order.id), value, currency: "ZAR", items: items.map((i) => ({ item_id: String(i.productId), item_name: i.name, price: i.unitPriceCents / 100, quantity: i.quantity })) }],
          ...(ADS_PURCHASE ? [["conversion", { send_to: ADS_PURCHASE, value, currency: "ZAR", transaction_id: String(order.id) }] as GtagEvent] : []),
        ]
      : [];

  const tracking = purchase.length ? <GtagEvents events={purchase} onceKey={`purchase_${order.id}`} /> : null;

  // A team order: a one-line summary with the invoice, then the one next step in the dashboard.
  if (teamOrder) {
    const eftDue = order.paymentMethod === "bacs" && order.status === "on-hold";
    const status = paid ? "Paid, thank you" : eftDue ? "Waiting for your EFT" : order.status === "pending" ? "Waiting for PayFast" : (ORDER_STATUS_LABEL[order.status] ?? order.status);
    const customCards = hasCards && designable.length > 0 && !allDone;
    return (
      <div className="acc__wrap">
        <h1>Thanks for your order, {order.billingFirstName}</h1>
        <section className="acc-panel acc-orderbar" aria-label="Your order">
          <div className="acc-orderbar__row">
            <p className="acc-orderbar__sum">
              <b>Order {order.id}</b> · {rands(order.totalCents)} · {status}
            </p>
            {hasInvoice(order) ? (
              <a className="acc-btn acc-btn--small" href={`/my-account/invoice/${order.id}/`}>
                Download invoice (PDF)
              </a>
            ) : null}
          </div>
          {eftDue ? <p className="acc-orderbar__note">Pay by EFT, with {order.id} as the reference. The invoice and our bank details are in your order email, so you can forward it to your finance team.</p> : null}
          <details className="acc-orderbar__more">
            <summary>View order</summary>
            {eftDue ? <BankDetails orderId={order.id} /> : null}
            <OrderDetails order={order} items={items} />
          </details>
        </section>
        <section className="acc-panel acc-panel--ok" aria-labelledby="team-next">
          {hasCompany ? (
            <>
              <h2 id="team-next">Next, add your people</h2>
              <p>Add each person on Profiles. Their Pro profile goes live as you add them, and each card goes to print once its name is in.</p>
              <Link className="acc-btn acc-btn--primary" href="/manage/">Add my people</Link>
            </>
          ) : (
            <>
              <h2 id="team-next">Next, set up your company</h2>
              <p>We’ll read your website for your logo, colours and contact details, so every profile in your team looks like your brand. You can change anything.</p>
              <Link className="acc-btn acc-btn--primary" href="/manage/companies/?add=1&from=order#add-company">Set up my company</Link>
            </>
          )}
          {!hasCompany || customCards ? (
            <p className="acc__muted" style={{ marginBottom: 0 }}>
              {hasCompany ? "Then " : customCards ? "Then add your people on Profiles, and " : "Then add your people on Profiles."}
              {customCards ? (
                <>
                  upload your card designs in <Link href="/manage/cards/?tab=new">My Cards</Link>.
                </>
              ) : null}
            </p>
          ) : null}
        </section>
        {tracking}
      </div>
    );
  }

  return (
    <div className="acc__wrap">
      <h1>Order received</h1>
      <section className="acc-panel acc-panel--ok">
        <h2>Thanks for your MeCard order, {order.billingFirstName}!</h2>
        <p style={{ marginBottom: 6 }}>What&rsquo;s next?</p>
        <ol className="shop-steps">
          {paid ? <li className="is-done">Payment received — thank you</li> : <li>{order.paymentMethod === "bacs" ? "Pay for this order using the account details below" : "We’re waiting for PayFast to confirm your payment"}</li>}
          {hasCards ? (
            <>
              {allDone ? (
                <li className="is-done">Card designs received</li>
              ) : (
                <li>
                  {done > 0 ? "Continue uploading your remaining card designs" : "Upload your card designs"} in <Link href="/manage/cards/?tab=new">My Cards</Link>
                </li>
              )}
              <li>We&rsquo;ll check your designs for issues and give feedback if we find any</li>
              <li>Your order will be manufactured and shipped to the address on this order</li>
            </>
          ) : null}
          {hasUpgrades ? <li>Your profile upgrades will be applied automatically as your profiles are created or updated</li> : null}
        </ol>
      </section>
      <ul className="acc-list" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", display: "grid" }}>
        <li className="acc-item">
          <div className="acc-item__text">
            <div className="acc-item__sub">Order number</div>
            <div className="acc-item__title">{order.id}</div>
          </div>
        </li>
        <li className="acc-item">
          <div className="acc-item__text">
            <div className="acc-item__sub">Date</div>
            <div className="acc-item__title">{formatDate(order.createdAt)}</div>
          </div>
        </li>
        <li className="acc-item">
          <div className="acc-item__text">
            <div className="acc-item__sub">Total</div>
            <div className="acc-item__title">{rands(order.totalCents)}</div>
          </div>
        </li>
        <li className="acc-item">
          <div className="acc-item__text">
            <div className="acc-item__sub">Status</div>
            <div className="acc-item__title">{order.status === "pending" ? "Awaiting payment" : ORDER_STATUS_LABEL[order.status] ?? order.status}</div>
          </div>
        </li>
      </ul>
      {order.paymentMethod === "bacs" && order.status === "on-hold" ? <BankDetails orderId={order.id} /> : null}
      <OrderDetails order={order} items={items} />
      {tracking}
    </div>
  );
}
