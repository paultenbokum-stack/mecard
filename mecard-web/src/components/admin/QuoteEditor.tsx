import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { products, type quotes } from "@/db/schema";
import { QuoteLinesEditor } from "@/components/admin/QuoteLinesEditor";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Card, Flash } from "@/components/admin/ui";
import { deleteQuoteAction, saveQuoteAction } from "@/lib/admin-quote-actions";
import { formatDate } from "@/lib/money";
import { ADDITIONAL_SHIPPING_PRODUCT, effectiveStatus, QUOTE_STATUS_LABEL, QUOTE_VALID_DAYS, quoteParts } from "@/lib/quote-rules";
import { quotePath } from "@/lib/quotes";

/** YYYY-MM-DD in South Africa, for a date input. */
const saDate = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(d) : "");

/** The quote screen. A salesperson (staff = false) gets no order links and can't choose the salesperson. */
export async function QuoteEditor({
  q,
  sp,
  staff,
  salespeople = [],
}: {
  q: typeof quotes.$inferSelect;
  sp: AdminSearchParams;
  staff: boolean;
  salespeople?: { id: number; name: string }[];
}) {
  const base = "/admin/quotes/";
  const catalogue = await db.select({ id: products.id, name: products.name, priceCents: products.priceCents, active: products.active }).from(products).orderBy(asc(products.sortOrder), asc(products.name));
  const status = effectiveStatus(q);
  const locked = q.status === "accepted";
  const parts = quoteParts(q.items);

  return (
    <>
      <AdminHeader title={`Quote #${q.id}`} back={{ href: base, label: "Quotes" }}>
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
            · paid as {staff ? <Link href={`/admin/orders/${q.orderId}/`}>order #{q.orderId}</Link> : `order #${q.orderId}`}
          </>
        ) : null}
      </p>
      {locked ? <div className="adm-note">The customer accepted this quote, so its lines are in their basket at these prices and can&apos;t be changed here.</div> : null}

      <form action={saveQuoteAction}>
        <input type="hidden" name="quote_id" value={q.id} />
        <div className="adm-grid">
          <div>
            <Card title="Lines">
              <QuoteLinesEditor
                catalogue={catalogue.filter((p) => p.id !== ADDITIONAL_SHIPPING_PRODUCT)}
                shippingProduct={catalogue.find((p) => p.id === ADDITIONAL_SHIPPING_PRODUCT) ?? null}
                items={parts.products}
                shippingLine={parts.shippingLine}
                discountCents={q.discountCents}
                locked={locked}
              />
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
            {staff ? (
              <Card title="Salesperson">
                <div className="adm-field">
                  <label htmlFor="q-sales">Earns commission on this quote</label>
                  <select id="q-sales" name="sales_user_id" defaultValue={q.salesUserId ?? ""} className="adm-select">
                    <option value="">Nobody</option>
                    {salespeople.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </Card>
            ) : null}
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
