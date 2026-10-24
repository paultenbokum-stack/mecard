import { createHash } from "node:crypto";

// PayFast redirect + ITN, called directly (replaces the WooCommerce PayFast
// gateway plugin). Docs: https://developers.payfast.co.za/docs#step_1_form_fields

export const payfastConfig = () => ({
  merchantId: process.env.PAYFAST_MERCHANT_ID ?? "",
  merchantKey: process.env.PAYFAST_MERCHANT_KEY ?? "",
  passphrase: process.env.PAYFAST_PASSPHRASE ?? "",
  sandbox: !!process.env.PAYFAST_SANDBOX,
});

export const processUrl = (sandbox: boolean) =>
  sandbox ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process";
const validateUrl = (sandbox: boolean) =>
  sandbox ? "https://sandbox.payfast.co.za/eng/query/validate" : "https://www.payfast.co.za/eng/query/validate";

/** PHP urlencode(): spaces → "+", everything but [A-Za-z0-9_.-] percent-encoded (uppercase). */
export function phpUrlencode(s: string): string {
  return encodeURIComponent(s)
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
}

/** key=value&… of the non-empty fields, in the given order (PayFast is order-sensitive). */
export function paramString(fields: [string, string][]): string {
  return fields
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${phpUrlencode(v.trim())}`)
    .join("&");
}

export function signature(fields: [string, string][], passphrase: string): string {
  let s = paramString(fields);
  if (passphrase) s += `&passphrase=${phpUrlencode(passphrase.trim())}`;
  return createHash("md5").update(s).digest("hex");
}

export type CheckoutOrder = {
  id: number;
  totalCents: number;
  firstName: string;
  lastName: string;
  email: string;
  itemName: string;
};

/** Hidden form fields for the redirect to PayFast, signature last. */
export function checkoutFields(order: CheckoutOrder, appUrl: string): { action: string; fields: [string, string][] } {
  const cfg = payfastConfig();
  const fields: [string, string][] = [
    ["merchant_id", cfg.merchantId],
    ["merchant_key", cfg.merchantKey],
    ["return_url", `${appUrl}/checkout/order-received/${order.id}/`],
    ["cancel_url", `${appUrl}/basket/?cancelled=${order.id}`],
    ["notify_url", `${appUrl}/api/payfast/itn/`],
    ["name_first", order.firstName],
    ["name_last", order.lastName],
    ["email_address", order.email],
    ["m_payment_id", String(order.id)],
    ["amount", (order.totalCents / 100).toFixed(2)],
    ["item_name", order.itemName.slice(0, 100)],
  ];
  return { action: processUrl(cfg.sandbox), fields: [...fields, ["signature", signature(fields, cfg.passphrase)]] };
}

/** Checks an ITN body: signature, then PayFast's own validate endpoint. */
export async function verifyItn(rawBody: string): Promise<{ ok: boolean; data: Record<string, string>; reason?: string }> {
  const cfg = payfastConfig();
  const pairs = [...new URLSearchParams(rawBody).entries()];
  const data = Object.fromEntries(pairs);
  const fields = pairs.filter(([k]) => k !== "signature");
  // The ITN signature covers every posted field, empty ones included.
  let s = fields.map(([k, v]) => `${k}=${phpUrlencode(v.trim())}`).join("&");
  if (cfg.passphrase) s += `&passphrase=${phpUrlencode(cfg.passphrase.trim())}`;
  if (createHash("md5").update(s).digest("hex") !== data.signature) return { ok: false, data, reason: "bad signature" };
  if (data.merchant_id !== cfg.merchantId) return { ok: false, data, reason: "wrong merchant" };

  const res = await fetch(validateUrl(cfg.sandbox), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: fields.map(([k, v]) => `${k}=${phpUrlencode(v)}`).join("&"),
  }).catch(() => null);
  const text = res ? (await res.text()).trim() : "";
  if (text !== "VALID") return { ok: false, data, reason: `validate said ${text || "nothing"}` };
  return { ok: true, data };
}
