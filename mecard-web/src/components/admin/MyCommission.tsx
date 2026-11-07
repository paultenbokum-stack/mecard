import { CommissionLines, emptyRow, MonthNav } from "@/components/admin/SalesReport";
import { SalesLinkCard } from "@/components/admin/SalesLinkCard";
import { AdminHeader, Card } from "@/components/admin/ui";
import { rands } from "@/lib/money";
import { commissionLines, ensureSalesCode, salesReport } from "@/lib/sales";
import { bpsToPercent, FIRST_SALE_MONTHS, monthLabel, PAYOUT_CUTOFF_DAY, PAYOUT_DAY, REFERRAL_MONTHS, SIGNUP_DAYS } from "@/lib/sales-rules";
import { siteUrl } from "@/lib/site";

/** A salesperson's own month: their link, their figures and the sales behind them. */
export async function MyCommission({ userId, month }: { userId: number; month: string }) {
  const [code, rows, lines] = await Promise.all([ensureSalesCode(userId), salesReport(month, userId), commissionLines(month, userId)]);
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
        You earn {bpsToPercent(r.rateBps)}% of sales excluding shipping, on anything bought through your quote. With your link, a customer must sign up within {SIGNUP_DAYS} days of clicking and make a
        first purchase within {FIRST_SALE_MONTHS} month of signing up; you then earn on what they buy for {REFERRAL_MONTHS} months from signing up. Paid on the {PAYOUT_DAY}th for orders paid up to the{" "}
        {PAYOUT_CUTOFF_DAY}th.
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
