-- The team funnel for the weekly review, and two fixes to the insights views.

-- Fix: an anonymous visitor (no user) compared equal to a profile with no owner,
-- because NULL IS DISTINCT FROM NULL is false, so their visits were dropped from
-- team profiles, which have no owner. Anonymous events always count now.
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
  AND (e.user_id IS NULL OR (e.user_id IS DISTINCT FROM p.owner_id AND e.user_id IS DISTINCT FROM p.manager_id))
GROUP BY 1, 2, 3, 4, 5, 6;
--> statement-breakpoint

-- Whether the first visit came from a Google Ads click (paid_click), at the end
-- because CREATE OR REPLACE can only add columns there.
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
  (SELECT min(o.paid_at) FROM orders o WHERE o.user_id = u.id AND o.paid_at IS NOT NULL) AS first_paid_at,
  coalesce(u.acquisition ?| array['gclid', 'gbraid', 'wbraid'], false) AS paid_click
FROM users u
LEFT JOIN LATERAL (
  SELECT e.id, e.source, e.meta FROM events e WHERE e.user_id = u.id AND e.name = 'signup_completed' ORDER BY e.created_at LIMIT 1
) sc ON true
WHERE NOT u.is_admin;
--> statement-breakpoint

-- Each stage of the team flow per week, including visitors who never sign up,
-- which user_journeys can't show. Counts only.
CREATE OR REPLACE VIEW insights.team_funnel AS
SELECT
  date_trunc('week', e.created_at AT TIME ZONE 'Africa/Johannesburg')::date AS week,
  CASE WHEN e.name = 'team_step_viewed' THEN 'step_' || coalesce(e.meta->>'step', 'unknown')
       WHEN e.name = 'page_viewed' THEN 'for_teams_page'
       WHEN e.name = 'signup_completed' THEN 'signup_teams'
       ELSE e.name END AS stage,
  coalesce(e.device, 'unknown') AS device,
  count(*) AS events,
  count(DISTINCT e.session_id) AS sessions,
  count(DISTINCT e.user_id) AS users
FROM events e
WHERE (e.name = 'page_viewed' AND e.meta->>'path' = '/for-teams/')
   OR (e.name = 'signup_completed' AND e.meta->>'for' = 'teams')
   OR e.name IN ('team_price_changed', 'team_setup_started', 'team_step_viewed', 'team_site_read', 'team_company_created', 'team_package_chosen', 'quote_requested', 'team_invite_sent', 'team_invite_accepted', 'team_people_added', 'team_names_completed', 'team_artwork_step', 'card_reassigned', 'team_reminder_sent', 'one_card_started')
GROUP BY 1, 2, 3;
--> statement-breakpoint

COMMENT ON VIEW insights.team_funnel IS 'The team flow by week and device: for_teams_page, team_price_changed, team_setup_started, signup_teams, step_company, team_site_read, team_company_created, step_pay, team_package_chosen, quote_requested, then people added. Events, sessions and users per stage, including visitors who never sign up. Join to insights.orders for sales.';
