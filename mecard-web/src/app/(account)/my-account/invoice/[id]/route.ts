import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { invoiceFilename, renderInvoice } from "@/lib/invoice";
import { currentUserId, isAdminUser } from "@/lib/session";

// The invoice PDF for the customer's own order (PDF Invoices' My Account button).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const userId = await currentUserId();
  if (!userId) return new Response("Please log in.", { status: 401 });
  const own = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId))).limit(1);
  if (!own.length && !(await isAdminUser(userId))) return new Response("Not found", { status: 404 });
  const pdf = await renderInvoice(id);
  if (!pdf) return new Response("This order has no invoice yet.", { status: 404 });
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${invoiceFilename(id)}"`, "Cache-Control": "private, no-store" },
  });
}
