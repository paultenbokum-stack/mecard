import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { products, users } from "@/db/schema";
import { QuoteRequestForm } from "@/components/shop/QuoteRequestForm";
import { cartView } from "@/lib/cart";
import { SHOP_CATALOGUE } from "@/lib/catalog";
import { rands } from "@/lib/money";
import { currentUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Request a quote - MeCard" } };

// /request-quote/ (YITH's page): open to everyone, prefilled from the basket
// ("or ask for a quote") for signed-in customers.
export default async function RequestQuotePage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const sp = await searchParams;
  const userId = await currentUserId();
  const ids = SHOP_CATALOGUE.map((c) => c.id);
  const rows = await db.select().from(products).where(inArray(products.id, ids));
  const byId = new Map(rows.filter((p) => p.active).map((p) => [p.id, p]));
  const list = ids.filter((id) => byId.has(id)).map((id) => ({ id, name: byId.get(id)!.name, price: rands(byId.get(id)!.priceCents) }));
  const [u] = userId ? await db.select().from(users).where(eq(users.id, userId)).limit(1) : [];
  const quantities: Record<number, number> = {};
  if (userId) for (const l of (await cartView(userId)).lines) if (!l.quoteId) quantities[l.productId] = (quantities[l.productId] ?? 0) + l.qty;

  return (
    <div className="acc__wrap">
      <h1>Request a quote</h1>
      {sp.sent ? (
        <div className="acc-panel acc-panel--ok">Thank you: your quote is on its way to your inbox.</div>
      ) : (
        <>
          <p className="acc__lead">Ordering for a team, or need a formal quote first? Tell us what you need and we&rsquo;ll email you a quote straight away. You can accept it online and pay by card or EFT.</p>
          <QuoteRequestForm products={list} quantities={quantities} defaults={{ name: u ? `${u.firstName} ${u.lastName}`.trim() || u.displayName : "", email: u?.email ?? "", phone: u?.phone ?? "" }} />
        </>
      )}
    </div>
  );
}
