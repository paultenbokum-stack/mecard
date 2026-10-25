"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { encodeAcquisition, FIRST_TOUCH_COOKIE, FIRST_TOUCH_DAYS, firstTouch, isMarketingPath } from "@/lib/acquisition";
import { beacon } from "@/lib/beacon";

// On every page (root layout): saves the visitor's first-touch source once
// (conversion plan 0.2), and sends page_viewed on the marketing pages (0.7).
// Done in the browser so cached pages never set cookies.

export function FirstTouch() {
  const path = usePathname();

  useEffect(() => {
    try {
      if (!document.cookie.split("; ").some((c) => c.startsWith(FIRST_TOUCH_COOKIE + "="))) {
        const value = encodeAcquisition(firstTouch(location.href, document.referrer));
        document.cookie = `${FIRST_TOUCH_COOKIE}=${value};max-age=${FIRST_TOUCH_DAYS * 86400};path=/;samesite=lax`;
      }
    } catch {
      // No cookies: nothing to remember.
    }
  }, []);

  useEffect(() => {
    if (path && isMarketingPath(path)) beacon("page_viewed", { meta: { path } });
  }, [path]);

  return null;
}
