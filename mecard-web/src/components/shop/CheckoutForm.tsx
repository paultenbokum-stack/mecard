"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { placeOrderAction } from "@/lib/shop-actions";

// WooCommerce's checkout: billing details, delivery options (live Bob Go
// rates once the address is complete) and PayFast or direct bank transfer.

const PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"];
const ADDRESS_FIELDS = ["billing_company", "billing_address_1", "billing_address_2", "billing_suburb", "billing_city", "billing_state", "billing_postcode"];

type Method = { id: string; label: string; price: string; note?: string };
type Defaults = { firstName: string; lastName: string; email: string; phone: string };

export function CheckoutForm({
  defaults,
  methods,
  summary,
  liveRates,
  ships,
}: {
  defaults: Defaults;
  methods: Method[];
  summary: React.ReactNode;
  liveRates: boolean;
  /** False when the basket holds only Pro upgrades: no address needed. */
  ships: boolean;
}) {
  const [state, action, pending] = useActionState(placeOrderAction, null);
  const [options, setOptions] = useState<Method[]>(methods);
  const [chosen, setChosen] = useState(methods[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [quoted, setQuoted] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const last = useRef("");
  const picked = useRef(false);
  const requestNo = useRef(0);

  // Re-quote when the address changes (debounced), like WooCommerce's update_checkout.
  const requote = (force = false) => {
    if (!liveRates || !ships || !form.current) return;
    const data = new FormData(form.current);
    const address = Object.fromEntries(ADDRESS_FIELDS.map((k) => [k, String(data.get(k) ?? "").trim()]));
    const complete = ["billing_address_1", "billing_suburb", "billing_city", "billing_state", "billing_postcode"].every((k) => address[k]);
    const key = JSON.stringify(address);
    if (!complete || (key === last.current && !force)) return;
    last.current = key;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const mine = ++requestNo.current;
      setLoading(true);
      try {
        const res = await fetch("/api/checkout/shipping/", { method: "POST", headers: { "Content-Type": "application/json" }, body: key });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = ((await res.json()) as { options: Method[] }).options;
        if (mine !== requestNo.current) return;
        setOptions(next);
        setQuoted(true);
        setChosen((c) => (picked.current && next.some((o) => o.id === c) ? c : ((next.find((o) => o.id.startsWith("bobgo:")) ?? next[0])?.id ?? "")));
      } catch {
        last.current = "";
      } finally {
        if (mine === requestNo.current) setLoading(false);
      }
    }, 500);
  };
  useEffect(() => {
    const t = setTimeout(() => requote(), 300);
    return () => {
      clearTimeout(t);
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const field = (name: string, label: string, opts: { required?: boolean; type?: string; defaultValue?: string; autoComplete?: string } = {}) => (
    <div className="acc-field">
      <label htmlFor={name}>
        {label} {opts.required === false ? <span className="acc__muted">(optional)</span> : <abbr title="required">*</abbr>}
      </label>
      <input id={name} name={name} type={opts.type ?? "text"} defaultValue={opts.defaultValue} required={opts.required !== false} autoComplete={opts.autoComplete} />
    </div>
  );

  return (
    <form ref={form} action={action} className="shop-checkout" onChange={() => requote()} onBlur={() => requote()}>
      <section className="acc-panel acc-panel--white">
        {state?.error ? (
          <p className="acc-panel acc-panel--error" role="alert" style={{ marginTop: 0 }}>
            {state.error}
          </p>
        ) : null}
        <h2>Billing details</h2>
        <div className="acc-form">
          <div className="acc-grid">
            {field("billing_first_name", "First name", { defaultValue: defaults.firstName, autoComplete: "given-name" })}
            {field("billing_last_name", "Last name", { defaultValue: defaults.lastName, autoComplete: "family-name" })}
          </div>
          {field("billing_company", "Company name", { required: false, autoComplete: "organization" })}
          {ships ? (
            <>
              <div className="acc-field">
                <span className="acc-field__label">Country / Region</span>
                <strong>South Africa</strong>
              </div>
              {field("billing_address_1", "Street address", { autoComplete: "address-line1" })}
              {field("billing_address_2", "Apartment, suite, unit, etc.", { required: false, autoComplete: "address-line2" })}
              <div className="acc-grid">
                {field("billing_suburb", "Suburb", { autoComplete: "address-level3" })}
                {field("billing_city", "Town / City", { autoComplete: "address-level2" })}
              </div>
              <div className="acc-grid">
                <div className="acc-field">
                  <label htmlFor="billing_state">
                    Province <abbr title="required">*</abbr>
                  </label>
                  <select id="billing_state" name="billing_state" required defaultValue="">
                    <option value="" disabled>
                      Select an option…
                    </option>
                    {PROVINCES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                {field("billing_postcode", "Postcode / ZIP", { autoComplete: "postal-code" })}
              </div>
            </>
          ) : null}
          <div className="acc-grid">
            {field("billing_phone", "Phone", { type: "tel", defaultValue: defaults.phone, autoComplete: "tel" })}
            {field("billing_email", "Email address", { type: "email", defaultValue: defaults.email, autoComplete: "email" })}
          </div>
          <div className="acc-field">
            <label htmlFor="order_comments">
              Order notes <span className="acc__muted">(optional)</span>
            </label>
            <textarea id="order_comments" name="order_comments" rows={3} placeholder="Notes about your order, e.g. special notes for delivery." />
          </div>
        </div>
      </section>

      <section className="acc-panel acc-panel--white">
        <h2>Your order</h2>
        {summary}
        <h3 style={{ marginTop: 16 }}>Delivery</h3>
        <div aria-live="polite">
          {options.map((m) => (
            <label className="shop-choice" key={m.id}>
              <input
                type="radio"
                name="shipping_method"
                value={m.id}
                checked={chosen === m.id}
                onChange={() => {
                  picked.current = true;
                  setChosen(m.id);
                }}
                required
              />
              <span>
                {m.label}: {m.price}
                {m.note ? <small>{m.note}</small> : null}
              </span>
            </label>
          ))}
          {liveRates && ships && loading ? <p className="acc__muted">Getting delivery options…</p> : null}
          {liveRates && ships && !loading && !options.some((o) => o.id.startsWith("bobgo:")) ? (
            <p className="acc__muted">
              {quoted ? "No courier delivery is available to this address. Check the suburb and postcode, or choose pickup." : "Enter your street address, suburb, town, province and postcode to see courier options."}
            </p>
          ) : null}
          {liveRates && ships && quoted && !loading ? (
            <button type="button" className="acc-link" onClick={() => requote(true)}>
              Update delivery options
            </button>
          ) : null}
        </div>

        <h3 style={{ marginTop: 16 }}>Payment</h3>
        <label className="shop-choice">
          <input type="radio" name="payment_method" value="payfast" defaultChecked />
          <span>
            PayFast
            <small>Pay by card, instant EFT and more. You will be taken to PayFast to complete your payment.</small>
          </span>
        </label>
        <label className="shop-choice">
          <input type="radio" name="payment_method" value="bacs" />
          <span>
            Direct bank transfer
            <small>Make your payment directly into our bank account. Please use your Order ID as the payment reference. Your order will not be shipped until the funds have cleared in our account.</small>
          </span>
        </label>

        <div className="acc-check" style={{ margin: "14px 0" }}>
          <input type="checkbox" id="terms" name="terms" required />
          <label htmlFor="terms">
            I have read and agree to the website <a href="https://taggable.co.za/terms-of-use/">terms and conditions</a> <abbr title="required">*</abbr>
          </label>
        </div>
        <button type="submit" className="acc-btn acc-btn--cta acc-btn--block" disabled={pending}>
          {pending ? "Placing order…" : "Place order"}
        </button>
        <p className="acc__muted" style={{ marginTop: 10 }}>
          <Link href="/basket/">Back to basket</Link>
        </p>
      </section>
    </form>
  );
}
