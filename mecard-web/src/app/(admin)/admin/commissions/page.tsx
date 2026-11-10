import Link from "next/link";
import { MyCommission } from "@/components/admin/MyCommission";
import { CopyButton } from "@/components/admin/CopyButton";
import { CommissionLines, MonthNav, SalesTable } from "@/components/admin/SalesReport";
import { SalesLinkCard } from "@/components/admin/SalesLinkCard";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Card, Flash } from "@/components/admin/ui";
import { payCommissionsAction } from "@/lib/admin-sales-actions";
import { rands } from "@/lib/money";
import { commissionLines, ensureSalesCode, listSalespeople, payoutRun, salesReport } from "@/lib/sales";
import { bpsToPercent, currentMonth, isMonth, monthLabel, PAYOUT_CUTOFF_DAY, PAYOUT_DAY, payoutClosed } from "@/lib/sales-rules";
import { requireQuoteStaff } from "@/lib/session";
import { siteUrl } from "@/lib/site";

export const metadata = { title: "Commissions" };

export default async function AdminCommissions({ searchParams }: { searchParams: Promise<AdminSearchParams & { month?: string; sales?: string }> }) {
  const who = await requireQuoteStaff("/admin/commissions/");
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  if (!who.isAdmin) return <MyCommission userId={who.id} month={month} />;

  const chosen = Number(sp.sales);
  const salesUserId = Number.isInteger(chosen) && chosen > 0 ? chosen : undefined;
  const run = `${month}-${PAYOUT_DAY}`;
  const [all, lines, owed, code, people] = await Promise.all([salesReport(month), commissionLines(month, salesUserId), payoutRun(run), who.isSales ? ensureSalesCode(who.id) : null, listSalespeople()]);
  // Everyone who earns commission, with the link to share; a code is made for anyone who has none yet.
  const links = await Promise.all(people.map(async (p) => ({ ...p, code: p.code ?? (await ensureSalesCode(p.id)) })));
  const rows = salesUserId ? all.filter((r) => r.id === salesUserId) : all;
  const owing = owed.filter((o) => o.salesUserId && (!salesUserId || o.salesUserId === salesUserId));
  const closed = payoutClosed(run);
  const through = new Date().toISOString();

  return (
    <>
      <AdminHeader title="Commissions" />
      <Flash saved={sp.saved} error={sp.error} />
      {code ? (
        <Card title="Your link" className="adm-card--narrow">
          <SalesLinkCard url={siteUrl(`/r/${code}/`)} />
        </Card>
      ) : null}
      <Card title={`Salespeople and their links (${links.length})`}>
        {links.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table adm-table--tight">
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th className="adm-num">Rate</th>
                  <th>Link</th>
                  <th aria-label="Copy" />
                </tr>
              </thead>
              <tbody>
                {links.map((p) => {
                  const url = p.code ? siteUrl(`/r/${p.code}/`) : "";
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/users/${p.id}/`}>{p.name}</Link>
                        <div className="adm-muted adm-small">{p.email}</div>
                      </td>
                      <td className="adm-num">{bpsToPercent(p.rateBps)}%</td>
                      <td style={{ fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{url || "No link yet"}</td>
                      <td className="adm-num">{url ? <CopyButton text={url} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adm-muted" style={{ margin: 0 }}>
            Nobody is a salesperson yet. Tick Salesperson on someone&apos;s user page to give them a link.
          </p>
        )}
        <p className="adm-help" style={{ marginBottom: 0 }}>
          Each link opens the home page. Add ?to=cards, ?to=teams or ?to=signup to open Pricing, For teams or Sign up instead.
        </p>
      </Card>
      <MonthNav month={month} keep={{ sales: salesUserId ? String(salesUserId) : undefined }} />
      <SalesTable rows={rows} month={month} nameHref={(id) => `?${new URLSearchParams({ month, sales: String(id) })}`} />
      {salesUserId ? (
        <p>
          <Link href={`?${new URLSearchParams({ month })}`}>Show everyone</Link>
        </p>
      ) : null}
      <p className="adm-help">
        A percentage of sales excluding shipping, on any purchase through a salesperson&apos;s quote, and on what a customer buys in the 12 months after signing up through their link (within 7 days of
        the click, with a first purchase within a month of signing up). Each step counts in the month it happened; orders and commission count in the month paid.
      </p>

      {owing.length ? (
        <Card title={`Payout on ${PAYOUT_DAY} ${monthLabel(month)}`}>
          <p className="adm-help" style={{ marginTop: 0 }}>
            {closed
              ? `Orders paid up to the ${PAYOUT_CUTOFF_DAY}th, with anything left over from earlier runs.`
              : `This run is still open and closes on the ${PAYOUT_CUTOFF_DAY}th, so these amounts can still grow.`}
          </p>
          {owing.map((o) => (
            <form key={o.salesUserId} action={payCommissionsAction} className="adm-inline" style={{ display: "flex", flexWrap: "wrap", marginBottom: 8 }}>
              <input type="hidden" name="sales_user_id" value={o.salesUserId ?? ""} />
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="payout_date" value={run} />
              <input type="hidden" name="through" value={through} />
              <span style={{ minWidth: 220 }}>
                {o.name}: <strong>{rands(o.cents)}</strong>
              </span>
              {closed && o.cents > 0 ? (
                <>
                  <input name="ref" required maxLength={120} placeholder="Payment reference" aria-label={`Payment reference for ${o.name}`} className="adm-input" />
                  <SubmitButton busy="Saving…" confirm={`Mark ${rands(o.cents)} as paid to ${o.name}?`}>
                    Mark as paid
                  </SubmitButton>
                </>
              ) : o.cents <= 0 ? (
                <span className="adm-muted adm-small">Nothing to pay. This carries to the next run.</span>
              ) : null}
            </form>
          ))}
        </Card>
      ) : null}

      <h2>Sales paid in {monthLabel(month)}</h2>
      <CommissionLines lines={lines} staff />
    </>
  );
}
