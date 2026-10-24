import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/account/Bits";
import { acceptQuoteAction, rejectQuoteAction } from "@/lib/quote-actions";
import { effectiveStatus, quoteBillingLines, QUOTE_STATUS_LABEL, verifyQuoteToken } from "@/lib/quote-rules";
import { quoteById } from "@/lib/quotes";
import { formatDate, rands } from "@/lib/money";

export const metadata: Metadata = { title: { absolute: "Your quote - MeCard" }, robots: { index: false } };

type Props = { params: Promise<{ id: string; token: string }>; searchParams: Promise<{ sent?: string; rejected?: string; error?: string; accept?: string }> };

// The link in the quote email: the quote, its PDF, and Accept / Reject (YITH's labels).
export default async function QuotePage({ params, searchParams }: Props) {
  const [{ id, token }, sp] = await Promise.all([params, searchParams]);
  const q = await quoteById(Number(id));
  if (!q || !verifyQuoteToken(q.id, q.email, token)) notFound();
  const status = effectiveStatus(q);
  const open = status === "sent" || status === "new";

  return (
    <div className="acc__wrap">
      <h1>Quote #{q.id}</h1>
      {sp.sent ? <div className="acc-panel acc-panel--ok">Thank you for your request. We&rsquo;ve emailed this quote to {q.email}.</div> : null}
      {sp.rejected ? <div className="acc-panel acc-panel--notice">You rejected this quote. Thanks for letting us know.</div> : null}
      {sp.error ? <div className="acc-panel acc-panel--error">{sp.error}</div> : null}
      {sp.accept && open ? <div className="acc-panel acc-panel--notice">You&rsquo;re signed in: press Accept to put this quote in your basket.</div> : null}
      <p className="acc__lead">
        {QUOTE_STATUS_LABEL[status] ?? status}
        {q.expiresAt && open ? ` · valid until ${formatDate(q.expiresAt)}` : ""} · for {q.name || q.email}
        {q.company ? `, ${q.company}` : ""}
      </p>
      {quoteBillingLines(q).length ? (
        <p className="acc__muted">
          {quoteBillingLines(q).map((l) => (
            <span key={l} style={{ display: "block" }}>
              {l}
            </span>
          ))}
        </p>
      ) : null}
      <section className="acc-panel acc-panel--white">
        <table className="shop-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="shop-num">Price</th>
              <th className="shop-num">Qty</th>
              <th className="shop-num">Total</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((i) => (
              <tr key={i.productId}>
                <td>{i.name}</td>
                <td className="shop-num">{rands(i.unitPriceCents)}</td>
                <td className="shop-num">{i.qty}</td>
                <td className="shop-num">{rands(i.unitPriceCents * i.qty)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {q.discountCents > 0 ? (
              <tr>
                <th colSpan={3}>Discount</th>
                <td className="shop-num">-{rands(q.discountCents)}</td>
              </tr>
            ) : null}
            <tr>
              <th colSpan={3}>Total</th>
              <td className="shop-num">
                <strong>{rands(q.totalCents)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
        {q.note ? <p style={{ marginTop: 14, whiteSpace: "pre-line" }}>{q.note}</p> : null}
        <div className="acc-actions">
          <a className="acc-btn" href={`/quote/${q.id}/${token}/pdf/`}>
            Download PDF
          </a>
          {open || status === "accepted" ? (
            <form action={acceptQuoteAction.bind(null, q.id, token)}>
              <ConfirmButton className="acc-btn acc-btn--cta">{status === "accepted" ? "Continue to checkout" : "Accept"}</ConfirmButton>
            </form>
          ) : null}
          {open ? (
            <form action={rejectQuoteAction.bind(null, q.id, token)}>
              <ConfirmButton className="acc-btn acc-btn--danger" confirm="Reject this quote?">
                Reject
              </ConfirmButton>
            </form>
          ) : null}
        </div>
        {open ? <p className="acc__muted" style={{ marginBottom: 0 }}>Accepting puts these items in your basket at the quoted prices; you then pay by card or EFT. You&rsquo;ll be asked to sign in or create an account first.</p> : null}
        {status === "expired" ? (
          <p style={{ marginBottom: 0 }}>
            This quote has expired. <Link href="/request-quote/">Ask for a new one</Link>.
          </p>
        ) : null}
      </section>
    </div>
  );
}
