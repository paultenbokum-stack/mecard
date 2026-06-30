<?php
namespace Me\Tracking;

if ( ! defined( 'ABSPATH' ) ) {
    return;
}

class Module {

    const TABLE_VERSION = '1.0.0';

    private static $allowed_events = [
        // Engagement
        'profile_viewed',
        'share_intent',
        'vcard_downloaded',
        'contact_form_submitted',
        'recipient_ad_viewed',
        // Onboarding
        'signup_started',
        'signup_completed',
        'profile_step1_saved',
        'profile_step2_saved',
        'look_confirmed',
        'a2hs_prompted',
        'a2hs_accepted',
        'a2hs_dismissed',
        'onboarding_completed',
        // PWA (allowlist only — no client instrumentation yet)
        'pwa_launched',
        'pwa_signin_prompted',
        'pwa_signin_completed',
        'pwa_anonymous_view_chosen',
        // Monetisation
        'purchase',
        'pro_upsell_clicked',
        'additional_profile_added',
        'team_company_created',
        'team_member_added',
        'team_invite_sent',
        'team_invite_accepted',
        // Viral surfaces
        'recipient_ad_clicked',
        'post_save_cta_viewed',
        'post_save_cta_clicked',
        'post_save_cta_dismissed',
        // Legacy
        'first_profile_created',
    ];

    public static function init() {
        // Called from inside an init callback, so run table install directly
        // (priority 5 would have already passed by now).
        self::maybe_install_table();
        self::maybe_set_session_cookie();
        add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );
        add_action( 'admin_menu', [ __CLASS__, 'register_admin_page' ] );

        // Signup tracking
        add_action( 'mecard_profile_autocreated', [ __CLASS__, 'on_signup_completed' ], 10, 2 );

        // Purchase tracking — fires once when order first leaves pending
        add_action( 'woocommerce_order_status_pending_to_on-hold', [ __CLASS__, 'on_purchase' ], 30, 2 );
        add_action( 'woocommerce_order_status_pending_to_processing', [ __CLASS__, 'on_purchase' ], 30, 2 );
        add_action( 'save_post_mecard-profile', [ __CLASS__, 'on_profile_created' ], 30, 3 );
        add_action( 'save_post_mecard-company', [ __CLASS__, 'on_company_created' ], 30, 3 );
    }

    // ─── Table ───────────────────────────────────────────────

    public static function table_name(): string {
        global $wpdb;
        return $wpdb->prefix . 'mecard_events';
    }

    public static function maybe_install_table(): void {
        $installed = get_option( 'mecard_events_table_version', '' );
        if ( $installed === self::TABLE_VERSION ) {
            return;
        }

        global $wpdb;
        $table   = self::table_name();
        $charset = $wpdb->get_charset_collate();

        // dbDelta requires: two spaces after PRIMARY KEY, KEY instead of INDEX,
        // each column on its own line with exactly one trailing comma.
        $sql = "CREATE TABLE {$table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  event_name varchar(64) NOT NULL,
  session_id varchar(64) NOT NULL,
  user_id bigint(20) unsigned DEFAULT NULL,
  profile_id bigint(20) unsigned DEFAULT NULL,
  company_id bigint(20) unsigned DEFAULT NULL,
  source varchar(32) DEFAULT NULL,
  referrer text DEFAULT NULL,
  country char(2) DEFAULT NULL,
  ua_hash char(64) DEFAULT NULL,
  ip_hash char(64) DEFAULT NULL,
  meta longtext DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY idx_event_time (event_name,created_at),
  KEY idx_user_time (user_id,created_at),
  KEY idx_profile_time (profile_id,created_at),
  KEY idx_company_time (company_id,created_at),
  KEY idx_session (session_id)
) {$charset};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $result = dbDelta( $sql );

        // Verify table was actually created before storing version
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" );
        if ( $table_exists ) {
            update_option( 'mecard_events_table_version', self::TABLE_VERSION, true );
        } else {
            // Fallback: create directly with minimal SQL
            $fallback_sql = "CREATE TABLE IF NOT EXISTS {$table} (
                id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
                event_name varchar(64) NOT NULL,
                session_id varchar(64) NOT NULL,
                user_id bigint(20) unsigned DEFAULT NULL,
                profile_id bigint(20) unsigned DEFAULT NULL,
                company_id bigint(20) unsigned DEFAULT NULL,
                source varchar(32) DEFAULT NULL,
                referrer text,
                country char(2) DEFAULT NULL,
                ua_hash char(64) DEFAULT NULL,
                ip_hash char(64) DEFAULT NULL,
                meta longtext,
                created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_event_time (event_name,created_at),
                KEY idx_user_time (user_id,created_at),
                KEY idx_profile_time (profile_id,created_at),
                KEY idx_company_time (company_id,created_at),
                KEY idx_session (session_id)
            ) {$charset}";
            $wpdb->query( $fallback_sql );
            $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" );
            if ( $table_exists ) {
                update_option( 'mecard_events_table_version', self::TABLE_VERSION, true );
            } else {
                error_log( 'MeCard Tracking: table creation failed. dbDelta result: ' . wp_json_encode( $result ) . ' | Fallback error: ' . $wpdb->last_error . ' | SQL: ' . substr( $fallback_sql, 0, 200 ) );
            }
        }
    }

    // ─── Session cookie ──────────────────────────────────────

    public static function maybe_set_session_cookie(): void {
        if ( isset( $_COOKIE['mecard_sid'] ) && strlen( $_COOKIE['mecard_sid'] ) >= 16 ) {
            return;
        }
        if ( headers_sent() ) {
            return;
        }

        $sid = wp_generate_uuid4();
        setcookie( 'mecard_sid', $sid, [
            'expires'  => time() + YEAR_IN_SECONDS,
            'path'     => '/',
            'secure'   => is_ssl(),
            'httponly' => false, // JS needs to read it
            'samesite' => 'Lax',
        ] );
        $_COOKIE['mecard_sid'] = $sid; // available in same request
    }

    // ─── REST endpoint ───────────────────────────────────────

    public static function register_rest_routes(): void {
        register_rest_route( 'mecard/v1', '/track', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'handle_track' ],
            'permission_callback' => '__return_true',
        ] );
    }

    public static function handle_track( \WP_REST_Request $request ): \WP_REST_Response {
        $body = $request->get_json_params();
        if ( empty( $body ) ) {
            $body = $request->get_body_params();
        }

        $event_name = isset( $body['event_name'] ) ? sanitize_key( $body['event_name'] ) : '';
        if ( ! in_array( $event_name, self::$allowed_events, true ) ) {
            return new \WP_REST_Response( [ 'error' => 'invalid_event' ], 400 );
        }

        $session_id = isset( $_COOKIE['mecard_sid'] ) ? $_COOKIE['mecard_sid'] : '';
        if ( empty( $session_id ) && ! empty( $body['session_id'] ) ) {
            $session_id = $body['session_id'];
        }

        $ip   = self::get_client_ip();
        $salt = wp_salt( 'auth' );

        $result = self::log_event( [
            'event_name' => $event_name,
            'session_id' => $session_id,
            'user_id'    => get_current_user_id() ?: null,
            'profile_id' => ! empty( $body['profile_id'] ) ? absint( $body['profile_id'] ) : null,
            'company_id' => ! empty( $body['company_id'] ) ? absint( $body['company_id'] ) : null,
            'source'     => ! empty( $body['source'] ) ? $body['source'] : null,
            'referrer'   => ! empty( $body['referrer'] ) ? $body['referrer'] : null,
            'country'    => self::resolve_country( $ip ),
            'ua_hash'    => hash( 'sha256', ( isset( $_SERVER['HTTP_USER_AGENT'] ) ? $_SERVER['HTTP_USER_AGENT'] : '' ) . $salt ),
            'ip_hash'    => hash( 'sha256', $ip . $salt ),
            'meta'       => ! empty( $body['meta'] ) ? $body['meta'] : null,
        ] );

        if ( $result === false ) {
            return new \WP_REST_Response( [ 'error' => 'insert_failed' ], 500 );
        }

        return new \WP_REST_Response( [ 'ok' => true ], 200 );
    }

    // ─── Core insert ─────────────────────────────────────────

    /**
     * Insert an event into the mecard_events table.
     *
     * @return int|false Insert ID on success, false on failure.
     */
    public static function log_event( array $args ) {
        global $wpdb;

        $data = [
            'event_name' => sanitize_key( substr( $args['event_name'] ?? '', 0, 64 ) ),
            'session_id' => sanitize_text_field( substr( $args['session_id'] ?? '', 0, 64 ) ),
            'user_id'    => isset( $args['user_id'] ) ? absint( $args['user_id'] ) : null,
            'profile_id' => isset( $args['profile_id'] ) ? absint( $args['profile_id'] ) : null,
            'company_id' => isset( $args['company_id'] ) ? absint( $args['company_id'] ) : null,
            'source'     => isset( $args['source'] ) ? sanitize_key( substr( $args['source'], 0, 32 ) ) : null,
            'referrer'   => isset( $args['referrer'] ) ? esc_url_raw( substr( $args['referrer'], 0, 2048 ) ) : null,
            'country'    => isset( $args['country'] ) ? strtoupper( substr( sanitize_text_field( $args['country'] ), 0, 2 ) ) : null,
            'ua_hash'    => isset( $args['ua_hash'] ) ? sanitize_text_field( substr( $args['ua_hash'], 0, 64 ) ) : null,
            'ip_hash'    => isset( $args['ip_hash'] ) ? sanitize_text_field( substr( $args['ip_hash'], 0, 64 ) ) : null,
            'meta'       => isset( $args['meta'] ) ? wp_json_encode( $args['meta'] ) : null,
            'created_at' => current_time( 'mysql', true ),
        ];

        // Null out zero IDs
        if ( empty( $data['user_id'] ) )    $data['user_id']    = null;
        if ( empty( $data['profile_id'] ) ) $data['profile_id'] = null;
        if ( empty( $data['company_id'] ) ) $data['company_id'] = null;

        $formats = [
            '%s', // event_name
            '%s', // session_id
            $data['user_id']    !== null ? '%d' : null,
            $data['profile_id'] !== null ? '%d' : null,
            $data['company_id'] !== null ? '%d' : null,
            '%s', // source
            '%s', // referrer
            '%s', // country
            '%s', // ua_hash
            '%s', // ip_hash
            '%s', // meta
            '%s', // created_at
        ];

        // Remove null columns so $wpdb->insert handles NULLs properly
        $clean_data    = [];
        $clean_formats = [];
        $keys = array_keys( $data );
        foreach ( $keys as $i => $key ) {
            if ( $data[ $key ] !== null ) {
                $clean_data[ $key ]  = $data[ $key ];
                $clean_formats[]     = $formats[ $i ] ?? '%s';
            }
        }

        $result = $wpdb->insert( self::table_name(), $clean_data, $clean_formats );
        if ( ! $result ) {
            error_log( 'MeCard Tracking insert failed: ' . $wpdb->last_error );
        }
        return $result ? $wpdb->insert_id : false;
    }

    // ─── Server-side event hooks ─────────────────────────────

    /**
     * Fired by the mecard_profile_autocreated action when onboarding
     * creates the user's first profile (covers both email + Google signup).
     */
    public static function on_signup_completed( int $profile_id, int $user_id ): void {
        self::log_event( [
            'event_name' => 'signup_completed',
            'session_id' => isset( $_COOKIE['mecard_sid'] ) ? $_COOKIE['mecard_sid'] : 'server-' . $user_id,
            'user_id'    => $user_id,
            'profile_id' => $profile_id,
            'source'     => 'onboarding',
            'meta'       => [ 'intent' => 'solo' ],
        ] );
    }

    /**
     * Fires once when an order first leaves pending status.
     * Hooked to woocommerce_order_status_pending_to_on-hold (BACS)
     * and woocommerce_order_status_pending_to_processing (gateway).
     */
    public static function on_purchase( int $order_id, \WC_Order $order ): void {
        $user_id    = (int) $order->get_customer_id();
        $session_id = isset( $_COOKIE['mecard_sid'] ) ? $_COOKIE['mecard_sid'] : 'server-' . $order_id;

        $bundle_ids = array_filter( [
            defined( 'MECARD_BUNDLE_PRODUCT_ID' )         ? (int) MECARD_BUNDLE_PRODUCT_ID         : 0,
            defined( 'MECARD_CLASSIC_BUNDLE_PRODUCT_ID' ) ? (int) MECARD_CLASSIC_BUNDLE_PRODUCT_ID : 0,
        ] );
        $upgrade_id    = defined( 'MECARD_PROFILE_UPGRADE_PRODUCT_ID' ) ? (int) MECARD_PROFILE_UPGRADE_PRODUCT_ID : 0;
        $product_ids   = [];
        $purchase_type = null;

        foreach ( $order->get_items() as $item ) {
            $product = $item->get_product();
            if ( ! $product ) {
                continue;
            }
            $pid = (int) $product->get_id();
            $product_ids[] = $pid;

            if ( $pid === $upgrade_id || $product->get_type() === 'mecard-profile' ) {
                $purchase_type = 'pro_upgrade';
            } elseif ( in_array( $pid, $bundle_ids, true ) && $purchase_type !== 'pro_upgrade' ) {
                $purchase_type = 'bundle';
            }
        }

        if ( ! $purchase_type && ! empty( $product_ids ) ) {
            $purchase_type = 'card';
        }

        self::log_event( [
            'event_name' => 'purchase',
            'session_id' => $session_id,
            'user_id'    => $user_id,
            'source'     => 'woocommerce',
            'meta'       => [
                'order_id'      => $order_id,
                'product_ids'   => $product_ids,
                'purchase_type' => $purchase_type,
                'payment'       => $order->get_payment_method(),
                'total'         => $order->get_total(),
            ],
        ] );
    }

    public static function on_profile_created( int $post_id, \WP_Post $post, bool $update ): void {
        if ( $update ) {
            return;
        }
        if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
            return;
        }
        if ( ! in_array( $post->post_status, [ 'publish', 'private' ], true ) ) {
            return;
        }

        $creator_id = get_current_user_id();
        if ( ! $creator_id ) {
            return;
        }

        // Check if user already has other profiles (this is an additional profile)
        $existing = get_posts( [
            'post_type'   => 'mecard-profile',
            'author'      => $creator_id,
            'post_status' => [ 'publish', 'private' ],
            'fields'      => 'ids',
            'exclude'     => [ $post_id ],
            'numberposts' => 1,
        ] );

        if ( ! empty( $existing ) ) {
            // Detect company linkage for team context.
            $company_id = 0;
            if ( function_exists( 'toolset_get_related_post' ) ) {
                $company_id = (int) toolset_get_related_post( $post_id, 'company-mecard-profile', 'parent' );
            }
            if ( ! $company_id ) {
                $company_id = (int) get_post_meta( $post_id, 'wpcf-company-parent', true );
            }

            $event_name = $company_id ? 'team_member_added' : 'additional_profile_added';
            $event_data = [
                'event_name' => $event_name,
                'session_id' => isset( $_COOKIE['mecard_sid'] ) ? $_COOKIE['mecard_sid'] : 'server-' . $creator_id,
                'user_id'    => $creator_id,
                'profile_id' => $post_id,
                'source'     => wp_doing_ajax() ? 'ajax' : 'admin',
            ];
            if ( $company_id ) {
                $event_data['company_id'] = $company_id;
            }
            self::log_event( $event_data );
        }
    }

    /**
     * Fires when a new mecard-company post is created.
     */
    public static function on_company_created( int $post_id, \WP_Post $post, bool $update ): void {
        if ( $update ) {
            return;
        }
        if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
            return;
        }
        if ( ! in_array( $post->post_status, [ 'publish', 'private' ], true ) ) {
            return;
        }

        $creator_id = get_current_user_id();
        if ( ! $creator_id ) {
            return;
        }

        self::log_event( [
            'event_name' => 'team_company_created',
            'session_id' => isset( $_COOKIE['mecard_sid'] ) ? $_COOKIE['mecard_sid'] : 'server-' . $creator_id,
            'user_id'    => $creator_id,
            'company_id' => $post_id,
            'source'     => wp_doing_ajax() ? 'ajax' : 'admin',
        ] );
    }

    // ─── Helpers ─────────────────────────────────────────────

    private static function get_client_ip(): string {
        $ip = '';
        if ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
            $parts = explode( ',', $_SERVER['HTTP_X_FORWARDED_FOR'] );
            $ip    = trim( $parts[0] );
        }
        if ( empty( $ip ) && ! empty( $_SERVER['REMOTE_ADDR'] ) ) {
            $ip = $_SERVER['REMOTE_ADDR'];
        }
        return $ip;
    }

    private static function resolve_country( string $ip ): ?string {
        if ( empty( $ip ) ) {
            return null;
        }
        if ( class_exists( 'WC_Geolocation' ) ) {
            $geo = \WC_Geolocation::geolocate_ip( $ip );
            if ( ! empty( $geo['country'] ) ) {
                return strtoupper( substr( $geo['country'], 0, 2 ) );
            }
        }
        return null;
    }

    // ─── Admin event viewer ──────────────────────────────────

    public static function register_admin_page(): void {
        add_management_page(
            'MeCard Events',
            'MeCard Events',
            'manage_options',
            'mecard-events',
            [ __CLASS__, 'render_admin_page' ]
        );
    }

    public static function render_admin_page(): void {
        global $wpdb;
        $table = self::table_name();

        // Handle clear action
        if ( isset( $_POST['mecard_clear_events'] ) && check_admin_referer( 'mecard_clear_events' ) ) {
            $wpdb->query( "TRUNCATE TABLE {$table}" );
            echo '<div class="notice notice-success"><p>All events cleared.</p></div>';
        }

        // Filters
        $filter_event   = isset( $_GET['filter_event'] )   ? sanitize_key( $_GET['filter_event'] )      : '';
        $filter_profile = isset( $_GET['filter_profile'] ) ? absint( $_GET['filter_profile'] )           : 0;
        $filter_user    = isset( $_GET['filter_user'] )    ? absint( $_GET['filter_user'] )              : 0;

        $where = [];
        $args  = [];
        if ( $filter_event ) {
            $where[] = 'event_name = %s';
            $args[]  = $filter_event;
        }
        if ( $filter_profile ) {
            $where[] = 'profile_id = %d';
            $args[]  = $filter_profile;
        }
        if ( $filter_user ) {
            $where[] = 'user_id = %d';
            $args[]  = $filter_user;
        }

        $where_sql = ! empty( $where ) ? 'WHERE ' . implode( ' AND ', $where ) : '';

        // Get distinct event names for filter dropdown
        $event_names = $wpdb->get_col( "SELECT DISTINCT event_name FROM {$table} ORDER BY event_name" );

        // Get total count
        if ( ! empty( $args ) ) {
            $count = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} {$where_sql}", ...$args ) );
        } else {
            $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );
        }

        // Get rows
        $query = "SELECT * FROM {$table} {$where_sql} ORDER BY created_at DESC LIMIT 100";
        if ( ! empty( $args ) ) {
            $rows = $wpdb->get_results( $wpdb->prepare( $query, ...$args ) );
        } else {
            $rows = $wpdb->get_results( $query );
        }

        ?>
        <div class="wrap">
            <h1>MeCard Events <span style="font-size:14px;color:#666;">(<?php echo number_format( $count ); ?> total)</span></h1>

            <form method="get" style="margin: 12px 0;">
                <input type="hidden" name="page" value="mecard-events">
                <select name="filter_event">
                    <option value="">All events</option>
                    <?php foreach ( $event_names as $name ) : ?>
                        <option value="<?php echo esc_attr( $name ); ?>" <?php selected( $filter_event, $name ); ?>><?php echo esc_html( $name ); ?></option>
                    <?php endforeach; ?>
                </select>
                <input type="number" name="filter_profile" placeholder="Profile ID" value="<?php echo $filter_profile ?: ''; ?>" style="width:120px;">
                <input type="number" name="filter_user" placeholder="User ID" value="<?php echo $filter_user ?: ''; ?>" style="width:120px;">
                <button type="submit" class="button">Filter</button>
                <a href="<?php echo admin_url( 'tools.php?page=mecard-events' ); ?>" class="button">Reset</a>
            </form>

            <table class="widefat striped" style="margin-top:8px;">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Event</th>
                        <th>Session</th>
                        <th>User</th>
                        <th>Profile</th>
                        <th>Company</th>
                        <th>Source</th>
                        <th>Country</th>
                        <th>Meta</th>
                        <th>Created (UTC)</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if ( empty( $rows ) ) : ?>
                        <tr><td colspan="10" style="text-align:center;padding:20px;">No events found.</td></tr>
                    <?php else : ?>
                        <?php foreach ( $rows as $row ) : ?>
                        <tr>
                            <td><?php echo (int) $row->id; ?></td>
                            <td><code><?php echo esc_html( $row->event_name ); ?></code></td>
                            <td title="<?php echo esc_attr( $row->session_id ); ?>"><?php echo esc_html( substr( $row->session_id, 0, 8 ) ); ?>&hellip;</td>
                            <td><?php echo $row->user_id ? (int) $row->user_id : '&mdash;'; ?></td>
                            <td><?php echo $row->profile_id ? (int) $row->profile_id : '&mdash;'; ?></td>
                            <td><?php echo $row->company_id ? (int) $row->company_id : '&mdash;'; ?></td>
                            <td><?php echo $row->source ? esc_html( $row->source ) : '&mdash;'; ?></td>
                            <td><?php echo $row->country ? esc_html( $row->country ) : '&mdash;'; ?></td>
                            <td><code style="font-size:11px;max-width:200px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="<?php echo esc_attr( $row->meta ); ?>"><?php echo $row->meta ? esc_html( $row->meta ) : '&mdash;'; ?></code></td>
                            <td><?php echo esc_html( $row->created_at ); ?></td>
                        </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>

            <form method="post" style="margin-top:16px;">
                <?php wp_nonce_field( 'mecard_clear_events' ); ?>
                <button type="submit" name="mecard_clear_events" value="1" class="button" onclick="return confirm('Clear all events from the table?');">Clear all events</button>
            </form>
        </div>
        <?php
    }
}
