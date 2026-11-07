import "server-only";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, events, profiles } from "@/db/schema";
import { editableProfilesWhere, type Viewer } from "./access";
import { FREE_DAYS, periodStart, totals, usageGroup, visits, type AnalyticsEvent, type Period, type TeamRowStats, type UsageGroup } from "./analytics-rules";
import { displayName } from "./profile-view";
import { isPro } from "./profile-format";

// The customer Analytics tab's data. Pro profiles report everything; a free
// single profile gets its 7-day totals; on the team view free profiles report nothing.

const NAMES = ["profile_viewed", "vcard_downloaded", "contact_action"];
/** Enough for any real profile's 180 days; the newest events win. */
const MAX_EVENTS = 20_000;

const eventCols = { name: events.name, sessionId: events.sessionId, source: events.source, referrer: events.referrer, device: events.device, at: events.createdAt, meta: events.meta };

const profileEvents = (profileId: number, since: Date): Promise<AnalyticsEvent[]> =>
  db
    .select(eventCols)
    .from(events)
    .where(and(eq(events.profileId, profileId), gte(events.createdAt, since), inArray(events.name, NAMES)))
    .orderBy(desc(events.createdAt))
    .limit(MAX_EVENTS);

/** Pro: the period's totals, the views of the period before it, and the activity log. */
export async function proAnalytics(profileId: number, days: Period, now = new Date()) {
  const rows = await profileEvents(profileId, periodStart(days * 2, now));
  const start = periodStart(days, now).getTime();
  const current = rows.filter((e) => e.at.getTime() >= start);
  return { totals: totals(current), viewsBefore: rows.filter((e) => e.at.getTime() < start && e.name === "profile_viewed").length, log: visits(current) };
}

/** Free: totals for the last 7 days and nothing else. */
export async function freeAnalytics(profileId: number, now = new Date()) {
  return totals(await profileEvents(profileId, periodStart(FREE_DAYS, now)));
}

export type TeamRow = {
  id: number;
  name: string;
  jobTitle: string;
  company: string;
  photoPath: string | null;
  /** Null for free profiles, which report nothing here. */
  stats: TeamRowStats | null;
  group: UsageGroup | null;
  weeks: number[];
};

const WEEKS = 13;

/** Every active profile the viewer manages, with stats for the Pro ones. */
export async function teamAnalytics(v: Viewer, days: Period, now = new Date()) {
  const list = await db
    .select({ id: profiles.id, type: profiles.type, slug: profiles.slug, firstName: profiles.firstName, lastName: profiles.lastName, jobTitle: profiles.jobTitle, photoPath: profiles.photoPath, companyName: profiles.companyName, company: companies.name })
    .from(profiles)
    .leftJoin(companies, eq(companies.id, profiles.companyId))
    .where(and(editableProfilesWhere(v.id), eq(profiles.archived, false)))
    .orderBy(asc(profiles.firstName), asc(profiles.lastName), asc(profiles.id));
  const proIds = list.filter(isPro).map((p) => p.id);

  const since = periodStart(days, now).toISOString();
  const weeksFrom = periodStart(WEEKS * 7, now).toISOString();
  const [period, last, weekly] = proIds.length
    ? await Promise.all([
        db
          .select({
            id: events.profileId,
            views: sql<number>`count(*) filter (where ${events.name} = 'profile_viewed')::int`,
            saves: sql<number>`count(*) filter (where ${events.name} = 'vcard_downloaded')::int`,
            contactTaps: sql<number>`count(*) filter (where ${events.name} = 'contact_action')::int`,
          })
          .from(events)
          .where(and(inArray(events.profileId, proIds), inArray(events.name, NAMES), sql`${events.createdAt} >= ${since}::timestamptz`))
          .groupBy(events.profileId),
        db
          .select({ id: events.profileId, at: sql<string>`max(${events.createdAt})` })
          .from(events)
          .where(and(inArray(events.profileId, proIds), eq(events.name, "profile_viewed")))
          .groupBy(events.profileId),
        db
          .select({ id: events.profileId, week: sql<number>`floor(extract(epoch from (${now.toISOString()}::timestamptz - ${events.createdAt})) / 604800)::int`, views: sql<number>`count(*)::int` })
          .from(events)
          .where(and(inArray(events.profileId, proIds), eq(events.name, "profile_viewed"), sql`${events.createdAt} >= ${weeksFrom}::timestamptz`))
          .groupBy(sql`1`, sql`2`),
      ])
    : [[], [], []];

  const byId = new Map(period.map((r) => [r.id, r]));
  const lastById = new Map(last.map((r) => [r.id, new Date(r.at)]));
  const rows: TeamRow[] = list.map((p) => {
    const base = { id: p.id, name: displayName(p), jobTitle: p.jobTitle, company: p.company || p.companyName, photoPath: p.photoPath };
    if (!isPro(p)) return { ...base, stats: null, group: null, weeks: [] };
    const r = byId.get(p.id);
    const lastView = lastById.get(p.id) ?? null;
    const weeks = Array.from({ length: WEEKS }, (_, i) => weekly.find((w) => w.id === p.id && w.week === WEEKS - 1 - i)?.views ?? 0);
    return { ...base, stats: { views: r?.views ?? 0, saves: r?.saves ?? 0, contactTaps: r?.contactTaps ?? 0, lastView }, group: usageGroup(lastView, now), weeks };
  });
  return rows;
}
