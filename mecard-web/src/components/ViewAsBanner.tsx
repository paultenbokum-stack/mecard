"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { VIEW_AS_LABEL_COOKIE } from "@/lib/view-as-rules";

const noSubscribe = () => () => {};

function readLabel(): string | null {
  const value = document.cookie.match(new RegExp(`(?:^|; )${VIEW_AS_LABEL_COOKIE}=([^;]*)`))?.[1];
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// The always-on reminder that this is a customer's account seen through staff eyes,
// on every page. It lives in the root layout and reads a cookie in the browser, so
// the cached public pages stay cached. Hidden from everyone without that cookie.
export function ViewAsBanner() {
  usePathname(); // Re-read the cookie on client navigation: starting view-as is one.
  const notSaved = useSearchParams().has("read_only");
  const label = useSyncExternalStore(noSubscribe, readLabel, () => null);
  if (!label) return null;
  return (
    <div className="view-as" role="status">
      <p className="view-as__text">
        Viewing as <strong>{label}</strong>.{" "}
        {notSaved ? <strong>That wasn&rsquo;t saved: this view is read-only.</strong> : "Read-only: nothing you change here is saved."}
      </p>
      <form method="post" action="/api/view-as/stop/">
        <button type="submit" className="view-as__exit">
          Exit
        </button>
      </form>
    </div>
  );
}
