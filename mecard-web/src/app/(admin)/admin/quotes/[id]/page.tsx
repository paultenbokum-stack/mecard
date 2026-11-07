import { notFound } from "next/navigation";
import { QuoteEditor } from "@/components/admin/QuoteEditor";
import type { AdminSearchParams } from "@/components/admin/ui";
import { quoteById } from "@/lib/quotes";
import { listSalespeople } from "@/lib/sales";

export const metadata = { title: "Quote" };

export default async function AdminQuote({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const q = Number.isInteger(id) ? await quoteById(id) : null;
  if (!q) notFound();
  return <QuoteEditor q={q} sp={sp} desk="admin" salespeople={await listSalespeople()} />;
}
