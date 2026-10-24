"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { miniCartRemoveAction } from "@/lib/shop-actions";
import { rands } from "@/lib/money";
import type { MiniCart as MiniCartData } from "@/lib/mini-cart";

// The header's basket: a cart icon with the item count that opens WooCommerce's
// mini basket in a panel (slides in on desktop, full width on phones). The
// basket itself stays on the server (/api/cart/ and the remove action).

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MiniCart() {
  const [cart, setCart] = useState<MiniCartData | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    void fetch("/api/cart/", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: MiniCartData | null) => c && setCart(c))
      .catch(() => undefined);
  }, []);

  // Fresh on every page (adding to the basket lands on a new page) and when opened.
  useEffect(load, [load, pathname]);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    panel.current?.querySelector<HTMLElement>(".mc-minicart__close")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab" || !panel.current) return;
      // Keep focus inside the panel while it is open.
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
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
    };
  }, [open, load, close]);

  const remove = (key: string) =>
    startTransition(async () => {
      setCart(await miniCartRemoveAction(key));
      router.refresh(); // the basket or checkout page behind the panel
      panel.current?.querySelector<HTMLElement>(".mc-minicart__close")?.focus();
    });

  const count = cart?.count ?? 0;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="mc-minicart__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Basket, ${count} ${count === 1 ? "item" : "items"}`}
        onClick={() => setOpen(true)}
      >
        <i className="fa-solid fa-cart-shopping" aria-hidden="true" />
        {count ? (
          <span className="mc-minicart__count" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="mc-minicart">
          <div className="mc-minicart__backdrop" onClick={close} aria-hidden="true" />
          <div ref={panel} className="mc-minicart__panel" role="dialog" aria-modal="true" aria-labelledby="mc-minicart-title" aria-busy={pending}>
            <div className="mc-minicart__head">
              <h2 id="mc-minicart-title">Basket</h2>
              <button type="button" className="mc-minicart__close" aria-label="Close basket" onClick={close}>
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
            {!cart ? (
              <p className="mc-minicart__empty">Loading…</p>
            ) : !cart.lines.length ? (
              <div className="mc-minicart__empty">
                <p>No products in the basket.</p>
                <Link className="mc-minicart__btn mc-minicart__btn--primary" href="/shop/" onClick={() => setOpen(false)}>
                  Shop
                </Link>
              </div>
            ) : (
              <>
                <ul className="mc-minicart__lines">
                  {cart.lines.map((l) => (
                    <li key={l.key} className="mc-minicart__line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.image ? <img className="mc-minicart__thumb" src={l.image} alt="" width={64} height={64} /> : <span className="mc-minicart__thumb" />}
                      <div className="mc-minicart__info">
                        <Link className="mc-minicart__name" href={l.url} onClick={() => setOpen(false)}>
                          {l.name}
                        </Link>
                        {l.forName ? <span className="mc-minicart__for">For {l.forName}</span> : null}
                        <span className="mc-minicart__qty">
                          {l.qty} × {rands(l.priceCents)}
                        </span>
                      </div>
                      <span className="mc-minicart__total">{rands(l.lineCents)}</span>
                      <button type="button" className="mc-minicart__remove" aria-label={`Remove ${l.name} from basket`} disabled={pending} onClick={() => remove(l.key)}>
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mc-minicart__foot">
                  <p className="mc-minicart__subtotal">
                    <span>Subtotal</span>
                    <strong>{rands(cart.subtotalCents)}</strong>
                  </p>
                  <p className="mc-minicart__note">Shipping and coupons are worked out at checkout.</p>
                  <div className="mc-minicart__actions">
                    <Link className="mc-minicart__btn" href="/basket/" onClick={() => setOpen(false)}>
                      View basket
                    </Link>
                    <Link className="mc-minicart__btn mc-minicart__btn--primary" href="/checkout/" onClick={() => setOpen(false)}>
                      Checkout
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
