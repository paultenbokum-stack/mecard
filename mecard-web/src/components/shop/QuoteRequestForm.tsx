"use client";

import { useActionState, useState } from "react";
import { requestQuoteAction } from "@/lib/quote-actions";

// [yith_ywraq_request_quote]: what you need and how to reach you.

type Product = { id: number; name: string; price: string };

export function QuoteRequestForm({ products, defaults, quantities }: { products: Product[]; defaults: { name: string; email: string; phone: string }; quantities: Record<number, number> }) {
  const [state, action, pending] = useActionState(requestQuoteAction, null);
  const [started] = useState(() => Date.now());
  return (
    <form action={action} className="acc-form">
      {state?.error ? (
        <p className="acc-panel acc-panel--error" role="alert" style={{ margin: 0 }}>
          {state.error}
        </p>
      ) : null}
      <section className="acc-panel acc-panel--white" style={{ margin: 0 }}>
        <h2>What do you need?</h2>
        <table className="shop-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="shop-num">Price each</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <label htmlFor={`q_${p.id}`} style={{ margin: 0, fontWeight: 400 }}>
                    {p.name}
                  </label>
                </td>
                <td className="shop-num">{p.price}</td>
                <td>
                  <input id={`q_${p.id}`} className="shop-qty" type="number" name={`qty_${p.id}`} min={0} max={5000} defaultValue={quantities[p.id] ?? 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="acc__muted" style={{ marginBottom: 0 }}>
          Delivery is added to the quote as one line. Pro upgrades are per profile: order one for each person on your team.
        </p>
      </section>
      <section className="acc-panel acc-panel--white" style={{ margin: 0 }}>
        <h2>Your details</h2>
        <div className="acc-grid">
          <div className="acc-field">
            <label htmlFor="qr-name">Name *</label>
            <input id="qr-name" name="name" required maxLength={200} defaultValue={defaults.name} autoComplete="name" />
          </div>
          <div className="acc-field">
            <label htmlFor="qr-email">Email *</label>
            <input id="qr-email" name="email" type="email" required maxLength={255} defaultValue={defaults.email} autoComplete="email" />
          </div>
          <div className="acc-field">
            <label htmlFor="qr-phone">Phone</label>
            <input id="qr-phone" name="phone" type="tel" maxLength={50} defaultValue={defaults.phone} autoComplete="tel" />
          </div>
          <div className="acc-field">
            <label htmlFor="qr-company">Company</label>
            <input id="qr-company" name="company" maxLength={255} autoComplete="organization" />
          </div>
        </div>
        <div className="acc-field" style={{ marginTop: 14 }}>
          <label htmlFor="qr-message">Message</label>
          <textarea id="qr-message" name="message" rows={4} maxLength={3000} placeholder="Anything we should know: deadlines, design help, delivery." />
        </div>
        <input type="text" name="website" defaultValue="" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
        <input type="hidden" name="started" value={started} />
        <div className="acc-check" style={{ margin: "14px 0" }}>
          <input type="checkbox" id="qr-terms" name="terms" required />
          <label htmlFor="qr-terms">
            I have read and agree to the website <a href="https://taggable.co.za/terms-of-use/">terms and conditions</a>.
          </label>
        </div>
        <button type="submit" className="acc-btn acc-btn--primary" disabled={pending}>
          {pending ? "Sending…" : "Send your request"}
        </button>
      </section>
    </form>
  );
}
