import type { Metadata } from "next";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/session";
import "./admin.css";

export const metadata: Metadata = { title: { default: "Admin", template: "%s – MeCard Admin" }, robots: { index: false, follow: false } };

// Staff screens (the WordPress admin, WooCommerce orders and the Toolset
// backend pages: Card Processing, Encoding CSV). Admins only.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="adm">
      <aside className="adm-side">
        <AdminNav />
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
