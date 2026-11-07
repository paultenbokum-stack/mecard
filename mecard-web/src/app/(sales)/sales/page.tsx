import { CommissionLines, emptyRow, MonthNav } from "@/components/admin/SalesReport";
import { SalesLinkCard } from "@/components/admin/SalesLinkCard";
import { AdminHeader, Card } from "@/components/admin/ui";
import { rands } from "@/lib/money";
import { commissionLines, ensureSalesCode, salesReport } from "@/lib/sales";
import { bpsToPercent, currentMonth, isMonth, monthLabel, REFERRAL_MONTHS } from "@/lib/sales-rules";
import { requireSales } from "@/lib/session";
import { siteUrl } from "@/lib/site";

export const metadata = { title: "My commission" };

export default async function SalesHome({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const me = await requireSales();
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  const [code, rows, lines] = await Promise.all([ensureSalesCode(me), salesReport(month, me), commissionLines(month, me)]);
  const r = rows[0] ?? { ...emptyRow(), rateBps: 0 };
  const stats: [string, string][] = [
    ["Link clicks", String(r.clicks)],
    ["Sign-ups", String(r.signups)],
    ["Orders from your link", String(r.linkOrders)],
    ["Quotes sent", String(r.quotesSent)],
    ["Quotes accepted", String(r.quotesAccepted)],
    ["Orders from your quotes", String(r.quoteOrders)],
    ["Sales excluding shipping", rands(r.salesCents)],
    ["Commission earned", rands(r.earnedCents)],
    ["Commission paid", rands(r.paidCents)],
    ["Due to you now", rands(r.dueCents)],
  ];

  return (
    <>
      <AdminHeader title="My commission" />
      <p className="adm-muted">
        You earn {bpsToPercent(r.rateBps)}% of sales excluding shipping, on everything a customer buys in the {REFERRAL_MONTHS} months after signing up through your link, and on anything bought through
        your quote.
      </p>
      {code ? (
        <Card title="Your link" className="adm-card--narrow">
          <SalesLinkCard url={siteUrl(`/r/${code}/`)} />
        </Card>
      ) : null}
      <h2>{monthLabel(month)}</h2>
      <MonthNav month={month} />
      <div className="adm-stats">
        {stats.map(([label, value]) => (
          <div key={label} className="adm-stat">
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <CommissionLines lines={lines} />
    </>
  );
}
