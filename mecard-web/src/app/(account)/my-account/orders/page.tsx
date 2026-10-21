import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { Subnav } from "@/components/account/Bits";
import { hasInvoice } from "@/lib/invoice";
import { formatDate, ORDER_STATUS_LABEL, rands } from "@/lib/money";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Orders - MeCard" } };

// WooCommerce My Account → Orders (quotes are listed with the shop's quotes later).
export default async function OrdersPage() {
  const userId = await requireUserId("/my-account/orders/");
  const list = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .then((rows) => rows.filter((o) => !o.status.startsWith("ywraq")));

  return (
    <div className="acc__wrap">
      <Subnav active="orders" />
      <h1>Orders</h1>
      {list.length ? (
        <section className="acc-panel acc-panel--white">
          <table className="shop-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th className="shop-num">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/my-account/view-order/${o.id}/`}>#{o.id}</Link>
                  </td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>{ORDER_STATUS_LABEL[o.status] ?? o.status}</td>
                  <td className="shop-num">{rands(o.totalCents)}</td>
                  <td className="shop-num">
                    {o.status === "pending" ? (
                      <Link className="acc-btn acc-btn--small acc-btn--primary" href={`/checkout/pay/${o.id}/`}>
                        Pay
                      </Link>
                    ) : null}{" "}
                    <Link className="acc-btn acc-btn--small" href={`/my-account/view-order/${o.id}/`}>
                      View
                    </Link>{" "}
                    {hasInvoice(o) ? (
                      <a className="acc-btn acc-btn--small" href={`/my-account/invoice/${o.id}/`}>
                        Invoice
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <div className="acc-empty">
          No order has been made yet. <Link href="/shop/">Browse products</Link>
        </div>
      )}
    </div>
  );
}
