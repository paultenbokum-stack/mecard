import Link from "next/link";
import { and, asc, desc, eq, ilike, isNotNull, isNull, ne, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, companies, profiles, users } from "@/db/schema";
import { CARD_TYPES } from "@/components/account/Bits";
import { AdminHeader, type AdminSearchParams, Flash, PAGE_SIZE, Pager, pageNumber, SortSelect, Tabs } from "@/components/admin/ui";
import { formatDate } from "@/lib/money";

export const metadata = { title: "Tags" };

type Params = AdminSearchParams & { status?: string; type?: string; sort?: string };

// Every card and tag (cards table), whatever its production step: the list to
// find one, see where it points and manage it. Card processing is the
// production view of the same records.
const STATUSES = {
  assigned: { label: "Assigned", where: and(eq(cards.archived, false), isNotNull(cards.profileId), or(isNull(cards.cartItemKey), eq(cards.cartItemKey, ""))) },
  unassigned: { label: "Unassigned", where: and(eq(cards.archived, false), isNull(cards.profileId), or(isNull(cards.cartItemKey), eq(cards.cartItemKey, ""))) },
  basket: { label: "In a basket", where: and(eq(cards.archived, false), isNotNull(cards.cartItemKey), ne(cards.cartItemKey, "")) },
  archived: { label: "Archived", where: eq(cards.archived, true) },
} as const;
type Status = keyof typeof STATUSES;

const SORTS: [string, string][] = [
  ["created_desc", "Newest first"],
  ["created_asc", "Oldest first"],
  ["updated_desc", "Recently changed"],
];

export default async function AdminTags({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const status = sp.status && sp.status in STATUSES ? (sp.status as Status) : undefined;
  const type = sp.type && sp.type in CARD_TYPES ? sp.type : undefined;
  const sort = SORTS.some(([k]) => k === sp.sort) ? sp.sort! : "created_desc";
  const page = pageNumber(sp.page);

  const filters: SQL[] = [];
  if (type) filters.push(eq(cards.type, type));
  if (q) {
    const like = `%${q}%`;
    filters.push(
      or(
        ...(/^\d+$/.test(q) ? [eq(cards.id, Number(q)), eq(cards.orderId, Number(q)), eq(cards.profileId, Number(q))] : []),
        ilike(cards.slug, like),
        ilike(cards.label, like),
        ilike(users.email, like),
        ilike(companies.name, like),
        sql`(${profiles.firstName} || ' ' || ${profiles.lastName}) ilike ${like}`,
      )!,
    );
  }
  const base = filters.length ? and(...filters) : undefined;
  const where = status ? and(base, STATUSES[status].where) : and(base, eq(cards.archived, false));
  const order = sort === "created_asc" ? [asc(cards.id)] : sort === "updated_desc" ? [desc(cards.updatedAt), desc(cards.id)] : [desc(cards.id)];
  const from = () =>
    db
      .select({ c: cards, ownerEmail: users.email, ownerName: users.displayName, first: profiles.firstName, last: profiles.lastName, company: companies.name })
      .from(cards)
      .leftJoin(users, eq(users.id, cards.ownerId))
      .leftJoin(profiles, eq(profiles.id, cards.profileId))
      .leftJoin(companies, eq(companies.id, cards.companyId));
  const count = (w: SQL | undefined) =>
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(cards)
      .leftJoin(users, eq(users.id, cards.ownerId))
      .leftJoin(profiles, eq(profiles.id, cards.profileId))
      .leftJoin(companies, eq(companies.id, cards.companyId))
      .where(w)
      .then((r) => r[0].n);

  const [rows, total, ...tabCounts] = await Promise.all([
    from().where(where).orderBy(...order).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    count(where),
    count(and(base, eq(cards.archived, false))),
    ...(Object.keys(STATUSES) as Status[]).map((s) => count(and(base, STATUSES[s].where))),
  ]);
  const qs = (extra: Record<string, string | undefined>) =>
    `?${new URLSearchParams(Object.fromEntries(Object.entries({ q, type, sort: sort !== "created_desc" ? sort : undefined, ...extra }).filter((e): e is [string, string] => !!e[1])))}`;

  return (
    <>
      <AdminHeader title="Tags">
        <Link href="/admin/cards/" className="adm-btn">
          Card processing
        </Link>
      </AdminHeader>
      <Flash saved={sp.saved} error={sp.error} />
      <Tabs
        tabs={[
          { href: qs({}), label: "All live", count: tabCounts[0], active: !status },
          ...(Object.keys(STATUSES) as Status[]).map((s, i) => ({ href: qs({ status: s }), label: STATUSES[s].label, count: tabCounts[i + 1], active: status === s })),
        ]}
      />
      <form className="adm-filters" role="search">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <input type="search" name="q" defaultValue={q} placeholder="Code, label, owner email, profile, company or number" aria-label="Search tags" className="adm-input" />
        <select name="type" defaultValue={type ?? ""} className="adm-select" aria-label="Type">
          <option value="">All types</option>
          {Object.entries(CARD_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <SortSelect value={sort} options={SORTS} />
        <button className="adm-btn">Show</button>
        {q || type ? (
          <Link href={qs({ q: undefined, type: undefined, status })} className="adm-link">
            Clear
          </Link>
        ) : null}
      </form>
      <div className="adm-table-wrap">
        <table className="adm-table adm-table--tight">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Type</th>
              <th>Profile</th>
              <th>Company</th>
              <th>Owner</th>
              <th>Order</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, ownerEmail, ownerName, first, last, company }) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/cards/${c.id}/`}>
                    <strong>{c.label || c.slug}</strong>
                  </Link>
                  <div className="adm-muted adm-small">
                    /t/{c.slug}/ · #{c.id}
                    {c.archived ? " · archived" : c.cartItemKey ? " · in a basket" : ""}
                  </div>
                </td>
                <td className="adm-small">{CARD_TYPES[c.type] ?? c.type}</td>
                <td className="adm-small">{c.profileId ? <Link href={`/admin/profiles/${c.profileId}/`}>{`${first ?? ""} ${last ?? ""}`.trim() || `Profile ${c.profileId}`}</Link> : <span className="adm-muted">–</span>}</td>
                <td className="adm-small">{c.companyId ? <Link href={`/admin/companies/${c.companyId}/`}>{company ?? c.companyId}</Link> : <span className="adm-muted">–</span>}</td>
                <td className="adm-small">{c.ownerId ? <Link href={`/admin/users/${c.ownerId}/`}>{ownerName || ownerEmail}</Link> : <span className="adm-muted">–</span>}</td>
                <td className="adm-small">{c.orderId ? <Link href={`/admin/orders/${c.orderId}/`}>#{c.orderId}</Link> : <span className="adm-muted">–</span>}</td>
                <td className="adm-small adm-nowrap">{formatDate(c.createdAt)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="adm-muted">
                  No tags found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} params={{ q, type, status, sort: sort !== "created_desc" ? sort : undefined }} />
    </>
  );
}
