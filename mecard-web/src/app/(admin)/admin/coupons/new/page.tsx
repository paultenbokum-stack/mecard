import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { CouponForm } from "@/components/admin/CouponForm";
import { AdminHeader, type AdminSearchParams, Card, Flash } from "@/components/admin/ui";

export const metadata = { title: "Add coupon" };

export default async function NewCoupon({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const sp = await searchParams;
  const choices = await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.active, true)).orderBy(asc(products.sortOrder), asc(products.name));
  return (
    <>
      <AdminHeader title="Add coupon" back={{ href: "/admin/coupons/", label: "Coupons" }} />
      <Flash error={sp.error} />
      <div style={{ maxWidth: 780 }}>
        <Card>
          <CouponForm products={choices} />
        </Card>
      </div>
    </>
  );
}
