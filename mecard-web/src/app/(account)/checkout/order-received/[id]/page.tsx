import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { cards, orderItems, orders } from "@/db/schema";
import { BankDetails, OrderDetails } from "@/components/shop/OrderDetails";
import { cardTypesFor, PRODUCT } from "@/lib/catalog";
import { formatDate, ORDER_STATUS_LABEL, rands } from "@/lib/money";
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
  const paid = ["processing", "completed"].includes(order.status);
  const hasCards = items.some((i) => cardTypesFor(i.productId).length);
  const hasUpgrades = items.some((i) => i.productId === PRODUCT.proUpgrade);
  const designable = orderCards.filter((c) => c.type !== "phonetag");
  const done = designable.filter((c) => c.designSubmitted).length;
  const allDone = designable.length > 0 && done >= designable.length;

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
    </div>
  );
}
