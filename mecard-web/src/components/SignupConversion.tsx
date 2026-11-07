"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SIGNUP_CONVERSION_COOKIE } from "@/lib/signup-choice";

type Gtag = (...args: unknown[]) => void;

// Tells Google about a new account. onNewUser leaves a short-lived cookie; the
// first account page after sign-up sends mecard_signup (the GA4 event behind the
// "Mecard (web) mecard_signup" conversion in Google Ads) and clears the cookie,
// so a reload can't count it twice. Email sign-up arrives by client navigation
// and Google sign-up by a full page load, hence the pathname dependency.
export function SignupConversion() {
  const pathname = usePathname();
  useEffect(() => {
    const method = document.cookie.match(new RegExp(`(?:^|; )${SIGNUP_CONVERSION_COOKIE}=([^;]*)`))?.[1];
    if (!method) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const send = () => {
      const gtag = (window as unknown as { gtag?: Gtag }).gtag;
      if (typeof gtag !== "function") {
        if (++tries < 40) timer = setTimeout(send, 250);
        return;
      }
      gtag("event", "mecard_signup", { event_source: "mecard", method, transport_type: "beacon" });
      document.cookie = `${SIGNUP_CONVERSION_COOKIE}=; path=/; max-age=0`;
    };
    timer = setTimeout(send, 0);
    return () => clearTimeout(timer);
  }, [pathname]);
  return null;
}
