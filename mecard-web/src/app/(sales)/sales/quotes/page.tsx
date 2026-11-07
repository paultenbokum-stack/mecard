import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { quotes } from "@/db/schema";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Card, Flash } from "@/components/admin/ui";
import { createQuoteAction } from "@/lib/admin-quote-actions";
import { formatDate, rands } from "@/lib/money";
import { effectiveStatus, QUOTE_STATUS_LABEL } from "@/lib/quote-rules";
import { requireSales } from "@/lib/session";

export const metadata = { title: "My quotes" };

export default async function SalesQuotes({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const me = await requireSales();
  const sp = await searchParams;
  const rows = await db.select().from(quotes).where(eq(quotes.salesUserId, me)).orderBy(desc(quotes.createdAt), desc(quotes.id)).limit(200);

  return (
    <>
      <AdminHeader title="My quotes" />
      <Flash saved={sp.saved} error={sp.error} />
      <Card title="New quote" className="adm-card--narrow">
        <form action={createQuoteAction} className="adm-form">
          <input type="hidden" name="desk" value="sales" />
          <div className="adm-field">
            <label htmlFor="nq-name">Name</label>
            <input id="nq-name" name="name" className="adm-input" />
          </div>
          <div className="adm-field">
            <label htmlFor="nq-email">Email *</label>
            <input id="nq-email" name="email" type="email" required className="adm-input" />
          </div>
          <div className="adm-field">
            <label htmlFor="nq-company">Company</label>
            <input id="nq-company" name="company" className="adm-input" />
          </div>
          <div className="adm-field" style={{ justifyContent: "flex-end" }}>
            <SubmitButton className="adm-btn adm-btn--primary" busy="Creating…">
              Create quote
            </SubmitButton>
          </div>
        </form>
        <p className="adm-help" style={{ marginBottom: 0 }}>
          You add the lines next, then send it. The customer gets an email with a PDF and a link to accept.
        </p>
      </Card>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Date</th>
              <th>Customer</th>
              <th className="adm-num">Total</th>
              <th>Valid until</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = effectiveStatus(r);
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/sales/quotes/${r.id}/`}>
                      <strong>#{r.id}</strong>
                    </Link>
                  </td>
                  <td className="adm-small adm-nowrap">{formatDate(r.createdAt)}</td>
                  <td>
                    {r.name || "—"}
                    {r.company ? <span className="adm-muted"> · {r.company}</span> : null}
                    <div className="adm-muted adm-small">{r.email}</div>
                  </td>
                  <td className="adm-num">{rands(r.totalCents)}</td>
                  <td className="adm-small adm-nowrap">{r.expiresAt ? formatDate(r.expiresAt) : "—"}</td>
                  <td>
                    <Badge status={s}>{QUOTE_STATUS_LABEL[s] ?? s}</Badge>
                    {r.orderId ? <div className="adm-small">Order #{r.orderId}</div> : null}
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="adm-muted">
                  No quotes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
