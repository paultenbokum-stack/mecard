import Link from "next/link";
import { asc, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, users } from "@/db/schema";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Card, Flash, PAGE_SIZE, Pager, pageNumber, SortSelect } from "@/components/admin/ui";
import { createCompanyAction } from "@/lib/admin-company-actions";
import { formatDate } from "@/lib/money";

export const metadata = { title: "Companies" };

type Params = AdminSearchParams & { sort?: string };

const SORTS: [string, string][] = [
  ["created_desc", "Newest first"],
  ["created_asc", "Oldest first"],
  ["updated_desc", "Recently changed"],
  ["profiles_desc", "Most profiles"],
];

export default async function AdminCompanies({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const sort = SORTS.some(([k]) => k === sp.sort) ? sp.sort! : "created_desc";
  const page = pageNumber(sp.page);
  const profileCount = sql<number>`(select count(*)::int from profiles p where p.company_id = "companies"."id" and not p.archived)`;
  const cardCount = sql<number>`(select count(*)::int from cards k where k.company_id = "companies"."id" and not k.archived)`;
  let where: SQL | undefined;
  if (q) {
    const like = `%${q}%`;
    where = or(...(/^\d+$/.test(q) ? [eq(companies.id, Number(q))] : []), ilike(companies.name, like), ilike(companies.slug, like), ilike(users.email, like));
  }
  const order =
    sort === "created_asc" ? [asc(companies.id)] : sort === "updated_desc" ? [desc(companies.updatedAt)] : sort === "profiles_desc" ? [desc(profileCount), desc(companies.id)] : [desc(companies.id)];
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ c: companies, ownerEmail: users.email, ownerName: users.displayName, profiles: profileCount, cards: cardCount })
      .from(companies)
      .leftJoin(users, eq(users.id, companies.ownerId))
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(companies).leftJoin(users, eq(users.id, companies.ownerId)).where(where),
  ]);

  return (
    <>
      <AdminHeader title="Companies" />
      <Flash saved={sp.saved} error={sp.error} />
      <form className="adm-filters" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Name, address, owner email or number" aria-label="Search companies" className="adm-input" />
        <SortSelect value={sort} options={SORTS} />
        <button className="adm-btn">Show</button>
        {q ? (
          <Link href={sort !== "created_desc" ? `?sort=${sort}` : "?"} className="adm-link">
            Clear
          </Link>
        ) : null}
      </form>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Owner</th>
              <th className="adm-num">Profiles</th>
              <th className="adm-num">Tags</th>
              <th>Created</th>
              <th>Changed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, ownerEmail, ownerName, profiles, cards }) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/companies/${c.id}/`}>
                    <strong>{c.name}</strong>
                  </Link>
                  <div className="adm-muted adm-small">
                    {c.slug} · #{c.id}
                  </div>
                </td>
                <td className="adm-small">{c.ownerId ? <Link href={`/admin/users/${c.ownerId}/`}>{ownerName || ownerEmail}</Link> : <span className="adm-muted">–</span>}</td>
                <td className="adm-num">{profiles}</td>
                <td className="adm-num">{cards}</td>
                <td className="adm-small adm-nowrap">{formatDate(c.createdAt)}</td>
                <td className="adm-small adm-nowrap">{formatDate(c.updatedAt)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="adm-muted">
                  No companies found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} params={{ q, sort: sort !== "created_desc" ? sort : undefined }} />
      <div style={{ maxWidth: 780, marginTop: 18 }}>
        <Card title="New company">
          <form action={createCompanyAction} className="adm-form">
            <div className="adm-field">
              <label htmlFor="nc-name">Name *</label>
              <input id="nc-name" name="name" required className="adm-input" />
            </div>
            <div className="adm-field">
              <label htmlFor="nc-owner">Owner&apos;s email *</label>
              <input id="nc-owner" name="owner" type="email" required className="adm-input" />
            </div>
            <div className="adm-field--full">
              <SubmitButton className="adm-btn adm-btn--primary" busy="Creating…">
                Create company
              </SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
