import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, companies, entitlements, orders, profiles, quotes, users } from "@/db/schema";
import { CARD_TYPES } from "@/components/account/Bits";
import { AdminLogList } from "@/components/admin/AdminLogList";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Breadcrumbs, Card, Flash } from "@/components/admin/ui";
import { userDeleteGuard } from "@/lib/admin-guards";
import { deleteUserAction, saveUserAction, sendResetAction, userDeleteCounts } from "@/lib/admin-user-actions";
import { ENTITLEMENT_STATUS_LABEL, ENTITLEMENT_TYPE_LABEL } from "@/lib/entitlement-labels";
import { imageUrl } from "@/lib/images/paths";
import { listLibrary } from "@/lib/media-library";
import { formatDate, ORDER_STATUS_LABEL, rands } from "@/lib/money";
import { effectiveStatus, QUOTE_STATUS_LABEL } from "@/lib/quote-rules";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "User" };

export default async function AdminUser({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }) {
  const me = await requireAdmin();
  const id = Number((await params).id);
  const sp = await searchParams;
  const [u] = Number.isInteger(id) ? await db.select().from(users).where(eq(users.id, id)) : [];
  if (!u) notFound();
  const [profs, comps, cardRows, orderRows, quoteRows, ents, counts, images] = await Promise.all([
    db
      .select({ p: profiles, company: companies.name })
      .from(profiles)
      .leftJoin(companies, eq(companies.id, profiles.companyId))
      .where(or(eq(profiles.ownerId, id), eq(profiles.managerId, id)))
      .orderBy(profiles.archived, desc(profiles.id)),
    db.select().from(companies).where(eq(companies.ownerId, id)).orderBy(desc(companies.id)),
    db.select().from(cards).where(eq(cards.ownerId, id)).orderBy(cards.archived, desc(cards.id)).limit(100),
    db.select().from(orders).where(eq(orders.userId, id)).orderBy(desc(orders.id)).limit(50),
    db
      .select()
      .from(quotes)
      .where(or(eq(quotes.userId, id), sql`lower(${quotes.email}) = ${u.email.toLowerCase()}`))
      .orderBy(desc(quotes.id))
      .limit(50),
    db
      .select({ type: entitlements.type, status: entitlements.status, n: sql<number>`count(*)::int` })
      .from(entitlements)
      .where(eq(entitlements.ownerId, id))
      .groupBy(entitlements.type, entitlements.status),
    userDeleteCounts(id),
    listLibrary(id),
  ]);
  const name = u.displayName || `${u.firstName} ${u.lastName}`.trim() || u.email;
  const guard = userDeleteGuard({ ...counts, isSelf: id === me });
  const liveCards = cardRows.filter((c) => !c.archived);

  return (
    <>
      <Breadcrumbs items={[{ href: "/admin/", label: "Admin" }, { href: "/admin/users/", label: "Users" }, { label: name }]} />
      <AdminHeader title={name}>{u.isAdmin ? <Badge status="processing">Staff</Badge> : <Badge status="sent">Customer</Badge>}</AdminHeader>
      <Flash saved={sp.saved} error={sp.error} />
      <p className="adm-muted">
        Account #{u.id} · {u.email}
        {u.username ? ` · username ${u.username}` : ""} · joined {formatDate(u.createdAt)}
        {u.lastActiveAt ? ` · last active ${formatDate(u.lastActiveAt)}` : ""} · {u.passwordHash ? "has a password" : "no password yet"}
      </p>

      <div className="adm-grid">
        <div>
          <Card title={`Profiles (${profs.length})`}>
            {profs.length ? (
              <table className="adm-table adm-table--tight">
                <tbody>
                  {profs.map(({ p, company }) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/profiles/${p.id}/`}>{`${p.firstName} ${p.lastName}`.trim() || `Profile ${p.id}`}</Link>
                        {company ? <span className="adm-muted"> · {company}</span> : null}
                      </td>
                      <td className="adm-small">{p.ownerId === id ? "owner" : "manages"}</td>
                      <td className="adm-small">{p.type === "pro" ? "Pro" : "Standard"}</td>
                      <td className="adm-small">{p.archived ? <span className="adm-muted">archived</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                None.
              </p>
            )}
          </Card>
          <Card title={`Companies owned (${comps.length})`}>
            {comps.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {comps.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/companies/${c.id}/`}>{c.name}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                None.
              </p>
            )}
          </Card>
          <Card title={`Tags (${liveCards.length} live${cardRows.length > liveCards.length ? `, ${cardRows.length - liveCards.length} archived` : ""})`}>
            {cardRows.length ? (
              <table className="adm-table adm-table--tight">
                <tbody>
                  {cardRows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/cards/${c.id}/`}>{c.label || c.slug}</Link>
                      </td>
                      <td className="adm-small">{CARD_TYPES[c.type] ?? c.type}</td>
                      <td className="adm-small">{c.profileId ? <Link href={`/admin/profiles/${c.profileId}/`}>profile {c.profileId}</Link> : <span className="adm-muted">unassigned</span>}</td>
                      <td className="adm-small">{c.archived ? <span className="adm-muted">archived</span> : c.cartItemKey ? <span className="adm-muted">in basket</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                None.
              </p>
            )}
          </Card>
          <Card title={`Images (${images.total})`}>
            {images.rows.length ? (
              <div className="adm-images">
                {images.rows.map((m) => (
                  <a key={m.id} className="adm-images__item" href={imageUrl(m.path) ?? "#"} target="_blank" rel="noopener" title={`${m.filename} · ${formatDate(m.createdAt)}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m.active ? <img src={imageUrl(m.path, 160)!} alt="" loading="lazy" /> : <span className="adm-muted">archived</span>}
                    <span className="adm-small">{m.title || m.filename}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                None.
              </p>
            )}
            {images.total > images.rows.length ? <p className="adm-small adm-muted">Newest {images.rows.length} shown. Archived images are restored when opened.</p> : null}
          </Card>
          <Card title={`Orders (${orderRows.length})`}>
            {orderRows.length ? (
              <table className="adm-table adm-table--tight">
                <tbody>
                  {orderRows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/orders/${o.id}/`}>#{o.id}</Link>
                      </td>
                      <td className="adm-small">{formatDate(o.createdAt)}</td>
                      <td className="adm-num">{rands(o.totalCents)}</td>
                      <td>
                        <Badge status={o.status}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                None.
              </p>
            )}
          </Card>
          <div className="adm-grid--2">
            <Card title={`Quotes (${quoteRows.length})`}>
              {quoteRows.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {quoteRows.map((q) => (
                    <li key={q.id}>
                      <Link href={`/admin/quotes/${q.id}/`}>#{q.id}</Link> {rands(q.totalCents)} <span className="adm-muted adm-small">{QUOTE_STATUS_LABEL[effectiveStatus(q)]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="adm-muted" style={{ margin: 0 }}>
                  None.
                </p>
              )}
            </Card>
            <Card title={`Entitlements (${ents.reduce((t, e) => t + e.n, 0)})`}>
              {ents.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {ents.map((e) => (
                    <li key={`${e.type}${e.status}`} className="adm-small">
                      {e.n} × {ENTITLEMENT_TYPE_LABEL[e.type] ?? e.type}, {ENTITLEMENT_STATUS_LABEL[e.status] ?? e.status}
                    </li>
                  ))}
                  <li className="adm-small" style={{ listStyle: "none", marginTop: 4 }}>
                    <Link href={`/admin/entitlements/?q=${encodeURIComponent(u.email)}`}>View them</Link>
                  </li>
                </ul>
              ) : (
                <p className="adm-muted" style={{ margin: 0 }}>
                  None.
                </p>
              )}
            </Card>
          </div>
        </div>

        <div>
          <Card title="Account">
            <form action={saveUserAction} className="adm-form" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <input type="hidden" name="user_id" value={u.id} />
              <div className="adm-field">
                <label htmlFor="u-first">First name</label>
                <input id="u-first" name="first_name" defaultValue={u.firstName} className="adm-input" />
              </div>
              <div className="adm-field">
                <label htmlFor="u-last">Last name</label>
                <input id="u-last" name="last_name" defaultValue={u.lastName} className="adm-input" />
              </div>
              <div className="adm-field adm-field--full">
                <label htmlFor="u-display">Display name</label>
                <input id="u-display" name="display_name" defaultValue={u.displayName} className="adm-input" />
              </div>
              <div className="adm-field adm-field--full">
                <label htmlFor="u-email">Email</label>
                <input id="u-email" name="email" type="email" required defaultValue={u.email} className="adm-input" />
              </div>
              <div className="adm-field">
                <label htmlFor="u-phone">Phone</label>
                <input id="u-phone" name="phone" defaultValue={u.phone} className="adm-input" />
              </div>
              <div className="adm-field">
                <label htmlFor="u-role">Role</label>
                <select id="u-role" name="role" defaultValue={u.isAdmin ? "staff" : "customer"} className="adm-select">
                  <option value="customer">Customer</option>
                  <option value="staff">Staff (these admin screens)</option>
                </select>
              </div>
              <div className="adm-field--full">
                <SubmitButton className="adm-btn adm-btn--primary" busy="Saving…">
                  Save account
                </SubmitButton>
              </div>
            </form>
          </Card>
          <Card title="Password">
            <form action={sendResetAction}>
              <input type="hidden" name="user_id" value={u.id} />
              <p className="adm-small" style={{ marginTop: 0 }}>
                Emails {u.email} a link to choose a new password (valid for an hour). Staff never see or set passwords.
              </p>
              <SubmitButton busy="Sending…" confirm={`Email a password reset link to ${u.email}?`}>
                Send password reset
              </SubmitButton>
            </form>
          </Card>
          <Card title="Delete account" className="adm-card--danger">
            {guard.ok ? (
              <form action={deleteUserAction}>
                <input type="hidden" name="user_id" value={u.id} />
                <p className="adm-small" style={{ marginTop: 0 }}>
                  Removes the account and its basket. Type <strong>{u.email}</strong> to confirm.
                </p>
                <input name="confirm" className="adm-input" aria-label="Type the email address to confirm" style={{ width: "100%", marginBottom: 8 }} autoComplete="off" />
                <SubmitButton className="adm-btn adm-btn--danger" busy="Deleting…">
                  Delete account
                </SubmitButton>
              </form>
            ) : (
              <>
                <p className="adm-small" style={{ marginTop: 0 }}>
                  This account can&apos;t be deleted yet:
                </p>
                <ul className="adm-blockers">
                  {guard.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          <AdminLogList entity="user" id={u.id} />
        </div>
      </div>
    </>
  );
}
