import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "@/db/client";
import { products, quotes, users, type QuoteLine } from "@/db/schema";
import { addQuoteLines } from "./cart";
import { cardTypesFor, isVirtual } from "./catalog";
import { sendEmail } from "./email";
import { INVOICE_SELLER } from "./invoice-settings";
import { formatDate, rands } from "./money";
import { ADDITIONAL_SHIPPING_PRODUCT, effectiveStatus, QUOTE_VALID_DAYS, quoteToken, quoteTotals } from "./quote-rules";
import { siteUrl } from "./site";

export type Quote = typeof quotes.$inferSelect;

export const quotePath = (q: Pick<Quote, "id" | "email">) => `/quote/${q.id}/${quoteToken(q.id, q.email)}/`;
const shopInbox = () => process.env.ORDER_NOTIFY_TO || process.env.CONTACT_TO || "";

/**
 * A quote request (YITH with "automatic quote" on): priced at shop prices,
 * with one Additional Shipping line when anything ships, then sent at once.
 */
export async function requestQuote(input: {
  userId: number | null;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  items: { productId: number; qty: number }[];
}): Promise<Quote> {
  const wanted = input.items.filter((i) => i.qty > 0);
  const ids = [...new Set([...wanted.map((i) => i.productId), ADDITIONAL_SHIPPING_PRODUCT])];
  const rows = await db.select().from(products).where(and(inArray(products.id, ids), eq(products.active, true)));
  const byId = new Map(rows.map((p) => [p.id, p]));
  const items: QuoteLine[] = wanted
    .filter((i) => byId.has(i.productId) && i.productId !== ADDITIONAL_SHIPPING_PRODUCT)
    .map((i) => ({ productId: i.productId, name: byId.get(i.productId)!.name, qty: i.qty, unitPriceCents: byId.get(i.productId)!.priceCents }));
  const ship = byId.get(ADDITIONAL_SHIPPING_PRODUCT);
  if (ship && items.some((i) => !isVirtual(i.productId))) items.push({ productId: ship.id, name: ship.name, qty: 1, unitPriceCents: ship.priceCents });
  const totals = quoteTotals(items);
  const now = new Date();
  const [q] = await db
    .insert(quotes)
    .values({
      userId: input.userId,
      status: "sent",
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      message: input.message,
      items,
      ...totals,
      expiresAt: new Date(now.getTime() + QUOTE_VALID_DAYS * 864e5),
      sentAt: now,
    })
    .returning();
  await sendQuoteEmails(q);
  return q;
}

export async function sendQuoteEmails(q: Quote) {
  const pdf = await renderQuotePdf(q).catch((e) => (console.error(`[quotes] PDF for quote ${q.id} failed`, e), null));
  const link = siteUrl(quotePath(q));
  const lines = q.items.map((i) => `  ${i.name} × ${i.qty}   ${rands(i.unitPriceCents * i.qty)}`).join("\n");
  await sendEmail({
    to: q.email,
    subject: `Your MeCard quote #${q.id}`,
    text: [
      `Hi ${q.name || "there"},`,
      "",
      `Thank you for your quote request. Here is your quote, valid until ${q.expiresAt ? formatDate(q.expiresAt) : "further notice"}:`,
      "",
      lines,
      "",
      `Total: ${rands(q.totalCents)}`,
      ...(q.note ? ["", q.note] : []),
      "",
      `Accept or reject it here: ${link}`,
      "",
      "The MeCard team",
    ].join("\n"),
    ...(pdf ? { attachments: [{ filename: `mecard-quote-${q.id}.pdf`, content: Buffer.from(pdf) }] } : {}),
  });
  if (shopInbox()) {
    await sendEmail({
      to: shopInbox(),
      replyTo: q.email,
      subject: `[MeCard]: New quote request #${q.id} from ${q.name || q.email}`,
      text: `${q.name}${q.company ? ` (${q.company})` : ""} <${q.email}> ${q.phone}\n\n${lines}\n\nTotal: ${rands(q.totalCents)}${q.message ? `\n\nMessage:\n${q.message}` : ""}\n\nCustomer link: ${link}`,
    });
  }
}

export async function quoteById(id: number) {
  const [q] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  return q ?? null;
}

/** The customer's quotes: by account, or by the email they asked with. */
export async function quotesForUser(userId: number) {
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return db
    .select()
    .from(quotes)
    .where(or(eq(quotes.userId, userId), u ? sql`lower(${quotes.email}) = ${u.email.toLowerCase()}` : sql`false`))
    .orderBy(desc(quotes.createdAt));
}

/** Accept: the quote's lines go into the user's basket at the quoted prices. */
export async function acceptQuote(q: Quote, userId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const status = effectiveStatus(q);
  if (status === "expired") return { ok: false, error: "This quote has expired. Please ask us for a new one." };
  if (status === "rejected") return { ok: false, error: "This quote was rejected." };
  await addQuoteLines(userId, q.id, q.items);
  if (status !== "accepted") await db.update(quotes).set({ status: "accepted", userId, updatedAt: new Date() }).where(eq(quotes.id, q.id));
  return { ok: true };
}

export async function rejectQuote(q: Quote) {
  if (effectiveStatus(q) !== "sent") return;
  await db.update(quotes).set({ status: "rejected", updatedAt: new Date() }).where(eq(quotes.id, q.id));
  if (shopInbox()) await sendEmail({ to: shopInbox(), subject: `[MeCard]: Quote #${q.id} was rejected`, text: `${q.name} <${q.email}> rejected quote #${q.id} (${rands(q.totalCents)}).` });
}

export const quoteHasCards = (q: Pick<Quote, "items">) => q.items.some((i) => cardTypesFor(i.productId).length);

const INK = rgb(0.12, 0.14, 0.18);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.88, 0.9, 0.93);

/** The quote PDF (YITH's "table" template: logo, seller, customer, items, totals, payment details). */
export async function renderQuotePdf(q: Quote): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = (s: string) => s.replace(/[^\x20-\x7e -ÿ]/g, "");
  const text = (s: string, x: number, y: number, o: { size?: number; font?: typeof regular; color?: typeof INK; right?: boolean } = {}) => {
    const font = o.font ?? regular;
    const size = o.size ?? 10;
    const str = clean(s);
    page.drawText(str, { x: o.right ? x - font.widthOfTextAtSize(str, size) : x, y, size, font, color: o.color ?? INK });
  };
  const left = 50;
  const right = 545;
  let y = 780;
  try {
    const png = await pdf.embedPng(await readFile(path.join(process.cwd(), "public/images/mecard-logo.png")));
    const w = 130;
    page.drawImage(png, { x: left, y: y - (png.height * w) / png.width + 20, width: w, height: (png.height * w) / png.width });
  } catch {
    text("MeCard", left, y, { font: bold, size: 22 });
  }
  text("QUOTE", right, y, { font: bold, size: 20, right: true });
  y = 720;
  const seller = [INVOICE_SELLER.name, ...INVOICE_SELLER.address, INVOICE_SELLER.email];
  seller.forEach((l, i) => text(l, left, y - i * 14, { font: i === 0 ? bold : regular, size: i === 0 ? 10.5 : 9.5 }));
  const details: [string, string][] = [
    ["Quote number", String(q.id)],
    ["Date", formatDate(q.sentAt ?? q.createdAt)],
    ["Valid until", q.expiresAt ? formatDate(q.expiresAt) : "-"],
  ];
  details.forEach(([k, v], i) => {
    text(k, right - 110, y - i * 14, { size: 9.5, color: MUTED, right: true });
    text(v, right, y - i * 14, { size: 9.5, right: true });
  });
  y = 720 - Math.max(seller.length, details.length) * 14 - 24;
  text("QUOTE FOR", left, y, { font: bold, size: 9, color: MUTED });
  const to = [q.name, q.company, q.email, q.phone].filter(Boolean);
  to.forEach((l, i) => text(l, left, y - 16 - i * 13, { size: 9.5 }));
  y = y - 16 - to.length * 13 - 26;

  page.drawRectangle({ x: left, y: y - 6, width: right - left, height: 20, color: rgb(0.96, 0.96, 0.97) });
  text("Product", left + 6, y, { font: bold, size: 9.5 });
  text("Qty", right - 190, y, { font: bold, size: 9.5, right: true });
  text("Price", right - 95, y, { font: bold, size: 9.5, right: true });
  text("Total", right - 6, y, { font: bold, size: 9.5, right: true });
  y -= 24;
  for (const i of q.items) {
    text(i.name.slice(0, 60), left + 6, y);
    text(String(i.qty), right - 190, y, { right: true });
    text(rands(i.unitPriceCents), right - 95, y, { right: true });
    text(rands(i.unitPriceCents * i.qty), right - 6, y, { right: true });
    page.drawLine({ start: { x: left, y: y - 7 }, end: { x: right, y: y - 7 }, thickness: 0.5, color: LINE });
    y -= 22;
  }
  y -= 6;
  const totals: [string, string, boolean?][] = [
    ["Subtotal", rands(q.subtotalCents)],
    ...(q.discountCents > 0 ? [["Discount", `-${rands(q.discountCents)}`] as [string, string]] : []),
    ["Total", rands(q.totalCents), true],
  ];
  for (const [k, v, strong] of totals) {
    text(k, right - 110, y, { font: strong ? bold : regular, right: true, color: strong ? INK : MUTED });
    text(v, right - 6, y, { font: strong ? bold : regular, right: true });
    y -= 17;
  }
  if (q.note) {
    y -= 10;
    q.note.split("\n").slice(0, 6).forEach((l, i) => text(l.slice(0, 95), left, y - i * 13, { size: 9.5 }));
  }
  // Footer: YITH's "Payment to be made to" block, and the accept link.
  ["Payment to be made to:", ...INVOICE_SELLER.footer].forEach((l, i) => text(l, left, 130 - i * 12, { size: 8.5, color: MUTED }));
  text(`Accept this quote online: ${siteUrl(quotePath(q))}`, left, 60, { size: 8.5, color: MUTED });
  return pdf.save();
}
