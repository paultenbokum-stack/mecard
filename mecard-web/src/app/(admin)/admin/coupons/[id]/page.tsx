import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { coupons, orders, products, users } from "@/db/schema";
import { CouponForm } from "@/components/admin/CouponForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Card, Flash } from "@/components/admin/ui";
import { deleteCouponAction } from "@/lib/admin-coupon-actions";
import { couponUsage, ordersUsingCode } from "@/lib/coupons";
import { formatDate, ORDER_STATUS_LABEL, rands } from "@/lib/money";

export const metadata = { title: "Coupon" };

const productChoices = () => db.select({ id: products.id, name: products.name }).from(products).where(eq(products.active, true)).orderBy(asc(products.sortOrder), asc(products.name));

export default async function AdminCoupon({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const [c] = Number.isInteger(id) ? await db.select().from(coupons).where(eq(coupons.id, id)) : [];
  if (!c) notFound();
  const [choices, usage, used, accounts] = await Promise.all([
    productChoices(),
    couponUsage(c.code, null),
    db.select().from(orders).where(ordersUsingCode(c.code)).orderBy(desc(orders.id)).limit(50),
    c.allowedUserIds.length ? db.select({ email: users.email }).from(users).where(inArray(users.id, c.allowedUserIds)) : Promise.resolve([]),
  ]);

  return (
    <>
      <AdminHeader title={c.code} back={{ href: "/admin/coupons/", label: "Coupons" }} />
      <Flash saved={sp.saved} error={sp.error} />
      <div className="adm-grid">
        <Card>
          <CouponForm coupon={c} products={choices} emails={accounts.map((a) => a.email)} />
        </Card>
        <div>
          <Card title={`Orders using it (${usage.usage}${c.usageLimit !== null ? ` of ${c.usageLimit}` : ""})`}>
            {used.length ? (
              <table className="adm-table adm-table--tight">
                <tbody>
                  {used.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/orders/${o.id}/`}>#{o.id}</Link>
                      </td>
                      <td className="adm-small adm-muted">{formatDate(o.createdAt)}</td>
                      <td className="adm-num">-{rands(o.discountCents)}</td>
                      <td>
                        <Badge status={o.status}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                Not used yet.
              </p>
            )}
            <p className="adm-help" style={{ marginBottom: 0 }}>
              Cancelled and failed orders don&apos;t count towards the limits.
            </p>
          </Card>
          <Card title="Delete coupon" className="adm-card--danger">
            <form action={deleteCouponAction}>
              <input type="hidden" name="coupon_id" value={c.id} />
              <p className="adm-small">Customers can no longer use it. Orders that used it keep their discount. To pause it instead, untick Active.</p>
              <SubmitButton className="adm-btn adm-btn--danger" confirm={`Delete coupon ${c.code}?`}>
                Delete coupon
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
