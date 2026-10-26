"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { orderNotes, orders } from "@/db/schema";
import { sendOrderToBobgo } from "@/lib/bobgo";
import { ORDER_STATUS_LABEL, PAID_STATUSES, randsToCents } from "@/lib/money";
import { editOrder, type EditResult } from "@/lib/order-edit";
import { parseQty } from "@/lib/order-edit-rules";
import { sendCustomerNoteEmail } from "@/lib/order-emails";
import { setOrderStatus } from "@/lib/orders";
import { markOrderCollected, markOrderDelivered, markOrderShipped, syncOrderTracking } from "@/lib/order-shipping";
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
  const paid = PAID_STATUSES.includes(status) && o && !o.paidAt ? { paidAt: new Date() } : {};
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

// ── Shipping: Processing → Shipped → Completed ──────────────────────────────

export async function markShippedAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  const done = await markOrderShipped(id, { by: me, reference: str(form, "reference"), courier: str(form, "courier") });
  back(`/admin/orders/${id}/`, done ? { saved: "Marked shipped: the customer has been emailed." } : { error: "The order is already shipped." });
}

export async function markDeliveredAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  const done = await markOrderDelivered(id, { by: me, note: "Marked delivered by staff." });
  back(`/admin/orders/${id}/`, done ? { saved: "Marked delivered: the order is completed." } : { error: "The order is already completed." });
}

export async function markCollectedAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  await markOrderCollected(id, { by: me });
  back(`/admin/orders/${id}/`, { saved: "Marked collected: the order is completed." });
}

export async function checkTrackingAction(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("order_id"));
  const result = await syncOrderTracking(id);
  back(`/admin/orders/${id}/`, { saved: `Bob Go tracking: ${result}.` });
}

// ── Editing an order on hold: items, coupon, discount and shipping ──────────

function editOutcome(id: number, res: EditResult): never {
  revalidatePath("/admin/orders/");
  back(`/admin/orders/${id}/`, res.ok ? { saved: res.message } : { error: res.error });
}

export async function updateOrderItemsAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  const qty = new Map<number, number>();
  const remove = Number(form.get("remove"));
  if (remove) qty.set(remove, 0);
  else {
    for (const [k, v] of form.entries()) {
      const m = /^qty_(\d+)$/.exec(k);
      if (!m) continue;
      const n = parseQty(String(v));
      if (Number.isNaN(n)) back(`/admin/orders/${id}/`, { error: "Quantities are whole numbers from 0 to 999." });
      qty.set(Number(m[1]), n);
    }
  }
  editOutcome(id, await editOrder(id, me, { kind: "items", qty }));
}

export async function addOrderItemAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  const qty = parseQty(str(form, "qty"));
  if (!(qty >= 1)) back(`/admin/orders/${id}/`, { error: "Please enter a quantity of 1 or more." });
  editOutcome(id, await editOrder(id, me, { kind: "add", productId: Number(form.get("product_id")), qty }));
}

export async function applyOrderCouponAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  if (form.get("remove_coupon")) editOutcome(id, await editOrder(id, me, { kind: "removeCoupon" }));
  const code = str(form, "coupon");
  if (!code) back(`/admin/orders/${id}/`, { error: "Please enter a coupon code." });
  editOutcome(id, await editOrder(id, me, { kind: "coupon", code }));
}

export async function adjustOrderAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("order_id"));
  const path = `/admin/orders/${id}/`;
  const shippingCents = randsToCents(str(form, "shipping")) ?? 0;
  if (Number.isNaN(shippingCents)) back(path, { error: "Enter the shipping as an amount, such as R99." });
  editOutcome(id, await editOrder(id, me, { kind: "adjust", discount: str(form, "discount"), shippingCents }));
}
