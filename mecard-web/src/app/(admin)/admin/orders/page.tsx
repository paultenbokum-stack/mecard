import Link from "next/link";
import { and, desc, eq, ilike, not, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { AdminHeader, type AdminSearchParams, Badge, PAGE_SIZE, Pager, pageNumber, SearchBox, Tabs } from "@/components/admin/ui";
import { formatDate, ORDER_STATUS_LABEL, PAYMENT_LABEL, rands } from "@/lib/money";

export const metadata = { title: "Orders" };

// WooCommerce's old quote requests were stored as orders (ywraq-* statuses); they aren't orders.
const REAL_ORDERS = not(ilike(orders.status, "ywraq-%"));

export default async function AdminOrders({ searchParams }: { searchParams: Promise<AdminSearchParams & { status?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().replace(/^#/, "");
  const status = sp.status && sp.status in ORDER_STATUS_LABEL ? sp.status : undefined;
  const page = pageNumber(sp.page);

  const filters: SQL[] = [REAL_ORDERS];
  if (status) filters.push(eq(orders.status, status));
  if (q) {
    const like = `%${q}%`;
    filters.push(
      or(
        ...(/^\d+$/.test(q) ? [eq(orders.id, Number(q))] : []),
        ilike(orders.billingEmail, like),
        ilike(orders.billingCompany, like),
        sql`(${orders.billingFirstName} || ' ' || ${orders.billingLastName}) ilike ${like}`,
      )!,
    );
  }
  const where = and(...filters);

  const [rows, [{ total }], counts] = await Promise.all([
    db
      .select({
        o: orders,
        // Qualified by hand: inside the subquery a bare "id" would mean order_items.id.
        items: sql<string>`(select string_agg(oi.name || ' × ' || oi.quantity, ', ') from order_items oi where oi.order_id = "orders"."id")`,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(orders).where(where),
    db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).where(REAL_ORDERS).groupBy(orders.status),
  ]);
  const countOf = new Map(counts.map((c) => [c.status, c.n]));
  const tab = (s?: string) => `?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(q ? { q } : {}) })}`;

  return (
    <>
      <AdminHeader title="Orders" />
      <Tabs
        tabs={[
          { href: tab(), label: "All", count: counts.reduce((t, c) => t + c.n, 0), active: !status },
          ...Object.entries(ORDER_STATUS_LABEL)
            .filter(([s]) => countOf.get(s))
            .map(([s, label]) => ({ href: tab(s), label, count: countOf.get(s), active: status === s })),
        ]}
      />
      <SearchBox q={q} placeholder="Order number, name, company or email" keep={{ status }} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Payment</th>
              <th className="adm-num">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, items }) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/orders/${o.id}/`}>
                    <strong>#{o.id}</strong>
                  </Link>
                </td>
                <td className="adm-nowrap adm-small">{formatDate(o.createdAt)}</td>
                <td>
                  {`${o.billingFirstName} ${o.billingLastName}`.trim() || "—"}
                  {o.billingCompany ? <span className="adm-muted"> · {o.billingCompany}</span> : null}
                  <div className="adm-muted adm-small">{o.billingEmail}</div>
                </td>
                <td className="adm-small">{items}</td>
                <td className="adm-small">{PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod}</td>
                <td className="adm-num">{rands(o.totalCents)}</td>
                <td>
                  <Badge status={o.status}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="adm-muted">
                  No orders found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} params={{ status, q }} />
    </>
  );
}
