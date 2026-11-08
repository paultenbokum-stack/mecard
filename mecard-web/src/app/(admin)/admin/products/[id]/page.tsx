import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { AdminLogList } from "@/components/admin/AdminLogList";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Card, Flash } from "@/components/admin/ui";
import { saveProductAction } from "@/lib/admin-product-actions";

export const metadata = { title: "Product" };

const randsInput = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));

export default async function AdminProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const [p] = Number.isInteger(id) ? await db.select().from(products).where(eq(products.id, id)).limit(1) : [];
  if (!p) notFound();

  return (
    <>
      <AdminHeader title={p.name} back={{ href: "/admin/products/", label: "Products" }}>
        <a href={`/product/${p.slug}/`} target="_blank" rel="noopener" className="adm-btn">
          <i className="fas fa-external-link-alt" aria-hidden="true" /> View page
        </a>
        {p.active ? <Badge status="active">Shown</Badge> : <Badge status="inactive">Hidden</Badge>}
      </AdminHeader>
      <Flash saved={sp.saved} error={sp.error} />
      <form action={saveProductAction}>
        <input type="hidden" name="product_id" value={p.id} />
        <div className="adm-grid">
          <div>
            <Card title="Details">
              <div className="adm-form" style={{ gridTemplateColumns: "1fr" }}>
                <div className="adm-field">
                  <label htmlFor="p-name">Name</label>
                  <input id="p-name" name="name" required maxLength={255} defaultValue={p.name} className="adm-input" />
                </div>
                <div className="adm-field">
                  <label htmlFor="p-description">Description (HTML)</label>
                  <textarea id="p-description" name="description" rows={18} defaultValue={p.description} className="adm-textarea" />
                  <span className="adm-help">Shown on the product page. Scripts and forms are removed when you save.</span>
                </div>
              </div>
            </Card>
          </div>
          <div>
            <Card title="Price">
              <div className="adm-form" style={{ gridTemplateColumns: "1fr" }}>
                <div className="adm-field">
                  <label htmlFor="p-price">Price (R)</label>
                  <input id="p-price" name="price" inputMode="decimal" required defaultValue={randsInput(p.priceCents)} className="adm-input" />
                </div>
                <div className="adm-field">
                  <label htmlFor="p-was">Struck-through price (R, optional)</label>
                  <input id="p-was" name="was_price" inputMode="decimal" defaultValue={randsInput(p.regularPriceCents)} className="adm-input" />
                  <span className="adm-help">Shows a sale: the old, higher price crossed out beside the price.</span>
                </div>
                <div className="adm-field">
                  <label>
                    <input type="checkbox" name="active" defaultChecked={p.active} /> Shown to customers
                  </label>
                </div>
              </div>
              <p className="adm-help">
                The home page and profile screens follow this price, within 5 minutes. Orders and quotes keep the prices they have. The Pricing, For teams, Free and How it works pages have their own text, so
                change those separately.
              </p>
              <SubmitButton className="adm-btn adm-btn--primary" busy="Saving…">
                Save product
              </SubmitButton>
            </Card>
          </div>
        </div>
      </form>
      <AdminLogList entity="product" id={p.id} />
    </>
  );
}
