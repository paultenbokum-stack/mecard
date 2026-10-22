import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { PAID_STATUSES } from "./money";
import type { StatsRange } from "./stats-range";

// The staff stats page (the plugin's MeCard Analytics). Engagement comes from
// the events table (imported from wp_mecard_events, so it starts mid-June
// 2026); sign-ups, orders and revenue from their own tables, which hold the
// full WordPress history.

const iso = (d: Date) => d.toISOString();
const rows = async <T>(q: SQL) => (await db.execute(q)) as unknown as T[];
const paid = sql.raw(PAID_STATUSES.map((s) => `'${s}'`).join(", "));
/** A card page reached through /t/ (NFC tap or the QR code on the card) rather than a profile link. */
const TAP = sql`(meta->>'entry_url_pattern' = 't' or source = 'nfc')`;

export type PeriodTotals = {
  views: number;
  tapViews: number;
  vcards: number;
  shares: number;
  forms: number;
  adViews: number;
  activeProfiles: number;
  signups: number;
  newProfiles: number;
  orders: number;
  revenueCents: number;
};

async function totals(from: Date, to: Date): Promise<PeriodTotals> {
  const [e] = await rows<Record<string, number>>(sql`
    select count(*) filter (where name = 'profile_viewed')::int as views,
           count(*) filter (where name = 'profile_viewed' and ${TAP})::int as "tapViews",
           count(*) filter (where name = 'vcard_downloaded')::int as vcards,
           count(*) filter (where name = 'share_intent')::int as shares,
           count(*) filter (where name = 'contact_form_submitted')::int as forms,
           count(*) filter (where name = 'recipient_ad_viewed')::int as "adViews",
           count(distinct profile_id) filter (where name = 'profile_viewed')::int as "activeProfiles"
      from events where created_at >= ${iso(from)}::timestamptz and created_at < ${iso(to)}::timestamptz`);
  const [o] = await rows<Record<string, number>>(sql`
    select (select count(*) from users where created_at >= ${iso(from)}::timestamptz and created_at < ${iso(to)}::timestamptz)::int as signups,
           (select count(*) from profiles where created_at >= ${iso(from)}::timestamptz and created_at < ${iso(to)}::timestamptz)::int as "newProfiles",
           count(*)::int as orders,
           coalesce(sum(total_cents), 0)::int as "revenueCents"
      from orders
     where status in (${paid}) and coalesce(paid_at, created_at) >= ${iso(from)}::timestamptz and coalesce(paid_at, created_at) < ${iso(to)}::timestamptz`);
  return { ...(e as PeriodTotals), ...(o as Partial<PeriodTotals>) } as PeriodTotals;
}

export type SeriesPoint = { bucket: string; views: number; vcards: number; signups: number; revenueCents: number };

async function series(r: StatsRange): Promise<SeriesPoint[]> {
  const unit = sql.raw(`'${r.bucket}'`);
  const b = (col: SQL) => sql`to_char(date_trunc(${unit}, ${col} at time zone 'Africa/Johannesburg'), 'YYYY-MM-DD')`;
  const range = (col: SQL) => sql`${col} >= ${iso(r.from)}::timestamptz and ${col} < ${iso(r.to)}::timestamptz`;
  const [ev, us, or] = await Promise.all([
    rows<{ bucket: string; views: number; vcards: number }>(sql`
      select ${b(sql`created_at`)} as bucket,
             count(*) filter (where name = 'profile_viewed')::int as views,
             count(*) filter (where name = 'vcard_downloaded')::int as vcards
        from events where ${range(sql`created_at`)} group by 1`),
    rows<{ bucket: string; signups: number }>(sql`select ${b(sql`created_at`)} as bucket, count(*)::int as signups from users where ${range(sql`created_at`)} group by 1`),
    rows<{ bucket: string; revenue: number }>(sql`
      select ${b(sql`coalesce(paid_at, created_at)`)} as bucket, coalesce(sum(total_cents), 0)::int as revenue
        from orders where status in (${paid}) and ${range(sql`coalesce(paid_at, created_at)`)} group by 1`),
  ]);
  const map = new Map<string, SeriesPoint>();
  const at = (k: string) => map.get(k) ?? (map.set(k, { bucket: k, views: 0, vcards: 0, signups: 0, revenueCents: 0 }), map.get(k)!);
  for (const x of ev) Object.assign(at(x.bucket), { views: x.views, vcards: x.vcards });
  for (const x of us) at(x.bucket).signups = x.signups;
  for (const x of or) at(x.bucket).revenueCents = x.revenue;
  return [...map.values()];
}

export type Count = { label: string; n: number };

async function breakdowns(r: StatsRange) {
  const inRange = sql`created_at >= ${iso(r.from)}::timestamptz and created_at < ${iso(r.to)}::timestamptz`;
  const [sources, shares, countries, topProfiles, funnel, products] = await Promise.all([
    rows<Count>(sql`
      select case when ${TAP} then 'Card (/t/: NFC or QR)' when coalesce(source, '') = '' then 'Profile link (direct)' else 'Link: ' || source end as label, count(*)::int as n
        from events where name = 'profile_viewed' and ${inRange} group by 1 order by 2 desc limit 8`),
    rows<Count>(sql`
      select coalesce(nullif(meta->>'method', ''), 'other') as label, count(*)::int as n
        from events where name = 'share_intent' and ${inRange} group by 1 order by 2 desc limit 8`),
    rows<Count>(sql`
      select coalesce(country, '–') as label, count(*)::int as n
        from events where name = 'profile_viewed' and ${inRange} group by 1 order by 2 desc limit 8`),
    rows<{ id: number; label: string; company: string; n: number; vcards: number }>(sql`
      select p.id, trim(p.first_name || ' ' || p.last_name) as label, coalesce(c.name, p.company_name) as company,
             count(*) filter (where e.name = 'profile_viewed')::int as n,
             count(*) filter (where e.name = 'vcard_downloaded')::int as vcards
        from events e join profiles p on p.id = e.profile_id left join companies c on c.id = p.company_id
       where e.name in ('profile_viewed', 'vcard_downloaded') and e.created_at >= ${iso(r.from)}::timestamptz and e.created_at < ${iso(r.to)}::timestamptz
       group by 1, 2, 3 order by 4 desc limit 10`),
    rows<Count>(sql`
      select name as label, count(distinct coalesce(user_id::text, session_id, id::text))::int as n
        from events where name in ('signup_completed', 'profile_step1_saved', 'profile_step2_saved', 'look_confirmed', 'onboarding_completed') and ${inRange}
       group by 1`),
    rows<{ label: string; qty: number; revenue: number }>(sql`
      select i.name as label, sum(i.quantity)::int as qty, sum(i.quantity * i.unit_price_cents)::int as revenue
        from order_items i join orders o on o.id = i.order_id
       where o.status in (${paid}) and coalesce(o.paid_at, o.created_at) >= ${iso(r.from)}::timestamptz and coalesce(o.paid_at, o.created_at) < ${iso(r.to)}::timestamptz
       group by 1 order by 3 desc limit 10`),
  ]);
  const STEPS: [string, string][] = [
    ["signup_completed", "Signed up"],
    ["profile_step1_saved", "Profile details"],
    ["profile_step2_saved", "Contact details"],
    ["look_confirmed", "Look chosen"],
    ["onboarding_completed", "Finished onboarding"],
  ];
  const f = new Map(funnel.map((x) => [x.label, x.n]));
  return { sources, shares, countries, topProfiles, funnel: STEPS.map(([k, label]) => ({ label, n: f.get(k) ?? 0 })), products };
}

/** Right now, whatever the range: cards in use and Pro profiles. */
async function stock() {
  const [s] = await rows<{ liveCards: number; profiles: number; proProfiles: number; eventsSince: Date | string | null }>(sql`
    select (select count(*) from cards where not archived and profile_id is not null and (cart_item_key is null or cart_item_key = ''))::int as "liveCards",
           (select count(*) from profiles where not archived)::int as profiles,
           (select count(*) from profiles where not archived and type = 'pro')::int as "proProfiles",
           (select min(created_at) from events) as "eventsSince"`);
  return s;
}

export async function adminStats(r: StatsRange) {
  const [current, previous, points, more, now] = await Promise.all([totals(r.from, r.to), totals(r.prevFrom, r.prevTo), series(r), breakdowns(r), stock()]);
  return { current, previous, points, ...more, stock: now };
}
