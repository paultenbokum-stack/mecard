import Link from "next/link";
import { and, desc, eq, inArray, not, ilike, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { orders, quotes } from "@/db/schema";
import { AdminHeader, Badge, Card } from "@/components/admin/ui";
import { cardStageCounts } from "@/lib/admin-card-queries";
import { formatDate, ORDER_STATUS_LABEL, rands } from "@/lib/money";

export const metadata = { title: "Dashboard" };

// What needs doing today: paid orders to fulfil, EFTs to check, cards at each
// production step, quotes waiting.
export default async function AdminHome() {
  const [byStatus, stages, [{ openQuotes }], recent] = await Promise.all([
    db
      .select({ status: orders.status, n: sql<number>`count(*)::int` })
      .from(orders)
      .where(inArray(orders.status, ["processing", "on-hold", "pending"]))
      .groupBy(orders.status),
    cardStageCounts(),
    db
      .select({ openQuotes: sql<number>`count(*)::int` })
      .from(quotes)
      .where(and(eq(quotes.status, "sent"), sql`${quotes.expiresAt} > now()`)),
    db.select().from(orders).where(not(ilike(orders.status, "ywraq-%"))).orderBy(desc(orders.id)).limit(8),
  ]);
  const n = (s: string) => byStatus.find((b) => b.status === s)?.n ?? 0;
  const stats: [number, string, string][] = [
    [n("processing"), "Paid orders to fulfil", "/admin/orders/?status=processing"],
    [n("on-hold"), "EFT orders waiting for payment", "/admin/orders/?status=on-hold"],
    [stages.check, "Card designs to check", "/admin/cards/?stage=check"],
    [stages.print, "Cards to print", "/admin/cards/?stage=print"],
    [stages.encode, "Cards to encode", "/admin/cards/?stage=encode"],
    [stages.pack, "Cards to package", "/admin/cards/?stage=pack"],
    [stages.ship, "Packaged, to ship", "/admin/cards/?stage=ship"],
    [openQuotes, "Open quotes", "/admin/quotes/?status=sent"],
  ];

  return (
    <>
      <AdminHeader title="Dashboard" />
      <div className="adm-stats">
        {stats.map(([value, label, href]) => (
          <Link key={href} href={href} className="adm-stat">
            <strong>{value}</strong>
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <Card title="Latest orders">
        <div className="adm-table-wrap">
          <table className="adm-table adm-table--tight">
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}/`}>#{o.id}</Link>
                  </td>
                  <td className="adm-small adm-nowrap">{formatDate(o.createdAt, true)}</td>
                  <td>{`${o.billingFirstName} ${o.billingLastName}`.trim() || o.billingEmail}</td>
                  <td className="adm-num">{rands(o.totalCents)}</td>
                  <td>
                    <Badge status={o.status}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
