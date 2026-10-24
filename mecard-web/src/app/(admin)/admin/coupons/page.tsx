import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { coupons } from "@/db/schema";
import { AdminHeader, type AdminSearchParams, Badge, Flash } from "@/components/admin/ui";
import { couponState, describeCoupon } from "@/lib/coupon-rules";
import { couponUsage } from "@/lib/coupons";
import { formatDate, rands } from "@/lib/money";

export const metadata = { title: "Coupons" };

const STATE_LABEL = { active: "Active", inactive: "Inactive", expired: "Expired", "used-up": "Used up" } as const;

export default async function AdminCoupons({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const sp = await searchParams;
  const list = await db.select().from(coupons).orderBy(desc(coupons.createdAt), desc(coupons.id));
  const usage = await Promise.all(list.map((c) => couponUsage(c.code, null)));

  return (
    <>
      <AdminHeader title="Coupons">
        <Link href="/admin/coupons/new/" className="adm-btn adm-btn--primary">
          <i className="fas fa-plus" aria-hidden="true" /> Add coupon
        </Link>
      </AdminHeader>
      <Flash saved={sp.saved} error={sp.error} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Minimum spend</th>
              <th className="adm-num">Used</th>
              <th>Valid until</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c, i) => {
              const state = couponState(c, usage[i].usage);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/coupons/${c.id}/`}>
                      <strong>{c.code}</strong>
                    </Link>
                    {c.description ? <div className="adm-muted adm-small">{c.description}</div> : null}
                  </td>
                  <td>
                    {describeCoupon(c)}
                    {c.productIds.length ? <div className="adm-muted adm-small">selected products only</div> : null}
                    {c.allowedUserIds.length ? (
                      <div className="adm-muted adm-small">
                        {c.allowedUserIds.length} account{c.allowedUserIds.length === 1 ? "" : "s"} only
                      </div>
                    ) : null}
                  </td>
                  <td>{c.minSpendCents ? rands(c.minSpendCents) : "—"}</td>
                  <td className="adm-num">
                    {usage[i].usage}
                    {c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}
                  </td>
                  <td className="adm-small">{c.expiresAt ? formatDate(c.expiresAt) : "No expiry"}</td>
                  <td>
                    <Badge status={state}>{STATE_LABEL[state]}</Badge>
                  </td>
                </tr>
              );
            })}
            {!list.length ? (
              <tr>
                <td colSpan={6} className="adm-muted">
                  No coupons yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
