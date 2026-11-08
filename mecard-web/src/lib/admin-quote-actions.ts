"use server";

import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { companies, orders, products, quotes, users, type QuoteLine } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { cleanEmail } from "@/lib/form-values";
import { randsToCents } from "@/lib/money";
import { ADDITIONAL_SHIPPING_PRODUCT, QUOTE_STATUS_LABEL, QUOTE_VALID_DAYS, quotePrefill, quoteTotals } from "@/lib/quote-rules";
import { quoteById, sendQuoteEmails } from "@/lib/quotes";
import { requireAdmin, requireQuoteStaff } from "@/lib/session";

// Staff editing of quotes (YITH's quote screen in WooCommerce): lines and
// prices, a discount, a note to the customer, expiry and status; then send.
// A salesperson uses the same screens, for their own quotes only.

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function back(path: string, outcome: { saved?: string; error?: string }): never {
  redirect(`${path}?${new URLSearchParams(outcome as Record<string, string>)}`);
}

/** Who is working on quotes, and whether they're kept to their own. */
async function quoteDesk() {
  const who = await requireQuoteStaff("/admin/quotes/");
  return { ...who, base: "/admin/quotes/", ownOnly: !who.isAdmin };
}

/** The quote's lines from the form: product_id[], qty[], price[] (Rands); quantity 0 removes a line. */
async function linesFromForm(form: FormData): Promise<QuoteLine[] | string> {
  const ids = form.getAll("product_id").map(Number);
  const qtys = form.getAll("qty").map((v) => Number(v || 0));
  const prices = form.getAll("price").map((v) => String(v));
  const known = ids.filter((id) => id > 0);
  const rows = known.length ? await db.select({ id: products.id, name: products.name, priceCents: products.priceCents }).from(products).where(inArray(products.id, known)) : [];
  const byId = new Map(rows.map((p) => [p.id, p]));
  const lines: QuoteLine[] = [];
  for (let i = 0; i < ids.length; i++) {
    if (!ids[i] || !qtys[i]) continue;
    const p = byId.get(ids[i]);
    if (!p) return "Unknown product.";
    if (!Number.isInteger(qtys[i]) || qtys[i] < 0 || qtys[i] > 5000) return "Quantities must be whole numbers up to 5000.";
    const price = prices[i]?.trim() ? randsToCents(prices[i]) : p.priceCents;
    if (price === null || Number.isNaN(price)) return `Please enter a valid price for ${p.name}.`;
    lines.push({ productId: p.id, name: p.name, qty: qtys[i], unitPriceCents: price, ...(p.id === ADDITIONAL_SHIPPING_PRODUCT ? {} : { regularPriceCents: p.priceCents }) });
  }
  return lines;
}

export async function saveQuoteAction(form: FormData) {
  const desk = await quoteDesk();
  const id = Number(form.get("quote_id"));
  const path = `${desk.base}${id}/`;
  const q = await quoteById(id);
  if (!q || (desk.ownOnly && q.salesUserId !== desk.id)) back(desk.base, { error: "Quote not found." });
  const send = form.get("intent") === "send";

  const status = str(form, "status");
  if (!(status in QUOTE_STATUS_LABEL)) back(path, { error: "Unknown status." });
  const email = cleanEmail(form.get("email"));
  if (!email) back(path, { error: "Please enter the customer's email address." });
  const expires = str(form, "expires");
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) back(path, { error: "Please enter a valid expiry date." });
  const discount = randsToCents(str(form, "discount")) ?? 0;
  if (Number.isNaN(discount)) back(path, { error: "Please enter a valid discount." });

  // Accepted quotes are in the customer's basket at these prices: only the note and details can change.
  const locked = q.status === "accepted";
  const lines = locked ? q.items : await linesFromForm(form);
  if (typeof lines === "string") back(path, { error: lines });
  if (send && !lines.length) back(path, { error: "Add at least one line before sending." });
  const totals = quoteTotals(lines, locked ? q.discountCents : discount);

  // Sending starts the 10 days again unless staff chose a later date.
  const typed = expires ? new Date(`${expires}T23:59:59.999+02:00`) : null;
  const fresh = new Date(Date.now() + QUOTE_VALID_DAYS * 864e5);
  const expiresAt = send ? (typed && typed > fresh ? typed : fresh) : typed;

  // Only staff move a quote to another salesperson. A commission already written stays as it is.
  let salesUserId = q.salesUserId;
  if (!desk.ownOnly && form.has("sales_user_id")) {
    salesUserId = Number(form.get("sales_user_id")) || null;
    if (salesUserId) {
      const [u] = await db.select({ isSales: users.isSales }).from(users).where(eq(users.id, salesUserId)).limit(1);
      if (!u?.isSales) back(path, { error: "Choose a salesperson." });
    }
    if (salesUserId !== q.salesUserId) await logAdmin(desk.id, "quote", id, "salesperson changed", `${q.salesUserId ?? "nobody"} → ${salesUserId ?? "nobody"}`);
  }

  await db
    .update(quotes)
    .set({
      name: str(form, "name").slice(0, 200),
      email,
      phone: str(form, "phone").slice(0, 50),
      company: str(form, "company").slice(0, 255),
      vatNumber: str(form, "vat_number").slice(0, 30),
      address1: str(form, "address_1").slice(0, 255),
      address2: str(form, "address_2").slice(0, 255),
      city: str(form, "city").slice(0, 100),
      province: str(form, "province").slice(0, 100),
      postcode: str(form, "postcode").slice(0, 20),
      country: str(form, "country").toUpperCase().slice(0, 2),
      note: str(form, "note").slice(0, 3000),
      items: lines,
      ...totals,
      status: send ? "sent" : locked ? "accepted" : status,
      salesUserId,
      expiresAt,
      ...(!send && status === "accepted" && !q.acceptedAt ? { acceptedAt: new Date() } : {}),
      ...(send ? { sentAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, id));

  if (send) {
    const saved = await quoteById(id);
    await sendQuoteEmails(saved!);
    back(path, { saved: `Quote saved and sent to ${email}.` });
  }
  back(path, { saved: locked ? "Saved. The lines are locked because the customer accepted the quote." : "Quote saved." });
}

/** A quote staff start themselves (a phone or email request). */
export async function createQuoteAction(form: FormData) {
  const desk = await quoteDesk();
  const email = cleanEmail(form.get("email"));
  if (!email) back(desk.base, { error: "Please enter the customer's email address." });
  const [q] = await db
    .insert(quotes)
    .values({
      status: "new",
      name: str(form, "name").slice(0, 200),
      email,
      company: str(form, "company").slice(0, 255),
      salesUserId: desk.isSales ? desk.id : null,
      message: `Created by staff (user ${desk.id}).`,
    })
    .returning({ id: quotes.id });
  back(`${desk.base}${q.id}/`, { saved: "Quote created. Add its lines, then send it." });
}

/**
 * A quote for a customer, started from their staff user or company page: filled
 * in from their account (quotePrefill) and linked to it, so it's on their
 * account's Quotes and accepting it fills their basket. Opens in the quote
 * editor; nothing is emailed until staff send it.
 */
export async function createQuoteForUserAction(form: FormData) {
  const me = await requireAdmin();
  const [staff] = await db.select({ isSales: users.isSales }).from(users).where(eq(users.id, me)).limit(1);
  const userId = Number(form.get("user_id"));
  const companyId = Number(form.get("company_id")) || 0;
  const [u] = Number.isInteger(userId) && userId > 0 ? await db.select().from(users).where(eq(users.id, userId)).limit(1) : [];
  if (!u) back("/admin/users/", { error: "That user no longer exists." });
  const [[order], [company]] = await Promise.all([
    db.select().from(orders).where(eq(orders.userId, u.id)).orderBy(desc(orders.createdAt)).limit(1),
    db
      .select({ id: companies.id, name: companies.name, phone: companies.phone, vatNumber: companies.vatNumber })
      .from(companies)
      .where(companyId ? eq(companies.id, companyId) : eq(companies.ownerId, u.id))
      .orderBy(companies.id)
      .limit(1),
  ]);
  const [q] = await db
    .insert(quotes)
    .values({ status: "new", userId: u.id, ...quotePrefill(u, order, company), salesUserId: staff?.isSales ? me : null, message: `Created by staff (user ${me}) from the customer's account.` })
    .returning({ id: quotes.id });
  await logAdmin(me, companyId ? "company" : "user", companyId || u.id, "quote created", `Quote #${q.id}`);
  back(`/admin/quotes/${q.id}/`, { saved: "Quote created from the customer's account. Add its lines, then send it." });
}

export async function deleteQuoteAction(form: FormData) {
  const desk = await quoteDesk();
  const id = Number(form.get("quote_id"));
  const q = await quoteById(id);
  if (!q || (desk.ownOnly && q.salesUserId !== desk.id)) back(desk.base, { error: "Quote not found." });
  if (desk.ownOnly && q.status === "accepted") back(`${desk.base}${id}/`, { error: "The customer accepted this quote, so only staff can delete it." });
  await db.delete(quotes).where(eq(quotes.id, id));
  back(desk.base, { saved: `Quote #${id} deleted.` });
}
