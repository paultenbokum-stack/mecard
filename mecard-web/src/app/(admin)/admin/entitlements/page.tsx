import Link from "next/link";
import { and, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { entitlements, profiles, users } from "@/db/schema";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Card, Flash, PAGE_SIZE, Pager, pageNumber, SearchBox, Tabs } from "@/components/admin/ui";
import { grantProUpgradeAction, setEntitlementStatusAction } from "@/lib/admin-entitlement-actions";
import { ENTITLEMENT_STATUS_LABEL, ENTITLEMENT_TYPE_LABEL } from "@/lib/entitlement-labels";
import { formatDate } from "@/lib/money";

export const metadata = { title: "Entitlements" };

type Params = AdminSearchParams & { status?: string; type?: string; order?: string };

// What customers have paid for and how it was used: Pro upgrades, and the
// card credits bundles and card orders create.
export default async function AdminEntitlements({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const status = sp.status && sp.status in ENTITLEMENT_STATUS_LABEL ? sp.status : undefined;
  const type = sp.type && sp.type in ENTITLEMENT_TYPE_LABEL ? sp.type : undefined;
  const order = sp.order && /^\d+$/.test(sp.order) ? sp.order : undefined;
  const q = sp.q?.trim() || undefined;
  const page = pageNumber(sp.page);

  const filters: SQL[] = [];
  if (type) filters.push(eq(entitlements.type, type));
  if (order) filters.push(eq(entitlements.sourceOrderId, Number(order)));
  if (q) {
    const like = `%${q}%`;
    filters.push(or(...(/^\d+$/.test(q) ? [eq(entitlements.id, Number(q)), eq(entitlements.sourceOrderId, Number(q))] : []), ilike(users.email, like), ilike(users.displayName, like))!);
  }
  const base = filters.length ? and(...filters) : undefined;
  const where = status ? and(base, eq(entitlements.status, status)) : base;

  const [rows, [{ total }], counts] = await Promise.all([
    db
      .select({ e: entitlements, email: users.email, owner: users.displayName, first: profiles.firstName, last: profiles.lastName })
      .from(entitlements)
      .leftJoin(users, eq(users.id, entitlements.ownerId))
      .leftJoin(profiles, eq(profiles.id, entitlements.assignedProfileId))
      .where(where)
      .orderBy(desc(entitlements.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(entitlements).leftJoin(users, eq(users.id, entitlements.ownerId)).where(where),
    db
      .select({ status: entitlements.status, n: sql<number>`count(*)::int` })
      .from(entitlements)
      .leftJoin(users, eq(users.id, entitlements.ownerId))
      .where(base)
      .groupBy(entitlements.status),
  ]);
  const countOf = new Map(counts.map((c) => [c.status, c.n]));
  const keep = { type, order, q };
  const qs = (extra: Record<string, string | undefined>) =>
    `?${new URLSearchParams(Object.fromEntries(Object.entries({ ...keep, ...extra }).filter((e): e is [string, string] => !!e[1])))}`;
  const here = `/admin/entitlements/${qs({ status, page: page > 1 ? String(page) : undefined })}`;

  return (
    <>
      <AdminHeader title="Entitlements" />
      <Flash saved={sp.saved} error={sp.error} />
      <Tabs
        tabs={[
          { href: qs({}), label: "All", count: counts.reduce((t, c) => t + c.n, 0), active: !status },
          ...Object.entries(ENTITLEMENT_STATUS_LABEL)
            .filter(([s]) => countOf.get(s))
            .map(([s, label]) => ({ href: qs({ status: s }), label, count: countOf.get(s), active: status === s })),
        ]}
      />
      <div className="adm-search">
        <SearchBox q={q} placeholder="Customer email or name, order or entitlement number" keep={{ status, type, order }} />
        <form className="adm-inline" style={{ marginBottom: 12 }}>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {order ? <input type="hidden" name="order" value={order} /> : null}
          <select name="type" defaultValue={type ?? ""} className="adm-select" aria-label="Type">
            <option value="">All types</option>
            {Object.entries(ENTITLEMENT_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="adm-btn">Filter</button>
        </form>
        {order ? (
          <span className="adm-small">
            Order #{order} · <Link href={qs({ order: undefined, status })}>all orders</Link>
          </span>
        ) : null}
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table adm-table--tight">
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Order</th>
              <th>Used on</th>
              <th>Dates</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, email, owner, first, last }) => {
              const changes = (e.meta?.adminChanges as { at: string; note: string }[] | undefined) ?? [];
              return (
                <tr key={e.id}>
                  <td className="adm-small">{e.id}</td>
                  <td className="adm-small">
                    {owner || email || `user ${e.ownerId}`}
                    <div className="adm-muted">{email}</div>
                  </td>
                  <td className="adm-small">
                    {ENTITLEMENT_TYPE_LABEL[e.type] ?? e.type}
                    {e.groupKey ? <div className="adm-muted">bundle</div> : null}
                  </td>
                  <td className="adm-small">
                    {e.sourceOrderId ? <Link href={`/admin/orders/${e.sourceOrderId}/`}>#{e.sourceOrderId}</Link> : e.meta?.grantedBy ? "given by staff" : "—"}
                  </td>
                  <td className="adm-small">
                    {e.assignedProfileId ? `${`${first ?? ""} ${last ?? ""}`.trim() || "Profile"} (${e.assignedProfileId})` : null}
                    {e.assignedCardId ?? e.assignedTagId ? (
                      <div>
                        <Link href={`/admin/cards/${e.assignedCardId ?? e.assignedTagId}/`}>Card {e.assignedCardId ?? e.assignedTagId}</Link>
                      </div>
                    ) : null}
                    {!e.assignedProfileId && !e.assignedCardId && !e.assignedTagId ? <span className="adm-muted">—</span> : null}
                  </td>
                  <td className="adm-small adm-nowrap">
                    {formatDate(e.createdAt)}
                    {e.consumedAt ? <div className="adm-muted">used {formatDate(e.consumedAt)}</div> : null}
                    {changes.length ? <div className="adm-muted" title={changes.map((c) => `${c.at.slice(0, 10)} ${c.note}`).join("\n")}>{changes.length} staff change{changes.length === 1 ? "" : "s"}</div> : null}
                  </td>
                  <td>
                    <form action={setEntitlementStatusAction} className="adm-inline">
                      <input type="hidden" name="entitlement_id" value={e.id} />
                      <input type="hidden" name="back" value={here} />
                      <Badge status={e.status}>{ENTITLEMENT_STATUS_LABEL[e.status] ?? e.status}</Badge>
                      <select name="status" defaultValue={e.status} className="adm-select adm-input--sm" aria-label={`Status of entitlement ${e.id}`}>
                        {Object.entries(ENTITLEMENT_STATUS_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <SubmitButton className="adm-btn adm-btn--sm" confirm={`Change entitlement ${e.id}?`}>
                        Change
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="adm-muted">
                  No entitlements found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} params={{ status, type, order, q }} />

      <div style={{ maxWidth: 780, marginTop: 18 }}>
        <Card title="Give Pro upgrades">
          <form action={grantProUpgradeAction} className="adm-form">
            <input type="hidden" name="back" value={here} />
            <div className="adm-field">
              <label htmlFor="g-email">Customer email</label>
              <input id="g-email" name="email" type="email" required className="adm-input" />
            </div>
            <div className="adm-field">
              <label htmlFor="g-count">How many</label>
              <input id="g-count" name="count" type="number" min={1} max={50} defaultValue={1} className="adm-input adm-input--num" />
            </div>
            <div className="adm-field adm-field--full">
              <label htmlFor="g-reason">Why</label>
              <input id="g-reason" name="reason" required className="adm-input" placeholder="e.g. paid by EFT outside the shop, goodwill" />
            </div>
            <div className="adm-field--full">
              <SubmitButton className="adm-btn adm-btn--primary" busy="Giving…">
                Give
              </SubmitButton>
            </div>
          </form>
          <p className="adm-help" style={{ marginBottom: 0 }}>
            The customer can then upgrade that many profiles to Pro from their account, as if they had bought them. Setting a row back to Paid, not used frees it
            for another profile; it doesn&apos;t downgrade the profile it was used on.
          </p>
        </Card>
      </div>
    </>
  );
}
