-- Conversion plan 4.1: the insights schema. Read-only views that return IDs and
-- counts only: never names, emails, phone numbers, addresses, ip_hash or ua_hash.
-- The claude_insights role (scripts/insights-role.ts) may read these views and
-- nothing else; views run with their owner's rights, so it needs no access to
-- the tables underneath. User, profile and order IDs are the app's own integer
-- IDs: meaningless without the tables, which claude_insights can't read.
CREATE SCHEMA IF NOT EXISTS insights;
--> statement-breakpoint

-- Every event that belongs to a known user: their own (user_id), or an anonymous
-- one from the browser session they signed up in (users.first_session_id).
CREATE OR REPLACE VIEW insights.user_journeys AS
SELECT
  coalesce(e.user_id, s.id) AS user_id,
  e.session_id,
  e.name AS event,
  e.created_at AS at,
  e.profile_id,
  e.company_id,
  e.source,
  substring(e.referrer from '^https?://(?:www\.)?([^/:?#]+)') AS referrer_domain,
  e.device,
  e.country,
  e.meta->>'step' AS step,
  e.meta->>'placement' AS placement,
  e.meta->>'offer' AS offer,
  e.meta->>'trigger' AS trigger,
  e.meta->>'path' AS path,
  coalesce(e.meta->>'for', e.meta->>'kind', e.meta->>'method', e.meta->>'surface') AS detail,
  e.meta->>'exp' AS exp,
  (e.user_id IS NULL) AS before_signup
FROM events e
LEFT JOIN users s ON e.user_id IS NULL AND s.first_session_id IS NOT NULL AND s.first_session_id = e.session_id
WHERE e.user_id IS NOT NULL OR s.id IS NOT NULL;
--> statement-breakpoint

-- One row per account: where it came from, what it chose at signup, and when it
-- reached each step of the funnel.
CREATE OR REPLACE VIEW insights.signups AS
SELECT
  u.id AS user_id,
  u.created_at AS signed_up_at,
  sc.source AS signup_method,
  coalesce(sc.meta->>'for', CASE WHEN sc.id IS NULL THEN NULL ELSE 'me' END) AS intent,
  u.account_mode,
  u.acquisition->>'utm_source' AS utm_source,
  u.acquisition->>'utm_medium' AS utm_medium,
  u.acquisition->>'utm_campaign' AS utm_campaign,
  u.acquisition->>'referrer_domain' AS referrer_domain,
  u.acquisition->>'landing_path' AS landing_path,
  (u.acquisition->>'ref_profile_id')::integer AS ref_profile_id,
  (u.acquisition->>'first_seen')::timestamptz AS first_seen_at,
  (u.first_session_id IS NOT NULL) AS session_linked,
  (SELECT count(*) FROM profiles p WHERE p.owner_id = u.id AND NOT p.archived) AS profiles,
  (SELECT min(e.created_at) FROM events e WHERE e.user_id = u.id AND e.name = 'onboarding_completed') AS published_at,
  (SELECT min(e.created_at) FROM events e JOIN profiles p ON p.id = e.profile_id
     WHERE p.owner_id = u.id AND e.name = 'profile_viewed' AND e.user_id IS DISTINCT FROM u.id) AS first_external_view_at,
  (SELECT min(e.created_at) FROM events e WHERE e.user_id = u.id AND e.name = 'upsell_viewed') AS upsell_seen_at,
  (SELECT min(e.created_at) FROM events e WHERE e.user_id = u.id AND e.name = 'checkout_started') AS checkout_started_at,
  (SELECT min(o.paid_at) FROM orders o WHERE o.user_id = u.id AND o.paid_at IS NOT NULL) AS first_paid_at
FROM users u
LEFT JOIN LATERAL (
  SELECT e.id, e.source, e.meta FROM events e WHERE e.user_id = u.id AND e.name = 'signup_completed' ORDER BY e.created_at LIMIT 1
) sc ON true
WHERE NOT u.is_admin;
--> statement-breakpoint

-- Public profile engagement per day, by source and device.
CREATE OR REPLACE VIEW insights.engagement_daily AS
SELECT
  (e.created_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
  coalesce(e.source, 'direct') AS source,
  coalesce(e.device, 'unknown') AS device,
  count(*) FILTER (WHERE e.name = 'profile_viewed') AS profile_views,
  count(DISTINCT e.profile_id) FILTER (WHERE e.name = 'profile_viewed') AS profiles_viewed,
  count(*) FILTER (WHERE e.name = 'vcard_downloaded') AS saves,
  count(*) FILTER (WHERE e.name = 'contact_action') AS contact_taps,
  count(*) FILTER (WHERE e.name = 'share_intent') AS shares,
  count(*) FILTER (WHERE e.name IN ('recipient_ad_viewed', 'post_save_cta_viewed')) AS viral_cta_views,
  count(*) FILTER (WHERE e.name IN ('recipient_ad_clicked', 'post_save_cta_clicked')) AS viral_cta_clicks
FROM events e
WHERE e.name IN ('profile_viewed', 'vcard_downloaded', 'contact_action', 'share_intent',
                 'recipient_ad_viewed', 'post_save_cta_viewed', 'recipient_ad_clicked', 'post_save_cta_clicked')
GROUP BY 1, 2, 3;
--> statement-breakpoint

-- Orders with what kind of purchase they were. product_type: team (2 or more
-- bundles, cards/tags or Pro upgrades), bundle (one classic or custom bundle),
-- single (one card or tag, with or without a Pro upgrade), pro (one Pro upgrade
-- only), other. Product IDs: bundles 2044 / 11160, Pro upgrade 41811.
CREATE OR REPLACE VIEW insights.orders AS
SELECT
  o.id AS order_id,
  o.user_id,
  o.created_at AS ordered_at,
  o.paid_at,
  o.status,
  o.payment_method,
  o.total_cents,
  o.discount_cents,
  o.shipping_cents,
  (o.coupon_code <> '') AS used_coupon,
  i.units,
  CASE
    WHEN i.bundles >= 2 OR i.units - i.bundles - i.pro_units >= 2 OR i.pro_units >= 2 THEN 'team'
    WHEN i.bundles = 1 THEN 'bundle'
    WHEN i.units - i.pro_units = 1 THEN 'single'
    WHEN i.pro_units = 1 AND i.units = 1 THEN 'pro'
    ELSE 'other'
  END AS product_type,
  i.product_ids
FROM orders o
LEFT JOIN LATERAL (
  SELECT
    coalesce(sum(oi.quantity), 0) AS units,
    coalesce(sum(oi.quantity) FILTER (WHERE oi.product_id IN (2044, 11160)), 0) AS bundles,
    coalesce(sum(oi.quantity) FILTER (WHERE oi.product_id = 41811), 0) AS pro_units,
    array_agg(DISTINCT oi.product_id) AS product_ids
  FROM order_items oi WHERE oi.order_id = o.id
) i ON true;
--> statement-breakpoint

-- What each view answers, for the MCP schema tool.
COMMENT ON VIEW insights.user_journeys IS 'One row per event of each known user, including their anonymous events before signup (before_signup). For per-user path reviews: order by user_id, at.';
--> statement-breakpoint
COMMENT ON VIEW insights.signups IS 'One row per account (staff excluded): signup time, method, intent (me/teams), first-touch source, and when it published, got its first external view, saw an upsell, started checkout and first paid.';
--> statement-breakpoint
COMMENT ON VIEW insights.engagement_daily IS 'Public profile engagement per South African day, by source and device: views, saves (vCard), contact taps, shares, viral CTA views and clicks.';
--> statement-breakpoint
COMMENT ON VIEW insights.orders IS 'One row per order: user, order and paid times, status, payment method, totals in cents, units and product_type (single, pro, bundle, team, other).';
--> statement-breakpoint

-- Keep claude_insights' read access when these views are recreated (once the role exists).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'claude_insights') THEN
    GRANT USAGE ON SCHEMA insights TO claude_insights;
    GRANT SELECT ON ALL TABLES IN SCHEMA insights TO claude_insights;
  END IF;
END $$;
