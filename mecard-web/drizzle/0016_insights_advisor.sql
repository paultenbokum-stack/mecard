-- Insights by profile, company and account over time, to find where the
-- opportunities are. Same rule as 0012: IDs and counts only, never names, emails,
-- phone numbers, addresses, ip_hash or ua_hash.

-- Public engagement per South African day, per profile, by source and device. A
-- profile's owner and manager looking at it don't count. company_id and
-- owner_user_id are the profile's current ones, so history follows the profile.
CREATE OR REPLACE VIEW insights.profile_engagement_daily AS
SELECT
  (e.created_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
  e.profile_id,
  p.company_id,
  p.owner_id AS owner_user_id,
  coalesce(e.source, 'direct') AS source,
  coalesce(e.device, 'unknown') AS device,
  count(*) FILTER (WHERE e.name = 'profile_viewed') AS views,
  count(DISTINCT e.session_id) FILTER (WHERE e.name = 'profile_viewed') AS visitors,
  count(*) FILTER (WHERE e.name = 'vcard_downloaded') AS saves,
  count(*) FILTER (WHERE e.name = 'contact_action') AS contact_taps,
  count(*) FILTER (WHERE e.name = 'share_intent') AS shares
FROM events e
JOIN profiles p ON p.id = e.profile_id
WHERE e.name IN ('profile_viewed', 'vcard_downloaded', 'contact_action', 'share_intent')
  AND e.user_id IS DISTINCT FROM p.owner_id
  AND e.user_id IS DISTINCT FROM p.manager_id
GROUP BY 1, 2, 3, 4, 5, 6;
--> statement-breakpoint

-- One row per profile: who it belongs to, its plan, its cards, and how it's doing now.
CREATE OR REPLACE VIEW insights.profiles AS
SELECT
  p.id AS profile_id,
  p.owner_id AS owner_user_id,
  p.manager_id AS manager_user_id,
  p.company_id,
  p.type AS plan,
  p.archived,
  p.created_at,
  p.onboarding->>'stage' AS onboarding_stage,
  (SELECT count(*) FROM cards c WHERE c.profile_id = p.id AND NOT c.archived) AS cards_linked,
  coalesce(d.views_total, 0) AS views_total,
  coalesce(d.views_30d, 0) AS views_30d,
  coalesce(d.views_prev_30d, 0) AS views_prev_30d,
  coalesce(d.saves_total, 0) AS saves_total,
  coalesce(d.saves_30d, 0) AS saves_30d,
  coalesce(d.contact_taps_total, 0) AS contact_taps_total,
  coalesce(d.contact_taps_30d, 0) AS contact_taps_30d,
  coalesce(d.shares_total, 0) AS shares_total,
  d.first_view_day,
  d.last_view_day
FROM profiles p
LEFT JOIN (
  SELECT
    profile_id,
    sum(views) AS views_total,
    coalesce(sum(views) FILTER (WHERE day > current_date - 30), 0) AS views_30d,
    coalesce(sum(views) FILTER (WHERE day <= current_date - 30 AND day > current_date - 60), 0) AS views_prev_30d,
    sum(saves) AS saves_total,
    coalesce(sum(saves) FILTER (WHERE day > current_date - 30), 0) AS saves_30d,
    sum(contact_taps) AS contact_taps_total,
    coalesce(sum(contact_taps) FILTER (WHERE day > current_date - 30), 0) AS contact_taps_30d,
    sum(shares) AS shares_total,
    min(day) FILTER (WHERE views > 0) AS first_view_day,
    max(day) FILTER (WHERE views > 0) AS last_view_day
  FROM insights.profile_engagement_daily
  GROUP BY profile_id
) d ON d.profile_id = p.id;
--> statement-breakpoint

-- One row per company: its size, plan mix, cards, recent engagement, and what its
-- owner has bought. An owner with several companies shows the same spend on each.
CREATE OR REPLACE VIEW insights.companies AS
SELECT
  c.id AS company_id,
  c.owner_id AS owner_user_id,
  c.created_at,
  (c.logo_path <> '') AS has_logo,
  (SELECT count(*) FROM profiles p WHERE p.company_id = c.id AND NOT p.archived) AS profiles,
  (SELECT count(*) FROM profiles p WHERE p.company_id = c.id AND NOT p.archived AND p.type = 'pro') AS pro_profiles,
  (SELECT count(*) FROM profiles p WHERE p.company_id = c.id AND p.archived) AS archived_profiles,
  (SELECT count(*) FROM cards k WHERE k.company_id = c.id AND NOT k.archived) AS cards,
  (SELECT count(*) FROM cards k WHERE k.company_id = c.id AND NOT k.archived AND k.profile_id IS NULL) AS cards_unlinked,
  e.profiles_viewed_30d,
  e.views_total,
  e.views_30d,
  e.views_prev_30d,
  e.saves_total,
  e.saves_30d,
  e.contact_taps_30d,
  e.last_view_day,
  o.owner_paid_orders,
  o.owner_paid_cents,
  o.owner_last_paid_at
FROM companies c
LEFT JOIN LATERAL (
  SELECT
    coalesce(sum(p.views_total), 0) AS views_total,
    coalesce(sum(p.views_30d), 0) AS views_30d,
    coalesce(sum(p.views_prev_30d), 0) AS views_prev_30d,
    coalesce(sum(p.saves_total), 0) AS saves_total,
    coalesce(sum(p.saves_30d), 0) AS saves_30d,
    coalesce(sum(p.contact_taps_30d), 0) AS contact_taps_30d,
    count(*) FILTER (WHERE p.views_30d > 0) AS profiles_viewed_30d,
    max(p.last_view_day) AS last_view_day
  FROM insights.profiles p WHERE p.company_id = c.id
) e ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS owner_paid_orders, coalesce(sum(r.total_cents), 0) AS owner_paid_cents, max(r.paid_at) AS owner_last_paid_at
  FROM orders r
  WHERE r.user_id = c.owner_id AND r.paid_at IS NOT NULL AND r.status NOT IN ('cancelled', 'refunded', 'failed')
) o ON true;
--> statement-breakpoint

-- One row per account (staff excluded): what it runs, what it has spent, what is
-- paid for but unused or waiting, and how its profiles are doing now. Profiles
-- count when the account owns or manages them.
CREATE OR REPLACE VIEW insights.accounts AS
SELECT
  u.id AS user_id,
  u.created_at AS signed_up_at,
  u.last_active_at,
  u.account_mode,
  p.profiles,
  p.pro_profiles,
  p.views_total,
  p.views_30d,
  p.views_prev_30d,
  p.saves_30d,
  p.contact_taps_30d,
  p.last_view_day,
  (SELECT count(*) FROM companies c WHERE c.owner_id = u.id) AS companies_owned,
  (SELECT count(*) FROM cards k WHERE k.owner_id = u.id AND NOT k.archived) AS cards,
  (SELECT count(*) FROM cards k WHERE k.owner_id = u.id AND NOT k.archived AND k.profile_id IS NULL) AS cards_unlinked,
  o.paid_orders,
  o.paid_cents,
  o.first_paid_at,
  o.last_paid_at,
  (SELECT count(*) FROM entitlements t WHERE t.owner_id = u.id AND t.type = 'pro_upgrade' AND t.status = 'paid_unassigned') AS unused_pro_upgrades,
  (SELECT jsonb_array_length(b.items) FROM carts b WHERE b.user_id = u.id) AS basket_lines,
  (SELECT count(*) FROM quotes q WHERE q.user_id = u.id) AS quotes,
  (SELECT count(*) FROM quotes q WHERE q.user_id = u.id AND q.status IN ('new', 'sent') AND (q.expires_at IS NULL OR q.expires_at > now())) AS open_quotes
FROM users u
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE NOT r.archived) AS profiles,
    count(*) FILTER (WHERE NOT r.archived AND r.plan = 'pro') AS pro_profiles,
    coalesce(sum(r.views_total), 0) AS views_total,
    coalesce(sum(r.views_30d), 0) AS views_30d,
    coalesce(sum(r.views_prev_30d), 0) AS views_prev_30d,
    coalesce(sum(r.saves_30d), 0) AS saves_30d,
    coalesce(sum(r.contact_taps_30d), 0) AS contact_taps_30d,
    max(r.last_view_day) AS last_view_day
  FROM insights.profiles r
  WHERE r.owner_user_id = u.id OR r.manager_user_id = u.id
) p ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS paid_orders, coalesce(sum(r.total_cents), 0) AS paid_cents, min(r.paid_at) AS first_paid_at, max(r.paid_at) AS last_paid_at
  FROM orders r
  WHERE r.user_id = u.id AND r.paid_at IS NOT NULL AND r.status NOT IN ('cancelled', 'refunded', 'failed')
) o ON true
WHERE NOT u.is_admin;
--> statement-breakpoint

COMMENT ON VIEW insights.profile_engagement_daily IS 'Public engagement per South African day, per profile, by source and device: views, visitors, saves, contact taps, shares. Excludes the owner and manager. Sum it by week or month for trends, or by company_id or owner_user_id for rollups. Visitors do not add up across rows. Events start June 2026.';
--> statement-breakpoint
COMMENT ON VIEW insights.profiles IS 'One row per profile: owner, manager, company, plan (standard/pro), archived, onboarding stage, linked cards, and views, saves and contact taps in total, the last 30 days and the 30 days before.';
--> statement-breakpoint
COMMENT ON VIEW insights.companies IS 'One row per company: owner, logo, active, Pro and archived profiles, cards and unlinked cards, engagement in total and recent, and paid orders by its owner (repeated if they own several companies).';
--> statement-breakpoint
COMMENT ON VIEW insights.accounts IS 'One row per account (staff excluded): activity, profiles owned or managed, companies, cards, unlinked cards, paid orders and spend, Pro upgrades paid for but unused, basket lines, quotes, and recent engagement.';
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'claude_insights') THEN
    GRANT USAGE ON SCHEMA insights TO claude_insights;
    GRANT SELECT ON ALL TABLES IN SCHEMA insights TO claude_insights;
  END IF;
END $$;
