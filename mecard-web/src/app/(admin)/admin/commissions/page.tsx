import Link from "next/link";
import { CommissionLines, MonthNav, SalesTable } from "@/components/admin/SalesReport";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Card, Flash } from "@/components/admin/ui";
import { payCommissionsAction } from "@/lib/admin-sales-actions";
import { rands } from "@/lib/money";
import { commissionLines, salesReport } from "@/lib/sales";
import { currentMonth, isMonth, monthLabel } from "@/lib/sales-rules";

export const metadata = { title: "Commissions" };

export default async function AdminCommissions({ searchParams }: { searchParams: Promise<AdminSearchParams & { month?: string; sales?: string }> }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  const chosen = Number(sp.sales);
  const salesUserId = Number.isInteger(chosen) && chosen > 0 ? chosen : undefined;
  const [all, lines] = await Promise.all([salesReport(month), commissionLines(month, salesUserId)]);
  const rows = salesUserId ? all.filter((r) => r.id === salesUserId) : all;
  const owing = rows.filter((r) => r.dueCents > 0);
  const through = new Date().toISOString();

  return (
    <>
      <AdminHeader title="Commissions" />
      <Flash saved={sp.saved} error={sp.error} />
      <MonthNav month={month} keep={{ sales: salesUserId ? String(salesUserId) : undefined }} />
      <SalesTable rows={rows} month={month} nameHref={(id) => `?${new URLSearchParams({ month, sales: String(id) })}`} />
      {salesUserId ? (
        <p>
          <Link href={`?${new URLSearchParams({ month })}`}>Show everyone</Link>
        </p>
      ) : null}
      <p className="adm-help">
        A percentage of sales excluding shipping, on every purchase within 12 months of signing up through the salesperson&apos;s link, and on any purchase through their quote. Each step counts in the
        month it happened; orders and commission count in the month paid.
      </p>

      {owing.length ? (
        <Card title="Pay out">
          {owing.map((r) => (
            <form key={r.id} action={payCommissionsAction} className="adm-inline" style={{ display: "flex", flexWrap: "wrap", marginBottom: 8 }}>
              <input type="hidden" name="sales_user_id" value={r.id} />
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="through" value={through} />
              <span style={{ minWidth: 220 }}>
                {r.name}: <strong>{rands(r.dueCents)}</strong>
              </span>
              <input name="ref" required maxLength={120} placeholder="Payment reference" aria-label={`Payment reference for ${r.name}`} className="adm-input" />
              <SubmitButton busy="Saving…" confirm={`Mark ${rands(r.dueCents)} as paid to ${r.name}?`}>
                Mark as paid
              </SubmitButton>
            </form>
          ))}
        </Card>
      ) : null}

      <h2>Sales paid in {monthLabel(month)}</h2>
      <CommissionLines lines={lines} staff />
    </>
  );
}
