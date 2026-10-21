"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { orderNotes, orders } from "@/db/schema";
import { sendOrderToBobgo } from "@/lib/bobgo";
import { ORDER_STATUS_LABEL } from "@/lib/money";
import { sendCustomerNoteEmail } from "@/lib/order-emails";
import { setOrderStatus } from "@/lib/orders";
import { requireAdmin } from "@/lib/session";

// Staff actions on orders (WooCommerce's order screen). Every action checks
// the admin again: server actions can be called directly.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Back to an admin page with the outcome in the URL (shown by <Flash>). */
function back(path: string, outcome: { saved?: string; error?: string }): never {
  redirect(`${path}?${new URLSearchParams(outcome as Record<string, string>)}`);
}

export async function setOrderStatusAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  const status = str(form, "status");
  const path = `/admin/orders/${id}/`;
  if (!(status in ORDER_STATUS_LABEL)) back(path, { error: "Unknown status." });
  // Marking an EFT order paid by hand records the payment date, as WooCommerce does.
  const [o] = await db.select({ paidAt: orders.paidAt }).from(orders).where(eq(orders.id, id));
  const paid = (status === "processing" || status === "completed") && o && !o.paidAt ? { paidAt: new Date() } : {};
  const changed = await setOrderStatus(id, status, paid, { by: me });
  revalidatePath("/admin/orders/");
  const label = ORDER_STATUS_LABEL[status];
  back(path, changed ? { saved: `Status changed to ${label}.` } : { saved: `The order is already ${label}.` });
}

export async function addOrderNoteAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  const path = `/admin/orders/${id}/`;
  const body = str(form, "note");
  const customerNote = form.get("note_type") === "customer";
  if (!body) back(path, { error: "Please write a note." });
  if (customerNote) {
    const sent = await sendCustomerNoteEmail(id, body);
    if (!sent.ok) back(path, { error: `The note wasn't added because the email failed: ${sent.error}` });
  }
  await db.insert(orderNotes).values({ orderId: id, body, customerNote, authorId: me });
  back(path, { saved: customerNote ? "Note added and emailed to the customer." : "Private note added." });
}

export async function deleteOrderNoteAction(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("order_id"));
  await db.delete(orderNotes).where(and(eq(orderNotes.id, Number(form.get("note_id"))), eq(orderNotes.orderId, id)));
  back(`/admin/orders/${id}/`, { saved: "Note deleted." });
}

const ADDRESS_FIELDS = {
  billing_first_name: "billingFirstName",
  billing_last_name: "billingLastName",
  billing_company: "billingCompany",
  billing_email: "billingEmail",
  billing_phone: "billingPhone",
  address_1: "address1",
  address_2: "address2",
  suburb: "suburb",
  city: "city",
  province: "province",
  postcode: "postcode",
} as const;

export async function updateOrderAddressAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  const path = `/admin/orders/${id}/`;
  const values = Object.fromEntries(Object.entries(ADDRESS_FIELDS).map(([field, col]) => [col, str(form, field)])) as Record<
    (typeof ADDRESS_FIELDS)[keyof typeof ADDRESS_FIELDS],
    string
  >;
  if (values.billingEmail && !EMAIL_RE.test(values.billingEmail)) back(path, { error: "Please enter a valid email address." });
  await db.update(orders).set(values).where(eq(orders.id, id));
  await db.insert(orderNotes).values({ orderId: id, body: "Billing details edited.", authorId: me });
  back(path, { saved: "Billing details saved." });
}

/** Send (or re-send) a paid order to Bob Go. */
export async function sendToBobgoAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  const res = await sendOrderToBobgo(id, { by: me, force: form.get("force") === "1" });
  back(
    `/admin/orders/${id}/`,
    res.ok ? { saved: res.updated ? `Updated in Bob Go (Bob Go order ${res.id}).` : `Sent to Bob Go (Bob Go order ${res.id}).` } : { error: res.error },
  );
}
