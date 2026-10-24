import Link from "next/link";
import type { orders } from "@/db/schema";
import { hasInvoice } from "@/lib/invoice";
import { formatDate, ORDER_STATUS_LABEL, rands } from "@/lib/money";

// WooCommerce's My Account orders table: number, date, status, total and actions.
export function OrdersTable({ list }: { list: (typeof orders.$inferSelect)[] }) {
  return (
    <table className="shop-table shop-table--orders">
      <thead>
        <tr>
          <th>Order</th>
          <th>Date</th>
          <th>Status</th>
          <th className="shop-num">Total</th>
          <th>
            <span className="screen-reader-text">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {list.map((o) => (
          <tr key={o.id}>
            <td data-title="Order">
              <Link href={`/my-account/view-order/${o.id}/`}>#{o.id}</Link>
            </td>
            <td data-title="Date">{formatDate(o.createdAt)}</td>
            <td data-title="Status">{ORDER_STATUS_LABEL[o.status] ?? o.status}</td>
            <td data-title="Total" className="shop-num">
              {rands(o.totalCents)}
            </td>
            <td className="shop-num shop-table__actions">
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
  );
}
