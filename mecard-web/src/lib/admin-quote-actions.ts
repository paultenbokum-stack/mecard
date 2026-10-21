"use server";

import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { products, quotes, type QuoteLine } from "@/db/schema";
import { cleanEmail } from "@/lib/form-values";
import { randsToCents } from "@/lib/money";
import { QUOTE_STATUS_LABEL, QUOTE_VALID_DAYS, quoteTotals } from "@/lib/quote-rules";
import { quoteById, sendQuoteEmails } from "@/lib/quotes";
import { requireAdmin } from "@/lib/session";

// Staff editing of quotes (YITH's quote screen in WooCommerce): lines and
// prices, a discount, a note to the customer, expiry and status; then send.

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function back(path: string, outcome: { saved?: string; error?: string }): never {
  redirect(`${path}?${new URLSearchParams(outcome as Record<string, string>)}`);
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
    lines.push({ productId: p.id, name: p.name, qty: qtys[i], unitPriceCents: price });
  }
  return lines;
}

export async function saveQuoteAction(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("quote_id"));
  const path = `/admin/quotes/${id}/`;
  const q = await quoteById(id);
  if (!q) back("/admin/quotes/", { error: "Quote not found." });
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

  await db
    .update(quotes)
    .set({
      name: str(form, "name").slice(0, 200),
      email,
      phone: str(form, "phone").slice(0, 50),
      company: str(form, "company").slice(0, 255),
      note: str(form, "note").slice(0, 3000),
      items: lines,
      ...totals,
      status: send ? "sent" : locked ? "accepted" : status,
      expiresAt,
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
  const me = await requireAdmin();
  const email = cleanEmail(form.get("email"));
  if (!email) back("/admin/quotes/", { error: "Please enter the customer's email address." });
  const [q] = await db
    .insert(quotes)
    .values({ status: "new", name: str(form, "name").slice(0, 200), email, company: str(form, "company").slice(0, 255), message: `Created by staff (user ${me}).` })
    .returning({ id: quotes.id });
  back(`/admin/quotes/${q.id}/`, { saved: "Quote created. Add its lines, then send it." });
}

export async function deleteQuoteAction(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("quote_id"));
  await db.delete(quotes).where(eq(quotes.id, id));
  back("/admin/quotes/", { saved: `Quote #${id} deleted.` });
}
