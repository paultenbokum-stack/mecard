"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/sales/", label: "My commission", icon: "fa-coins", exact: true },
  { href: "/sales/quotes/", label: "My quotes", icon: "fa-file-invoice" },
];

export function SalesNav() {
  const path = usePathname() ?? "";
  const norm = path.endsWith("/") ? path : path + "/";
  return (
    <nav aria-label="Sales">
      <Link href="/sales/" className="adm-brand">
        <strong>me</strong>card <span>sales</span>
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
