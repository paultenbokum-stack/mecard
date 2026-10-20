"use client";

import { useEffect } from "react";

// What the site pages' scripts did on WordPress, for the server-rendered page:
//   - logged-in / logged-out content (the Toolset conditionals), decided here
//     because the pages are cached and the same for everyone;
//   - the scroll-reveal animation and smooth anchor scrolling (mecard-homepage.js);
//   - the accordion block (WordPress's interactivity script).

export function PageScripts() {
  useEffect(() => {
    const root = document.getElementById("mc-wp");
    if (!root) return;
    const cleanups: (() => void)[] = [];

    root.dataset.auth = "out";
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { user?: unknown } | null) => {
        if (s?.user) root.dataset.auth = "in";
      })
      .catch(() => undefined);

    const reveal = root.querySelectorAll<HTMLElement>(".mc-reveal");
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        },
        { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
      );
      reveal.forEach((el, i) => {
        el.style.transitionDelay = `${(i % 3) * 80}ms`;
        io.observe(el);
      });
      cleanups.push(() => io.disconnect());
    } else reveal.forEach((el) => el.classList.add("is-visible"));

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const toggle = target?.closest<HTMLButtonElement>(".wp-block-accordion-heading__toggle");
      if (toggle) {
        const item = toggle.closest(".wp-block-accordion-item");
        const panel = item?.querySelector<HTMLElement>(":scope > .wp-block-accordion-panel");
        if (!item || !panel) return;
        const open = !item.classList.contains("is-open");
        item.classList.toggle("is-open", open);
        panel.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        return;
      }
      const a = target?.closest<HTMLAnchorElement>('a[href^="#"]');
      const hash = a?.getAttribute("href") ?? "";
      if (a && hash.length > 1) {
        const dest = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (dest) {
          e.preventDefault();
          dest.scrollIntoView({ behavior: "smooth", block: "start" });
          history.pushState(null, "", hash);
        }
      }
    };
    root.querySelectorAll(".wp-block-accordion-item").forEach((item) => {
      item.querySelector(".wp-block-accordion-heading__toggle")?.setAttribute("aria-expanded", String(item.classList.contains("is-open")));
    });
    root.addEventListener("click", onClick);
    cleanups.push(() => root.removeEventListener("click", onClick));

    return () => cleanups.forEach((f) => f());
  }, []);
  return null;
}
