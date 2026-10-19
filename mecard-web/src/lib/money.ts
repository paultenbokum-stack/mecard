/** R1,234.50 — WooCommerce's ZAR format. */
export function rands(cents: number): string {
  const [whole, frac] = (Math.abs(cents) / 100).toFixed(2).split(".");
  return (cents < 0 ? "-" : "") + "R" + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + frac;
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending payment",
  "on-hold": "On hold",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

export function formatDate(d: Date, withTime = false): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" };
  if (withTime) Object.assign(opts, { hour: "numeric", minute: "2-digit" });
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

export const PAYMENT_LABEL: Record<string, string> = {
  payfast: "Payfast",
  bacs: "Direct bank transfer",
};
