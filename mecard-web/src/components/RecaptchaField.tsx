"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";
import { RECAPTCHA_FIELD, type RecaptchaAction } from "@/lib/recaptcha-rules";

// Invisible reCAPTCHA Enterprise for one form: a hidden field that always holds a
// fresh token. Tokens last two minutes and work once, so it renews every 90
// seconds and after each submit. With no site key (local development) it renders
// only the empty field, and the server lets the form through.

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

type Grecaptcha = { enterprise: { ready: (cb: () => void) => void; execute: (key: string, opts: { action: string }) => Promise<string> } };

export function RecaptchaField({ action }: { action: RecaptchaAction }) {
  const input = useRef<HTMLInputElement>(null);

  const renew = useCallback(() => {
    const g = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
    if (!SITE_KEY || !g?.enterprise) return;
    g.enterprise.ready(() => {
      g.enterprise
        .execute(SITE_KEY, { action })
        .then((token) => {
          if (input.current) input.current.value = token;
        })
        .catch(() => undefined);
    });
  }, [action]);

  useEffect(() => {
    if (!SITE_KEY) return;
    renew();
    const timer = window.setInterval(renew, 90_000);
    // The token is spent by this submit; get the next one ready for a retry.
    const form = input.current?.form;
    const onSubmit = () => window.setTimeout(renew, 1500);
    form?.addEventListener("submit", onSubmit);
    return () => {
      window.clearInterval(timer);
      form?.removeEventListener("submit", onSubmit);
    };
  }, [renew]);

  return (
    <>
      <input ref={input} type="hidden" name={RECAPTCHA_FIELD} defaultValue="" />
      {SITE_KEY ? <Script src={`https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(SITE_KEY)}`} strategy="afterInteractive" onReady={renew} /> : null}
    </>
  );
}
