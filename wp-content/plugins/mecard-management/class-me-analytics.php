<?php
namespace Me\Analytics;

if ( ! defined( 'ABSPATH' ) ) {
    return;
}

class Module {

    const CACHE_TTL = 300; // 5 minutes

    public static function init(): void {
        add_action( 'admin_menu', [ __CLASS__, 'register_admin_page' ] );
    }

    // ─── Admin page registration ─────────────────────────────

    public static function register_admin_page(): void {
        add_menu_page(
            'MeCard Analytics',
            'MeCard Analytics',
            'manage_options',
            'mecard-analytics',
            [ __CLASS__, 'render_page' ],
            'dashicons-chart-area',
            58
        );
    }

    // ─── Page render ─────────────────────────────────────────

    public static function render_page(): void {
        $range   = isset( $_GET['range'] ) ? sanitize_key( $_GET['range'] ) : '90d';
        $nocache = isset( $_GET['nocache'] );

        $ranges = [
            '30d'    => [ 'label' => 'Last 30 days',   'days' => 30 ],
            '90d'    => [ 'label' => 'Last 90 days',   'days' => 90 ],
            '12m'    => [ 'label' => 'Last 12 months', 'days' => 365 ],
            'custom' => [ 'label' => 'Custom range',   'days' => 0 ],
        ];

        // Custom date range from inputs.
        $custom_from = isset( $_GET['date_from'] ) ? sanitize_text_field( $_GET['date_from'] ) : '';
        $custom_to   = isset( $_GET['date_to'] )   ? sanitize_text_field( $_GET['date_to'] )   : '';

        if ( $range === 'custom' && $custom_from && $custom_to ) {
            $date_from = gmdate( 'Y-m-d 00:00:00', strtotime( $custom_from ) );
            $date_to   = gmdate( 'Y-m-d 23:59:59', strtotime( $custom_to ) );
            $days      = max( 1, (int) round( ( strtotime( $date_to ) - strtotime( $date_from ) ) / DAY_IN_SECONDS ) );
        } else {
            if ( ! isset( $ranges[ $range ] ) || $range === 'custom' ) {
                $range = '90d';
            }
            $days      = $ranges[ $range ]['days'];
            $date_from = gmdate( 'Y-m-d H:i:s', strtotime( "-{$days} days" ) );
            $date_to   = current_time( 'mysql', true );
        }

        // Prior period for deltas (same length, immediately before).
        $prior_from = gmdate( 'Y-m-d H:i:s', strtotime( $date_from ) - $days * DAY_IN_SECONDS );
        $prior_to   = $date_from;

        $kpis         = self::get_kpis( $date_from, $date_to, $prior_from, $prior_to, $nocache );
        $funnel       = self::get_onboarding_funnel( $date_from, $date_to, $nocache );
        $engagement   = self::get_engagement( $date_from, $date_to, $prior_from, $prior_to, $nocache );
        $monetisation = self::get_monetisation( $date_from, $date_to, $nocache );
        $geo          = self::get_geo( $date_from, $date_to, $nocache );
        $segments     = self::get_segments( $nocache );
        $time_series  = self::get_signups_time_series( $date_from, $date_to, $nocache );
        $view_series  = self::get_views_time_series( $date_from, $date_to, $nocache );
        $callouts     = self::generate_callouts( $funnel, $kpis, $engagement );
        $team         = self::get_team_analytics( $date_from, $date_to, $prior_from, $prior_to, $nocache );

        self::render_html( $range, $ranges, $kpis, $funnel, $engagement, $monetisation, $geo, $segments, $time_series, $view_series, $callouts, $custom_from, $custom_to, $team );
    }

    // ─── Query helpers ───────────────────────────────────────

    private static function events_table(): string {
        global $wpdb;
        return $wpdb->prefix . 'mecard_events';
    }

    private static function table_exists(): bool {
        global $wpdb;
        $table = self::events_table();
        return (bool) $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" );
    }

    private static function cached( string $key, bool $nocache, callable $cb ) {
        if ( ! $nocache ) {
            $cached = get_transient( $key );
            if ( $cached !== false ) {
                return $cached;
            }
        }
        $value = $cb();
        set_transient( $key, $value, self::CACHE_TTL );
        return $value;
    }

    private static function count_event( string $event, string $from, string $to ): int {
        global $wpdb;
        $table = self::events_table();
        return (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$table} WHERE event_name = %s AND created_at BETWEEN %s AND %s",
            $event, $from, $to
        ) );
    }

    private static function count_distinct_users( string $event, string $from, string $to ): int {
        global $wpdb;
        $table = self::events_table();
        return (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(DISTINCT user_id) FROM {$table} WHERE event_name = %s AND user_id IS NOT NULL AND created_at BETWEEN %s AND %s",
            $event, $from, $to
        ) );
    }

    // ─── KPIs ────────────────────────────────────────────────

    private static function get_kpis( string $from, string $to, string $pfrom, string $pto, bool $nocache ): array {
        $key = 'mecard_dash_kpis_' . md5( $from . $to );
        return self::cached( $key, $nocache, function () use ( $from, $to, $pfrom, $pto ) {
            if ( ! self::table_exists() ) {
                return self::empty_kpis();
            }

            global $wpdb;
            $table = self::events_table();

            $signups      = self::count_event( 'signup_completed', $from, $to );
            $signups_prev = self::count_event( 'signup_completed', $pfrom, $pto );

            $completed      = self::count_event( 'onboarding_completed', $from, $to );
            $completed_prev = self::count_event( 'onboarding_completed', $pfrom, $pto );

            $onboarding_pct      = $signups > 0 ? round( $completed / $signups * 100, 1 ) : 0;
            $onboarding_pct_prev = $signups_prev > 0 ? round( $completed_prev / $signups_prev * 100, 1 ) : 0;

            // Pro conversion: purchases with purchase_type = pro_upgrade or bundle.
            $pro_purchases = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE event_name = 'purchase' AND created_at BETWEEN %s AND %s
                 AND (JSON_EXTRACT(meta, '$.purchase_type') IN ('\"pro_upgrade\"', '\"bundle\"'))",
                $from, $to
            ) );
            $pro_purchases_prev = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE event_name = 'purchase' AND created_at BETWEEN %s AND %s
                 AND (JSON_EXTRACT(meta, '$.purchase_type') IN ('\"pro_upgrade\"', '\"bundle\"'))",
                $pfrom, $pto
            ) );
            $pro_pct      = $signups > 0 ? round( $pro_purchases / $signups * 100, 1 ) : 0;
            $pro_pct_prev = $signups_prev > 0 ? round( $pro_purchases_prev / $signups_prev * 100, 1 ) : 0;

            // Revenue.
            $revenue = (float) $wpdb->get_var( $wpdb->prepare(
                "SELECT COALESCE(SUM(JSON_EXTRACT(meta, '$.total')), 0) FROM {$table}
                 WHERE event_name = 'purchase' AND created_at BETWEEN %s AND %s",
                $from, $to
            ) );
            $revenue_prev = (float) $wpdb->get_var( $wpdb->prepare(
                "SELECT COALESCE(SUM(JSON_EXTRACT(meta, '$.total')), 0) FROM {$table}
                 WHERE event_name = 'purchase' AND created_at BETWEEN %s AND %s",
                $pfrom, $pto
            ) );
            $arps      = $signups > 0 ? round( $revenue / $signups, 2 ) : 0;
            $arps_prev = $signups_prev > 0 ? round( $revenue_prev / $signups_prev, 2 ) : 0;

            // Active profiles (30d) — distinct profiles with profile_viewed.
            $active = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(DISTINCT profile_id) FROM {$table}
                 WHERE event_name = 'profile_viewed' AND profile_id IS NOT NULL
                 AND created_at >= %s",
                gmdate( 'Y-m-d H:i:s', strtotime( '-30 days' ) )
            ) );
            $active_prev = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(DISTINCT profile_id) FROM {$table}
                 WHERE event_name = 'profile_viewed' AND profile_id IS NOT NULL
                 AND created_at BETWEEN %s AND %s",
                gmdate( 'Y-m-d H:i:s', strtotime( '-60 days' ) ),
                gmdate( 'Y-m-d H:i:s', strtotime( '-30 days' ) )
            ) );

            return [
                'signups'              => $signups,
                'signups_delta'        => self::delta( $signups, $signups_prev ),
                'onboarding_pct'       => $onboarding_pct,
                'onboarding_pct_delta' => self::pp_delta( $onboarding_pct, $onboarding_pct_prev ),
                'pro_pct'              => $pro_pct,
                'pro_pct_delta'        => self::pp_delta( $pro_pct, $pro_pct_prev ),
                'arps'                 => $arps,
                'arps_delta'           => round( $arps - $arps_prev, 2 ),
                'active'               => $active,
                'active_delta'         => self::delta( $active, $active_prev ),
            ];
        } );
    }

    private static function empty_kpis(): array {
        return [
            'signups' => 0, 'signups_delta' => 0,
            'onboarding_pct' => 0, 'onboarding_pct_delta' => 0,
            'pro_pct' => 0, 'pro_pct_delta' => 0,
            'arps' => 0, 'arps_delta' => 0,
            'active' => 0, 'active_delta' => 0,
        ];
    }

    // ─── Onboarding funnel ───────────────────────────────────

    private static function get_onboarding_funnel( string $from, string $to, bool $nocache ): array {
        $key = 'mecard_dash_funnel_' . md5( $from . $to );
        return self::cached( $key, $nocache, function () use ( $from, $to ) {
            if ( ! self::table_exists() ) {
                return [];
            }

            $steps = [
                [ 'label' => 'Sign up',             'event' => 'signup_completed' ],
                [ 'label' => 'Profile step 1',      'event' => 'profile_step1_saved' ],
                [ 'label' => 'Profile step 2',      'event' => 'profile_step2_saved' ],
                [ 'label' => 'Confirm look',         'event' => 'look_confirmed' ],
                [ 'label' => 'Add to Home Screen',  'event' => 'a2hs_accepted' ],
                [ 'label' => 'Onboarding complete', 'event' => 'onboarding_completed' ],
                [ 'label' => 'Made a purchase',    'event' => 'purchase' ],
            ];

            $result = [];
            $prev_count = 0;
            foreach ( $steps as $i => $step ) {
                $count = self::count_distinct_users( $step['event'], $from, $to );
                $conv  = ( $i === 0 || $prev_count === 0 ) ? 100 : round( $count / $prev_count * 100, 0 );
                $drop  = $i === 0 ? 0 : $prev_count - $count;
                $result[] = [
                    'label' => $step['label'],
                    'count' => $count,
                    'conv'  => $conv,
                    'drop'  => $drop,
                ];
                $prev_count = $count;
            }
            return $result;
        } );
    }

    // ─── Engagement ──────────────────────────────────────────

    private static function get_engagement( string $from, string $to, string $pfrom, string $pto, bool $nocache ): array {
        $key = 'mecard_dash_engage_' . md5( $from . $to );
        return self::cached( $key, $nocache, function () use ( $from, $to, $pfrom, $pto ) {
            if ( ! self::table_exists() ) {
                return [
                    'views_tap' => 0, 'views_direct' => 0,
                    'vcards' => 0, 'vcards_delta' => 0,
                    'forms' => 0, 'forms_delta' => 0,
                    'ad_views' => 0, 'ad_views_delta' => 0,
                    'share_methods' => [],
                ];
            }

            global $wpdb;
            $table = self::events_table();

            // View split by entry_url_pattern.
            $views_tap = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table}
                 WHERE event_name = 'profile_viewed' AND created_at BETWEEN %s AND %s
                 AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.entry_url_pattern')) = 't'",
                $from, $to
            ) );
            $views_direct = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table}
                 WHERE event_name = 'profile_viewed' AND created_at BETWEEN %s AND %s
                 AND (JSON_UNQUOTE(JSON_EXTRACT(meta, '$.entry_url_pattern')) = 'mecard-profile'
                      OR JSON_EXTRACT(meta, '$.entry_url_pattern') IS NULL)",
                $from, $to
            ) );

            $vcards      = self::count_event( 'vcard_downloaded', $from, $to );
            $vcards_prev = self::count_event( 'vcard_downloaded', $pfrom, $pto );

            $forms      = self::count_event( 'contact_form_submitted', $from, $to );
            $forms_prev = self::count_event( 'contact_form_submitted', $pfrom, $pto );

            $ads      = self::count_event( 'recipient_ad_viewed', $from, $to );
            $ads_prev = self::count_event( 'recipient_ad_viewed', $pfrom, $pto );

            // Share methods breakdown.
            $share_rows = $wpdb->get_results( $wpdb->prepare(
                "SELECT JSON_UNQUOTE(JSON_EXTRACT(meta, '$.method')) AS method, COUNT(*) AS cnt
                 FROM {$table}
                 WHERE event_name = 'share_intent' AND created_at BETWEEN %s AND %s
                 GROUP BY method ORDER BY cnt DESC",
                $from, $to
            ) );
            $share_methods = [];
            foreach ( $share_rows as $row ) {
                $share_methods[ $row->method ?: 'unknown' ] = (int) $row->cnt;
            }

            return [
                'views_tap'    => $views_tap,
                'views_direct' => $views_direct,
                'vcards'       => $vcards,
                'vcards_delta' => self::delta( $vcards, $vcards_prev ),
                'forms'        => $forms,
                'forms_delta'  => self::delta( $forms, $forms_prev ),
                'ad_views'     => $ads,
                'ad_views_delta' => self::delta( $ads, $ads_prev ),
                'share_methods' => $share_methods,
            ];
        } );
    }

    // ─── Monetisation ────────────────────────────────────────

    private static function get_monetisation( string $from, string $to, bool $nocache ): array {
        $key = 'mecard_dash_monet_' . md5( $from . $to );
        return self::cached( $key, $nocache, function () use ( $from, $to ) {
            if ( ! self::table_exists() ) {
                return [ 'upsell_clicked' => 0, 'purchases_pro' => 0, 'purchases_bundle' => 0, 'purchases_card' => 0 ];
            }

            global $wpdb;
            $table = self::events_table();

            $upsell_clicked = self::count_event( 'pro_upsell_clicked', $from, $to );

            $purchase_types = $wpdb->get_results( $wpdb->prepare(
                "SELECT JSON_UNQUOTE(JSON_EXTRACT(meta, '$.purchase_type')) AS ptype, COUNT(*) AS cnt
                 FROM {$table}
                 WHERE event_name = 'purchase' AND created_at BETWEEN %s AND %s
                 GROUP BY ptype",
                $from, $to
            ) );
            $by_type = [];
            foreach ( $purchase_types as $row ) {
                $by_type[ $row->ptype ] = (int) $row->cnt;
            }

            return [
                'upsell_clicked'  => $upsell_clicked,
                'purchases_pro'   => ( $by_type['pro_upgrade'] ?? 0 ) + ( $by_type['bundle'] ?? 0 ),
                'purchases_card'  => $by_type['card'] ?? 0,
                'purchases_total' => array_sum( $by_type ),
            ];
        } );
    }

    // ─── Geography ───────────────────────────────────────────

    private static function get_geo( string $from, string $to, bool $nocache ): array {
        $key = 'mecard_dash_geo_' . md5( $from . $to );
        return self::cached( $key, $nocache, function () use ( $from, $to ) {
            if ( ! self::table_exists() ) {
                return [];
            }

            global $wpdb;
            $table = self::events_table();

            $rows = $wpdb->get_results( $wpdb->prepare(
                "SELECT COALESCE(country, '--') AS country, COUNT(*) AS cnt
                 FROM {$table}
                 WHERE event_name = 'profile_viewed' AND created_at BETWEEN %s AND %s
                 GROUP BY country ORDER BY cnt DESC LIMIT 10",
                $from, $to
            ) );

            $result = [];
            $total  = 0;
            foreach ( $rows as $row ) {
                $total += (int) $row->cnt;
            }
            foreach ( $rows as $row ) {
                $result[] = [
                    'country' => $row->country,
                    'views'   => (int) $row->cnt,
                    'share'   => $total > 0 ? round( $row->cnt / $total * 100, 1 ) : 0,
                ];
            }
            return $result;
        } );
    }

    // ─── Segments ────────────────────────────────────────────

    private static function get_segments( bool $nocache ): array {
        $key = 'mecard_dash_segments_v1';
        return self::cached( $key, $nocache, function () {
            global $wpdb;

            $bundle_ids = array_filter( [
                defined( 'MECARD_BUNDLE_PRODUCT_ID' )         ? (int) MECARD_BUNDLE_PRODUCT_ID         : 0,
                defined( 'MECARD_CLASSIC_BUNDLE_PRODUCT_ID' ) ? (int) MECARD_CLASSIC_BUNDLE_PRODUCT_ID : 0,
                defined( 'MECARD_CLASSIC_CORP_PRODUCT_ID' )   ? (int) MECARD_CLASSIC_CORP_PRODUCT_ID   : 0,
            ] );

            // Get all users with profiles.
            $users = $wpdb->get_results(
                "SELECT post_author AS user_id, COUNT(*) AS profile_count
                 FROM {$wpdb->posts}
                 WHERE post_type = 'mecard-profile' AND post_status IN ('publish','private')
                 GROUP BY post_author"
            );

            $single = 0;
            $team_intent = 0;
            $team_converted = 0;

            foreach ( $users as $u ) {
                $uid = (int) $u->user_id;
                $pc  = (int) $u->profile_count;
                if ( $uid <= 0 ) continue;

                $is_bundle_first = false;
                if ( ! empty( $bundle_ids ) && function_exists( 'wc_get_orders' ) ) {
                    $orders = wc_get_orders( [
                        'customer_id' => $uid,
                        'limit'       => 1,
                        'orderby'     => 'date',
                        'order'       => 'ASC',
                        'status'      => [ 'completed', 'processing', 'on-hold' ],
                        'return'      => 'ids',
                    ] );
                    if ( ! empty( $orders ) ) {
                        $order = wc_get_order( $orders[0] );
                        if ( $order ) {
                            foreach ( $order->get_items() as $item ) {
                                if ( in_array( (int) $item->get_product_id(), $bundle_ids, true ) ) {
                                    $is_bundle_first = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                if ( $is_bundle_first ) {
                    $team_intent++;
                } elseif ( $pc > 1 ) {
                    $team_converted++;
                } else {
                    $single++;
                }
            }

            $total = $single + $team_intent + $team_converted;
            return [
                'single'         => $single,
                'team_intent'    => $team_intent,
                'team_converted' => $team_converted,
                'total'          => $total,
            ];
        } );
    }

    // ─── Team analytics ───────────────────────────────────────

    private static function get_team_analytics( string $from, string $to, string $pfrom, string $pto, bool $nocache ): array {
        $key = 'mecard_dash_team_' . md5( $from . $to );
        return self::cached( $key, $nocache, function () use ( $from, $to, $pfrom, $pto ) {
            global $wpdb;

            if ( ! self::table_exists() ) {
                return [
                    'companies_created'       => 0,
                    'companies_created_delta'  => 0,
                    'members_added'            => 0,
                    'members_added_delta'      => 0,
                    'bundle_purchases'         => 0,
                    'bundle_purchases_delta'   => 0,
                    'bundle_revenue'           => 0,
                    'bundle_revenue_delta'     => 0,
                    'team_profiles_active'     => 0,
                    'team_profiles_active_delta' => 0,
                    'funnel'                   => [],
                ];
            }

            $table = self::events_table();

            // Companies created
            $companies_now  = self::count_event( 'team_company_created', $from, $to );
            $companies_prev = self::count_event( 'team_company_created', $pfrom, $pto );

            // Members added
            $members_now  = self::count_event( 'team_member_added', $from, $to );
            $members_prev = self::count_event( 'team_member_added', $pfrom, $pto );

            // Bundle purchases (purchase_type = 'bundle')
            $bundle_now = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table}
                 WHERE event_name = 'purchase' AND created_at BETWEEN %s AND %s
                 AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.purchase_type')) = 'bundle'",
                $from, $to
            ) );
            $bundle_prev = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table}
                 WHERE event_name = 'purchase' AND created_at BETWEEN %s AND %s
                 AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.purchase_type')) = 'bundle'",
                $pfrom, $pto
            ) );

            // Bundle revenue
            $bundle_rev_now = (float) $wpdb->get_var( $wpdb->prepare(
                "SELECT COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.total')) AS DECIMAL(10,2))), 0)
                 FROM {$table}
                 WHERE event_name = 'purchase' AND created_at BETWEEN %s AND %s
                 AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.purchase_type')) = 'bundle'",
                $from, $to
            ) );
            $bundle_rev_prev = (float) $wpdb->get_var( $wpdb->prepare(
                "SELECT COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.total')) AS DECIMAL(10,2))), 0)
                 FROM {$table}
                 WHERE event_name = 'purchase' AND created_at BETWEEN %s AND %s
                 AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.purchase_type')) = 'bundle'",
                $pfrom, $pto
            ) );

            // Active team profiles (profiles linked to a company with views in period)
            $team_active_now = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(DISTINCT e.profile_id)
                 FROM {$table} e
                 INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = e.profile_id AND pm.meta_key = 'wpcf-company-parent' AND pm.meta_value > 0
                 WHERE e.event_name = 'profile_viewed' AND e.profile_id IS NOT NULL
                 AND e.created_at BETWEEN %s AND %s",
                $from, $to
            ) );
            $team_active_prev = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(DISTINCT e.profile_id)
                 FROM {$table} e
                 INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = e.profile_id AND pm.meta_key = 'wpcf-company-parent' AND pm.meta_value > 0
                 WHERE e.event_name = 'profile_viewed' AND e.profile_id IS NOT NULL
                 AND e.created_at BETWEEN %s AND %s",
                $pfrom, $pto
            ) );

            // Team funnel — all-time counts for meaningful funnel
            // Step 1: Users who purchased a bundle (team-intent signal)
            $f_bundle = (int) $wpdb->get_var(
                "SELECT COUNT(DISTINCT user_id) FROM {$table}
                 WHERE event_name = 'purchase' AND user_id IS NOT NULL
                 AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.purchase_type')) = 'bundle'"
            );

            // Step 2: Users who created a company
            $f_company = (int) $wpdb->get_var(
                "SELECT COUNT(DISTINCT user_id) FROM {$table}
                 WHERE event_name = 'team_company_created' AND user_id IS NOT NULL"
            );

            // Step 3: Users who added at least one team member
            $f_member = (int) $wpdb->get_var(
                "SELECT COUNT(DISTINCT user_id) FROM {$table}
                 WHERE event_name = 'team_member_added' AND user_id IS NOT NULL"
            );

            // Step 4: Team users whose profiles received at least one view
            // (users who have both a purchase + a profile_viewed event)
            $f_active = (int) $wpdb->get_var(
                "SELECT COUNT(DISTINCT p.user_id)
                 FROM (SELECT DISTINCT user_id FROM {$table}
                       WHERE event_name = 'purchase' AND user_id IS NOT NULL
                       AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.purchase_type')) = 'bundle') p
                 INNER JOIN (SELECT DISTINCT e.user_id FROM {$table} e
                       INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = e.profile_id
                       AND pm.meta_key = 'wpcf-company-parent' AND pm.meta_value > 0
                       WHERE e.event_name = 'profile_viewed' AND e.profile_id IS NOT NULL) v
                 ON p.user_id = v.user_id"
            );

            $funnel = [];
            $steps = [
                [ 'label' => 'Bundle purchased', 'count' => $f_bundle ],
                [ 'label' => 'Company created',  'count' => $f_company ],
                [ 'label' => 'Member added',     'count' => $f_member ],
                [ 'label' => 'Profile viewed',   'count' => $f_active ],
            ];
            $prev_count = 0;
            foreach ( $steps as $i => $step ) {
                $conv = ( $i === 0 || $prev_count === 0 ) ? 100 : round( $step['count'] / $prev_count * 100, 0 );
                $drop = $i === 0 ? 0 : $prev_count - $step['count'];
                $funnel[] = [
                    'label' => $step['label'],
                    'count' => $step['count'],
                    'conv'  => $conv,
                    'drop'  => $drop,
                ];
                $prev_count = $step['count'];
            }

            return [
                'companies_created'         => $companies_now,
                'companies_created_delta'   => self::delta( $companies_now, $companies_prev ),
                'members_added'             => $members_now,
                'members_added_delta'       => self::delta( $members_now, $members_prev ),
                'bundle_purchases'          => $bundle_now,
                'bundle_purchases_delta'    => self::delta( $bundle_now, $bundle_prev ),
                'bundle_revenue'            => $bundle_rev_now,
                'bundle_revenue_delta'      => self::delta( $bundle_rev_now, $bundle_rev_prev ),
                'team_profiles_active'      => $team_active_now,
                'team_profiles_active_delta' => self::delta( $team_active_now, $team_active_prev ),
                'funnel'                    => $funnel,
            ];
        } );
    }

    // ─── Time series ─────────────────────────────────────────

    private static function get_signups_time_series( string $from, string $to, bool $nocache ): array {
        $key = 'mecard_dash_signups_ts_' . md5( $from . $to );
        return self::cached( $key, $nocache, function () use ( $from, $to ) {
            if ( ! self::table_exists() ) {
                return [ 'labels' => [], 'data' => [] ];
            }
            global $wpdb;
            $table = self::events_table();
            $rows = $wpdb->get_results( $wpdb->prepare(
                "SELECT DATE(created_at) AS d, COUNT(*) AS cnt
                 FROM {$table}
                 WHERE event_name = 'signup_completed' AND created_at BETWEEN %s AND %s
                 GROUP BY d ORDER BY d",
                $from, $to
            ) );
            $labels = [];
            $data   = [];
            foreach ( $rows as $row ) {
                $labels[] = $row->d;
                $data[]   = (int) $row->cnt;
            }
            return [ 'labels' => $labels, 'data' => $data ];
        } );
    }

    private static function get_views_time_series( string $from, string $to, bool $nocache ): array {
        $key = 'mecard_dash_views_ts_' . md5( $from . $to );
        return self::cached( $key, $nocache, function () use ( $from, $to ) {
            if ( ! self::table_exists() ) {
                return [ 'labels' => [], 'tap' => [], 'direct' => [] ];
            }
            global $wpdb;
            $table = self::events_table();

            $rows = $wpdb->get_results( $wpdb->prepare(
                "SELECT DATE(created_at) AS d,
                    SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(meta, '$.entry_url_pattern')) = 't' THEN 1 ELSE 0 END) AS tap,
                    SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(meta, '$.entry_url_pattern')) != 't' OR JSON_EXTRACT(meta, '$.entry_url_pattern') IS NULL THEN 1 ELSE 0 END) AS direct
                 FROM {$table}
                 WHERE event_name = 'profile_viewed' AND created_at BETWEEN %s AND %s
                 GROUP BY d ORDER BY d",
                $from, $to
            ) );

            $labels = [];
            $tap    = [];
            $direct = [];
            foreach ( $rows as $row ) {
                $labels[] = $row->d;
                $tap[]    = (int) $row->tap;
                $direct[] = (int) $row->direct;
            }
            return [ 'labels' => $labels, 'tap' => $tap, 'direct' => $direct ];
        } );
    }

    // ─── Callouts ────────────────────────────────────────────

    private static function generate_callouts( array $funnel, array $kpis, array $engagement ): array {
        $callouts = [];

        // Flag funnel steps with low conversion.
        foreach ( $funnel as $i => $step ) {
            if ( $i === 0 ) continue;
            if ( $step['conv'] < 55 && $step['count'] > 0 ) {
                $callouts[] = '<strong>Critical drop-off:</strong> ' . esc_html( $step['label'] ) . ' has only ' . $step['conv'] . '% step conversion (' . number_format( $step['drop'] ) . ' users lost).';
            } elseif ( $step['conv'] < 75 && $step['count'] > 0 ) {
                $callouts[] = '<strong>Watch:</strong> ' . esc_html( $step['label'] ) . ' step conversion is ' . $step['conv'] . '%.';
            }
        }

        // Flag low onboarding completion.
        if ( $kpis['signups'] > 10 && $kpis['onboarding_pct'] < 50 ) {
            $callouts[] = '<strong>Onboarding completion</strong> is ' . $kpis['onboarding_pct'] . '% &mdash; less than half of signups finish.';
        }

        // Flag if no data.
        if ( $kpis['signups'] === 0 ) {
            $callouts[] = '<strong>No signup events</strong> recorded in this period. Check that tracking is firing correctly.';
        }

        return $callouts;
    }

    // ─── Delta helpers ───────────────────────────────────────

    private static function delta( $current, $previous ): float {
        if ( $previous == 0 ) {
            return $current > 0 ? 100 : 0;
        }
        return round( ( $current - $previous ) / $previous * 100, 1 );
    }

    private static function pp_delta( float $current, float $previous ): float {
        return round( $current - $previous, 1 );
    }

    private static function render_delta( $value, string $unit = '%', string $prefix = '' ): string {
        if ( $value > 0 ) {
            return '<span class="mecard-delta mecard-delta--up">&triangle; ' . esc_html( $prefix . abs( $value ) . $unit ) . '</span>';
        } elseif ( $value < 0 ) {
            return '<span class="mecard-delta mecard-delta--down">&dtri; ' . esc_html( $prefix . abs( $value ) . $unit ) . '</span>';
        }
        return '<span class="mecard-delta mecard-delta--flat">&rtrif; flat</span>';
    }

    private static function render_pp_delta( float $value ): string {
        if ( $value > 0 ) {
            return '<span class="mecard-delta mecard-delta--up">&triangle; ' . abs( $value ) . 'pp</span>';
        } elseif ( $value < 0 ) {
            return '<span class="mecard-delta mecard-delta--down">&dtri; ' . abs( $value ) . 'pp</span>';
        }
        return '<span class="mecard-delta mecard-delta--flat">&rtrif; flat</span>';
    }

    // ─── HTML output ─────────────────────────────────────────

    private static function render_html( string $range, array $ranges, array $kpis, array $funnel, array $engagement, array $monetisation, array $geo, array $segments, array $time_series, array $view_series, array $callouts, string $custom_from = '', string $custom_to = '', array $team = [] ): void {
        $page_url = admin_url( 'admin.php?page=mecard-analytics' );
        ?>
        <style>
            .mecard-dash { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1200px; }
            .mecard-dash h1 { font-size: 22px; font-weight: 600; margin: 0 0 20px; }
            .mecard-toolbar { display: flex; gap: 12px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; }
            .mecard-toolbar select { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
            .mecard-toolbar input[type="date"] { padding: 5px 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
            .mecard-toolbar .mecard-custom-range { display: none; align-items: center; gap: 8px; }
            .mecard-toolbar .mecard-custom-range.active { display: flex; }
            .mecard-toolbar .mecard-btn-apply { padding: 6px 14px; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; background: #3b82f6; color: #fff; cursor: pointer; }
            .mecard-toolbar .mecard-btn-apply:hover { background: #2563eb; }
            .mecard-grid { display: grid; gap: 16px; margin-bottom: 20px; }
            .mecard-grid--kpis { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
            .mecard-grid--2 { grid-template-columns: 1fr 1fr; }
            .mecard-grid--3 { grid-template-columns: repeat(3, 1fr); }
            .mecard-card { background: #fff; border: 1px solid #e5e9f0; border-radius: 10px; padding: 18px 20px; }
            .mecard-card h3 { margin: 0 0 10px; font-size: 12px; font-weight: 600; color: #6b7488; text-transform: uppercase; letter-spacing: 0.4px; }
            .mecard-kpi-value { font-size: 28px; font-weight: 700; margin: 0; }
            .mecard-delta { font-size: 12px; font-weight: 500; margin-top: 4px; display: inline-block; }
            .mecard-delta--up { color: #16a34a; }
            .mecard-delta--down { color: #dc2626; }
            .mecard-delta--flat { color: #6b7488; }
            .mecard-section { font-size: 16px; font-weight: 600; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e9f0; }
            .mecard-callout { background: linear-gradient(135deg, #dbeafe, #e0e7ff); border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px 18px; margin-bottom: 20px; }
            .mecard-callout h4 { margin: 0 0 8px; font-size: 13px; color: #1e40af; }
            .mecard-callout ul { margin: 6px 0 0 18px; padding: 0; font-size: 13px; color: #1e3a8a; }
            .mecard-callout li { margin-bottom: 4px; }
            .mecard-funnel { display: flex; flex-direction: column; gap: 6px; }
            .mecard-funnel-row { display: grid; grid-template-columns: 180px 1fr 80px 70px; gap: 10px; align-items: center; font-size: 13px; }
            .mecard-funnel-bar { height: 28px; border-radius: 4px; color: #fff; padding: 0 10px; display: flex; align-items: center; font-weight: 500; font-size: 12px; }
            .mecard-funnel-bar--good { background: linear-gradient(90deg, #1f6feb, #0d9488); }
            .mecard-funnel-bar--warn { background: linear-gradient(90deg, #f59e0b, #d97706); }
            .mecard-funnel-bar--bad { background: linear-gradient(90deg, #f87171, #dc2626); }
            .mecard-funnel-conv { text-align: right; font-weight: 600; }
            .mecard-funnel-conv--good { color: #16a34a; }
            .mecard-funnel-conv--warn { color: #d97706; }
            .mecard-funnel-conv--bad { color: #dc2626; }
            .mecard-funnel-drop { font-size: 11px; color: #6b7488; text-align: right; }
            .mecard-chart-wrap { position: relative; height: 250px; }
            .mecard-seg { display: flex; gap: 12px; align-items: center; }
            .mecard-seg-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
            .mecard-seg-icon--single { background: #e0e7ef; color: #475569; }
            .mecard-seg-icon--team { background: #ddd6fe; color: #6d28d9; }
            .mecard-seg-icon--converted { background: #d1fae5; color: #065f46; }
            .mecard-seg-count { font-size: 24px; font-weight: 700; }
            .mecard-seg-meta { font-size: 11px; color: #6b7488; margin-top: 2px; }
            .mecard-source-split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
            .mecard-source-tile { background: #f8fafc; border: 1px solid #e5e9f0; border-radius: 8px; padding: 12px; }
            .mecard-source-tile .label { font-size: 11px; color: #6b7488; text-transform: uppercase; letter-spacing: 0.3px; }
            .mecard-source-tile .v { font-size: 20px; font-weight: 700; margin-top: 4px; }
            .mecard-geo-table { width: 100%; border-collapse: collapse; }
            .mecard-geo-table th, .mecard-geo-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e9f0; font-size: 13px; }
            .mecard-geo-table th { font-size: 11px; color: #6b7488; text-transform: uppercase; background: #fafbfc; }
            .mecard-geo-table .num { text-align: right; }
            .mecard-legend { display: flex; gap: 14px; margin-top: 10px; font-size: 11px; color: #6b7488; }
            .mecard-legend span { display: flex; align-items: center; gap: 5px; }
            .mecard-dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
            @media (max-width: 980px) {
                .mecard-grid--2, .mecard-grid--3 { grid-template-columns: 1fr; }
            }
        </style>

        <div class="wrap mecard-dash">
            <h1>MeCard Analytics Dashboard</h1>

            <!-- Toolbar -->
            <div class="mecard-toolbar">
                <label>Date range:</label>
                <select id="mecard-range-select" onchange="mecardRangeChanged(this)">
                    <?php foreach ( $ranges as $rk => $rv ) : ?>
                        <option value="<?php echo esc_attr( $rk ); ?>" <?php selected( $range, $rk ); ?>><?php echo esc_html( $rv['label'] ); ?></option>
                    <?php endforeach; ?>
                </select>
                <span id="mecard-custom-range" class="mecard-custom-range <?php echo $range === 'custom' ? 'active' : ''; ?>">
                    <input type="date" id="mecard-date-from" value="<?php echo esc_attr( $custom_from ); ?>">
                    <span>to</span>
                    <input type="date" id="mecard-date-to" value="<?php echo esc_attr( $custom_to ); ?>">
                    <button type="button" class="mecard-btn-apply" onclick="mecardApplyCustomRange()">Apply</button>
                </span>
            </div>
            <script>
            function mecardRangeChanged(sel) {
                var custom = document.getElementById('mecard-custom-range');
                if (sel.value === 'custom') {
                    custom.classList.add('active');
                    if (!document.getElementById('mecard-date-from').value) {
                        var today = new Date(), prior = new Date();
                        prior.setDate(prior.getDate() - 30);
                        document.getElementById('mecard-date-to').value = today.toISOString().slice(0, 10);
                        document.getElementById('mecard-date-from').value = prior.toISOString().slice(0, 10);
                    }
                } else {
                    custom.classList.remove('active');
                    location.href = '<?php echo esc_url( $page_url ); ?>&range=' + sel.value;
                }
            }
            function mecardApplyCustomRange() {
                var f = document.getElementById('mecard-date-from').value;
                var t = document.getElementById('mecard-date-to').value;
                if (f && t) {
                    location.href = '<?php echo esc_url( $page_url ); ?>&range=custom&date_from=' + f + '&date_to=' + t;
                }
            }
            </script>

            <?php if ( ! self::table_exists() ) : ?>
                <div class="notice notice-warning"><p>The <code>mecard_events</code> table does not exist. Create it first via the MeCard Events admin page or manually.</p></div>
                <?php return; ?>
            <?php endif; ?>

            <!-- Decision-support callouts -->
            <?php if ( ! empty( $callouts ) ) : ?>
            <div class="mecard-callout">
                <h4>What to work on next &mdash; auto-flagged</h4>
                <ul>
                    <?php foreach ( $callouts as $c ) : ?>
                        <li><?php echo $c; ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
            <?php endif; ?>

            <!-- KPI strip -->
            <div class="mecard-grid mecard-grid--kpis">
                <div class="mecard-card">
                    <h3>Signups</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $kpis['signups'] ); ?></p>
                    <?php echo self::render_delta( $kpis['signups_delta'] ); ?>
                </div>
                <div class="mecard-card">
                    <h3>Onboarding completion</h3>
                    <p class="mecard-kpi-value"><?php echo $kpis['onboarding_pct']; ?>%</p>
                    <?php echo self::render_pp_delta( $kpis['onboarding_pct_delta'] ); ?>
                </div>
                <div class="mecard-card">
                    <h3>Pro conversion</h3>
                    <p class="mecard-kpi-value"><?php echo $kpis['pro_pct']; ?>%</p>
                    <?php echo self::render_pp_delta( $kpis['pro_pct_delta'] ); ?>
                </div>
                <div class="mecard-card">
                    <h3>Avg revenue / signup</h3>
                    <p class="mecard-kpi-value">R <?php echo number_format( $kpis['arps'], 2 ); ?></p>
                    <?php echo self::render_delta( $kpis['arps_delta'], '', 'R ' ); ?>
                </div>
                <div class="mecard-card">
                    <h3>Active profiles (30d)</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $kpis['active'] ); ?></p>
                    <?php echo self::render_delta( $kpis['active_delta'] ); ?>
                </div>
            </div>

            <!-- Segmentation -->
            <div class="mecard-section">Customer segmentation</div>
            <div class="mecard-grid mecard-grid--3">
                <div class="mecard-card">
                    <h3>Single profile</h3>
                    <div class="mecard-seg">
                        <div class="mecard-seg-icon mecard-seg-icon--single">&#128100;</div>
                        <div>
                            <div class="mecard-seg-count"><?php echo number_format( $segments['single'] ); ?></div>
                            <div class="mecard-seg-meta"><?php echo $segments['total'] > 0 ? round( $segments['single'] / $segments['total'] * 100 ) : 0; ?>% of total</div>
                        </div>
                    </div>
                </div>
                <div class="mecard-card">
                    <h3>Team-intent (immediate)</h3>
                    <div class="mecard-seg">
                        <div class="mecard-seg-icon mecard-seg-icon--team">&#128101;</div>
                        <div>
                            <div class="mecard-seg-count"><?php echo number_format( $segments['team_intent'] ); ?></div>
                            <div class="mecard-seg-meta"><?php echo $segments['total'] > 0 ? round( $segments['team_intent'] / $segments['total'] * 100 ) : 0; ?>% of total</div>
                        </div>
                    </div>
                </div>
                <div class="mecard-card">
                    <h3>Converted to team</h3>
                    <div class="mecard-seg">
                        <div class="mecard-seg-icon mecard-seg-icon--converted">&#128200;</div>
                        <div>
                            <div class="mecard-seg-count"><?php echo number_format( $segments['team_converted'] ); ?></div>
                            <div class="mecard-seg-meta"><?php echo $segments['total'] > 0 ? round( $segments['team_converted'] / $segments['total'] * 100 ) : 0; ?>% of total</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Signups over time -->
            <div class="mecard-grid mecard-grid--2">
                <div class="mecard-card">
                    <h3>Signups over time</h3>
                    <div class="mecard-chart-wrap"><canvas id="mecardChartSignups"></canvas></div>
                </div>
                <div class="mecard-card">
                    <h3>Profile views over time</h3>
                    <div class="mecard-chart-wrap"><canvas id="mecardChartViews"></canvas></div>
                </div>
            </div>

            <!-- Onboarding funnel -->
            <div class="mecard-section">Onboarding funnel</div>
            <div class="mecard-card">
                <h3>Conversion through each step</h3>
                <?php if ( ! empty( $funnel ) ) : ?>
                <div class="mecard-funnel">
                    <?php
                    $max = $funnel[0]['count'] ?: 1;
                    foreach ( $funnel as $i => $step ) :
                        $pct_width = max( 5, round( $step['count'] / $max * 100 ) );
                        if ( $step['conv'] < 55 ) {
                            $bar_class = 'mecard-funnel-bar--bad';
                            $conv_class = 'mecard-funnel-conv--bad';
                        } elseif ( $step['conv'] < 75 ) {
                            $bar_class = 'mecard-funnel-bar--warn';
                            $conv_class = 'mecard-funnel-conv--warn';
                        } else {
                            $bar_class = 'mecard-funnel-bar--good';
                            $conv_class = 'mecard-funnel-conv--good';
                        }
                    ?>
                    <div class="mecard-funnel-row">
                        <div><?php echo ( $i + 1 ) . '. ' . esc_html( $step['label'] ); ?></div>
                        <div class="mecard-funnel-bar <?php echo $bar_class; ?>" style="width:<?php echo $pct_width; ?>%;"><?php echo number_format( $step['count'] ); ?></div>
                        <div class="mecard-funnel-conv <?php echo $conv_class; ?>"><?php echo $step['conv']; ?>%</div>
                        <div class="mecard-funnel-drop"><?php echo $i === 0 ? '&mdash;' : '&minus;' . number_format( $step['drop'] ); ?></div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <div class="mecard-legend">
                    <span><span class="mecard-dot" style="background:#1f6feb;"></span> Healthy</span>
                    <span><span class="mecard-dot" style="background:#d97706;"></span> Watch &lt;75%</span>
                    <span><span class="mecard-dot" style="background:#dc2626;"></span> Critical &lt;55%</span>
                </div>
                <?php else : ?>
                    <p style="color:#6b7488;">No onboarding events in this period.</p>
                <?php endif; ?>
            </div>

            <!-- Engagement -->
            <div class="mecard-section">Engagement</div>
            <div class="mecard-grid mecard-grid--2">
                <div class="mecard-card">
                    <h3>Profile views by source</h3>
                    <div class="mecard-chart-wrap"><canvas id="mecardChartViewSource"></canvas></div>
                    <div class="mecard-source-split">
                        <div class="mecard-source-tile">
                            <div class="label">Card tap (NFC + QR)</div>
                            <div class="v"><?php echo number_format( $engagement['views_tap'] ); ?></div>
                        </div>
                        <div class="mecard-source-tile">
                            <div class="label">Direct profile link</div>
                            <div class="v"><?php echo number_format( $engagement['views_direct'] ); ?></div>
                        </div>
                    </div>
                </div>
                <div class="mecard-card">
                    <h3>Share intents by method</h3>
                    <div class="mecard-chart-wrap"><canvas id="mecardChartShares"></canvas></div>
                </div>
            </div>

            <div class="mecard-grid mecard-grid--3">
                <div class="mecard-card">
                    <h3>vCard downloads</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $engagement['vcards'] ); ?></p>
                    <?php echo self::render_delta( $engagement['vcards_delta'] ); ?>
                </div>
                <div class="mecard-card">
                    <h3>Contact forms submitted</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $engagement['forms'] ); ?></p>
                    <?php echo self::render_delta( $engagement['forms_delta'] ); ?>
                </div>
                <div class="mecard-card">
                    <h3>Recipient ad views</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $engagement['ad_views'] ); ?></p>
                    <?php echo self::render_delta( $engagement['ad_views_delta'] ); ?>
                </div>
            </div>

            <!-- Monetisation -->
            <div class="mecard-section">Monetisation</div>
            <div class="mecard-grid mecard-grid--3">
                <div class="mecard-card">
                    <h3>Pro upsell clicks</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $monetisation['upsell_clicked'] ); ?></p>
                </div>
                <div class="mecard-card">
                    <h3>Pro/Bundle purchases</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $monetisation['purchases_pro'] ); ?></p>
                </div>
                <div class="mecard-card">
                    <h3>Card-only purchases</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $monetisation['purchases_card'] ); ?></p>
                </div>
            </div>

            <!-- Geography -->
            <div class="mecard-section">Geography</div>
            <div class="mecard-card">
                <h3>Profile views by country</h3>
                <?php if ( ! empty( $geo ) ) : ?>
                <table class="mecard-geo-table">
                    <thead><tr><th>Country</th><th class="num">Views</th><th class="num">Share</th></tr></thead>
                    <tbody>
                    <?php foreach ( $geo as $g ) : ?>
                        <tr>
                            <td><?php echo esc_html( $g['country'] === '--' ? 'Unknown' : strtoupper( $g['country'] ) ); ?></td>
                            <td class="num"><?php echo number_format( $g['views'] ); ?></td>
                            <td class="num"><?php echo $g['share']; ?>%</td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <?php else : ?>
                    <p style="color:#6b7488;">No geo data in this period.</p>
                <?php endif; ?>
            </div>

            <!-- Team analytics -->
            <div class="mecard-section">Team analytics</div>
            <div class="mecard-grid mecard-grid--kpis">
                <div class="mecard-card">
                    <h3>Companies created</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $team['companies_created'] ); ?></p>
                    <?php echo self::render_delta( $team['companies_created_delta'] ); ?>
                </div>
                <div class="mecard-card">
                    <h3>Members added</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $team['members_added'] ); ?></p>
                    <?php echo self::render_delta( $team['members_added_delta'] ); ?>
                </div>
                <div class="mecard-card">
                    <h3>Bundle purchases</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $team['bundle_purchases'] ); ?></p>
                    <?php echo self::render_delta( $team['bundle_purchases_delta'] ); ?>
                </div>
                <div class="mecard-card">
                    <h3>Bundle revenue</h3>
                    <p class="mecard-kpi-value">R <?php echo number_format( $team['bundle_revenue'], 2 ); ?></p>
                    <?php echo self::render_delta( $team['bundle_revenue_delta'], '%', 'R ' ); ?>
                </div>
                <div class="mecard-card">
                    <h3>Active team profiles</h3>
                    <p class="mecard-kpi-value"><?php echo number_format( $team['team_profiles_active'] ); ?></p>
                    <?php echo self::render_delta( $team['team_profiles_active_delta'] ); ?>
                </div>
            </div>

            <!-- Team funnel -->
            <div class="mecard-card">
                <h3>Team journey (all-time)</h3>
                <?php if ( ! empty( $team['funnel'] ) ) : ?>
                <div class="mecard-funnel">
                    <?php
                    $max = $team['funnel'][0]['count'] ?: 1;
                    foreach ( $team['funnel'] as $i => $step ) :
                        $pct_width = max( 3, round( $step['count'] / $max * 100 ) );
                        if ( $step['conv'] < 40 ) {
                            $bar_class = 'mecard-funnel-bar--bad';
                            $conv_class = 'mecard-funnel-conv--bad';
                        } elseif ( $step['conv'] < 70 ) {
                            $bar_class = 'mecard-funnel-bar--warn';
                            $conv_class = 'mecard-funnel-conv--warn';
                        } else {
                            $bar_class = 'mecard-funnel-bar--good';
                            $conv_class = 'mecard-funnel-conv--good';
                        }
                    ?>
                    <div class="mecard-funnel-row">
                        <div><?php echo ( $i + 1 ) . '. ' . esc_html( $step['label'] ); ?></div>
                        <div class="mecard-funnel-bar <?php echo $bar_class; ?>" style="width:<?php echo $pct_width; ?>%;"><?php echo number_format( $step['count'] ); ?></div>
                        <div class="mecard-funnel-conv <?php echo $conv_class; ?>"><?php echo $step['conv']; ?>%</div>
                        <div class="mecard-funnel-drop"><?php echo $i === 0 ? '&mdash;' : '&minus;' . number_format( $step['drop'] ); ?></div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php else : ?>
                    <p style="color:#6b7488;">No team funnel data yet.</p>
                <?php endif; ?>
            </div>

        </div><!-- .mecard-dash -->

        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
        <script>
        (function(){
            Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            Chart.defaults.font.size = 11;
            Chart.defaults.color = '#6b7488';
            Chart.defaults.plugins.legend.labels.boxWidth = 12;
            Chart.defaults.plugins.legend.labels.boxHeight = 12;

            // Signups over time
            var signupLabels = <?php echo wp_json_encode( $time_series['labels'] ); ?>;
            var signupData   = <?php echo wp_json_encode( $time_series['data'] ); ?>;
            if (document.getElementById('mecardChartSignups') && signupLabels.length) {
                new Chart(document.getElementById('mecardChartSignups'), {
                    type: 'bar',
                    data: { labels: signupLabels, datasets: [{ label: 'Signups', data: signupData, backgroundColor: '#1f6feb' }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#eef2f7' }, beginAtZero: true }, x: { grid: { display: false } } } }
                });
            }

            // Views over time (tap vs direct)
            var viewLabels = <?php echo wp_json_encode( $view_series['labels'] ); ?>;
            var viewTap    = <?php echo wp_json_encode( $view_series['tap'] ?? [] ); ?>;
            var viewDirect = <?php echo wp_json_encode( $view_series['direct'] ?? [] ); ?>;
            if (document.getElementById('mecardChartViews') && viewLabels.length) {
                new Chart(document.getElementById('mecardChartViews'), {
                    type: 'line',
                    data: {
                        labels: viewLabels,
                        datasets: [
                            { label: '/t/ (card tap)', data: viewTap, borderColor: '#1f6feb', backgroundColor: 'rgba(31,111,235,0.1)', fill: true, tension: 0.35 },
                            { label: '/mecard-profile/ (direct)', data: viewDirect, borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,0.1)', fill: true, tension: 0.35 }
                        ]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { grid: { color: '#eef2f7' }, beginAtZero: true }, x: { grid: { display: false } } } }
                });
            }

            // View source doughnut
            var tapTotal = <?php echo (int) $engagement['views_tap']; ?>;
            var directTotal = <?php echo (int) $engagement['views_direct']; ?>;
            if (document.getElementById('mecardChartViewSource') && (tapTotal + directTotal) > 0) {
                new Chart(document.getElementById('mecardChartViewSource'), {
                    type: 'doughnut',
                    data: { labels: ['/t/ card tap', '/mecard-profile/ direct'], datasets: [{ data: [tapTotal, directTotal], backgroundColor: ['#1f6feb', '#0d9488'] }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
                });
            }

            // Share methods
            var shareMethods = <?php echo wp_json_encode( $engagement['share_methods'] ); ?>;
            var shareLabels = Object.keys(shareMethods);
            var shareData   = Object.values(shareMethods);
            var shareColors = ['#25D366','#1f6feb','#f59e0b','#7c3aed','#0d9488','#94a3b8','#dc2626','#fbbf24'];
            if (document.getElementById('mecardChartShares') && shareLabels.length) {
                new Chart(document.getElementById('mecardChartShares'), {
                    type: 'doughnut',
                    data: { labels: shareLabels, datasets: [{ data: shareData, backgroundColor: shareColors.slice(0, shareLabels.length) }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
                });
            }
        })();
        </script>
        <?php
    }
}
