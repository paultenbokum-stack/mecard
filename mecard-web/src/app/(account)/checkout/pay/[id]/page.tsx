import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { orderItems, orders } from "@/db/schema";
import { AutoSubmit } from "@/components/shop/AutoSubmit";
import { rands } from "@/lib/money";
import { checkoutFields } from "@/lib/payfast";
import { requireUserId } from "@/lib/session";
import { devMarkPaidAction } from "@/lib/shop-actions";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = { title: { absolute: "Pay for order - MeCard" } };

// Hands the order to PayFast (the WooCommerce PayFast plugin's receipt page).
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const userId = await requireUserId(`/checkout/pay/${id}/`);
  const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
  if (!order) notFound();
  if (order.status !== "pending") redirect(`/checkout/order-received/${id}/`);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const { action, fields } = checkoutFields(
    {
      id: order.id,
      totalCents: order.totalCents,
      firstName: order.billingFirstName,
      lastName: order.billingLastName,
      email: order.billingEmail,
      itemName: `MeCard order #${order.id}: ` + items.map((i) => `${i.name} x ${i.quantity}`).join(", "),
    },
    SITE_URL,
  );
  const isDev = process.env.NODE_ENV === "development";
  return (
    <div className="acc__wrap acc__wrap--narrow">
      <h1>Pay for order</h1>
      <div className="acc-panel acc-panel--white">
        <p>
          Thank you for your order (#{order.id}, {rands(order.totalCents)}). {isDev ? "Click below to pay with PayFast." : "Taking you to PayFast to pay…"}
        </p>
        <form id="payfast-form" action={action} method="post">
          {fields.map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <button type="submit" className="acc-btn acc-btn--primary">
            Pay via PayFast
          </button>
        </form>
      </div>
      {!isDev ? <AutoSubmit formId="payfast-form" /> : null}
      {isDev ? (
        <form action={devMarkPaidAction} className="shop-dev">
          <input type="hidden" name="order_id" value={order.id} />
          <p style={{ marginTop: 0 }}>
            Local testing: PayFast can&apos;t send its payment notification to localhost, so a sandbox payment won&apos;t mark this order paid. Use this to
            simulate a successful payment instead.
          </p>
          <button type="submit" className="acc-btn acc-btn--small">
            Simulate successful payment
          </button>
        </form>
      ) : null}
    </div>
  );
}
