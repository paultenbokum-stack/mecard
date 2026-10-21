import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { orderItems, orderNotes, orders } from "@/db/schema";
import { Subnav } from "@/components/account/Bits";
import { BankDetails, OrderDetails } from "@/components/shop/OrderDetails";
import { hasInvoice } from "@/lib/invoice";
import { formatDate, ORDER_STATUS_LABEL } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Order - MeCard" } };

export default async function ViewOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const userId = await requireUserId(`/my-account/view-order/${id}/`);
  const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
  if (!order) notFound();
  const [items, notes] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db.select().from(orderNotes).where(and(eq(orderNotes.orderId, id), eq(orderNotes.customerNote, true))).orderBy(asc(orderNotes.createdAt)),
  ]);

  return (
    <div className="acc__wrap">
      <Subnav active="orders" />
      <h1>Order #{order.id}</h1>
      <p className="acc__lead">
        Order #{order.id} was placed on {formatDate(order.createdAt)} and is currently <strong>{ORDER_STATUS_LABEL[order.status] ?? order.status}</strong>.
      </p>
      <div className="acc-actions" style={{ marginBottom: 12 }}>
        {order.status === "pending" ? (
          <Link className="acc-btn acc-btn--primary" href={`/checkout/pay/${order.id}/`}>
            Pay
          </Link>
        ) : null}
        {hasInvoice(order) ? (
          <a className="acc-btn" href={`/my-account/invoice/${order.id}/`}>
            Download invoice (PDF)
          </a>
        ) : null}
        <Link className="acc-btn" href="/my-account/orders/">
          All orders
        </Link>
      </div>
      {notes.length ? (
        <section className="acc-panel">
          <h2>Order updates</h2>
          <ul className="acc-list">
            {notes.map((n) => (
              <li className="acc-item" key={n.id}>
                <div className="acc-item__text">
                  <div className="acc-item__sub">{formatDate(n.createdAt, true)}</div>
                  <div>{n.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {order.paymentMethod === "bacs" && order.status === "on-hold" ? <BankDetails orderId={order.id} /> : null}
      <OrderDetails order={order} items={items} />
    </div>
  );
}
