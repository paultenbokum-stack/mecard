import type { Metadata } from "next";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { SalesNav } from "@/components/admin/SalesNav";
import { requireSales } from "@/lib/session";
import "../../(admin)/admin/admin.css";

export const metadata: Metadata = { title: { default: "Sales", template: "%s – MeCard Sales" }, robots: { index: false, follow: false } };

// A salesperson's own screens: their link, their quotes and their commission. Nothing else of the admin.
export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  await requireSales();
  return (
    <div className="adm">
      <aside className="adm-side">
        <SalesNav />
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
