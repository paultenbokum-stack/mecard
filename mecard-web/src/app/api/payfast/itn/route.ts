import { orderTotalCents, setOrderStatus } from "@/lib/orders";
import { verifyItn } from "@/lib/payfast";

// PayFast Instant Transaction Notification. Public, no login; trust comes from
// the signature check plus PayFast's validate endpoint. WooCommerce's old
// notify URL (/?wc-api=WC_Gateway_PayFast) is rewritten here by the proxy, so
// payments for orders placed just before the switch-over still land.
export async function POST(req: Request) {
  const raw = await req.text();
  const { ok, data, reason } = await verifyItn(raw);
  if (!ok) {
    console.warn(`[payfast] ITN rejected: ${reason}`);
    return new Response("Bad ITN", { status: 400 });
  }
  const orderId = Number(data.m_payment_id);
  const expected = await orderTotalCents(orderId);
  if (expected === null || Math.abs(Math.round(Number(data.amount_gross) * 100) - expected) > 1) {
    console.warn(`[payfast] ITN amount mismatch for order ${orderId}`);
    return new Response("Amount mismatch", { status: 400 });
  }
  // Re-sent ITNs are harmless: setOrderStatus is a no-op when the status is unchanged.
  if (data.payment_status === "COMPLETE") {
    await setOrderStatus(orderId, "processing", { paidAt: new Date(), payfastPaymentId: data.pf_payment_id }, { note: `PayFast payment complete (payment ID ${data.pf_payment_id}).` });
  } else if (data.payment_status === "CANCELLED") {
    await setOrderStatus(orderId, "cancelled", {}, { note: "Payment cancelled at PayFast." });
  }
  return new Response("OK");
}
