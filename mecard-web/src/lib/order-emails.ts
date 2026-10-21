import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orderItems, orders } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { invoiceFilename, renderInvoice } from "@/lib/invoice";
import { bankDetailsText } from "@/lib/invoice-settings";
import { ORDER_STATUS_LABEL, PAYMENT_LABEL, rands } from "@/lib/money";

// The WooCommerce emails the live site sends, as plain text:
//   customer: processing, on hold, completed, refunded, customer note
//   shop:     new order (paid), cancelled, failed

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
/** Where shop notifications go (WooCommerce's "new order" recipient). */
const shopInbox = () => process.env.ORDER_NOTIFY_TO || process.env.CONTACT_TO || "";

type Order = typeof orders.$inferSelect;
type Item = typeof orderItems.$inferSelect;

async function load(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { order, items };
}

export function orderSummary(o: Order, items: Item[]): string {
  const lines = items.map((i) => `  ${i.name} × ${i.quantity}   ${rands(i.unitPriceCents * i.quantity)}`);
  const totals = [
    `Subtotal: ${rands(o.subtotalCents)}`,
    ...(o.discountCents > 0 ? [`Discount${o.couponCode ? ` (${o.couponCode})` : ""}: -${rands(o.discountCents)}`] : []),
    ...(o.shippingMethod
      ? [`Shipping: ${o.shippingCents > 0 ? `${rands(o.shippingCents)} via ${o.shippingMethod}` : o.shippingMethod}`]
      : []),
    `Payment method: ${PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod}`,
    `Total: ${rands(o.totalCents)}`,
  ];
  const address = [
    `${o.billingFirstName} ${o.billingLastName}`.trim(),
    o.billingCompany,
    o.address1,
    o.address2,
    o.suburb,
    o.city,
    `${o.province} ${o.postcode}`.trim(),
    o.billingPhone,
    o.billingEmail,
  ].filter(Boolean);
  return [`Order #${o.id}`, "", ...lines, "", ...totals, "", "Billing address:", ...address.map((l) => `  ${l}`)].join("\n");
}

const customerCopy: Partial<Record<string, { subject: (id: number) => string; intro: string }>> = {
  processing: {
    subject: (id) => `Your MeCard order #${id} has been received!`,
    intro: "Thank you for your order. We've received your payment and are now processing it.",
  },
  "on-hold": {
    subject: (id) => `Your MeCard order #${id} is on hold`,
    intro: "Thanks for your order. It's on hold until we confirm that payment has been received.",
  },
  completed: {
    subject: (id) => `Your MeCard order #${id} is now complete`,
    intro: "We have finished processing your order.",
  },
  refunded: {
    subject: (id) => `Your MeCard order #${id} has been refunded`,
    intro: "Your order has been refunded. The refund may take a few days to reflect, depending on your bank.",
  },
};

const shopCopy: Partial<Record<string, (id: number, name: string) => string>> = {
  processing: (id, name) => `[MeCard]: New order #${id} from ${name}`,
  "on-hold": (id, name) => `[MeCard]: New order #${id} from ${name} (awaiting EFT)`,
  cancelled: (id) => `[MeCard]: Order #${id} has been cancelled`,
  failed: (id) => `[MeCard]: Order #${id} has failed`,
};

/** Emails for a status change. Never throws: a failed email must not undo a payment. */
export async function sendOrderStatusEmails(orderId: number, prev: string, next: string) {
  try {
    const data = await load(orderId);
    if (!data) return;
    const { order, items } = data;
    const summary = orderSummary(order, items);
    const name = `${order.billingFirstName} ${order.billingLastName}`.trim() || order.billingEmail;

    const c = customerCopy[next];
    if (c && order.billingEmail) {
      // The invoice goes with "received", as the PDF Invoices plugin was set up.
      // A broken invoice must not stop the email itself.
      // EFT orders on hold: how to pay (WooCommerce's BACS instructions).
      const eftNote =
        next === "on-hold" && order.paymentMethod === "bacs"
          ? `Please pay by EFT, using your order number as the reference. Your order will not be processed until the funds have cleared in our account.\n\n${bankDetailsText(order.id)}\n\n`
          : "";
      const pdf = next === "processing"
        ? await renderInvoice(order.id).catch((e) => (console.error(`[orders] invoice for order ${order.id} failed`, e), null))
        : null;
      await sendEmail({
        to: order.billingEmail,
        subject: c.subject(order.id),
        text: `Hi ${order.billingFirstName || "there"},\n\n${c.intro}\n\n${eftNote}${summary}\n\nView your order: ${appUrl()}/my-account/view-order/${order.id}/\n\nThanks for using MeCard!`,
        ...(pdf ? { attachments: [{ filename: invoiceFilename(order.id), content: Buffer.from(pdf) }] } : {}),
      });
    }
    // Woo only sends "cancelled" to the shop for orders that had been paid or held.
    const s = shopCopy[next];
    const notifyShop = s && (next !== "cancelled" || ["processing", "on-hold"].includes(prev));
    if (notifyShop && shopInbox()) {
      await sendEmail({
        to: shopInbox(),
        subject: s(order.id, name),
        text: `Order #${order.id} is now ${ORDER_STATUS_LABEL[next] ?? next} (was ${ORDER_STATUS_LABEL[prev] ?? prev}).\n\n${summary}\n\nManage it: ${appUrl()}/admin/orders/${order.id}/`,
        replyTo: order.billingEmail || undefined,
      });
    }
  } catch (e) {
    console.error(`[orders] status email for order ${orderId} failed`, e);
  }
}

export async function sendCustomerNoteEmail(orderId: number, note: string) {
  const data = await load(orderId);
  if (!data?.order.billingEmail) return { ok: false as const, error: "This order has no customer email address." };
  const { order, items } = data;
  return sendEmail({
    to: order.billingEmail,
    subject: `A note has been added to your MeCard order #${order.id}`,
    text: `Hi ${order.billingFirstName || "there"},\n\nThe following note has been added to your order:\n\n${note}\n\nAs a reminder, here are your order details:\n\n${orderSummary(order, items)}\n\nView your order: ${appUrl()}/my-account/view-order/${order.id}/`,
  });
}
