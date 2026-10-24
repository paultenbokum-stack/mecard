"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

// A /manage/ screen (profile editor, card editor, buy a card) opened over the
// list. The URL is the screen's own (Next intercepting routes), so a refresh or
// shared link opens the full page instead. Closing goes back to `closeHref`; an
// editor with unsaved changes marks itself data-dirty="true" and is asked about.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, closeHref, wide = false, children }: { title: string; closeHref: string; wide?: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    if (panel.current?.querySelector('[data-dirty="true"]') && !window.confirm("You have unsaved changes. Close without saving?")) return;
    router.push(closeHref, { scroll: false });
  }, [router, closeHref]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>(".acc-modal__close")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        return close();
      }
      if (e.key !== "Tab" || !panel.current) return;
      // Keep focus inside the modal while it is open.
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [close]);

  return (
    <div className="acc-modal">
      <div className="acc-modal__backdrop" onClick={close} aria-hidden="true" />
      <div ref={panel} className={`acc-modal__panel${wide ? " acc-modal__panel--wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="acc-modal-title">
        <div className="acc-modal__head">
          <h2 id="acc-modal-title">{title}</h2>
          <button type="button" className="acc-modal__close" aria-label="Close" onClick={close}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="acc-modal__body">{children}</div>
      </div>
    </div>
  );
}
