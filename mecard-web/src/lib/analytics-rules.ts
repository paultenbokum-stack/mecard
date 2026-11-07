// The customer Analytics tab's rules: periods, totals, the activity log and the
// team usage groups. Pure, so it can be unit tested. lib/analytics.ts loads the
// events. Visitors stay anonymous: nothing here identifies a person.

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

/** What a free single profile sees: totals for this many days, and no activity log. */
export const FREE_DAYS: Period = 7;

const DAY = 86_400_000;

export const parsePeriod = (raw: unknown): Period => {
  const n = Number(raw);
  return PERIODS.find((p) => p === n) ?? 30;
};

export const periodStart = (days: number, now = new Date()) => new Date(now.getTime() - days * DAY);

export type AnalyticsEvent = {
  name: string;
  sessionId: string | null;
  source: string | null;
  referrer: string | null;
  device: string | null;
  at: Date;
  meta: Record<string, unknown> | null;
};

export type Totals = { views: number; visitors: number; saves: number; contactTaps: number; savers: number; contacters: number };

/** Views and taps as counted; visitors, savers and contacters as distinct browsers. */
export function totals(events: AnalyticsEvent[]): Totals {
  const distinct = (name: string) => {
    const rows = events.filter((e) => e.name === name);
    return { count: rows.length, people: new Set(rows.map((e, i) => e.sessionId ?? `event-${i}`)).size };
  };
  const views = distinct("profile_viewed");
  const saves = distinct("vcard_downloaded");
  const taps = distinct("contact_action");
  return { views: views.count, visitors: views.people, saves: saves.count, contactTaps: taps.count, savers: saves.people, contacters: taps.people };
}

/** A change as a plain count: at these volumes a percentage overstates it (2 to 3 reads as +50%). */
export function changeLine(now: number, before: number, days: number) {
  const diff = now - before;
  if (diff === 0) return `The same number of views as the ${days} days before`;
  return `${Math.abs(diff)} ${diff > 0 ? "more" : "fewer"} ${Math.abs(diff) === 1 ? "view" : "views"} than the ${days} days before`;
}

const NETWORKS: Record<string, string> = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", twitter: "X", youtube: "YouTube", tiktok: "TikTok" };

/** What a contact_action was, in the owner's words. */
export function contactLabel(meta: Record<string, unknown> | null): string | null {
  const kind = meta?.kind;
  if (kind === "call") return "Called you";
  if (kind === "email") return "Emailed you";
  if (kind === "whatsapp") return "WhatsApp";
  if (kind === "sms") return "Texted you";
  if (kind === "map") return "Opened your map";
  if (kind === "website") return "Your website";
  if (kind === "social") return NETWORKS[String(meta?.label)] ?? "Social link";
  return null;
}

/** Where a link was opened from, unless it was from MeCard itself. */
export function referrerDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host === "mecard.co.za" || host.endsWith(".mecard.co.za") || host === "localhost" ? null : host;
  } catch {
    return null;
  }
}

export type Visit = {
  at: Date;
  via: "card" | "link";
  device: string | null;
  from: string | null;
  /** auto: the contact was sent to their phone on the first tap, which doesn't mean they kept it. */
  saved: "button" | "auto" | null;
  actions: string[];
};

/** A browser's events more than this far apart are separate visits (the session cookie lasts a year). */
const VISIT_GAP = 30 * 60_000;

/** The activity log: one visit per row, newest first. */
export function visits(events: AnalyticsEvent[]): Visit[] {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const open = new Map<string, { visit: Visit; last: number }>();
  const out: Visit[] = [];
  sorted.forEach((e, i) => {
    const key = e.sessionId ?? `event-${i}`;
    const t = e.at.getTime();
    let cur = open.get(key);
    if (!cur || t - cur.last > VISIT_GAP) {
      const visit: Visit = { at: e.at, via: e.source === "nfc" ? "card" : "link", device: e.device, from: referrerDomain(e.referrer), saved: null, actions: [] };
      cur = { visit, last: t };
      open.set(key, cur);
      out.push(visit);
    }
    cur.last = t;
    if (e.name === "vcard_downloaded") {
      // A press of the button says more than the automatic save, so it wins.
      if (e.meta?.trigger === "auto") cur.visit.saved ??= "auto";
      else cur.visit.saved = "button";
    }
    if (e.name === "contact_action") {
      const label = contactLabel(e.meta);
      if (label && !cur.visit.actions.includes(label)) cur.visit.actions.push(label);
    }
  });
  return out.reverse();
}

export type UsageGroup = "using" | "quiet" | "never";

/** Using: viewed in the last 30 days, whichever period is showing. Quiet: viewed before that. */
export function usageGroup(lastView: Date | null, now = new Date()): UsageGroup {
  if (!lastView) return "never";
  return lastView.getTime() >= periodStart(30, now).getTime() ? "using" : "quiet";
}

export function daysAgo(at: Date | null, now = new Date()) {
  if (!at) return "Never";
  const start = (d: Date) => Math.floor((d.getTime() + 2 * 3_600_000) / DAY); // South African calendar days
  const days = start(now) - start(at);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

export const saveRate = (views: number, saves: number) => (views ? `${Math.min(100, Math.round((saves / views) * 100))}%` : "–");

/** Points for a small line chart, drawn in a 76 × 24 box. */
export function sparkPoints(values: number[]) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? 74 / (values.length - 1) : 0;
  return values.map((v, i) => `${(1 + i * step).toFixed(1)},${(22 - (v / max) * 20).toFixed(1)}`).join(" ");
}

export type TeamRowStats = { views: number; saves: number; contactTaps: number; lastView: Date | null };
export const TEAM_SORTS = ["views", "saves", "rate", "contactTaps", "lastView"] as const;
export type TeamSort = (typeof TEAM_SORTS)[number];
export const parseTeamSort = (raw: unknown): TeamSort => TEAM_SORTS.find((s) => s === raw) ?? "views";

/** Highest first; free profiles report nothing, so they always come last. */
export function sortRows<T extends { name: string; stats: TeamRowStats | null }>(rows: T[], sort: TeamSort): T[] {
  const value = (s: TeamRowStats) =>
    sort === "rate" ? (s.views ? s.saves / s.views : -1) : sort === "lastView" ? (s.lastView?.getTime() ?? -1) : s[sort];
  return [...rows].sort((a, b) => {
    if (!a.stats || !b.stats) return a.stats ? -1 : b.stats ? 1 : a.name.localeCompare(b.name);
    return value(b.stats) - value(a.stats) || a.name.localeCompare(b.name);
  });
}

/** A cell for the CSV export, with spreadsheet formulas neutralised (names are typed by users). */
export function csvCell(v: string | number) {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
