"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MiniCart } from "@/components/shop/MiniCart";

// Astra header and footer as WordPress rendered them. Card pages always get
// the logged-out menu (they are cached for everyone; pro profiles show no
// header at all); account pages switch menus like astra-child's
// my_wp_nav_menu_args().

const MENU = [
  ["How it works", "/how-it-works/"],
  ["Gallery", "/gallery/"],
  ["Sign Up", "/sign-up/"],
  ["Log in", "/my-account/"],
  ["Contact Us", "/contact-us/"],
] as const;

// The "logged-in" menu. My Account opens WooCommerce's account pages, as the
// WordPress menu's My Account item did; Dashboard is the /manage/ home. The
// basket is the cart icon beside the menu.
const MENU_LOGGED_IN = [
  ["Dashboard", "/manage/"],
  ["Gallery", "/gallery/"],
] as const;

const ACCOUNT_MENU = [
  ["Overview", "/my-account/"],
  ["My profiles and cards", "/manage/"],
  ["Orders", "/my-account/orders/"],
  ["Account details", "/my-account/edit-account/"],
  ["Get help", "/contact-us/"],
  ["Log out", "/my-account/customer-logout/"],
] as const;

function Chevron() {
  return (
    <svg className="mc-site-header__chevron" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M6.3 8.8a1 1 0 0 1 1.4 0L12 13.1l4.3-4.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

/** Desktop: My Account with its dropdown. Closes on Escape, a click outside, or focus leaving it. */
function AccountDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <li
      ref={ref}
      className="mc-site-header__account"
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button ref={button} type="button" className="mc-site-header__account-toggle" aria-expanded={open} aria-controls="mc-account-menu" onClick={() => setOpen((o) => !o)}>
        My Account
        <Chevron />
      </button>
      <ul id="mc-account-menu" className="mc-site-header__submenu" hidden={!open}>
        {ACCOUNT_MENU.map(([label, href]) => (
          <li key={href}>
            <a href={href}>{label}</a>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** `detect`: ask the browser's session which menu to show, on every page (cached pages, and account pages after logging in or out, where the layout isn't re-rendered). `tagline`: the site description under the logo (site pages). */
export function SiteHeader({ loggedIn = false, detect = false, tagline = false }: { loggedIn?: boolean; detect?: boolean; tagline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(loggedIn);
  const pathname = usePathname();
  useEffect(() => {
    if (!detect) return;
    let live = true;
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { user?: unknown } | null) => live && setSignedIn(!!s?.user))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [detect, pathname]);
  const menu = signedIn ? MENU_LOGGED_IN : MENU;
  return (
    <header className="mc-site-header">
      <div className="mc-site-header__bar">
        <div className="mc-site-header__inner">
          <div className="mc-site-header__brand">
            <Link href="/" className="mc-site-header__logo" rel="home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/mecard-logo.png" width={165} height={59} alt="MeCard" />
            </Link>
            {tagline ? <p className="mc-site-header__tagline">The only business card you&apos;ll ever need</p> : null}
          </div>
          <ul id="mc-site-menu" className="mc-site-header__menu mc-site-header__menu--desktop" style={{ display: "none" }}>
            {menu.map(([label, href]) => (
              <li key={href}>
                <a href={href}>{label}</a>
              </li>
            ))}
            {signedIn ? <AccountDropdown /> : null}
          </ul>
          {signedIn ? <MiniCart /> : null}
          <button type="button" className="mc-site-header__toggle" aria-expanded={open} aria-controls="mc-site-menu-mobile" aria-label="Main menu" onClick={() => setOpen((o) => !o)}>
            {open ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M5.3 18.7a1 1 0 0 1 0-1.4L10.6 12 5.3 6.7a1 1 0 0 1 1.4-1.4L12 10.6l5.3-5.3a1 1 0 1 1 1.4 1.4L13.4 12l5.3 5.3a1 1 0 0 1-1.4 1.4L12 13.4l-5.3 5.3a1 1 0 0 1-1.4 0Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {open ? (
        <ul id="mc-site-menu-mobile" className="mc-site-header__menu">
          {menu.map(([label, href]) => (
            <li key={href}>
              <a href={href}>{label}</a>
            </li>
          ))}
          {signedIn ? (
            <li className="mc-site-header__account-mobile">
              <span className="mc-site-header__menu-heading" id="mc-account-heading">
                My Account
              </span>
              <ul aria-labelledby="mc-account-heading">
                {ACCOUNT_MENU.map(([label, href]) => (
                  <li key={href}>
                    <a href={href}>{label}</a>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
        </ul>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mc-site-footer">
      <div className="mc-site-footer__menu">
        <ul>
          <li>
            <a href="https://taggable.co.za/terms-of-use/">Terms of Use</a>
          </li>
          <li>
            <a href="https://taggable.co.za/privacy/">Privacy Policy</a>
          </li>
          <li>
            <a href="https://taggable.co.za/cookie-policy/">Cookie Policy</a>
          </li>
        </ul>
      </div>
      <div className="mc-site-footer__copy">
        <p>Copyright © {new Date().getFullYear()} Taggable (Pty) Ltd</p>
      </div>
    </footer>
  );
}
