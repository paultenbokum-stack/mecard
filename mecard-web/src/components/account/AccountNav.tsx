import Link from "next/link";
import { LOGOUT } from "@/lib/auth-paths";

// WooCommerce's My Account navigation (woocommerce-MyAccount-navigation) beside
// the page content, with the MeCard console in place of Downloads/Addresses.

export const ACCOUNT_LINKS = [
  ["dashboard", "Overview", "/my-account/"],
  ["console", "My profiles and cards", "/manage/"],
  ["orders", "Orders", "/my-account/orders/"],
  ["quotes", "Quotes", "/my-account/quotes/"],
  ["edit-account", "Account details", "/my-account/edit-account/"],
  ["help", "Get help", "/contact-us/"],
  ["logout", "Log out", LOGOUT],
] as const;

type Section = (typeof ACCOUNT_LINKS)[number][0];

export function AccountLayout({ active, children }: { active: Section; children: React.ReactNode }) {
  return (
    <div className="acc__wrap acc__wrap--wide acc-myaccount">
      <nav className="acc-myaccount__nav" aria-label="My account">
        <ul>
          {ACCOUNT_LINKS.map(([key, label, href]) => (
            <li key={key}>
              <Link href={href} aria-current={active === key ? "page" : undefined}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="acc-myaccount__content">{children}</div>
    </div>
  );
}
