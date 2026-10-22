import Link from "next/link";
import { and, asc, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, profiles, users } from "@/db/schema";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Card, Flash, PAGE_SIZE, Pager, pageNumber, SortSelect, Tabs } from "@/components/admin/ui";
import { createProfileAction } from "@/lib/admin-profile-actions";
import { formatDate } from "@/lib/money";

export const metadata = { title: "Profiles" };

type Params = AdminSearchParams & { status?: string; type?: string; company?: string; sort?: string };

const SORTS: [string, string][] = [
  ["created_desc", "Newest first"],
  ["created_asc", "Oldest first"],
  ["updated_desc", "Recently changed"],
];

export default async function AdminProfiles({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const archived = sp.status === "archived";
  const type = sp.type === "pro" || sp.type === "standard" ? sp.type : undefined;
  const companyId = sp.company && /^\d+$/.test(sp.company) ? Number(sp.company) : undefined;
  const sort = SORTS.some(([k]) => k === sp.sort) ? sp.sort! : "created_desc";
  const page = pageNumber(sp.page);

  const filters: SQL[] = [];
  if (type) filters.push(eq(profiles.type, type));
  if (companyId) filters.push(eq(profiles.companyId, companyId));
  if (q) {
    const like = `%${q}%`;
    filters.push(
      or(
        ...(/^\d+$/.test(q) ? [eq(profiles.id, Number(q))] : []),
        ilike(profiles.slug, like),
        ilike(profiles.email, like),
        ilike(profiles.jobTitle, like),
        ilike(companies.name, like),
        ilike(profiles.companyName, like),
        ilike(users.email, like),
        sql`(${profiles.firstName} || ' ' || ${profiles.lastName}) ilike ${like}`,
      )!,
    );
  }
  const base = filters.length ? and(...filters) : undefined;
  const where = and(base, eq(profiles.archived, archived));
  const order = sort === "created_asc" ? [asc(profiles.id)] : sort === "updated_desc" ? [desc(profiles.updatedAt), desc(profiles.id)] : [desc(profiles.id)];
  const select = () =>
    db
      .select({
        p: profiles,
        company: companies.name,
        ownerEmail: users.email,
        ownerName: users.displayName,
        tags: sql<number>`(select count(*)::int from cards k where k.profile_id = "profiles"."id" and not k.archived)`,
      })
      .from(profiles)
      .leftJoin(companies, eq(companies.id, profiles.companyId))
      .leftJoin(users, eq(users.id, profiles.ownerId));
  const count = (w: SQL | undefined) =>
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(profiles)
      .leftJoin(companies, eq(companies.id, profiles.companyId))
      .leftJoin(users, eq(users.id, profiles.ownerId))
      .where(w)
      .then((r) => r[0].n);
  const [rows, total, liveN, archivedN, companyName] = await Promise.all([
    select().where(where).orderBy(...order).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    count(where),
    count(and(base, eq(profiles.archived, false))),
    count(and(base, eq(profiles.archived, true))),
    companyId ? db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).then((r) => r[0]?.name ?? `company ${companyId}`) : Promise.resolve(null),
  ]);
  const keep = { q, type, company: companyId ? String(companyId) : undefined, sort: sort !== "created_desc" ? sort : undefined };
  const qs = (extra: Record<string, string | undefined>) =>
    `?${new URLSearchParams(Object.fromEntries(Object.entries({ ...keep, ...extra }).filter((e): e is [string, string] => !!e[1])))}`;

  return (
    <>
      <AdminHeader title="Profiles" />
      <Flash saved={sp.saved} error={sp.error} />
      <Tabs
        tabs={[
          { href: qs({}), label: "Live", count: liveN, active: !archived },
          { href: qs({ status: "archived" }), label: "Archived", count: archivedN, active: archived },
        ]}
      />
      <form className="adm-filters" role="search">
        {archived ? <input type="hidden" name="status" value="archived" /> : null}
        {companyId ? <input type="hidden" name="company" value={companyId} /> : null}
        <input type="search" name="q" defaultValue={q} placeholder="Name, address, email, job, company, owner or number" aria-label="Search profiles" className="adm-input" />
        <select name="type" defaultValue={type ?? ""} className="adm-select" aria-label="Type">
          <option value="">Pro and standard</option>
          <option value="pro">Pro</option>
          <option value="standard">Standard</option>
        </select>
        <SortSelect value={sort} options={SORTS} />
        <button className="adm-btn">Show</button>
        {companyName ? (
          <span className="adm-small">
            In {companyName} · <Link href={qs({ company: undefined, status: archived ? "archived" : undefined })}>all companies</Link>
          </span>
        ) : null}
      </form>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Profile</th>
              <th>Company</th>
              <th>Owner</th>
              <th>Type</th>
              <th className="adm-num">Tags</th>
              <th>Created</th>
              <th>Changed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, company, ownerEmail, ownerName, tags }) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/profiles/${p.id}/`}>
                    <strong>{`${p.firstName} ${p.lastName}`.trim() || `Profile ${p.id}`}</strong>
                  </Link>
                  <div className="adm-muted adm-small">
                    {p.jobTitle ? `${p.jobTitle} · ` : ""}
                    {p.slug} · #{p.id}
                  </div>
                </td>
                <td className="adm-small">{p.companyId ? <Link href={`/admin/companies/${p.companyId}/`}>{company}</Link> : <span className="adm-muted">{p.companyName || "–"}</span>}</td>
                <td className="adm-small">{p.ownerId ? <Link href={`/admin/users/${p.ownerId}/`}>{ownerName || ownerEmail}</Link> : <span className="adm-muted">–</span>}</td>
                <td>{p.type === "pro" ? <Badge status="processing">Pro</Badge> : <span className="adm-small adm-muted">Standard</span>}</td>
                <td className="adm-num">{tags}</td>
                <td className="adm-small adm-nowrap">{formatDate(p.createdAt)}</td>
                <td className="adm-small adm-nowrap">{formatDate(p.updatedAt)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="adm-muted">
                  No profiles found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} params={{ ...keep, status: archived ? "archived" : undefined }} />
      <div style={{ maxWidth: 780, marginTop: 18 }}>
        <Card title="New profile">
          <form action={createProfileAction} className="adm-form">
            <div className="adm-field">
              <label htmlFor="np-first">First name *</label>
              <input id="np-first" name="first_name" required className="adm-input" />
            </div>
            <div className="adm-field">
              <label htmlFor="np-last">Last name</label>
              <input id="np-last" name="last_name" className="adm-input" />
            </div>
            <div className="adm-field">
              <label htmlFor="np-owner">Owner&apos;s account email *</label>
              <input id="np-owner" name="owner" type="email" required className="adm-input" />
            </div>
            <div className="adm-field">
              <label htmlFor="np-email">Email shown on the profile</label>
              <input id="np-email" name="email" type="email" className="adm-input" />
            </div>
            <div className="adm-field">
              <label htmlFor="np-company">Company (number or address, optional)</label>
              <input id="np-company" name="company" defaultValue={companyId ?? ""} className="adm-input" />
            </div>
            <div className="adm-field" style={{ justifyContent: "flex-end" }}>
              <SubmitButton className="adm-btn adm-btn--primary" busy="Creating…">
                Create profile
              </SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
