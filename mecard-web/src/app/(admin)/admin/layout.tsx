import type { Metadata } from "next";
import { headers } from "next/headers";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireQuoteStaff } from "@/lib/session";
import "./admin.css";

export const metadata: Metadata = { title: { default: "Admin", template: "%s – MeCard Admin" }, robots: { index: false, follow: false } };

// Staff screens (the WordPress admin, WooCommerce orders and the Toolset
// backend pages: Card Processing, Encoding CSV). Admins, and salespeople for
// their own quotes and commission: this layout doesn't run on every navigation,
// so src/proxy.ts is what keeps a salesperson to those screens.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-admin-path");
  const who = await requireQuoteStaff(path && /^\/admin\/[^\s]*$/.test(path) ? path : "/admin/");
  return (
    <div className="adm">
      <aside className="adm-side">
        <AdminNav salesOnly={!who.isAdmin} />
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
