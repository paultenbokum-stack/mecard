"use client";

import { useEffect } from "react";

type Gtag = (...args: unknown[]) => void;

export type GtagEvent = [name: string, params: Record<string, unknown>];

// Sends gtag events once the Google tag has loaded (it loads after the page is
// interactive). With `onceKey`, only once per browser, so a reload or a second
// visit to the thank-you page doesn't count the sale again.
export function GtagEvents({ events, onceKey }: { events: GtagEvent[]; onceKey?: string }) {
  useEffect(() => {
    const key = onceKey ? `mecard_gtag_${onceKey}` : "";
    try {
      if (key && localStorage.getItem(key)) return;
    } catch {
      // No storage: send anyway (Google also dedupes on transaction_id).
    }
    let tries = 0;
    const send = () => {
      const gtag = (window as unknown as { gtag?: Gtag }).gtag;
      if (typeof gtag !== "function") {
        if (++tries < 40) timer = setTimeout(send, 250);
        return;
      }
      for (const [name, params] of events) gtag("event", name, params);
      try {
        if (key) localStorage.setItem(key, "1");
      } catch {}
    };
    let timer = setTimeout(send, 0);
    return () => clearTimeout(timer);
    // The events are fixed for the page; send them once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
