import { notFound } from "next/navigation";
import { QuoteEditor } from "@/components/admin/QuoteEditor";
import type { AdminSearchParams } from "@/components/admin/ui";
import { quoteById } from "@/lib/quotes";
import { requireSales } from "@/lib/session";

export const metadata = { title: "Quote" };

export default async function SalesQuote({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }) {
  const me = await requireSales();
  const id = Number((await params).id);
  const sp = await searchParams;
  const q = Number.isInteger(id) ? await quoteById(id) : null;
  if (!q || q.salesUserId !== me) notFound();
  return <QuoteEditor q={q} sp={sp} desk="sales" />;
}
