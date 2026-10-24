import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, entitlements, orderItems, orderNotes, orders, profiles, users } from "@/db/schema";
import { CARD_TYPES } from "@/components/account/Bits";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Card, Flash } from "@/components/admin/ui";
import {
  addOrderNoteAction,
  checkTrackingAction,
  deleteOrderNoteAction,
  markCollectedAction,
  markDeliveredAction,
  markShippedAction,
  sendToBobgoAction,
  setOrderStatusAction,
  updateOrderAddressAction,
} from "@/lib/admin-actions";
import { cardProgress } from "@/lib/admin-cards";
import { bobgoEnabled } from "@/lib/bobgo";
import { hasInvoice } from "@/lib/invoice";
import { formatDate, ORDER_STATUS_LABEL, PAYMENT_LABEL, rands } from "@/lib/money";
import { PICKUP_METHOD } from "@/lib/shipping";

export const metadata = { title: "Order" };

const BILLING_FIELDS: [name: string, label: string, col: keyof typeof orders.$inferSelect, half?: boolean][] = [
  ["billing_first_name", "First name", "billingFirstName", true],
  ["billing_last_name", "Last name", "billingLastName", true],
  ["billing_company", "Company", "billingCompany"],
  ["address_1", "Street address", "address1"],
  ["address_2", "Apartment, suite, etc.", "address2"],
  ["suburb", "Suburb", "suburb", true],
  ["city", "Town / City", "city", true],
  ["province", "Province", "province", true],
  ["postcode", "Postcode", "postcode", true],
  ["billing_phone", "Phone", "billingPhone", true],
  ["billing_email", "Email", "billingEmail"],
];

export default async function AdminOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const [o] = Number.isInteger(id) ? await db.select().from(orders).where(eq(orders.id, id)) : [];
  if (!o) notFound();

  const [items, notes, [customer], orderCards, ents] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(orderItems.id),
    db
      .select({ n: orderNotes, author: sql<string | null>`coalesce(nullif(${users.displayName}, ''), ${users.email})` })
      .from(orderNotes)
      .leftJoin(users, eq(users.id, orderNotes.authorId))
      .where(eq(orderNotes.orderId, id))
      .orderBy(desc(orderNotes.createdAt), desc(orderNotes.id)),
    o.userId ? db.select().from(users).where(eq(users.id, o.userId)) : Promise.resolve([]),
    db
      .select({ c: cards, first: profiles.firstName, last: profiles.lastName })
      .from(cards)
      .leftJoin(profiles, eq(profiles.id, cards.profileId))
      .where(eq(cards.orderId, id))
      .orderBy(asc(cards.id)),
    db.select().from(entitlements).where(eq(entitlements.sourceOrderId, id)).orderBy(asc(entitlements.id)),
  ]);
  const statusLabel = ORDER_STATUS_LABEL[o.status] ?? o.status;

  return (
    <>
      <AdminHeader title={`Order #${o.id}`} back={{ href: "/admin/orders/", label: "Orders" }}>
        {hasInvoice(o) ? (
          <a href={`/my-account/invoice/${o.id}/`} target="_blank" rel="noopener" className="adm-btn">
            <i className="fas fa-file-pdf" aria-hidden="true" /> Invoice
          </a>
        ) : null}
        <Badge status={o.status}>{statusLabel}</Badge>
      </AdminHeader>
      <Flash saved={sp.saved} error={sp.error} />
      <p className="adm-muted">
        Placed {formatDate(o.createdAt, true)} · {PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod}
        {o.paidAt ? <> · paid {formatDate(o.paidAt, true)}</> : null}
        {o.payfastPaymentId ? <> · PayFast payment ID {o.payfastPaymentId}</> : null}
      </p>

      <div className="adm-grid">
        <div>
          <Card title="Items">
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="adm-num">Qty</th>
                    <th className="adm-num">Price</th>
                    <th className="adm-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.name}
                        {Object.entries(i.meta).length ? (
                          <div className="adm-muted adm-small">
                            {Object.entries(i.meta)
                              .filter(([k]) => !k.startsWith("_"))
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </div>
                        ) : null}
                      </td>
                      <td className="adm-num">{i.quantity}</td>
                      <td className="adm-num">{rands(i.unitPriceCents)}</td>
                      <td className="adm-num">{rands(i.unitPriceCents * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="adm-num">
                      Subtotal
                    </td>
                    <td className="adm-num">{rands(o.subtotalCents)}</td>
                  </tr>
                  {o.discountCents > 0 ? (
                    <tr>
                      <td colSpan={3} className="adm-num">
                        Discount{o.couponCode ? ` (${o.couponCode})` : ""}
                      </td>
                      <td className="adm-num">-{rands(o.discountCents)}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td colSpan={3} className="adm-num">
                      Shipping{o.shippingMethod ? ` via ${o.shippingMethod}` : ""}
                    </td>
                    <td className="adm-num">{rands(o.shippingCents)}</td>
                  </tr>
                  <tr>
                    <th colSpan={3} className="adm-num">
                      Total
                    </th>
                    <th className="adm-num">{rands(o.totalCents)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card title={`Cards on this order (${orderCards.length})`}>
            {orderCards.length ? (
              <div className="adm-table-wrap">
                <table className="adm-table adm-table--tight">
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th>Type</th>
                      <th>Profile</th>
                      <th>Production</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderCards.map(({ c, first, last }) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/admin/cards/${c.id}/`}>{c.label || c.slug}</Link>
                          {c.archived ? <span className="adm-muted"> (archived)</span> : null}
                        </td>
                        <td className="adm-small">{CARD_TYPES[c.type] ?? c.type}</td>
                        <td className="adm-small">{`${first ?? ""} ${last ?? ""}`.trim() || "—"}</td>
                        <td className="adm-small">{cardProgress(c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="adm-muted">No cards are linked to this order.</p>
            )}
            {ents.length ? (
              <>
                <h3>Entitlements</h3>
                <p className="adm-small" style={{ margin: 0 }}>
                  {ents.map((e) => `${e.type.replace("_", " ")}: ${e.status.replace("_", " ")}`).join(" · ")}{" "}
                  <Link href={`/admin/entitlements/?order=${o.id}`}>View</Link>
                </p>
              </>
            ) : null}
          </Card>

          <div className="adm-grid--2">
            <Card title="Billing and delivery">
              <address className="adm-small" style={{ fontStyle: "normal", marginBottom: 8 }}>
                {[`${o.billingFirstName} ${o.billingLastName}`.trim(), o.billingCompany, o.address1, o.address2, o.suburb, o.city, `${o.province} ${o.postcode}`.trim()]
                  .filter(Boolean)
                  .map((l, n) => (
                    <div key={n}>{l}</div>
                  ))}
              </address>
              <div className="adm-small">
                {o.billingEmail ? <div>{o.billingEmail}</div> : null}
                {o.billingPhone ? <div>{o.billingPhone}</div> : null}
              </div>
              <details style={{ marginTop: 12 }}>
                <summary className="adm-small">Edit billing details</summary>
                <form action={updateOrderAddressAction} className="adm-form" style={{ marginTop: 8 }}>
                  <input type="hidden" name="order_id" value={o.id} />
                  {BILLING_FIELDS.map(([name, label, col, half]) => (
                    <div key={name} className={`adm-field${half ? "" : " adm-field--full"}`}>
                      <label htmlFor={name}>{label}</label>
                      <input id={name} name={name} defaultValue={String(o[col] ?? "")} className="adm-input" />
                    </div>
                  ))}
                  <div className="adm-field--full">
                    <SubmitButton className="adm-btn adm-btn--primary" busy="Saving…">
                      Save billing details
                    </SubmitButton>
                  </div>
                </form>
              </details>
            </Card>
            <Card title="Customer">
              {customer ? (
                <p className="adm-small">
                  {customer.displayName || `${customer.firstName} ${customer.lastName}`.trim() || customer.email}
                  <br />
                  <span className="adm-muted">{customer.email}</span>
                  <br />
                  <Link href={`/admin/orders/?q=${encodeURIComponent(customer.email)}`}>Their orders</Link> ·{" "}
                  <Link href={`/admin/cards/?q=${encodeURIComponent(customer.email)}`}>Their cards</Link>
                </p>
              ) : (
                <p className="adm-muted">Guest, or the account was deleted.</p>
              )}
              <h3>Customer&apos;s note at checkout</h3>
              <p className="adm-small adm-pre" style={{ margin: 0 }}>
                {o.notes || <span className="adm-muted">None.</span>}
              </p>
            </Card>
          </div>
        </div>

        <div>
          <Card title="Status">
            <form action={setOrderStatusAction} className="adm-inline" style={{ width: "100%" }}>
              <input type="hidden" name="order_id" value={o.id} />
              <select name="status" defaultValue={o.status} className="adm-select" aria-label="Order status" style={{ flex: 1 }}>
                {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <SubmitButton className="adm-btn adm-btn--primary" busy="Saving…">
                Update
              </SubmitButton>
            </form>
            <ul className="adm-small adm-muted" style={{ paddingLeft: 18, margin: "12px 0 0" }}>
              <li>On hold → Processing marks an EFT payment as received: Pro upgrades and bundles take effect, and the cards go to production.</li>
              <li>Shipped marks the order&apos;s cards shipped; Completed means delivered (or collected).</li>
              <li>Cancelled archives the order&apos;s cards that haven&apos;t shipped and cancels its entitlements.</li>
              <li>The customer is emailed for Processing, On hold, Completed and Refunded.</li>
              <li>Refunded doesn&apos;t move money: refund the payment in PayFast or by EFT as well.</li>
            </ul>
          </Card>

          <Card title="Shipping">
            {o.shippingMethod ? <p className="adm-small" style={{ marginTop: 0 }}>{o.shippingMethod}</p> : null}
            {o.trackingReference || o.shippedAt ? (
              <p className="adm-small">
                {o.courierName || "Courier"}
                {o.trackingReference ? <>, tracking <strong>{o.trackingReference}</strong></> : null}
                {o.shippedAt ? <><br />Shipped {formatDate(o.shippedAt, true)}</> : null}
                {o.deliveredAt ? <><br />Delivered {formatDate(o.deliveredAt, true)}</> : null}
              </p>
            ) : null}
            {o.status === "processing" && o.shippingMethod === PICKUP_METHOD.label ? (
              <form action={markCollectedAction}>
                <input type="hidden" name="order_id" value={o.id} />
                <SubmitButton className="adm-btn adm-btn--primary" busy="Saving…" confirm="Mark this order collected? It will be completed and the customer emailed.">
                  <i className="fas fa-hand-holding" aria-hidden="true" /> Collected
                </SubmitButton>
              </form>
            ) : o.status === "processing" && o.shippingMethod ? (
              <details>
                <summary className="adm-small">Mark shipped by hand</summary>
                <form action={markShippedAction} className="adm-form" style={{ gridTemplateColumns: "1fr", marginTop: 8 }}>
                  <input type="hidden" name="order_id" value={o.id} />
                  <div className="adm-field">
                    <label htmlFor="ship-courier">Courier (optional)</label>
                    <input id="ship-courier" name="courier" className="adm-input" />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="ship-ref">Tracking reference (optional)</label>
                    <input id="ship-ref" name="reference" className="adm-input" />
                  </div>
                  <div>
                    <SubmitButton className="adm-btn adm-btn--primary" busy="Saving…">
                      <i className="fas fa-truck" aria-hidden="true" /> Mark shipped
                    </SubmitButton>
                  </div>
                </form>
              </details>
            ) : null}
            {o.status === "shipped" ? (
              <form action={markDeliveredAction} style={{ marginTop: 8 }}>
                <input type="hidden" name="order_id" value={o.id} />
                <SubmitButton className="adm-btn adm-btn--primary" busy="Saving…" confirm="Mark this order delivered? It will be completed and the customer emailed.">
                  <i className="fas fa-check" aria-hidden="true" /> Mark delivered
                </SubmitButton>
              </form>
            ) : null}
            {["processing", "shipped"].includes(o.status) && o.shippingMethod && o.shippingMethod !== PICKUP_METHOD.label ? (
              <form action={checkTrackingAction} style={{ marginTop: 8 }}>
                <input type="hidden" name="order_id" value={o.id} />
                <SubmitButton className="adm-link adm-small" busy="Checking…">
                  Check Bob Go tracking now
                </SubmitButton>
              </form>
            ) : null}
            <p className="adm-help" style={{ marginBottom: 0 }}>
              Bob Go tracking is checked every hour: the order moves to Shipped when the courier collects it and to Completed when it&apos;s delivered, with an
              email to the customer each time. Ticking Shipped on all its cards does the same.
            </p>
          </Card>

          <Card title="Bob Go">
            {o.bobgoOrderId ? (
              <>
                <p className="adm-small" style={{ margin: 0 }}>
                  Sent to Bob Go as order <strong>{o.bobgoOrderId}</strong>. Book the courier and print the waybill in Bob Go.
                </p>
                {o.bobgoStatus === "cancelled" ? <div className="adm-note adm-small">Cancelled in Bob Go.</div> : null}
                {o.bobgoStatus === "completed" ? <div className="adm-flash adm-flash--ok adm-small">Completed in Bob Go.</div> : null}
                {o.bobgoError ? <div className="adm-flash adm-flash--error adm-small">Last update failed: {o.bobgoError}</div> : null}
                <form action={sendToBobgoAction} style={{ marginTop: 8 }}>
                  <input type="hidden" name="order_id" value={o.id} />
                  <input type="hidden" name="force" value="1" />
                  <SubmitButton busy="Updating…">Update in Bob Go</SubmitButton>
                  <div className="adm-help">Sends the order&apos;s current address and items to Bob Go again.</div>
                </form>
              </>
            ) : o.shippingMethod === PICKUP_METHOD.label ? (
              <p className="adm-muted" style={{ margin: 0 }}>
                Local pickup: not sent to Bob Go.
              </p>
            ) : !bobgoEnabled() ? (
              <p className="adm-muted" style={{ margin: 0 }}>
                Bob Go isn&apos;t set up here (no BOBGO_API_KEY).
              </p>
            ) : (
              <>
                {o.bobgoError ? <div className="adm-flash adm-flash--error adm-small">Last attempt failed: {o.bobgoError}</div> : null}
                <p className="adm-muted">
                  {["processing", "shipped", "completed", "on-hold"].includes(o.status) ? "Not in Bob Go yet." : "Paid orders go to Bob Go automatically when they move to Processing."}
                </p>
                <form action={sendToBobgoAction}>
                  <input type="hidden" name="order_id" value={o.id} />
                  <SubmitButton busy="Sending…">Send to Bob Go</SubmitButton>
                </form>
              </>
            )}
          </Card>

          <Card title="Order history">
            <form action={addOrderNoteAction} style={{ marginBottom: 12 }}>
              <input type="hidden" name="order_id" value={o.id} />
              <textarea name="note" rows={3} required className="adm-textarea" aria-label="Note" placeholder="Add a note" />
              <div className="adm-inline" style={{ marginTop: 6 }}>
                <select name="note_type" className="adm-select" aria-label="Note type">
                  <option value="private">Private note</option>
                  <option value="customer">Note to customer (emailed)</option>
                </select>
                <SubmitButton busy="Adding…">Add</SubmitButton>
              </div>
            </form>
            {notes.length ? (
              <ol className="adm-notes">
                {notes.map(({ n, author }) => (
                  <li key={n.id} className={n.customerNote ? "is-customer" : n.authorId ? undefined : "is-system"}>
                    <div className="adm-pre">{n.body}</div>
                    <div className="adm-notes__meta">
                      {formatDate(n.createdAt, true)} · {author ?? "System"}
                      {n.customerNote ? " · emailed to customer" : ""}
                      <form action={deleteOrderNoteAction} className="adm-inline" style={{ marginLeft: 8 }}>
                        <input type="hidden" name="order_id" value={o.id} />
                        <input type="hidden" name="note_id" value={n.id} />
                        <SubmitButton className="adm-link adm-link--danger adm-small" confirm="Delete this note?">
                          Delete
                        </SubmitButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                No history yet.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
