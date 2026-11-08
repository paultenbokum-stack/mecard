import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { QuoteEditor } from "@/components/admin/QuoteEditor";
import type { AdminSearchParams } from "@/components/admin/ui";
import { quoteById } from "@/lib/quotes";
import { listSalespeople } from "@/lib/sales";
import { requireQuoteStaff } from "@/lib/session";

export const metadata = { title: "Quote" };

export default async function AdminQuote({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }) {
  const who = await requireQuoteStaff("/admin/quotes/");
  const id = Number((await params).id);
  const sp = await searchParams;
  const q = Number.isInteger(id) ? await quoteById(id) : null;
  if (!q || (!who.isAdmin && q.salesUserId !== who.id)) notFound();
  if (who.isAdmin) return <QuoteEditor q={q} sp={sp} staff salespeople={await listSalespeople()} />;
  const [me] = await db.select({ rateBps: users.commissionRateBps }).from(users).where(eq(users.id, who.id)).limit(1);
  return <QuoteEditor q={q} sp={sp} staff={false} salesRateBps={me?.rateBps ?? 0} />;
}
