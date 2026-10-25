"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveAddressAction } from "@/app/(account)/my-account/actions";
import type { SavedAddress } from "@/db/schema";
import { PROVINCES } from "@/lib/address-split";

// My Account → Addresses → Edit: WooCommerce's billing or shipping address form.

export function AddressForm({ kind, address }: { kind: "billing" | "shipping"; address: SavedAddress }) {
  const [state, action, pending] = useActionState(saveAddressAction, null);
  const field = (k: string, label: string, value: string, opts: { required?: boolean; type?: string; autoComplete: string }) => (
    <div className="acc-field">
      <label htmlFor={`${kind}_${k}`}>
        {label} {opts.required === false ? <span className="acc__muted">(optional)</span> : <abbr title="required">*</abbr>}
      </label>
      <input id={`${kind}_${k}`} name={`${kind}_${k}`} type={opts.type ?? "text"} defaultValue={value} required={opts.required !== false} autoComplete={`${kind} ${opts.autoComplete}`} />
    </div>
  );
  return (
    <form action={action} className="acc-form">
      <input type="hidden" name="kind" value={kind} />
      {state?.error ? (
        <p className="acc-panel acc-panel--error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="acc-grid">
        {field("first_name", "First name", address.firstName, { autoComplete: "given-name" })}
        {field("last_name", "Last name", address.lastName, { autoComplete: "family-name" })}
      </div>
      {field("company", "Company name", address.company, { required: false, autoComplete: "organization" })}
      <div className="acc-field">
        <span className="acc-field__label">Country / Region</span>
        <strong>South Africa</strong>
      </div>
      {field("address_1", "Street address", address.address1, { autoComplete: "address-line1" })}
      {field("address_2", "Apartment, suite, unit, etc.", address.address2, { required: false, autoComplete: "address-line2" })}
      <div className="acc-grid">
        {field("suburb", "Suburb", address.suburb, { autoComplete: "address-level3" })}
        {field("city", "Town / City", address.city, { autoComplete: "address-level2" })}
      </div>
      <div className="acc-grid">
        <div className="acc-field">
          <label htmlFor={`${kind}_state`}>
            Province <abbr title="required">*</abbr>
          </label>
          <select id={`${kind}_state`} name={`${kind}_state`} required defaultValue={PROVINCES.includes(address.province) ? address.province : ""}>
            <option value="" disabled>
              Select an option…
            </option>
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        {field("postcode", "Postcode / ZIP", address.postcode, { autoComplete: "postal-code" })}
      </div>
      {kind === "billing" ? field("phone", "Phone", address.phone, { type: "tel", autoComplete: "tel" }) : null}
      <div className="acc-actions">
        <button type="submit" className="acc-btn acc-btn--primary" disabled={pending}>
          {pending ? "Saving…" : "Save address"}
        </button>
        <Link href="/my-account/edit-address/">Cancel</Link>
      </div>
    </form>
  );
}
