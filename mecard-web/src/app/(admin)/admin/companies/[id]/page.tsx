import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, companies, orders, profiles, users } from "@/db/schema";
import { CARD_TYPES } from "@/components/account/Bits";
import { AdminLogList } from "@/components/admin/AdminLogList";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Breadcrumbs, Card, Flash } from "@/components/admin/ui";
import { companyDeleteCounts, deleteCompanyAction, saveCompanyAdminAction } from "@/lib/admin-company-actions";
import { companyDeleteGuard } from "@/lib/admin-guards";
import { formatDate, ORDER_STATUS_LABEL, rands } from "@/lib/money";

export const metadata = { title: "Company" };

export default async function AdminCompany({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const [row] = Number.isInteger(id)
    ? await db.select({ c: companies, owner: users }).from(companies).leftJoin(users, eq(users.id, companies.ownerId)).where(eq(companies.id, id))
    : [];
  if (!row) notFound();
  const { c, owner } = row;
  const [profs, tags, counts] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.companyId, id)).orderBy(profiles.archived, profiles.firstName),
    db.select().from(cards).where(eq(cards.companyId, id)).orderBy(cards.archived, desc(cards.id)).limit(200),
    companyDeleteCounts(id),
  ]);
  // Members: the people whose profiles are in the company (and the owner).
  const memberIds = [...new Set([c.ownerId, ...profs.filter((p) => !p.archived).flatMap((p) => [p.ownerId, p.managerId])].filter((x): x is number => !!x))];
  const [members, memberOrders] = await Promise.all([
    memberIds.length ? db.select({ id: users.id, email: users.email, name: users.displayName }).from(users).where(inArray(users.id, memberIds)) : Promise.resolve([]),
    memberIds.length
      ? db
          .select({ o: orders, buyer: sql<string>`coalesce(nullif(${users.displayName}, ''), ${users.email})` })
          .from(orders)
          .leftJoin(users, eq(users.id, orders.userId))
          .where(inArray(orders.userId, memberIds))
          .orderBy(desc(orders.id))
          .limit(20)
      : Promise.resolve([]),
  ]);
  const guard = companyDeleteGuard(counts);
  const liveProfiles = profs.filter((p) => !p.archived);
  const liveTags = tags.filter((t) => !t.archived);

  return (
    <>
      <Breadcrumbs items={[{ href: "/admin/", label: "Admin" }, { href: "/admin/companies/", label: "Companies" }, { label: c.name }]} />
      <AdminHeader title={c.name}>
        <Link href={`/manage/company/${c.id}/`} className="adm-btn">
          <i className="fas fa-pen" aria-hidden="true" /> Edit branding and links
        </Link>
      </AdminHeader>
      <Flash saved={sp.saved} error={sp.error} />
      <p className="adm-muted">
        Company #{c.id} · {c.slug} · created {formatDate(c.createdAt)} · changed {formatDate(c.updatedAt)}
      </p>

      <div className="adm-grid">
        <div>
          <Card title={`Profiles (${liveProfiles.length}${profs.length > liveProfiles.length ? `, ${profs.length - liveProfiles.length} archived` : ""})`}>
            {profs.length ? (
              <table className="adm-table adm-table--tight">
                <tbody>
                  {profs.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/profiles/${p.id}/`}>{`${p.firstName} ${p.lastName}`.trim() || `Profile ${p.id}`}</Link>
                        {p.jobTitle ? <span className="adm-muted"> · {p.jobTitle}</span> : null}
                      </td>
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
          <p className="adm-small" style={{ margin: "-10px 0 18px" }}>
            <Link href={`/admin/profiles/?company=${c.id}`}>These profiles in the profile list</Link> (to filter, sort or add one) ·{" "}
            <Link href={`/admin/tags/?q=${encodeURIComponent(c.name)}`}>this company&apos;s tags in the tag list</Link>
          </p>
          <Card title={`Tags (${liveTags.length}${tags.length > liveTags.length ? `, ${tags.length - liveTags.length} archived` : ""})`}>
            {tags.length ? (
              <table className="adm-table adm-table--tight">
                <tbody>
                  {tags.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/admin/cards/${t.id}/`}>{t.label || t.slug}</Link>
                      </td>
                      <td className="adm-small">{CARD_TYPES[t.type] ?? t.type}</td>
                      <td className="adm-small">{t.profileId ? <Link href={`/admin/profiles/${t.profileId}/`}>profile {t.profileId}</Link> : <span className="adm-muted">unassigned</span>}</td>
                      <td className="adm-small">{t.archived ? <span className="adm-muted">archived</span> : null}</td>
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
          <Card title={`Members' orders (latest ${memberOrders.length})`}>
            {memberOrders.length ? (
              <table className="adm-table adm-table--tight">
                <tbody>
                  {memberOrders.map(({ o, buyer }) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/orders/${o.id}/`}>#{o.id}</Link>
                      </td>
                      <td className="adm-small">{buyer}</td>
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
        </div>

        <div>
          <Card title="Company">
            <form action={saveCompanyAdminAction} className="adm-form" style={{ gridTemplateColumns: "1fr" }}>
              <input type="hidden" name="company_id" value={c.id} />
              <div className="adm-field">
                <label htmlFor="c-name">Name</label>
                <input id="c-name" name="name" required defaultValue={c.name} className="adm-input" />
              </div>
              <div className="adm-field">
                <label htmlFor="c-owner">Owner&apos;s email</label>
                <input id="c-owner" name="owner" type="email" defaultValue={owner?.email ?? ""} className="adm-input" />
                <span className="adm-help">The account that manages the company and its team. Blank for none.</span>
              </div>
              <div>
                <SubmitButton className="adm-btn adm-btn--primary" busy="Saving…">
                  Save
                </SubmitButton>
              </div>
            </form>
          </Card>
          <Card title={`Members (${members.length})`}>
            {members.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {members.map((m) => (
                  <li key={m.id} className="adm-small">
                    <Link href={`/admin/users/${m.id}/`}>{m.name || m.email}</Link>
                    {m.id === c.ownerId ? <span className="adm-muted"> · owner</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                None.
              </p>
            )}
          </Card>
          <Card title="Delete company" className="adm-card--danger">
            {guard.ok ? (
              <form action={deleteCompanyAction}>
                <input type="hidden" name="company_id" value={c.id} />
                <p className="adm-small" style={{ marginTop: 0 }}>
                  Deletes the company and its company-wide link buttons. Archived profiles and tags that pointed at it lose the link. Type <strong>{c.name}</strong> to
                  confirm.
                </p>
                <input name="confirm" className="adm-input" aria-label="Type the company name to confirm" style={{ width: "100%", marginBottom: 8 }} autoComplete="off" />
                <SubmitButton className="adm-btn adm-btn--danger" busy="Deleting…">
                  Delete company
                </SubmitButton>
              </form>
            ) : (
              <>
                <p className="adm-small" style={{ marginTop: 0 }}>
                  This company can&apos;t be deleted yet:
                </p>
                <ul className="adm-blockers">
                  {guard.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          <AdminLogList entity="company" id={c.id} />
        </div>
      </div>
    </>
  );
}
