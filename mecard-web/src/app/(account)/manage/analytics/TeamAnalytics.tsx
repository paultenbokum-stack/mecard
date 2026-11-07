import Link from "next/link";
import { Avatar, Pager, ProPendingBadge } from "@/components/account/Bits";
import { ProUpgradeButton, UpsellSeen } from "@/components/account/Upsells";
import type { TeamRow } from "@/lib/analytics";
import { daysAgo, saveRate, sortRows, sparkPoints, type Period, type TeamSort, type UsageGroup } from "@/lib/analytics-rules";
import { PAGE_SIZE } from "@/lib/manage";
import { PeriodLinks, Tile } from "./SingleAnalytics";

// The Analytics tab on the team view: how Pro profiles are being used, then one
// row per person. Free profiles are listed but report no stats, so the totals
// and the usage bar count Pro profiles only.

type Group = "all" | UsageGroup | "free";

export const parseGroup = (raw: unknown): Group => (["using", "quiet", "never", "free"] as const).find((g) => g === raw) ?? "all";

const GROUPS: Record<UsageGroup, { label: string; badge: string }> = {
  using: { label: "Using their card", badge: "acc-badge--live" },
  quiet: { label: "Gone quiet", badge: "acc-badge--wait" },
  never: { label: "Never used", badge: "" },
};

const COLUMNS: { key: TeamSort; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "saves", label: "Saved" },
  { key: "rate", label: "Save rate" },
  { key: "contactTaps", label: "Contacted" },
];

function Spark({ weeks }: { weeks: number[] }) {
  return (
    <svg className="acc-an-spark" viewBox="0 0 76 24" preserveAspectRatio="none" role="img" aria-label="Views per week">
      <polyline points={sparkPoints(weeks)} />
    </svg>
  );
}

function Person({ row, days }: { row: TeamRow; days: Period }) {
  return (
    <div className="acc-an-person">
      <Avatar path={row.photoPath} />
      <div>
        {row.stats ? <Link href={`/manage/analytics/?profile=${row.id}&days=${days}`}>{row.name}</Link> : <span className="acc-an-person__name">{row.name}</span>}
        <small>{[row.jobTitle, row.company].filter(Boolean).join(", ")}</small>
      </div>
    </div>
  );
}

function Usage({ row }: { row: TeamRow }) {
  if (!row.group) return <span className="acc-badge acc-an-tag">Free</span>;
  const g = GROUPS[row.group];
  return <span className={`acc-badge acc-an-tag ${g.badge}`}>{g.label}</span>;
}

function Upgrade({ row, pending }: { row: TeamRow; pending: boolean }) {
  if (row.stats) return null;
  if (pending) return <ProPendingBadge />;
  return (
    <ProUpgradeButton profileId={row.id} context="analytics_team" className="acc-btn acc-btn--small acc-btn--cta">
      Upgrade
    </ProUpgradeButton>
  );
}

export function TeamAnalytics({ rows, pending, days, group, sort, page }: { rows: TeamRow[]; pending: Set<number>; days: Period; group: Group; sort: TeamSort; page: number }) {
  const pro = rows.filter((r) => r.stats);
  const free = rows.length - pro.length;
  const count = (g: UsageGroup) => pro.filter((r) => r.group === g).length;
  const sum = (k: "views" | "saves" | "contactTaps") => pro.reduce((t, r) => t + (r.stats?.[k] ?? 0), 0);

  const href = (over: { days?: Period; group?: Group; sort?: TeamSort; page?: number }) => {
    const next = { days, group, sort, page: 1, ...over };
    const q = new URLSearchParams({ days: String(next.days) });
    if (next.group !== "all") q.set("group", next.group);
    if (next.sort !== "views") q.set("sort", next.sort);
    if (next.page > 1) q.set("page", String(next.page));
    return `/manage/analytics/?${q}`;
  };

  const head = (
    <div className="acc-an-head">
      <div>
        <p className="acc__eyebrow">Your team, last {days} days</p>
        <h1>Analytics</h1>
      </div>
      <PeriodLinks days={days} href={(d) => href({ days: d, page })} />
    </div>
  );

  if (!rows.length) {
    return (
      <>
        {head}
        <div className="acc-empty">
          Add your people on <Link href="/manage/">Profiles</Link> and their stats will show up here.
        </div>
      </>
    );
  }

  const shown = sortRows(rows.filter((r) => group === "all" || (group === "free" ? !r.stats : r.group === group)), sort);
  const pageRows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filters: [Group, string][] = [
    ["all", `All ${rows.length}`],
    ["using", `Using ${count("using")}`],
    ["quiet", `Quiet ${count("quiet")}`],
    ["never", `Never used ${count("never")}`],
    ["free", `Free ${free}`],
  ];

  return (
    <>
      {head}
      {free ? <UpsellSeen offer="pro" placement="analytics_team" /> : null}
      {pro.length ? (
        <>
          <div className="acc-an-tiles">
            <Tile label="Views" value={sum("views").toLocaleString("en-ZA")} />
            <Tile label="Saved contact" value={sum("saves").toLocaleString("en-ZA")} />
            <Tile label="Contact taps" value={sum("contactTaps").toLocaleString("en-ZA")} />
          </div>
          <section className="acc-panel">
            <h2>
              {count("using")} of {pro.length} Pro {pro.length === 1 ? "profile" : "profiles"} used their card this month
            </h2>
            <div className="acc-an-bar">
              {(["using", "quiet", "never"] as const).map((g) =>
                count(g) ? <Link key={g} href={href({ group: group === g ? "all" : g })} className={`acc-an-bar__${g}`} style={{ flexGrow: count(g) }} aria-label={`Show ${GROUPS[g].label.toLowerCase()}: ${count(g)}`} /> : null,
              )}
            </div>
            <div className="acc-an-legend">
              <span>
                <i className="acc-an-bar__using" />
                {count("using")} using their card
              </span>
              <span>
                <i className="acc-an-bar__quiet" />
                {count("quiet")} gone quiet
              </span>
              <span>
                <i className="acc-an-bar__never" />
                {count("never")} never used
              </span>
            </div>
            {free ? (
              <p className="acc__muted acc-an-note">
                {free} free {free === 1 ? "profile isn't" : "profiles aren't"} included. Upgrade them to see their stats.
              </p>
            ) : null}
          </section>
        </>
      ) : (
        <div className="acc-panel acc-panel--white">
          <h2>Upgrade a profile to see its stats</h2>
          <p style={{ marginBottom: 0 }}>Analytics is for Pro profiles. Upgrade someone below to see their views, saved contacts and contact taps here.</p>
        </div>
      )}

      <section className="acc-panel" id="people">
        <div className="acc-panel__head">
          <h2>Your people</h2>
          {pro.length ? (
            <a className="acc-btn acc-btn--small" href={`/manage/analytics/export/?days=${days}`}>
              Download CSV
            </a>
          ) : null}
        </div>
        <nav className="acc-an-seg acc-an-seg--wrap" aria-label="Filter by usage">
          {filters.map(([g, label]) => (
            <Link key={g} href={href({ group: g })} scroll={false} aria-current={g === group ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        {pageRows.length ? (
          <>
            <div className="acc-an-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Usage</th>
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="acc-an-num" aria-sort={sort === c.key ? "descending" : "none"}>
                        <Link href={href({ sort: c.key })} scroll={false}>
                          {c.label}
                        </Link>
                      </th>
                    ))}
                    <th className="acc-an-num">13 weeks</th>
                    <th className="acc-an-num" aria-sort={sort === "lastView" ? "descending" : "none"}>
                      <Link href={href({ sort: "lastView" })} scroll={false}>
                        Last view
                      </Link>
                    </th>
                    <th>
                      <span className="acc-an-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Person row={r} days={days} />
                      </td>
                      <td>
                        <Usage row={r} />
                      </td>
                      <td className="acc-an-num">{r.stats?.views ?? "–"}</td>
                      <td className="acc-an-num">{r.stats?.saves ?? "–"}</td>
                      <td className="acc-an-num">{r.stats ? saveRate(r.stats.views, r.stats.saves) : "–"}</td>
                      <td className="acc-an-num">{r.stats?.contactTaps ?? "–"}</td>
                      <td className="acc-an-num">{r.stats ? <Spark weeks={r.weeks} /> : "–"}</td>
                      <td className="acc-an-num">{r.stats ? daysAgo(r.stats.lastView) : "–"}</td>
                      <td className="acc-an-num">
                        <Upgrade row={r} pending={pending.has(r.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="acc-an-rows">
              {pageRows.map((r) => (
                <li key={r.id}>
                  <div className="acc-an-rows__top">
                    <Person row={r} days={days} />
                    <Usage row={r} />
                  </div>
                  {r.stats ? (
                    <div className="acc-an-rows__nums">
                      <span>
                        <b>{r.stats.views}</b>views
                      </span>
                      <span>
                        <b>{r.stats.saves}</b>saved
                      </span>
                      <span>
                        <b>{r.stats.contactTaps}</b>contacted
                      </span>
                    </div>
                  ) : (
                    <div className="acc-an-rows__free">
                      <span className="acc__muted">Stats are on Pro profiles</span>
                      <Upgrade row={r} pending={pending.has(r.id)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="acc-empty">Nobody in this group.</div>
        )}
        <Pager page={page} total={shown.length} size={PAGE_SIZE} href={(n) => href({ page: n })} />
      </section>
    </>
  );
}
