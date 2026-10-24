import Link from "next/link";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Card, Flash } from "@/components/admin/ui";
import { deleteQuoteAction, saveQuoteAction } from "@/lib/admin-quote-actions";
import { formatDate, rands } from "@/lib/money";
import { effectiveStatus, QUOTE_STATUS_LABEL, QUOTE_VALID_DAYS } from "@/lib/quote-rules";
import { quoteById, quotePath } from "@/lib/quotes";

export const metadata = { title: "Quote" };

const randsInput = (c: number) => (c / 100).toFixed(2);
/** YYYY-MM-DD in South Africa, for a date input. */
const saDate = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(d) : "");
const BLANK_LINES = 3;

export default async function AdminQuote({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const q = Number.isInteger(id) ? await quoteById(id) : null;
  if (!q) notFound();
  const catalogue = await db.select({ id: products.id, name: products.name, priceCents: products.priceCents, active: products.active }).from(products).orderBy(asc(products.sortOrder), asc(products.name));
  const status = effectiveStatus(q);
  const locked = q.status === "accepted";
  const lines = [...q.items, ...(locked ? [] : Array.from({ length: BLANK_LINES }, () => null))];

  return (
    <>
      <AdminHeader title={`Quote #${q.id}`} back={{ href: "/admin/quotes/", label: "Quotes" }}>
        {q.email ? (
          <>
            <a href={quotePath(q)} target="_blank" rel="noopener" className="adm-btn">
              <i className="fas fa-external-link-alt" aria-hidden="true" /> Customer&apos;s page
            </a>
            <a href={`${quotePath(q)}pdf/`} target="_blank" rel="noopener" className="adm-btn">
              <i className="fas fa-file-pdf" aria-hidden="true" /> PDF
            </a>
          </>
        ) : null}
        <Badge status={status}>{QUOTE_STATUS_LABEL[status] ?? status}</Badge>
      </AdminHeader>
      <Flash saved={sp.saved} error={sp.error} />
      <p className="adm-muted">
        Asked {formatDate(q.createdAt, true)}
        {q.sentAt ? ` · sent ${formatDate(q.sentAt, true)}` : " · not sent yet"}
        {q.expiresAt ? ` · valid until ${formatDate(q.expiresAt)}` : ""}
        {q.orderId ? (
          <>
            {" "}
            · paid as <Link href={`/admin/orders/${q.orderId}/`}>order #{q.orderId}</Link>
          </>
        ) : null}
      </p>
      {locked ? <div className="adm-note">The customer accepted this quote, so its lines are in their basket at these prices and can&apos;t be changed here.</div> : null}

      <form action={saveQuoteAction}>
        <input type="hidden" name="quote_id" value={q.id} />
        <div className="adm-grid">
          <div>
            <Card title="Lines">
              <div className="adm-table-wrap">
                <table className="adm-table adm-table--tight">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price each (R)</th>
                      <th className="adm-num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, n) => (
                      <tr key={n}>
                        <td>
                          <select name="product_id" defaultValue={l?.productId ?? ""} className="adm-select" disabled={locked} aria-label={`Line ${n + 1} product`} style={{ width: "100%" }}>
                            <option value="">{l ? "" : "Add a product…"}</option>
                            {catalogue
                              .filter((p) => p.active || p.id === l?.productId)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({rands(p.priceCents)})
                                </option>
                              ))}
                          </select>
                        </td>
                        <td>
                          <input name="qty" type="number" min={0} max={5000} defaultValue={l?.qty ?? ""} className="adm-input adm-input--num" disabled={locked} aria-label={`Line ${n + 1} quantity`} />
                        </td>
                        <td>
                          <input
                            name="price"
                            inputMode="decimal"
                            defaultValue={l ? randsInput(l.unitPriceCents) : ""}
                            placeholder="Shop price"
                            className="adm-input adm-input--num"
                            disabled={locked}
                            aria-label={`Line ${n + 1} price`}
                          />
                        </td>
                        <td className="adm-num">{l ? rands(l.qty * l.unitPriceCents) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="adm-num">
                        Subtotal
                      </td>
                      <td className="adm-num">{rands(q.subtotalCents)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="adm-num">
                        <label htmlFor="discount">Discount (R)</label>{" "}
                        <input id="discount" name="discount" inputMode="decimal" defaultValue={q.discountCents ? randsInput(q.discountCents) : ""} placeholder="0.00" className="adm-input adm-input--num" disabled={locked} />
                      </td>
                      <td className="adm-num">{q.discountCents ? `-${rands(q.discountCents)}` : ""}</td>
                    </tr>
                    <tr>
                      <th colSpan={3} className="adm-num">
                        Total
                      </th>
                      <th className="adm-num">{rands(q.totalCents)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="adm-help" style={{ marginBottom: 0 }}>
                Set a line&apos;s quantity to 0 to remove it. Leave the price empty for the shop price. Totals update when you save. Delivery is the Additional
                Shipping product; checkout then offers delivery included in the quote.
              </p>
            </Card>
            <Card title="Note to the customer">
              <textarea name="note" rows={4} defaultValue={q.note} className="adm-textarea" aria-label="Note to the customer" />
              <p className="adm-help" style={{ marginBottom: 0 }}>
                Shown on the quote page, in the email and on the PDF.
              </p>
            </Card>
            {q.message ? (
              <Card title="Customer's message">
                <p className="adm-pre" style={{ margin: 0 }}>
                  {q.message}
                </p>
              </Card>
            ) : null}
          </div>

          <div>
            <Card title="Customer">
              <div className="adm-form" style={{ gridTemplateColumns: "1fr" }}>
                {(
                  [
                    ["name", "Name", q.name, "text"],
                    ["email", "Email", q.email, "email"],
                    ["phone", "Phone", q.phone, "tel"],
                    ["company", "Company", q.company, "text"],
                    ["vat_number", "VAT number (optional)", q.vatNumber, "text"],
                  ] as const
                ).map(([name, label, value, type]) => (
                  <div key={name} className="adm-field">
                    <label htmlFor={`q-${name}`}>{label}</label>
                    <input id={`q-${name}`} name={name} type={type} defaultValue={value} className="adm-input" required={name === "email"} />
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Billing address (optional)">
              <div className="adm-form" style={{ gridTemplateColumns: "1fr" }}>
                {(
                  [
                    ["address_1", "Address", q.address1],
                    ["address_2", "Address line 2", q.address2],
                    ["city", "City", q.city],
                    ["province", "Province", q.province],
                    ["postcode", "Postal code", q.postcode],
                    ["country", "Country (2-letter code, e.g. ZA)", q.country],
                  ] as const
                ).map(([name, label, value]) => (
                  <div key={name} className="adm-field">
                    <label htmlFor={`q-${name}`}>{label}</label>
                    <input id={`q-${name}`} name={name} type="text" defaultValue={value} className="adm-input" maxLength={name === "country" ? 2 : undefined} />
                  </div>
                ))}
              </div>
              <p className="adm-help" style={{ marginBottom: 0 }}>
                Printed under the customer on the quote, the PDF and the email.
              </p>
            </Card>
            <Card title="Status and expiry">
              <div className="adm-form" style={{ gridTemplateColumns: "1fr" }}>
                <div className="adm-field">
                  <label htmlFor="q-status">Status</label>
                  <select id="q-status" name="status" defaultValue={q.status} className="adm-select" disabled={locked}>
                    {Object.entries(QUOTE_STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {locked ? <input type="hidden" name="status" value="accepted" /> : null}
                </div>
                <div className="adm-field">
                  <label htmlFor="q-expires">Valid until</label>
                  <input id="q-expires" name="expires" type="date" defaultValue={saDate(q.expiresAt)} className="adm-input" />
                  <span className="adm-help">Sending sets it to {QUOTE_VALID_DAYS} days from today, unless a later date is set here.</span>
                </div>
              </div>
              <div className="adm-head__actions" style={{ marginTop: 14 }}>
                <SubmitButton className="adm-btn" busy="Saving…">
                  Save
                </SubmitButton>
                {!locked ? (
                  <SubmitButton className="adm-btn adm-btn--primary" busy="Sending…" name="intent" value="send" confirm={`Save and email this quote to ${q.email || "the customer"}?`}>
                    <i className="fas fa-paper-plane" aria-hidden="true" /> {q.sentAt ? "Save and send again" : "Save and send"}
                  </SubmitButton>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </form>

      {!locked ? (
        <Card title="Delete quote" className="adm-card--danger">
          <form action={deleteQuoteAction} className="adm-inline">
            <input type="hidden" name="quote_id" value={q.id} />
            <span className="adm-small">For spam or duplicates. To decline a real request, set the status to Rejected instead.</span>
            <SubmitButton className="adm-btn adm-btn--danger" confirm={`Delete quote #${q.id}?`}>
              Delete
            </SubmitButton>
          </form>
        </Card>
      ) : null}
    </>
  );
}
