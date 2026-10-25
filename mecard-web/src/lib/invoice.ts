import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import { db } from "@/db/client";
import { orderItems, orders } from "@/db/schema";
import { billingLinesOf, formatAddress } from "@/lib/addresses";
import { INVOICE_SELLER, INVOICE_STATUSES, invoiceNumber, VAT_RATE } from "@/lib/invoice-settings";
import { formatDate, PAYMENT_LABEL, rands } from "@/lib/money";

type Order = typeof orders.$inferSelect;

export function hasInvoice(o: Pick<Order, "status" | "paidAt">): boolean {
  return INVOICE_STATUSES.includes(o.status) || (!!o.paidAt && o.status !== "pending");
}

export const invoiceFilename = (orderId: number) => `mecard-invoice-${invoiceNumber(orderId)}.pdf`;

const LOGO = path.join(process.cwd(), "public/images/mecard-logo.png");
const BRAND = rgb(0.867, 0.094, 0.231); // --nt-primary #dd183b
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.45, 0.45, 0.45);
const LINE = rgb(0.85, 0.85, 0.85);

/** The invoice for an order as PDF bytes, or null when it has none (unpaid). */
export async function renderInvoice(orderId: number): Promise<Uint8Array | null> {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o || !hasInvoice(o)) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(orderItems.id);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${invoiceNumber(o.id)}`);
  pdf.setAuthor(INVOICE_SELLER.name);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  const left = 50;
  const right = width - 50;

  // Standard PDF fonts only cover Windows-1252; swap anything else for "?".
  const clean = (font: PDFFont, s: string) =>
    [...s]
      .map((ch) => {
        try {
          font.encodeText(ch);
          return ch;
        } catch {
          return "?";
        }
      })
      .join("");
  const text = (
    p: PDFPage,
    s: string,
    x: number,
    y: number,
    o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {},
  ) => {
    const font = o.font ?? regular;
    const size = o.size ?? 10;
    const str = clean(font, s);
    const dx = o.align === "right" ? font.widthOfTextAtSize(str, size) : 0;
    p.drawText(str, { x: x - dx, y, size, font, color: o.color ?? INK });
  };
  /** Cut text to fit a column width. */
  const fit = (s: string, max: number, size = 10) => {
    let str = clean(regular, s);
    while (str.length > 1 && regular.widthOfTextAtSize(str, size) > max) str = str.slice(0, -2) + "…";
    return str;
  };

  // Header: logo and title
  let y = 780;
  try {
    const png = await pdf.embedPng(await readFile(LOGO));
    const w = 130;
    page.drawImage(png, { x: left, y: y - (png.height * w) / png.width + 20, width: w, height: (png.height * w) / png.width });
  } catch {
    text(page, "MeCard", left, y, { font: bold, size: 22, color: BRAND });
  }
  const title = INVOICE_SELLER.vatNumber ? "TAX INVOICE" : "INVOICE";
  text(page, title, right, y, { font: bold, size: 20, align: "right" });
  if (o.status === "refunded") text(page, "REFUNDED", right, y - 20, { font: bold, size: 11, color: BRAND, align: "right" });

  // Seller (left) and invoice details (right)
  y = 720;
  const seller = [
    INVOICE_SELLER.name,
    ...(INVOICE_SELLER.registration ? [`Reg. no. ${INVOICE_SELLER.registration}`] : []),
    ...(INVOICE_SELLER.vatNumber ? [`VAT no. ${INVOICE_SELLER.vatNumber}`] : []),
    ...INVOICE_SELLER.address,
    INVOICE_SELLER.email,
  ];
  seller.forEach((l, i) => text(page, l, left, y - i * 14, { font: i === 0 ? bold : regular, size: i === 0 ? 10.5 : 9.5 }));
  const details: [string, string][] = [
    ["Invoice number", invoiceNumber(o.id)],
    ["Invoice date", formatDate(o.paidAt ?? o.createdAt)],
    ["Order number", String(o.id)],
    ["Order date", formatDate(o.createdAt)],
    ["Payment method", PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod],
  ];
  details.forEach(([k, v], i) => {
    text(page, k, right - 120, y - i * 14, { size: 9.5, color: MUTED, align: "right" });
    text(page, v, right, y - i * 14, { size: 9.5, align: "right" });
  });

  // Bill to
  y = 720 - Math.max(seller.length, details.length) * 14 - 24;
  text(page, "BILL TO", left, y, { font: bold, size: 9, color: MUTED });
  const billTo = [
    ...formatAddress({ firstName: o.billingFirstName, lastName: o.billingLastName, company: o.billingCompany, ...billingLinesOf(o) }),
    o.billingEmail,
    o.billingPhone,
  ].filter(Boolean);
  billTo.forEach((l, i) => text(page, l, left, y - 16 - i * 13, { size: 9.5 }));
  y = y - 16 - billTo.length * 13 - 26;

  // Items
  const colQty = right - 190;
  const colPrice = right - 95;
  page.drawRectangle({ x: left, y: y - 6, width: right - left, height: 20, color: rgb(0.96, 0.96, 0.97) });
  text(page, "Product", left + 6, y, { font: bold, size: 9.5 });
  text(page, "Qty", colQty, y, { font: bold, size: 9.5, align: "right" });
  text(page, "Price", colPrice, y, { font: bold, size: 9.5, align: "right" });
  text(page, "Total", right - 6, y, { font: bold, size: 9.5, align: "right" });
  y -= 24;
  for (const i of items) {
    text(page, fit(i.name, colQty - left - 60), left + 6, y);
    text(page, String(i.quantity), colQty, y, { align: "right" });
    text(page, rands(i.unitPriceCents), colPrice, y, { align: "right" });
    text(page, rands(i.unitPriceCents * i.quantity), right - 6, y, { align: "right" });
    page.drawLine({ start: { x: left, y: y - 7 }, end: { x: right, y: y - 7 }, thickness: 0.5, color: LINE });
    y -= 22;
  }

  // Totals
  y -= 6;
  const totals: [string, string, boolean?][] = [
    ["Subtotal", rands(o.subtotalCents)],
    ...(o.discountCents > 0
      ? [[`Discount${o.couponCode ? ` (${o.couponCode})` : ""}`, `-${rands(o.discountCents)}`] as [string, string]]
      : []),
    [`Shipping${o.shippingMethod ? ` via ${o.shippingMethod}` : ""}`, rands(o.shippingCents)],
    ["Total", rands(o.totalCents), true],
  ];
  if (INVOICE_SELLER.vatNumber) {
    const vat = Math.round((o.totalCents * VAT_RATE) / (1 + VAT_RATE));
    totals.push([`Includes VAT (${Math.round(VAT_RATE * 100)}%)`, rands(vat)]);
  }
  for (const [k, v, strong] of totals) {
    text(page, fit(k, 220, 10), right - 110, y, { font: strong ? bold : regular, align: "right", color: strong ? INK : MUTED });
    text(page, v, right - 6, y, { font: strong ? bold : regular, align: "right" });
    y -= 17;
  }

  // Footer: the bank details WordPress printed, then the thank-you line.
  INVOICE_SELLER.footer.forEach((l, i) => text(page, l, left, 120 - i * 12, { size: 8.5, color: MUTED }));
  text(page, `Thank you for your order. Questions? ${INVOICE_SELLER.email}`, left, 60, { size: 9, color: MUTED });
  text(page, INVOICE_SELLER.website, right, 60, { size: 9, color: BRAND, align: "right" });

  return pdf.save();
}
