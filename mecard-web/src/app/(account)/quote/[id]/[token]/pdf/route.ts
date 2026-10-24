import { verifyQuoteToken } from "@/lib/quote-rules";
import { quoteById, renderQuotePdf } from "@/lib/quotes";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;
  const q = await quoteById(Number(id));
  if (!q || !verifyQuoteToken(q.id, q.email, token)) return new Response("Not found", { status: 404 });
  const pdf = await renderQuotePdf(q);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="mecard-quote-${q.id}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
