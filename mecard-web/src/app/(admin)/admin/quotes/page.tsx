import Link from "next/link";
import { and, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { quotes } from "@/db/schema";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Card, Flash, PAGE_SIZE, Pager, pageNumber, SearchBox, Tabs } from "@/components/admin/ui";
import { createQuoteAction } from "@/lib/admin-quote-actions";
import { formatDate, rands } from "@/lib/money";
import { QUOTE_STATUS_LABEL } from "@/lib/quote-rules";

export const metadata = { title: "Quotes" };

// effectiveStatus() in SQL: a sent quote past its date counts as expired.
const STATUS = sql<string>`case when ${quotes.status} in ('sent', 'new') and ${quotes.expiresAt} < now() then 'expired' else ${quotes.status} end`;

export default async function AdminQuotes({ searchParams }: { searchParams: Promise<AdminSearchParams & { status?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().replace(/^#/, "");
  const status = sp.status && sp.status in QUOTE_STATUS_LABEL ? sp.status : undefined;
  const page = pageNumber(sp.page);
  const filters: SQL[] = [];
  if (status) filters.push(sql`${STATUS} = ${status}`);
  if (q) {
    const like = `%${q}%`;
    filters.push(or(...(/^\d+$/.test(q) ? [eq(quotes.id, Number(q))] : []), ilike(quotes.email, like), ilike(quotes.name, like), ilike(quotes.company, like))!);
  }
  const where = filters.length ? and(...filters) : undefined;
  const [rows, [{ total }], counts] = await Promise.all([
    db
      .select({ q: quotes, status: STATUS })
      .from(quotes)
      .where(where)
      .orderBy(desc(quotes.createdAt), desc(quotes.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(quotes).where(where),
    db.select({ status: STATUS, n: sql<number>`count(*)::int` }).from(quotes).groupBy(STATUS),
  ]);
  const countOf = new Map(counts.map((c) => [c.status, c.n]));
  const tab = (s?: string) => `?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(q ? { q } : {}) })}`;

  return (
    <>
      <AdminHeader title="Quotes" />
      <Flash saved={sp.saved} error={sp.error} />
      <Tabs
        tabs={[
          { href: tab(), label: "All", count: counts.reduce((t, c) => t + c.n, 0), active: !status },
          ...Object.entries(QUOTE_STATUS_LABEL)
            .filter(([s]) => countOf.get(s))
            .map(([s, label]) => ({ href: tab(s), label, count: countOf.get(s), active: status === s })),
        ]}
      />
      <SearchBox q={q} placeholder="Quote number, name, company or email" keep={{ status }} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th className="adm-num">Total</th>
              <th>Valid until</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ q: r, status: s }) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/quotes/${r.id}/`}>
                    <strong>#{r.id}</strong>
                  </Link>
                </td>
                <td className="adm-small adm-nowrap">{formatDate(r.createdAt)}</td>
                <td>
                  {r.name || "—"}
                  {r.company ? <span className="adm-muted"> · {r.company}</span> : null}
                  <div className="adm-muted adm-small">{r.email}</div>
                </td>
                <td className="adm-small">{r.items.map((i) => `${i.name} × ${i.qty}`).join(", ") || <span className="adm-muted">No lines</span>}</td>
                <td className="adm-num">{rands(r.totalCents)}</td>
                <td className="adm-small adm-nowrap">{r.expiresAt ? formatDate(r.expiresAt) : "—"}</td>
                <td>
                  <Badge status={s}>{QUOTE_STATUS_LABEL[s] ?? s}</Badge>
                  {r.orderId ? (
                    <div className="adm-small">
                      <Link href={`/admin/orders/${r.orderId}/`}>Order #{r.orderId}</Link>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="adm-muted">
                  No quotes found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} params={{ status, q }} />
      <Card title="New quote" className="adm-card--narrow">
        <form action={createQuoteAction} className="adm-form">
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
          For requests by phone or email. You add the lines next, then send it; the customer gets the same email, PDF and accept link.
        </p>
      </Card>
    </>
  );
}
