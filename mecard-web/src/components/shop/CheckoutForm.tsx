"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { SavedAddress } from "@/db/schema";
import { PROVINCES, splitAddress } from "@/lib/address-split";
import { placeOrderAction } from "@/lib/shop-actions";

// WooCommerce's checkout: billing details (filled from the saved address),
// "Ship to a different address?", delivery options (live Bob Go rates for the
// delivery address once it is complete) and PayFast or direct bank transfer.

const ADDRESS_FIELDS = ["company", "address_1", "address_2", "suburb", "city", "state", "postcode"];
const ADDRESS_REQUIRED = ["address_1", "suburb", "city", "state", "postcode"];

type Method = { id: string; label: string; price: string; note?: string };
type Defaults = { email: string; billing: SavedAddress; shipping: SavedAddress | null; shipElsewhere: boolean };
type ProfileCompany = { name: string; address: string };

export function CheckoutForm({
  defaults,
  methods,
  summary,
  liveRates,
  ships,
  profileCompanies,
}: {
  defaults: Defaults;
  methods: Method[];
  summary: React.ReactNode;
  liveRates: boolean;
  /** False when the basket holds only Pro upgrades: no address needed. */
  ships: boolean;
  /** The company on the user's own profiles, offered while Company name is blank. */
  profileCompanies: ProfileCompany[];
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
  const [companyBlank, setCompanyBlank] = useState(!defaults.billing.company);
  const [shipElsewhere, setShipElsewhere] = useState(ships && defaults.shipElsewhere);

  // Re-quote when the delivery address changes (debounced), like WooCommerce's update_checkout.
  // The rates endpoint reads billing_* keys, so the shipping fields are sent under those names.
  const requote = (force = false) => {
    if (!liveRates || !ships || !form.current) return;
    const data = new FormData(form.current);
    const from = data.get("ship_to_different_address") ? "shipping" : "billing";
    const address = Object.fromEntries(ADDRESS_FIELDS.map((k) => [`billing_${k}`, String(data.get(`${from}_${k}`) ?? "").trim()]));
    const complete = ADDRESS_REQUIRED.every((k) => address[`billing_${k}`]);
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

  // Street, suburb, city, province and postcode under a prefix; autocomplete sections keep the browser's two addresses apart.
  const addressFields = (prefix: "billing" | "shipping", a: SavedAddress | null) => {
    const ac = (token: string) => `${prefix} ${token}`;
    return (
      <>
        <div className="acc-field">
          <span className="acc-field__label">Country / Region</span>
          <strong>South Africa</strong>
        </div>
        {field(`${prefix}_address_1`, "Street address", { autoComplete: ac("address-line1"), defaultValue: a?.address1 })}
        {field(`${prefix}_address_2`, "Apartment, suite, unit, etc.", { required: false, autoComplete: ac("address-line2"), defaultValue: a?.address2 })}
        <div className="acc-grid">
          {field(`${prefix}_suburb`, "Suburb", { autoComplete: ac("address-level3"), defaultValue: a?.suburb })}
          {field(`${prefix}_city`, "Town / City", { autoComplete: ac("address-level2"), defaultValue: a?.city })}
        </div>
        <div className="acc-grid">
          <div className="acc-field">
            <label htmlFor={`${prefix}_state`}>
              Province <abbr title="required">*</abbr>
            </label>
            <select id={`${prefix}_state`} name={`${prefix}_state`} required defaultValue={PROVINCES.includes(a?.province ?? "") ? a!.province : ""}>
              <option value="" disabled>
                Select an option…
              </option>
              {PROVINCES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          {field(`${prefix}_postcode`, "Postcode / ZIP", { autoComplete: ac("postal-code"), defaultValue: a?.postcode })}
        </div>
      </>
    );
  };
  const b = defaults.billing;
  const s = defaults.shipping;

  // Company name from the profile; its address goes into the address fields that are still empty.
  const copyCompany = (c: ProfileCompany) => {
    const el = form.current?.elements;
    if (!el) return;
    const put = (name: string, value: string, always = false) => {
      const input = el.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      if (input && value && (always || !input.value.trim())) input.value = value;
    };
    put("billing_company", c.name, true);
    setCompanyBlank(false);
    if (ships && c.address) {
      const a = splitAddress(c.address);
      put("billing_address_1", a.address1);
      put("billing_address_2", a.address2);
      put("billing_suburb", a.suburb);
      put("billing_city", a.city);
      put("billing_state", a.state);
      put("billing_postcode", a.postcode);
      requote();
    }
  };

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
            {field("billing_first_name", "First name", { defaultValue: b.firstName, autoComplete: "billing given-name" })}
            {field("billing_last_name", "Last name", { defaultValue: b.lastName, autoComplete: "billing family-name" })}
          </div>
          <div className="acc-field">
            <label htmlFor="billing_company">
              Company name <span className="acc__muted">(optional)</span>
            </label>
            <input id="billing_company" name="billing_company" type="text" autoComplete="billing organization" defaultValue={b.company} onChange={(e) => setCompanyBlank(!e.target.value.trim())} />
            {companyBlank && profileCompanies.length ? (
              <span className="acc-field__hint">
                {profileCompanies.map((c, i) => (
                  <span key={c.name}>
                    {i ? " · " : null}
                    <button type="button" className="acc-link" onClick={() => copyCompany(c)}>
                      Copy “{c.name}” from my profile
                    </button>
                  </span>
                ))}
              </span>
            ) : null}
          </div>
          {ships ? addressFields("billing", b) : null}
          <div className="acc-grid">
            {field("billing_phone", "Phone", { type: "tel", defaultValue: b.phone, autoComplete: "billing tel" })}
            {field("billing_email", "Email address", { type: "email", defaultValue: defaults.email, autoComplete: "billing email" })}
          </div>
          {ships ? (
            <>
              <div className="acc-check" style={{ margin: "6px 0" }}>
                <input
                  type="checkbox"
                  id="ship_to_different_address"
                  name="ship_to_different_address"
                  value="1"
                  checked={shipElsewhere}
                  onChange={(e) => {
                    setShipElsewhere(e.target.checked);
                    // The fields appear or go after this render; quote for whichever address now applies.
                    setTimeout(() => requote(true), 0);
                  }}
                />
                <label htmlFor="ship_to_different_address">
                  <strong>Ship to a different address?</strong>
                </label>
              </div>
              {shipElsewhere ? (
                <fieldset className="acc-fieldset">
                  <legend className="acc-field__label">Shipping address</legend>
                  <div className="acc-grid">
                    {field("shipping_first_name", "First name", { defaultValue: s?.firstName, autoComplete: "shipping given-name" })}
                    {field("shipping_last_name", "Last name", { defaultValue: s?.lastName, autoComplete: "shipping family-name" })}
                  </div>
                  {field("shipping_company", "Company name", { required: false, defaultValue: s?.company, autoComplete: "shipping organization" })}
                  {addressFields("shipping", s)}
                </fieldset>
              ) : null}
            </>
          ) : null}
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
