import type { OrderAddressLines, SavedAddress } from "@/db/schema";
import { provinceName } from "./address-split";

// Saved addresses (WooCommerce's billing_* / shipping_* user meta) and the two
// addresses on an order: address1…postcode on the order are where it is
// delivered; billingAddress holds the billing lines when they differ.

export const EMPTY_ADDRESS: SavedAddress = { firstName: "", lastName: "", company: "", phone: "", address1: "", address2: "", suburb: "", city: "", province: "", postcode: "" };

/** The address posted under a prefix ("billing" or "shipping") by the checkout or the Addresses page. */
export function addressFromFields(get: (k: string) => string, prefix: "billing" | "shipping"): SavedAddress {
  const f = (k: string) => get(`${prefix}_${k}`).trim();
  return {
    firstName: f("first_name"),
    lastName: f("last_name"),
    company: f("company"),
    phone: f("phone"),
    address1: f("address_1"),
    address2: f("address_2"),
    suburb: f("suburb"),
    city: f("city"),
    province: provinceName(f("state")) || f("state"),
    postcode: f("postcode"),
  };
}

const lineKeys = ["address1", "address2", "suburb", "city", "province", "postcode"] as const;

export function addressLines(a: OrderAddressLines): OrderAddressLines {
  return { address1: a.address1, address2: a.address2, suburb: a.suburb, city: a.city, province: a.province, postcode: a.postcode };
}

export function sameLines(a: OrderAddressLines, b: OrderAddressLines) {
  return lineKeys.every((k) => (a[k] ?? "").trim().toLowerCase() === (b[k] ?? "").trim().toLowerCase());
}

export function hasLines(a: Partial<OrderAddressLines> | null | undefined): a is OrderAddressLines {
  return !!a && !!(a.address1 ?? "").trim();
}

type OrderAddresses = OrderAddressLines & {
  billingFirstName: string;
  billingLastName: string;
  billingCompany: string;
  shippingFirstName: string;
  shippingLastName: string;
  shippingCompany: string;
  billingAddress: OrderAddressLines | Record<string, never>;
};

/** Who and where the order is delivered to. */
export function deliveryOf(o: OrderAddresses) {
  const own = !!o.shippingFirstName.trim();
  return {
    firstName: own ? o.shippingFirstName : o.billingFirstName,
    lastName: own ? o.shippingLastName : o.billingLastName,
    company: own ? o.shippingCompany : o.billingCompany,
    ...addressLines(o),
  };
}

/** The billing address lines: the order's own when it was shipped elsewhere, else the delivery address. */
export function billingLinesOf(o: OrderAddresses): OrderAddressLines {
  return hasLines(o.billingAddress) ? addressLines(o.billingAddress) : addressLines(o);
}

/** True when the order went to a different address or person than the billing one. */
export function shipsElsewhere(o: OrderAddresses) {
  return hasLines(o.billingAddress) || !!o.shippingFirstName.trim();
}

/** Name, company and address as lines for display (blank parts left out). */
export function formatAddress(a: { firstName?: string; lastName?: string; company?: string } & OrderAddressLines): string[] {
  return [`${a.firstName ?? ""} ${a.lastName ?? ""}`.trim(), a.company ?? "", a.address1, a.address2, a.suburb, a.city, `${a.province} ${a.postcode}`.trim()]
    .map((s) => s.trim())
    .filter(Boolean);
}
