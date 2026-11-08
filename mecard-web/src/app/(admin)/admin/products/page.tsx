import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { AdminHeader, type AdminSearchParams, Badge, Flash } from "@/components/admin/ui";
import { rands } from "@/lib/money";

export const metadata = { title: "Products" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const sp = await searchParams;
  const rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.name));
  return (
    <>
      <AdminHeader title="Products" />
      <Flash saved={sp.saved} error={sp.error} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="adm-num">Price</th>
              <th className="adm-num">Struck through</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/products/${p.id}/`}>
                    <strong>{p.name}</strong>
                  </Link>
                  <div className="adm-muted adm-small">/product/{p.slug}/</div>
                </td>
                <td className="adm-num">{rands(p.priceCents)}</td>
                <td className="adm-num">{p.regularPriceCents ? rands(p.regularPriceCents) : "—"}</td>
                <td>{p.active ? <Badge status="active">Shown</Badge> : <Badge status="inactive">Hidden</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
