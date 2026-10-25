// A company's address is one free-text line ("1D Study Road, Glenhazel,
// Johannesburg, 2192"); checkout wants it in WooCommerce's billing fields.
// Best effort: the customer sees the result and fixes what doesn't fit.

export const PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"];

export type SplitAddress = { address1: string; address2: string; suburb: string; city: string; state: string; postcode: string };

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const PROVINCE_BY_KEY = new Map<string, string>([...PROVINCES.map((p) => [squash(p), p] as [string, string]), ["kzn", "KwaZulu-Natal"], ["natal", "KwaZulu-Natal"], ["ec", "Eastern Cape"], ["wc", "Western Cape"], ["gp", "Gauteng"]]);

export function splitAddress(text: string): SplitAddress {
  const out: SplitAddress = { address1: "", address2: "", suburb: "", city: "", state: "", postcode: "" };
  let parts = text
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter((p) => p && !/^(south africa|rsa|za)$/i.test(p));
  parts = parts.flatMap((p) => {
    // "Cape Town 8001" or a postcode on its own.
    const m = /^(.*?)\s*\b(\d{4})$/.exec(p);
    if (m && !out.postcode && (!m[1] || !/^\d/.test(p))) {
      out.postcode = m[2];
      return m[1] ? [m[1]] : [];
    }
    const province = PROVINCE_BY_KEY.get(squash(p));
    if (province && !out.state) {
      out.state = province;
      return [];
    }
    return [p];
  });
  if (!parts.length) return out;
  // The street is the last part that starts with a number; unit and building names come before it.
  let street = -1;
  parts.forEach((p, i) => {
    if (/^\d/.test(p)) street = i;
  });
  if (street < 0) {
    out.address1 = parts.length > 1 ? parts.slice(0, -1).join(", ") : parts[0];
    out.city = parts.length > 1 ? parts[parts.length - 1] : "";
    return out;
  }
  out.address1 = parts[street];
  out.address2 = parts.slice(0, street).join(", ");
  const rest = parts.slice(street + 1);
  if (rest.length === 1) out.city = rest[0];
  else if (rest.length > 1) {
    out.city = rest[rest.length - 1];
    out.suburb = rest.slice(0, -1).join(", ");
  }
  return out;
}
