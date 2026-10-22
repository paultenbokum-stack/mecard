import Link from "next/link";
import { BarChart } from "@/components/admin/BarChart";
import { AdminHeader, Card, Tabs } from "@/components/admin/ui";
import { adminStats, type Count } from "@/lib/admin-stats";
import { formatDate, rands } from "@/lib/money";
import { bucketKeys, change, RANGES, statsRange } from "@/lib/stats-range";

export const metadata = { title: "Stats" };

type Params = { range?: string; from?: string; to?: string };

function Delta({ now, before }: { now: number; before: number }) {
  const c = change(now, before);
  if (c === null) return <span className="adm-delta">no earlier data</span>;
  return (
    <span className={`adm-delta ${c > 0 ? "adm-delta--up" : c < 0 ? "adm-delta--down" : ""}`}>
      {c > 0 ? "+" : ""}
      {c}% vs previous
    </span>
  );
}

function Tile({ label, value, now, before, note }: { label: string; value: string; now?: number; before?: number; note?: string }) {
  return (
    <div className="adm-stat">
      <strong>{value}</strong>
      <span>{label}</span>
      {now !== undefined && before !== undefined ? <Delta now={now} before={before} /> : null}
      {note ? <span className="adm-delta">{note}</span> : null}
    </div>
  );
}

function Breakdown({ title, rows, empty = "Nothing in this period." }: { title: string; rows: Count[]; empty?: string }) {
  const total = rows.reduce((t, r) => t + r.n, 0);
  return (
    <Card title={title}>
      {rows.length ? (
        <table className="adm-table adm-table--tight">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="adm-num">{r.n.toLocaleString("en-ZA")}</td>
                <td className="adm-num adm-muted adm-small">{total ? `${Math.round((r.n / total) * 100)}%` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="adm-muted" style={{ margin: 0 }}>
          {empty}
        </p>
      )}
    </Card>
  );
}

// The plugin's MeCard Analytics page: how much the cards are used, sign-ups,
// onboarding and sales over a period, against the period before.
export default async function AdminStats({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const r = statsRange(sp);
  const s = await adminStats(r);
  const { current: c, previous: p } = s;
  const keys = bucketKeys(r);
  const byKey = new Map(s.points.map((x) => [x.bucket, x]));
  const pts = (f: (x: (typeof s.points)[number]) => number) => keys.map((k) => ({ key: k, value: byKey.has(k) ? f(byKey.get(k)!) : 0 }));
  const per = r.bucket === "day" ? "per day" : r.bucket === "week" ? "per week" : "per month";
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
  const since = s.stock.eventsSince ? formatDate(new Date(s.stock.eventsSince)) : null;
  const ymd = (d: Date) => new Date(d.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);

  return (
    <>
      <AdminHeader title="Stats" />
      <Tabs
        tabs={[
          ...Object.entries(RANGES).map(([k, v]) => ({ href: `?range=${k}`, label: v.label, active: r.key === k })),
          { href: `?range=custom&from=${ymd(r.from)}&to=${ymd(r.to)}`, label: "Custom", active: r.key === "custom" },
        ]}
      />
      <form className="adm-search">
        <input type="hidden" name="range" value="custom" />
        <label className="adm-small" htmlFor="st-from">
          From
        </label>
        <input id="st-from" type="date" name="from" defaultValue={ymd(r.from)} className="adm-input" style={{ width: 160 }} />
        <label className="adm-small" htmlFor="st-to">
          to
        </label>
        <input id="st-to" type="date" name="to" defaultValue={ymd(new Date(r.to.getTime() - 1))} className="adm-input" style={{ width: 160 }} />
        <button className="adm-btn">Show</button>
        <span className="adm-muted">
          {r.label}, compared with the {r.days} days before.
        </span>
      </form>

      <h2 className="adm-section">Cards in use</h2>
      <div className="adm-stats">
        <Tile label="Profile views" value={c.views.toLocaleString("en-ZA")} now={c.views} before={p.views} />
        <Tile label="Views from the card (/t/: NFC or QR)" value={pct(c.tapViews, c.views)} note={`${c.tapViews.toLocaleString("en-ZA")} views`} />
        <Tile label="Contacts saved (vCard)" value={c.vcards.toLocaleString("en-ZA")} now={c.vcards} before={p.vcards} />
        <Tile label="Saved per view" value={pct(c.vcards, c.views)} />
        <Tile label="Profiles viewed at least once" value={c.activeProfiles.toLocaleString("en-ZA")} now={c.activeProfiles} before={p.activeProfiles} />
        <Tile label="Taps on contact details" value={c.contactTaps.toLocaleString("en-ZA")} now={c.contactTaps} before={p.contactTaps} note="call, email, WhatsApp, website, map, socials" />
        <Tile label="Shares" value={c.shares.toLocaleString("en-ZA")} now={c.shares} before={p.shares} />
      </div>

      <h2 className="adm-section">Customers and sales</h2>
      <div className="adm-stats">
        <Tile label="Sign-ups" value={c.signups.toLocaleString("en-ZA")} now={c.signups} before={p.signups} />
        <Tile label="New profiles" value={c.newProfiles.toLocaleString("en-ZA")} now={c.newProfiles} before={p.newProfiles} />
        <Tile label="Paid orders" value={c.orders.toLocaleString("en-ZA")} now={c.orders} before={p.orders} />
        <Tile label="Revenue (incl. VAT and shipping)" value={rands(c.revenueCents)} now={c.revenueCents} before={p.revenueCents} />
        <Tile label="Revenue per sign-up" value={c.signups ? rands(Math.round(c.revenueCents / c.signups)) : "–"} />
        <Tile label="Cards in use now" value={s.stock.liveCards.toLocaleString("en-ZA")} note={`${s.stock.proProfiles.toLocaleString("en-ZA")} of ${s.stock.profiles.toLocaleString("en-ZA")} profiles Pro (${pct(s.stock.proProfiles, s.stock.profiles)})`} />
      </div>

      <div className="adm-grid--2">
        <Card>
          <BarChart label={`Profile views ${per}`} points={pts((x) => x.views)} />
        </Card>
        <Card>
          <BarChart label={`Contacts saved ${per}`} points={pts((x) => x.vcards)} />
        </Card>
        <Card>
          <BarChart label={`Sign-ups ${per}`} points={pts((x) => x.signups)} />
        </Card>
        <Card>
          <BarChart label={`Revenue ${per}`} points={pts((x) => x.revenueCents)} money />
        </Card>
      </div>

      <div className="adm-grid--2">
        <Card title="Most viewed profiles">
          {s.topProfiles.length ? (
            <table className="adm-table adm-table--tight">
              <thead>
                <tr>
                  <th>Profile</th>
                  <th className="adm-num">Views</th>
                  <th className="adm-num">Saved</th>
                </tr>
              </thead>
              <tbody>
                {s.topProfiles.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.label || `Profile ${t.id}`}
                      {t.company ? <span className="adm-muted"> · {t.company}</span> : null}
                    </td>
                    <td className="adm-num">{t.n.toLocaleString("en-ZA")}</td>
                    <td className="adm-num">{t.vcards.toLocaleString("en-ZA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="adm-muted" style={{ margin: 0 }}>
              No views in this period.
            </p>
          )}
        </Card>
        <Card title="Onboarding (people reaching each step)">
          <table className="adm-table adm-table--tight">
            <tbody>
              {s.funnel.map((f, i) => (
                <tr key={f.label}>
                  <td>{f.label}</td>
                  <td className="adm-num">{f.n.toLocaleString("en-ZA")}</td>
                  <td className="adm-num adm-muted adm-small">{i ? pct(f.n, s.funnel[0].n) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Breakdown title="Where views come from" rows={s.sources} />
        <Card title="What sold (paid orders)">
          {s.products.length ? (
            <table className="adm-table adm-table--tight">
              <tbody>
                {s.products.map((x) => (
                  <tr key={x.label}>
                    <td>{x.label}</td>
                    <td className="adm-num">{x.qty.toLocaleString("en-ZA")}</td>
                    <td className="adm-num">{rands(x.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="adm-muted" style={{ margin: 0 }}>
              No paid orders in this period.
            </p>
          )}
        </Card>
        <Breakdown title="How profiles are shared" rows={s.shares} />
        <Breakdown title="Views by country" rows={s.countries} />
        <Breakdown title="Taps on contact details, by kind" rows={s.contactKinds} empty="None yet: recorded from October 2026." />
        <Breakdown title="Views by device" rows={s.devices} empty="No views in this period." />
      </div>

      <p className="adm-muted">
        Views, saves, shares and onboarding come from the event log{since ? `, which starts on ${since}` : ""}; sign-ups, orders and revenue cover the whole WordPress history.
        Revenue counts orders when paid (processing, shipped or completed). The <Link href="/admin/">dashboard</Link>{" "}has today&apos;s to-do numbers.
      </p>
    </>
  );
}
