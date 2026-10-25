import Link from "next/link";
import { Fragment } from "react";
import { switchToTeamsAction } from "@/app/(account)/manage/actions";
import { LOGOUT } from "@/lib/auth-paths";
import { manageViewFor } from "@/lib/manage-view";

// WooCommerce's My Account navigation (woocommerce-MyAccount-navigation) beside
// the page content, with the MeCard console in place of Downloads.

export const ACCOUNT_LINKS = [
  ["dashboard", "Overview", "/my-account/"],
  ["console", "My profiles and cards", "/manage/"],
  ["orders", "Orders", "/my-account/orders/"],
  ["quotes", "Quotes", "/my-account/quotes/"],
  ["images", "My images", "/my-account/images/"],
  ["edit-address", "Addresses", "/my-account/edit-address/"],
  ["edit-account", "Account details", "/my-account/edit-account/"],
  ["help", "Get help", "/contact-us/"],
  ["logout", "Log out", LOGOUT],
] as const;

type Section = (typeof ACCOUNT_LINKS)[number][0];

export async function AccountLayout({ active, children }: { active: Section; children: React.ReactNode }) {
  // The individual view offers the way to the team dashboard here too.
  const single = (await manageViewFor()).view === "single";
  return (
    <div className="acc__wrap acc__wrap--wide acc-myaccount">
      <nav className="acc-myaccount__nav" aria-label="My account">
        <ul>
          {ACCOUNT_LINKS.map(([key, label, href]) => (
            <Fragment key={key}>
              <li>
                <Link href={href} aria-current={active === key ? "page" : undefined}>
                  {label}
                </Link>
              </li>
              {key === "console" && single ? (
                <li>
                  <form action={switchToTeamsAction}>
                    <button type="submit" className="acc-myaccount__navbtn">
                      Switch to teams
                    </button>
                  </form>
                </li>
              ) : null}
            </Fragment>
          ))}
        </ul>
      </nav>
      <div className="acc-myaccount__content">{children}</div>
    </div>
  );
}
