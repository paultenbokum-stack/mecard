import Link from "next/link";
import { and, asc, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Card, Flash, PAGE_SIZE, Pager, pageNumber, SortSelect, Tabs } from "@/components/admin/ui";
import { createUserAction } from "@/lib/admin-user-actions";
import { formatDate } from "@/lib/money";

export const metadata = { title: "Users" };

type Params = AdminSearchParams & { role?: string; sort?: string };

const SORTS: [string, string][] = [
  ["created_desc", "Newest first"],
  ["created_asc", "Oldest first"],
  ["active_desc", "Recently active"],
];

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const role = sp.role === "staff" || sp.role === "customer" ? sp.role : undefined;
  const sort = SORTS.some(([k]) => k === sp.sort) ? sp.sort! : "created_desc";
  const page = pageNumber(sp.page);

  const filters: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    filters.push(
      or(
        ...(/^\d+$/.test(q) ? [eq(users.id, Number(q))] : []),
        ilike(users.email, like),
        ilike(users.username, like),
        ilike(users.displayName, like),
        sql`(${users.firstName} || ' ' || ${users.lastName}) ilike ${like}`,
      )!,
    );
  }
  const base = filters.length ? and(...filters) : undefined;
  const where = role ? and(base, eq(users.isAdmin, role === "staff")) : base;
  const order =
    sort === "created_asc" ? [asc(users.createdAt), asc(users.id)] : sort === "active_desc" ? [sql`${users.lastActiveAt} desc nulls last`, desc(users.id)] : [desc(users.createdAt), desc(users.id)];

  const [rows, [{ total }], counts] = await Promise.all([
    db
      .select({
        u: users,
        profiles: sql<number>`(select count(*)::int from profiles p where p.owner_id = "users"."id" and not p.archived)`,
        orders: sql<number>`(select count(*)::int from orders o where o.user_id = "users"."id")`,
      })
      .from(users)
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(users).where(where),
    db.select({ staff: users.isAdmin, n: sql<number>`count(*)::int` }).from(users).where(base).groupBy(users.isAdmin),
  ]);
  const staffN = counts.find((c) => c.staff)?.n ?? 0;
  const customerN = counts.find((c) => !c.staff)?.n ?? 0;
  const qs = (extra: Record<string, string | undefined>) =>
    `?${new URLSearchParams(Object.fromEntries(Object.entries({ q, sort: sort !== "created_desc" ? sort : undefined, ...extra }).filter((e): e is [string, string] => !!e[1])))}`;

  return (
    <>
      <AdminHeader title="Users" />
      <Flash saved={sp.saved} error={sp.error} />
      <Tabs
        tabs={[
          { href: qs({}), label: "All", count: staffN + customerN, active: !role },
          { href: qs({ role: "customer" }), label: "Customers", count: customerN, active: role === "customer" },
          { href: qs({ role: "staff" }), label: "Staff", count: staffN, active: role === "staff" },
        ]}
      />
      <form className="adm-filters" role="search">
        {role ? <input type="hidden" name="role" value={role} /> : null}
        <input type="search" name="q" defaultValue={q} placeholder="Email, name, username or account number" aria-label="Search accounts" className="adm-input" />
        <SortSelect value={sort} options={SORTS} />
        <button className="adm-btn">Show</button>
        {q ? (
          <Link href={qs({ q: undefined, role })} className="adm-link">
            Clear
          </Link>
        ) : null}
      </form>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Role</th>
              <th className="adm-num">Profiles</th>
              <th className="adm-num">Orders</th>
              <th>Joined</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ u, profiles, orders }) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/admin/users/${u.id}/`}>
                    <strong>{u.displayName || `${u.firstName} ${u.lastName}`.trim() || u.email}</strong>
                  </Link>
                  <div className="adm-muted adm-small">
                    {u.email}
                    {u.username && u.username !== u.email ? ` · ${u.username}` : ""} · #{u.id}
                  </div>
                </td>
                <td>{u.isAdmin ? <Badge status="processing">Staff</Badge> : <span className="adm-muted adm-small">Customer</span>}</td>
                <td className="adm-num">{profiles}</td>
                <td className="adm-num">{orders}</td>
                <td className="adm-small adm-nowrap">{formatDate(u.createdAt)}</td>
                <td className="adm-small adm-nowrap">{u.lastActiveAt ? formatDate(u.lastActiveAt) : "–"}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="adm-muted">
                  No accounts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} params={{ q, role, sort: sort !== "created_desc" ? sort : undefined }} />

      <div style={{ maxWidth: 780, marginTop: 18 }}>
        <Card title="New account">
          <form action={createUserAction} className="adm-form">
            <div className="adm-field">
              <label htmlFor="nu-first">First name</label>
              <input id="nu-first" name="first_name" className="adm-input" />
            </div>
            <div className="adm-field">
              <label htmlFor="nu-last">Last name</label>
              <input id="nu-last" name="last_name" className="adm-input" />
            </div>
            <div className="adm-field">
              <label htmlFor="nu-email">Email *</label>
              <input id="nu-email" name="email" type="email" required className="adm-input" />
            </div>
            <div className="adm-field">
              <label htmlFor="nu-role">Role</label>
              <select id="nu-role" name="role" className="adm-select" defaultValue="customer">
                <option value="customer">Customer</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div className="adm-field adm-field--full">
              <div className="adm-checkrow">
                <input id="nu-reset" name="send_reset" type="checkbox" defaultChecked className="adm-check" />
                <label htmlFor="nu-reset">Email them a link to set their password</label>
              </div>
            </div>
            <div className="adm-field--full">
              <SubmitButton className="adm-btn adm-btn--primary" busy="Creating…">
                Create account
              </SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
