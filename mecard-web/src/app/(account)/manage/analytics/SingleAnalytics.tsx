import Link from "next/link";
import { ProUpgradeButton, UpsellSeen } from "@/components/account/Upsells";
import { changeLine, FREE_DAYS, PERIODS, type Period, type Totals, type Visit } from "@/lib/analytics-rules";

// The Analytics tab for one profile: the activity log for Pro, and 7-day totals
// with an upsell for free. Visitors stay anonymous.

const PAGE = 20;

const SA = "Africa/Johannesburg";
const time = new Intl.DateTimeFormat("en-ZA", { timeZone: SA, hour: "2-digit", minute: "2-digit", hour12: false });
const dayName = new Intl.DateTimeFormat("en-ZA", { timeZone: SA, weekday: "long", day: "numeric", month: "long" });
const DEVICE: Record<string, string> = { phone: "Phone", tablet: "Tablet", desktop: "On a computer" };

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

export function PeriodLinks({ days, href }: { days: Period; href: (days: Period) => string }) {
  return (
    <nav className="acc-an-seg" aria-label="Period">
      {PERIODS.map((p) => (
        <Link key={p} href={href(p)} scroll={false} aria-current={p === days ? "page" : undefined}>
          {p} days
        </Link>
      ))}
    </nav>
  );
}

export function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="acc-an-tile">
      <div className="acc-an-tile__label">{label}</div>
      <div className="acc-an-tile__value">{value}</div>
    </div>
  );
}

function VisitRow({ visit, their }: { visit: Visit; their: boolean }) {
  const whose = their ? "the" : "your";
  const sub = [visit.from ? `From ${visit.from}` : null, visit.device ? DEVICE[visit.device] : null].filter(Boolean).join(", ");
  return (
    <li className="acc-an-visit">
      <time dateTime={visit.at.toISOString()}>{time.format(visit.at)}</time>
      <div className="acc-an-visit__main">
        <div className="acc-an-visit__title">
          <i className={`fa-solid ${visit.via === "card" ? "fa-wifi acc-an-nfc" : "fa-link"}`} aria-hidden="true" />{" "}
          {visit.via === "card" ? `Someone tapped or scanned ${whose} card` : `Someone opened ${whose} link`}
        </div>
        {sub ? <div className="acc-an-visit__sub">{sub}</div> : null}
      </div>
      <div className="acc-an-visit__tags">
        {visit.saved === "button" ? <span className="acc-badge acc-badge--live acc-an-tag">Saved</span> : null}
        {visit.saved === "auto" ? <span className="acc-badge acc-an-tag">Sent to their phone</span> : null}
        {visit.actions.map((a) => (
          <span key={a} className="acc-badge acc-badge--pro acc-an-tag">
            {a}
          </span>
        ))}
      </div>
    </li>
  );
}

export function ProAnalytics({
  data,
  days,
  shown,
  team,
}: {
  data: { totals: Totals; viewsBefore: number; log: Visit[] };
  days: Period;
  shown: number;
  team: { id: number; name: string } | null;
}) {
  const { totals: t, viewsBefore, log } = data;
  const base = (extra: Record<string, string | number>) => {
    const q = new URLSearchParams(Object.entries({ ...(team ? { profile: team.id } : {}), ...extra }).map(([k, v]) => [k, String(v)]));
    return `/manage/analytics/?${q}`;
  };
  const visible = log.slice(0, shown * PAGE);
  const groups = Map.groupBy(visible, (v) => dayName.format(v.at));
  const whom = team ? "them" : "you";
  const whose = team ? "their" : "your";

  return (
    <>
      <div className="acc-an-head">
        <div>
          <p className="acc__eyebrow">{team ? team.name : "Your card"}</p>
          <h1>Analytics</h1>
        </div>
        <PeriodLinks days={days} href={(d) => base({ days: d })} />
      </div>
      {team ? (
        <p className="acc__muted">
          <Link href={`/manage/analytics/?days=${days}`}>Back to your team</Link>
        </p>
      ) : null}
      <div className="acc-an-sum">
        <p>
          {people(t.visitors)} looked {whom} up in the last {days} days. {t.savers} saved {whose} contact and {t.contacters} got in touch.
        </p>
        <small>{changeLine(t.views, viewsBefore, days)}</small>
      </div>
      <section className="acc-panel">
        <div className="acc-panel__head">
          <h2>Recent activity</h2>
          <span className="acc__muted">Visitors stay anonymous</span>
        </div>
        {visible.length ? (
          [...groups].map(([day, rows]) => (
            <div key={day} className="acc-an-day">
              <h3>{day}</h3>
              <ul>
                {rows.map((v, i) => (
                  <VisitRow key={`${v.at.toISOString()}-${i}`} visit={v} their={!!team} />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <div className="acc-empty">Nothing in the last {days} days yet. Tap your card for someone or share your link, and each visit will show up here.</div>
        )}
        {log.length > visible.length ? (
          <div className="acc-more">
            <Link className="acc-btn acc-btn--small" href={base({ days, more: shown + 1 })} scroll={false}>
              Show earlier activity
            </Link>
          </div>
        ) : null}
      </section>
    </>
  );
}

// What the log looks like, blurred behind the upsell. Made up, and hidden from screen readers.
const SAMPLE = ["Someone tapped or scanned your card", "Someone opened your link", "Someone tapped or scanned your card"];

export function FreeAnalytics({ totals: t, profileId, pending }: { totals: Totals; profileId: number; pending: boolean }) {
  return (
    <>
      <div className="acc-an-head">
        <div>
          <p className="acc__eyebrow">Your card, last {FREE_DAYS} days</p>
          <h1>Analytics</h1>
        </div>
        <span className="acc-badge">Free</span>
      </div>
      <div className="acc-an-tiles">
        <Tile label="Views" value={t.views} />
        <Tile label="Saved contact" value={t.saves} />
        <Tile label="Contact taps" value={t.contactTaps} />
      </div>
      <section className="acc-panel acc-an-lock">
        <ul className="acc-an-lock__sample" aria-hidden="true">
          {SAMPLE.map((s, i) => (
            <li className="acc-an-visit" key={i}>
              <time>09:30</time>
              <div className="acc-an-visit__main">
                <div className="acc-an-visit__title">{s}</div>
                <div className="acc-an-visit__sub">Phone</div>
              </div>
            </li>
          ))}
        </ul>
        <div className="acc-an-lock__offer">
          <h2>See every tap, save and message as it happens</h2>
          {pending ? (
            <p>Your activity log opens as soon as your Pro upgrade is paid.</p>
          ) : (
            <>
              <p>Pro shows your full activity log and up to 90 days of history.</p>
              <UpsellSeen offer="pro" placement="analytics" profileId={profileId} />
              <ProUpgradeButton profileId={profileId} context="analytics" className="acc-btn acc-btn--primary">
                Upgrade to Pro
              </ProUpgradeButton>
            </>
          )}
        </div>
      </section>
    </>
  );
}
