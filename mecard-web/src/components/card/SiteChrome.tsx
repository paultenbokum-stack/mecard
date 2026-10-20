"use client";

import Link from "next/link";
import { useState } from "react";

// Astra header and footer as WordPress rendered them. Card pages always get
// the logged-out menu (they are cached for everyone; pro profiles show no
// header at all); account pages switch menus like astra-child's
// my_wp_nav_menu_args().

const MENU = [
  ["How it works", "/how-it-works/"],
  ["Gallery", "/gallery/"],
  ["Sign Up", "/sign-up/"],
  ["Login", "/my-account/"],
  ["Contact Us", "/contact-us/"],
] as const;

// The "logged-in" menu, with My Account's sub-items (Basket, Contact Us,
// Log Out) brought up a level. Dashboard goes to the new /manage/ home.
const MENU_LOGGED_IN = [
  ["Dashboard", "/manage/"],
  ["Gallery", "/gallery/"],
  ["Shop", "/shop/"],
  ["Basket", "/basket/"],
  ["Contact Us", "/contact-us/"],
  ["Log Out", "/my-account/customer-logout/"],
] as const;

export function SiteHeader({ loggedIn = false }: { loggedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const menu = loggedIn ? MENU_LOGGED_IN : MENU;
  return (
    <header className="mc-site-header">
      <div className="mc-site-header__bar">
        <Link href="/" className="mc-site-header__logo" rel="home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/mecard-logo.png" width={165} height={59} alt="MeCard" />
        </Link>
        <button type="button" className="mc-site-header__toggle" aria-expanded={open} aria-controls="mc-site-menu" aria-label="Main menu" onClick={() => setOpen((o) => !o)}>
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
        <ul id="mc-site-menu" className="mc-site-header__menu mc-site-header__menu--desktop" style={{ display: "none" }}>
          {menu.map(([label, href]) => (
            <li key={href}>
              <a href={href}>{label}</a>
            </li>
          ))}
        </ul>
      </div>
      {open ? (
        <ul className="mc-site-header__menu">
          {menu.map(([label, href]) => (
            <li key={href}>
              <a href={href}>{label}</a>
            </li>
          ))}
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
