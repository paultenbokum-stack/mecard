import type { Metadata } from "next";
import Link from "next/link";
import { Subnav } from "@/components/account/Bits";
import { formatDate, rands } from "@/lib/money";
import { effectiveStatus, QUOTE_STATUS_LABEL } from "@/lib/quote-rules";
import { quotePath, quotesForUser } from "@/lib/quotes";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Quotes - MeCard" } };

// My Account → Quotes (YITH's quote list, with the PDF in My Account).
export default async function QuotesPage() {
  const userId = await requireUserId("/my-account/quotes/");
  const list = await quotesForUser(userId);
  return (
    <div className="acc__wrap">
      <Subnav active="orders" />
      <h1>Quotes</h1>
      {list.length ? (
        <section className="acc-panel acc-panel--white">
          <table className="shop-table">
            <thead>
              <tr>
                <th>Quote</th>
                <th>Date</th>
                <th>Status</th>
                <th className="shop-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link href={quotePath(q)}>#{q.id}</Link>
                  </td>
                  <td>{formatDate(q.createdAt)}</td>
                  <td>{QUOTE_STATUS_LABEL[effectiveStatus(q)]}</td>
                  <td className="shop-num">{rands(q.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <div className="acc-empty">
          No quotes yet. <Link href="/request-quote/">Request a quote</Link>
        </div>
      )}
    </div>
  );
}
