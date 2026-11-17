import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { carts, events, profiles, users } from "@/db/schema";
import { AdminHeader, Badge } from "@/components/admin/ui";
import { BASKET_EXPIRES_AFTER, DAY, HOUR, lastReminderLabel, REMINDER_PRODUCTS } from "@/lib/automation-rules";
import { cartView } from "@/lib/cart";
import { formatDate, rands } from "@/lib/money";

export const metadata = { title: "Baskets" };
export const dynamic = "force-dynamic";

function ago(ms: number) {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))} min ago`;
  if (ms < DAY) return `${Math.round(ms / HOUR)} h ago`;
  const d = Math.floor(ms / DAY);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function left(ms: number) {
  if (ms <= 0) return "at the next run";
  if (ms < DAY) return `in ${Math.max(1, Math.round(ms / HOUR))} h`;
  const d = Math.round(ms / DAY);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

// Open baskets (AutomateWoo's Carts view): every account with something in its
// basket, newest change first. The hourly automations job sends the reminders
// and empties a basket 7 days after it last changed (src/lib/automations.ts).
export default async function AdminBaskets() {
  const rows = await db
    .select({ userId: carts.userId, items: carts.items, couponCode: carts.couponCode, sent: carts.remindersSent, updatedAt: carts.updatedAt, email: users.email, firstName: users.firstName, lastName: users.lastName })
    .from(carts)
    .innerJoin(users, eq(users.id, carts.userId))
    .where(sql`jsonb_array_length(${carts.items}) > 0`)
    .orderBy(desc(carts.updatedAt));

  const userIds = rows.map((r) => r.userId);
  const views = await Promise.all(userIds.map((id) => cartView(id)));
  const profileIds = [...new Set(rows.flatMap((r) => r.items.map((l) => l.profileId)).filter((x): x is number => !!x))];
  const names = profileIds.length
    ? new Map((await db.select({ id: profiles.id, f: profiles.firstName, l: profiles.lastName }).from(profiles).where(inArray(profiles.id, profileIds))).map((p) => [p.id, `${p.f} ${p.l}`.trim()]))
    : new Map<number, string>();
  const checkouts = userIds.length
    ? new Map(
        (
          await db
            .select({ userId: events.userId, at: sql<Date>`max(${events.createdAt})`.mapWith((v) => new Date(v)) })
            .from(events)
            .where(and(eq(events.name, "checkout_started"), inArray(events.userId, userIds)))
            .groupBy(events.userId)
        ).map((e) => [e.userId!, e.at]),
      )
    : new Map<number, Date>();

  const now = new Date().getTime();
  const totalCents = views.reduce((n, v) => n + v.subtotalCents, 0);

  return (
    <>
      <AdminHeader title="Baskets" />
      <p className="adm-muted">
        Accounts with something in their basket. Reminders go out after 15 minutes (cards only), 1 day and 5 days, and a basket is emptied 7 days after it last changed.
      </p>
      <div className="adm-stats">
        <div className="adm-stat">
          <strong>{rows.length}</strong>
          <span>open baskets</span>
        </div>
        <div className="adm-stat">
          <strong>{rands(totalCents)}</strong>
          <span>in baskets</span>
        </div>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Items</th>
              <th className="adm-num">Value</th>
              <th>Last changed</th>
              <th>Checkout</th>
              <th>Reminder sent</th>
              <th>Emptied</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const v = views[i];
              const age = now - r.updatedAt.getTime();
              const last = lastReminderLabel(r.sent);
              const hasCards = r.items.some((l) => REMINDER_PRODUCTS.includes(l.productId));
              const checkout = checkouts.get(r.userId);
              return (
                <tr key={r.userId}>
                  <td>
                    <Link href={`/admin/users/${r.userId}/`}>
                      <strong>{`${r.firstName} ${r.lastName}`.trim() || r.email}</strong>
                    </Link>
                    <div className="adm-muted adm-small">{r.email}</div>
                  </td>
                  <td className="adm-small">
                    {v.lines.map((l) => (
                      <div key={l.key}>
                        {l.qty} × {l.product.name}
                        {l.profileId ? <span className="adm-muted"> for {names.get(l.profileId) || `profile ${l.profileId}`}</span> : null}
                        {l.quoteId ? <span className="adm-muted"> (quote {l.quoteId})</span> : null}
                      </div>
                    ))}
                    {r.couponCode ? <div className="adm-muted">Coupon {r.couponCode}</div> : null}
                  </td>
                  <td className="adm-num">{rands(v.subtotalCents)}</td>
                  <td className="adm-small" title={formatDate(r.updatedAt, true)}>
                    {ago(age)}
                  </td>
                  <td className="adm-small">{checkout && checkout.getTime() >= r.updatedAt.getTime() - DAY ? `Started ${ago(now - checkout.getTime())}` : <span className="adm-muted">Not started</span>}</td>
                  <td>{last ? <Badge status="processing">{last}</Badge> : <span className="adm-muted adm-small">{hasCards || age >= DAY ? "None yet" : "None yet (first after 1 day)"}</span>}</td>
                  <td className="adm-small">{left(BASKET_EXPIRES_AFTER - age)}</td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="adm-muted">
                  No open baskets.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
