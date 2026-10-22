"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/", label: "Dashboard", icon: "fa-tachometer-alt", exact: true },
  { href: "/admin/stats/", label: "Stats", icon: "fa-chart-bar" },
  { href: "/admin/orders/", label: "Orders", icon: "fa-receipt" },
  { href: "/admin/cards/", label: "Card processing", icon: "fa-id-card" },
  { href: "/admin/encoding/", label: "Encoding file", icon: "fa-file-csv" },
  { href: "/admin/quotes/", label: "Quotes", icon: "fa-file-invoice" },
  { href: "/admin/coupons/", label: "Coupons", icon: "fa-percent" },
  { href: "/admin/entitlements/", label: "Entitlements", icon: "fa-key" },
];

export function AdminNav() {
  const path = usePathname() ?? "";
  const norm = path.endsWith("/") ? path : path + "/";
  return (
    <nav aria-label="Admin">
      <Link href="/admin/" className="adm-brand">
        <strong>me</strong>card <span>admin</span>
      </Link>
      <ul className="adm-nav">
        {items.map((i) => {
          const active = i.exact ? norm === i.href : norm.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
                <i className={`fas ${i.icon} fa-fw`} aria-hidden="true" /> {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <ul className="adm-nav adm-nav--foot">
        <li>
          <Link href="/manage/">
            <i className="fas fa-arrow-left fa-fw" aria-hidden="true" /> My MeCard
          </Link>
        </li>
        <li>
          <Link href="/my-account/customer-logout/" prefetch={false}>
            <i className="fas fa-sign-out-alt fa-fw" aria-hidden="true" /> Log out
          </Link>
        </li>
      </ul>
    </nav>
  );
}
