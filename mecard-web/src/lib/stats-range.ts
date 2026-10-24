// Date ranges and buckets for the staff stats page (the plugin's MeCard
// Analytics: last 30 / 90 days, 12 months or a custom range, compared with
// the period just before). Pure, so it can be unit tested.

export const RANGES = { "30d": { label: "Last 30 days", days: 30 }, "90d": { label: "Last 90 days", days: 90 }, "12m": { label: "Last 12 months", days: 365 } } as const;
export type RangeKey = keyof typeof RANGES | "custom";

export type StatsRange = {
  key: RangeKey;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  days: number;
  bucket: "day" | "week" | "month";
  label: string;
};

const DAY = 86_400_000;
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
/** Start of a South African calendar day (UTC+2, no daylight saving). */
const saDay = (ymd: string, end = false) => new Date(`${ymd}T${end ? "23:59:59.999" : "00:00:00.000"}+02:00`);

export function statsRange(params: { range?: string; from?: string; to?: string }, now = new Date()): StatsRange {
  let key: RangeKey = params.range && params.range in RANGES ? (params.range as RangeKey) : params.range === "custom" ? "custom" : "90d";
  let from: Date;
  let to: Date;
  if (key === "custom" && isDate(params.from) && isDate(params.to) && params.from <= params.to) {
    from = saDay(params.from);
    to = saDay(params.to, true);
  } else {
    if (key === "custom") key = "90d";
    to = now;
    from = new Date(now.getTime() - RANGES[key as keyof typeof RANGES].days * DAY);
  }
  const span = to.getTime() - from.getTime();
  const days = Math.max(1, Math.round(span / DAY));
  const label = key === "custom" ? `${params.from} to ${params.to}` : RANGES[key as keyof typeof RANGES].label;
  return {
    key,
    from,
    to,
    prevFrom: new Date(from.getTime() - span),
    prevTo: from,
    days,
    bucket: days <= 92 ? "day" : days <= 400 ? "week" : "month",
    label,
  };
}

/** Percentage change, or null when there is nothing to compare with. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Every bucket start (YYYY-MM-DD, South African time) in the range, so empty days still show as zero. */
export function bucketKeys(r: Pick<StatsRange, "from" | "to" | "bucket">): string[] {
  const ymd = (d: Date) => new Date(d.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
  const keys: string[] = [];
  const start = new Date(`${ymd(r.from)}T00:00:00Z`);
  if (r.bucket === "week") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7)); // Monday, as Postgres date_trunc('week')
  if (r.bucket === "month") start.setUTCDate(1);
  const end = ymd(r.to);
  for (const d = start; d.toISOString().slice(0, 10) <= end; ) {
    keys.push(d.toISOString().slice(0, 10));
    if (r.bucket === "day") d.setUTCDate(d.getUTCDate() + 1);
    else if (r.bucket === "week") d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return keys;
}
