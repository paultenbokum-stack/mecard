import Link from "next/link";
import { Badge } from "@/components/admin/ui";
import { formatDate, rands } from "@/lib/money";
import type { commissionLines, SalesRow } from "@/lib/sales";
import { bpsToPercent, COMMISSION_SOURCE_LABEL, COMMISSION_STATUS_LABEL, monthLabel, shiftMonth } from "@/lib/sales-rules";

/** Previous and next month, or any month by typing it. `keep` holds the page's other filters. */
export function MonthNav({ month, keep = {} }: { month: string; keep?: Record<string, string | undefined> }) {
  const kept = Object.fromEntries(Object.entries(keep).filter((e): e is [string, string] => !!e[1]));
  const href = (m: string) => `?${new URLSearchParams({ ...kept, month: m })}`;
  return (
    <form className="adm-search" aria-label="Month">
      {Object.entries(kept).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Link href={href(shiftMonth(month, -1))} className="adm-btn" aria-label="Previous month">
        ‹
      </Link>
      <input type="month" name="month" defaultValue={month} className="adm-input" aria-label="Month" />
      <Link href={href(shiftMonth(month, 1))} className="adm-btn" aria-label="Next month">
        ›
      </Link>
      <button className="adm-btn">Show</button>
      <span className="adm-muted">{monthLabel(month)}</span>
    </form>
  );
}

export const emptyRow = (): Omit<SalesRow, "id" | "name" | "rateBps"> => ({
  clicks: 0,
  signups: 0,
  linkOrders: 0,
  quotesSent: 0,
  quotesAccepted: 0,
  quoteOrders: 0,
  salesCents: 0,
  earnedCents: 0,
  paidCents: 0,
  dueCents: 0,
});

/** Every salesperson's month: link clicks through to orders, quotes through to orders, then the money. */
export function SalesTable({ rows, nameHref, month }: { rows: SalesRow[]; nameHref?: (id: number) => string; month: string }) {
  const total = rows.reduce((t, r) => {
    for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += r[k];
    return t;
  }, emptyRow());
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th rowSpan={2}>Salesperson</th>
            <th colSpan={3} className="adm-num">
              Link
            </th>
            <th colSpan={3} className="adm-num">
              Quotes
            </th>
            <th colSpan={4} className="adm-num">
              Commission
            </th>
          </tr>
          <tr>
            <th className="adm-num" title="Different visitors who clicked the link">
              Clicks
            </th>
            <th className="adm-num" title="New accounts from the link">
              Sign-ups
            </th>
            <th className="adm-num" title="Orders paid by customers from the link">
              Orders
            </th>
            <th className="adm-num">Sent</th>
            <th className="adm-num">Accepted</th>
            <th className="adm-num" title="Orders paid through a quote">
              Orders
            </th>
            <th className="adm-num" title="Sales excluding shipping, on orders paid this month">
              Sales
            </th>
            <th className="adm-num">Earned</th>
            <th className="adm-num" title="Paid out this month">
              Paid
            </th>
            <th className="adm-num" title="Owed today, from any month">
              Due now
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                {nameHref ? <Link href={nameHref(r.id)}>{r.name}</Link> : r.name}
                <div className="adm-muted adm-small">{bpsToPercent(r.rateBps)}%</div>
              </td>
              <td className="adm-num">{r.clicks}</td>
              <td className="adm-num">{r.signups}</td>
              <td className="adm-num">{r.linkOrders}</td>
              <td className="adm-num">{r.quotesSent}</td>
              <td className="adm-num">{r.quotesAccepted}</td>
              <td className="adm-num">{r.quoteOrders}</td>
              <td className="adm-num">{rands(r.salesCents)}</td>
              <td className="adm-num">{rands(r.earnedCents)}</td>
              <td className="adm-num">{rands(r.paidCents)}</td>
              <td className="adm-num">
                <strong>{rands(r.dueCents)}</strong>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={11} className="adm-muted">
                No salespeople yet, or nothing in {monthLabel(month)}. Make someone a salesperson on their user page.
              </td>
            </tr>
          ) : null}
        </tbody>
        {rows.length > 1 ? (
          <tfoot>
            <tr>
              <th>Total</th>
              <th className="adm-num">{total.clicks}</th>
              <th className="adm-num">{total.signups}</th>
              <th className="adm-num">{total.linkOrders}</th>
              <th className="adm-num">{total.quotesSent}</th>
              <th className="adm-num">{total.quotesAccepted}</th>
              <th className="adm-num">{total.quoteOrders}</th>
              <th className="adm-num">{rands(total.salesCents)}</th>
              <th className="adm-num">{rands(total.earnedCents)}</th>
              <th className="adm-num">{rands(total.paidCents)}</th>
              <th className="adm-num">{rands(total.dueCents)}</th>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

type Line = Awaited<ReturnType<typeof commissionLines>>[number];

/** The sales behind a month's commission. `staff` adds the salesperson and links to the order. */
export function CommissionLines({ lines, staff = false }: { lines: Line[]; staff?: boolean }) {
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th>Paid</th>
            <th>Order</th>
            <th>Customer</th>
            {staff ? <th>Salesperson</th> : null}
            <th>From</th>
            <th className="adm-num">Sales</th>
            <th className="adm-num">Rate</th>
            <th className="adm-num">Commission</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(({ c, customer, company, salesperson }) => (
            <tr key={c.id}>
              <td className="adm-small adm-nowrap">{formatDate(c.earnedAt)}</td>
              <td>{staff ? <Link href={`/admin/orders/${c.orderId}/`}>#{c.orderId}</Link> : `#${c.orderId}`}</td>
              <td>
                {customer}
                {company ? <span className="adm-muted"> · {company}</span> : null}
              </td>
              {staff ? <td className="adm-small">{salesperson ?? "Former staff"}</td> : null}
              <td className="adm-small">{c.reversesId ? "Taken back" : (COMMISSION_SOURCE_LABEL[c.source] ?? c.source)}</td>
              <td className="adm-num">{rands(c.baseCents)}</td>
              <td className="adm-num">{bpsToPercent(c.rateBps)}%</td>
              <td className="adm-num">{rands(c.amountCents)}</td>
              <td>
                <Badge status={c.status === "paid" ? "completed" : c.status === "due" ? "on-hold" : "cancelled"}>{COMMISSION_STATUS_LABEL[c.status] ?? c.status}</Badge>
                {c.paidRef ? <div className="adm-muted adm-small">{c.paidRef}</div> : null}
              </td>
            </tr>
          ))}
          {!lines.length ? (
            <tr>
              <td colSpan={staff ? 9 : 8} className="adm-muted">
                No commission this month.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
