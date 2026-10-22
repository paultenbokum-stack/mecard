import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { cards, companies, entitlements, events, profiles, users } from "@/db/schema";
import { CARD_TYPES } from "@/components/account/Bits";
import { AdminLogList } from "@/components/admin/AdminLogList";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Breadcrumbs, Card, Flash } from "@/components/admin/ui";
import { profileArchiveGuard } from "@/lib/admin-guards";
import { archiveProfileAction, profileArchiveCounts, restoreProfileAction, saveProfileAdminAction } from "@/lib/admin-profile-actions";
import { ENTITLEMENT_STATUS_LABEL, ENTITLEMENT_TYPE_LABEL } from "@/lib/entitlement-labels";
import { formatDate } from "@/lib/money";

export const metadata = { title: "Profile" };

const manager = alias(users, "manager");

export default async function AdminProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const [row] = Number.isInteger(id)
    ? await db
        .select({ p: profiles, owner: users, manager, company: { id: companies.id, name: companies.name, slug: companies.slug } })
        .from(profiles)
        .leftJoin(users, eq(users.id, profiles.ownerId))
        .leftJoin(manager, eq(manager.id, profiles.managerId))
        .leftJoin(companies, eq(companies.id, profiles.companyId))
        .where(eq(profiles.id, id))
    : [];
  if (!row) notFound();
  const { p, owner, company } = row;
  const mgr = row.manager;
  const [tags, ents, [usage], counts] = await Promise.all([
    db.select().from(cards).where(eq(cards.profileId, id)).orderBy(cards.archived, desc(cards.id)),
    db.select().from(entitlements).where(eq(entitlements.assignedProfileId, id)).orderBy(desc(entitlements.id)),
    db
      .select({
        views: sql<number>`count(*) filter (where ${events.name} = 'profile_viewed')::int`,
        saves: sql<number>`count(*) filter (where ${events.name} = 'vcard_downloaded')::int`,
        taps: sql<number>`count(*) filter (where ${events.name} = 'contact_action')::int`,
        last: sql<string | null>`max(${events.createdAt}) filter (where ${events.name} = 'profile_viewed')`,
      })
      .from(events)
      .where(eq(events.profileId, id)),
    profileArchiveCounts(id),
  ]);
  const name = `${p.firstName} ${p.lastName}`.trim() || `Profile ${p.id}`;
  const guard = profileArchiveGuard(counts);
  const liveTags = tags.filter((t) => !t.archived);

  return (
    <>
      <Breadcrumbs
        items={[
          { href: "/admin/", label: "Admin" },
          { href: "/admin/profiles/", label: "Profiles" },
          ...(company?.id ? [{ href: `/admin/companies/${company.id}/`, label: company.name }] : []),
          { label: name },
        ]}
      />
      <AdminHeader title={name}>
        <a href={`/mecard-profile/${p.slug}/`} target="_blank" rel="noopener" className="adm-btn">
          <i className="fas fa-external-link-alt" aria-hidden="true" /> Public page
        </a>
        <Link href={`/manage/profile/${p.id}/`} className="adm-btn">
          <i className="fas fa-pen" aria-hidden="true" /> Edit details
        </Link>
        {p.archived ? <Badge status="cancelled">Archived</Badge> : p.type === "pro" ? <Badge status="processing">Pro</Badge> : <Badge status="sent">Standard</Badge>}
      </AdminHeader>
      <Flash saved={sp.saved} error={sp.error} />
      <p className="adm-muted">
        Profile #{p.id} · /mecard-profile/{p.slug}/ · created {formatDate(p.createdAt)} · changed {formatDate(p.updatedAt)}
      </p>

      <div className="adm-grid">
        <div>
          <Card title="Details">
            <dl className="adm-dl">
              <dt>Job title</dt>
              <dd>{p.jobTitle || "–"}</dd>
              <dt>Email</dt>
              <dd>{p.email || "–"}</dd>
              <dt>Mobile</dt>
              <dd>{p.mobile || "–"}</dd>
              <dt>Company</dt>
              <dd>{company?.id ? <Link href={`/admin/companies/${company.id}/`}>{company.name}</Link> : p.companyName || "–"}</dd>
              <dt>Owner</dt>
              <dd>{owner ? <Link href={`/admin/users/${owner.id}/`}>{owner.displayName || owner.email}</Link> : <span className="adm-muted">none (a team profile not taken over yet)</span>}</dd>
              <dt>Managed by</dt>
              <dd>{mgr ? <Link href={`/admin/users/${mgr.id}/`}>{mgr.displayName || mgr.email}</Link> : "–"}</dd>
              <dt>Use</dt>
              <dd>
                {usage.views.toLocaleString("en-ZA")} views, {usage.saves.toLocaleString("en-ZA")} contacts saved, {usage.taps.toLocaleString("en-ZA")} contact taps
                {usage.last ? ` · last viewed ${formatDate(new Date(usage.last))}` : ""}
              </dd>
            </dl>
            <p className="adm-help" style={{ marginBottom: 0 }}>
              Name, contact details, photo and links are changed with <Link href={`/manage/profile/${p.id}/`}>the profile editor</Link>, as the customer sees it.
            </p>
          </Card>
          <Card title={`Tags (${liveTags.length}${tags.length > liveTags.length ? `, ${tags.length - liveTags.length} archived` : ""})`}>
            {tags.length ? (
              <table className="adm-table adm-table--tight">
                <tbody>
                  {tags.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/admin/cards/${t.id}/`}>{t.label || t.slug}</Link>
                        <span className="adm-muted adm-small"> /t/{t.slug}/</span>
                      </td>
                      <td className="adm-small">{CARD_TYPES[t.type] ?? t.type}</td>
                      <td className="adm-small">{t.orderId ? <Link href={`/admin/orders/${t.orderId}/`}>#{t.orderId}</Link> : null}</td>
                      <td className="adm-small">{t.archived ? <span className="adm-muted">archived</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                None. Assign one from the tag&apos;s page (<Link href="/admin/tags/?status=unassigned">unassigned tags</Link>).
              </p>
            )}
          </Card>
          <Card title={`Entitlements used here (${ents.length})`}>
            {ents.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {ents.map((e) => (
                  <li key={e.id} className="adm-small">
                    {ENTITLEMENT_TYPE_LABEL[e.type] ?? e.type}, {ENTITLEMENT_STATUS_LABEL[e.status] ?? e.status}
                    {e.sourceOrderId ? (
                      <>
                        {" "}
                        from <Link href={`/admin/orders/${e.sourceOrderId}/`}>#{e.sourceOrderId}</Link>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                None.
              </p>
            )}
          </Card>
        </div>

        <div>
          <Card title="Belongs to">
            <form action={saveProfileAdminAction} className="adm-form" style={{ gridTemplateColumns: "1fr" }}>
              <input type="hidden" name="profile_id" value={p.id} />
              <div className="adm-field">
                <label htmlFor="p-owner">Owner&apos;s account email</label>
                <input id="p-owner" name="owner" type="email" defaultValue={owner?.email ?? ""} className="adm-input" />
                <span className="adm-help">The person the profile is about. Blank for a team profile nobody has taken over.</span>
              </div>
              <div className="adm-field">
                <label htmlFor="p-manager">Managed by (account email)</label>
                <input id="p-manager" name="manager" type="email" defaultValue={mgr?.email ?? ""} className="adm-input" />
              </div>
              <div className="adm-field">
                <label htmlFor="p-company">Company (number or address)</label>
                <input id="p-company" name="company" defaultValue={company?.id ?? ""} className="adm-input" />
                <span className="adm-help">Blank for none. Its tags move with it.</span>
              </div>
              <div className="adm-field">
                <label htmlFor="p-type">Type</label>
                <select id="p-type" name="type" defaultValue={p.type} className="adm-select">
                  <option value="standard">Standard</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <div>
                <SubmitButton className="adm-btn adm-btn--primary" busy="Saving…">
                  Save
                </SubmitButton>
              </div>
            </form>
          </Card>
          <Card title={p.archived ? "Archived" : "Archive profile"} className="adm-card--danger">
            {p.archived ? (
              <form action={restoreProfileAction}>
                <input type="hidden" name="profile_id" value={p.id} />
                <p className="adm-small" style={{ marginTop: 0 }}>
                  Its page shows not found while archived.
                </p>
                <SubmitButton busy="Restoring…">Restore profile</SubmitButton>
              </form>
            ) : guard.ok ? (
              <form action={archiveProfileAction}>
                <input type="hidden" name="profile_id" value={p.id} />
                <p className="adm-small" style={{ marginTop: 0 }}>
                  Hides the profile (its page shows not found); it can be restored. Type <strong>{p.slug}</strong> to confirm.
                </p>
                <input name="confirm" className="adm-input" aria-label="Type the profile address to confirm" style={{ width: "100%", marginBottom: 8 }} autoComplete="off" />
                <SubmitButton className="adm-btn adm-btn--danger" busy="Archiving…">
                  Archive profile
                </SubmitButton>
              </form>
            ) : (
              <ul className="adm-blockers">
                {guard.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </Card>
          <AdminLogList entity="profile" id={p.id} />
        </div>
      </div>
    </>
  );
}
