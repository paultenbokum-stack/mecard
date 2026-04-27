<?php
namespace Me\Entitlements;

use Me\Single_Editor\Module as Single_Editor_Module;

if ( ! defined( 'ABSPATH' ) ) exit;

class Module {
    private const TABLE_VERSION = '1.0.0';

    public static function init() : void {
        add_action( 'init', [ __CLASS__, 'maybe_install_table' ], 5 );
        add_action( 'woocommerce_add_to_cart', [ __CLASS__, 'create_cart_entitlements' ], 20, 6 );
        add_action( 'woocommerce_remove_cart_item', [ __CLASS__, 'cancel_cart_entitlements' ], 20, 2 );
        add_action( 'woocommerce_after_cart_item_quantity_update', [ __CLASS__, 'sync_cart_quantity' ], 30, 4 );
        add_action( 'woocommerce_checkout_create_order_line_item', [ __CLASS__, 'add_order_item_meta' ], 20, 4 );
        add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'process_paid_order' ], 20 );
        add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'process_paid_order' ], 20 );
        add_action( 'mecard_profile_autocreated', [ __CLASS__, 'assign_available_entitlements_for_profile' ], 20, 2 );
        add_action( 'save_post_mecard-profile', [ __CLASS__, 'maybe_assign_on_profile_save' ], 20, 3 );
    }

    public static function maybe_install_table() : void {
        $installed = (string) get_option( 'me_mecard_entitlements_table_version', '' );
        if ( $installed === self::TABLE_VERSION ) {
            return;
        }

        global $wpdb;
        $table   = self::table_name();
        $charset = $wpdb->get_charset_collate();

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $sql = "CREATE TABLE {$table} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            owner_user_id BIGINT(20) UNSIGNED NOT NULL,
            team_id BIGINT(20) UNSIGNED NULL,
            type VARCHAR(32) NOT NULL,
            status VARCHAR(32) NOT NULL,
            group_key VARCHAR(64) NULL,
            source_order_id BIGINT(20) UNSIGNED NULL,
            source_order_item_id BIGINT(20) UNSIGNED NULL,
            source_product_id BIGINT(20) UNSIGNED NULL,
            cart_item_key VARCHAR(191) NULL,
            assigned_profile_id BIGINT(20) UNSIGNED NULL,
            assigned_card_id BIGINT(20) UNSIGNED NULL,
            assigned_tag_id BIGINT(20) UNSIGNED NULL,
            meta_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            consumed_at DATETIME NULL,
            PRIMARY KEY  (id),
            KEY owner_status_type (owner_user_id, status, type),
            KEY cart_owner (cart_item_key, owner_user_id),
            KEY group_key (group_key),
            KEY source_order_item (source_order_item_id),
            KEY assigned_profile (assigned_profile_id)
        ) {$charset};";

        dbDelta( $sql );
        update_option( 'me_mecard_entitlements_table_version', self::TABLE_VERSION, false );
    }

    public static function create_cart_entitlements( $cart_item_key, $product_id, $quantity, $variation_id, $variation, $cart_item_data ) : void {
        if ( ! is_user_logged_in() ) {
            return;
        }

        $product_id = (int) $product_id;
        if ( $product_id <= 0 ) {
            return;
        }

        $owner_user_id = get_current_user_id();
        $profile_id    = self::profile_id_from_cart_data( is_array( $cart_item_data ) ? $cart_item_data : [] );
        self::sync_cart_entitlements( (string) $cart_item_key, $product_id, max( 0, (int) $quantity ), $owner_user_id, $profile_id );
    }

    public static function cancel_cart_entitlements( $cart_item_key, $instance ) : void {
        if ( ! is_user_logged_in() ) {
            return;
        }

        $owner_user_id = get_current_user_id();
        if ( function_exists( 'mecard_is_cart_cleanup_in_progress' ) && mecard_is_cart_cleanup_in_progress( (string) $cart_item_key, $owner_user_id ) ) {
            return;
        }

        self::cancel_cart_entitlements_for_user( (string) $cart_item_key, $owner_user_id );
    }

    public static function cancel_cart_entitlements_for_user( string $cart_item_key, int $owner_user_id ) : int {
        return self::mark_cart_rows_cancelled( $cart_item_key, $owner_user_id );
    }

    public static function sync_cart_quantity( $cart_item_key, $quantity, $old_quantity, $cart ) : void {
        if ( ! is_user_logged_in() ) {
            return;
        }

        $product_id  = 0;
        $profile_id  = 0;
        $items       = method_exists( $cart, 'get_cart' ) ? $cart->get_cart() : [];

        foreach ( $items as $item ) {
            $item_key = (string) ( $item['key'] ?? '' );
            if ( $item_key !== (string) $cart_item_key ) {
                continue;
            }

            $product_id = (int) ( $item['product_id'] ?? 0 );
            $profile_id = self::profile_id_from_cart_data( is_array( $item ) ? $item : [] );
            break;
        }

        if ( $product_id <= 0 ) {
            return;
        }

        self::sync_cart_entitlements( (string) $cart_item_key, $product_id, max( 0, (int) $quantity ), get_current_user_id(), $profile_id );
    }

    public static function add_order_item_meta( $item, $cart_item_key, $values, $order ) : void {
        if ( ! $item || ! is_array( $values ) ) {
            return;
        }

        $profile_id = self::profile_id_from_cart_data( $values );
        if ( $profile_id > 0 ) {
            $item->update_meta_data( '_mecard_profile_id', $profile_id );
        }

        $item->update_meta_data( '_mecard_cart_item_key', (string) $cart_item_key );
        $item->update_meta_data( '_mecard_owner_user_id', get_current_user_id() );
    }

    public static function process_paid_order( $order_id ) : void {
        if ( ! function_exists( 'wc_get_order' ) ) {
            return;
        }

        $order = wc_get_order( $order_id );
        if ( ! $order ) {
            return;
        }

        $owner_user_id = (int) $order->get_user_id();
        if ( $owner_user_id <= 0 ) {
            return;
        }

        foreach ( $order->get_items() as $item_id => $item ) {
            if ( ! $item instanceof \WC_Order_Item_Product ) {
                continue;
            }

            $product_id = (int) $item->get_product_id();
            $types      = self::product_entitlement_types( $product_id );
            if ( empty( $types ) ) {
                continue;
            }

            $cart_item_key = (string) $item->get_meta( '_mecard_cart_item_key', true );
            if ( $cart_item_key === '' && isset( $item->legacy_cart_item_key ) ) {
                $cart_item_key = (string) $item->legacy_cart_item_key;
            }

            $profile_id = absint( $item->get_meta( '_mecard_profile_id', true ) );
            $rows       = self::find_rows_for_processing( $owner_user_id, $product_id, $cart_item_key );

            if ( empty( $rows ) ) {
                $rows = self::find_processed_rows( $owner_user_id, $product_id, (int) $order_id, (int) $item_id, $cart_item_key );
            }

            if ( empty( $rows ) ) {
                $rows = self::create_missing_paid_rows( $owner_user_id, $product_id, max( 1, (int) $item->get_quantity() ), $profile_id );
            }

            foreach ( $rows as $row ) {
                $row_id         = (int) $row['id'];
                $row_type       = (string) $row['type'];
                $assigned_id    = $profile_id > 0 ? $profile_id : (int) $row['assigned_profile_id'];
                $current_status = (string) $row['status'];

                if ( in_array( $current_status, [ 'consumed', 'refunded', 'cancelled' ], true ) ) {
                    continue;
                }

                $next_status    = $row_type === 'pro_upgrade'
                    ? ( $assigned_id > 0 ? 'paid_assigned' : 'paid_unassigned' )
                    : 'paid_assigned';

                self::update_row( $row_id, [
                    'source_order_id'      => (int) $order_id,
                    'source_order_item_id' => (int) $item_id,
                    'source_product_id'    => $product_id,
                    'assigned_profile_id'  => $assigned_id > 0 ? $assigned_id : null,
                    'status'               => $next_status,
                ] );

                if ( $assigned_id > 0 && $row_type !== 'pro_upgrade' ) {
                    self::attach_entitlement_record_to_profile( $row, $assigned_id );
                }

                if ( $row_type === 'pro_upgrade' && $assigned_id > 0 ) {
                    self::consume_pro_upgrade( $row_id, $assigned_id, (int) $order_id );
                    self::assign_bundle_companions( (string) $row['group_key'], $owner_user_id, $assigned_id );
                }
            }
        }
    }

    public static function assign_available_entitlements_for_profile( $profile_id, $user_id ) : void {
        $profile_id = (int) $profile_id;
        $user_id    = (int) $user_id;
        if ( $profile_id <= 0 || $user_id <= 0 ) {
            return;
        }

        self::assign_next_available_upgrade( $profile_id, $user_id );
    }

    public static function maybe_assign_on_profile_save( $post_id, $post, $update ) : void {
        if ( wp_is_post_revision( $post_id ) || ! $post instanceof \WP_Post ) {
            return;
        }

        $owner_user_id = (int) get_post_meta( $post_id, 'me_profile_owner_user_id', true );
        if ( $owner_user_id <= 0 ) {
            $owner_user_id = (int) $post->post_author;
        }

        if ( $owner_user_id <= 0 ) {
            return;
        }

        self::assign_next_available_upgrade( (int) $post_id, $owner_user_id );
    }

    private static function assign_next_available_upgrade( int $profile_id, int $owner_user_id ) : void {
        $current_type = (string) get_post_meta( $profile_id, 'wpcf-profile-type', true );
        if ( in_array( strtolower( $current_type ), [ 'professional', 'pro' ], true ) ) {
            return;
        }

        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM " . self::table_name() . " WHERE owner_user_id = %d AND type = %s AND status = %s ORDER BY id ASC LIMIT 1",
                $owner_user_id,
                'pro_upgrade',
                'paid_unassigned'
            ),
            ARRAY_A
        );

        if ( ! is_array( $row ) ) {
            return;
        }

        $row_id = (int) $row['id'];
        self::update_row( $row_id, [
            'assigned_profile_id' => $profile_id,
            'status'              => 'paid_assigned',
        ] );

        self::consume_pro_upgrade( $row_id, $profile_id, (int) $row['source_order_id'] );
        self::assign_bundle_companions( (string) $row['group_key'], $owner_user_id, $profile_id );
    }

    private static function sync_cart_entitlements( string $cart_item_key, int $product_id, int $quantity, int $owner_user_id, int $profile_id = 0 ) : void {
        if ( $quantity <= 0 ) {
            self::mark_cart_rows_cancelled( $cart_item_key, $owner_user_id );
            return;
        }

        if ( self::is_bundle_product( $product_id ) ) {
            self::sync_bundle_rows( $cart_item_key, $product_id, $quantity, $owner_user_id, $profile_id );
            return;
        }

        foreach ( self::product_entitlement_types( $product_id ) as $type ) {
            self::sync_single_type_rows( $cart_item_key, $product_id, $type, $quantity, $owner_user_id, $profile_id );
        }
    }

    private static function sync_bundle_rows( string $cart_item_key, int $product_id, int $quantity, int $owner_user_id, int $profile_id ) : void {
        global $wpdb;

        $table        = self::table_name();
        $existing     = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT group_key FROM {$table} WHERE owner_user_id = %d AND cart_item_key = %s AND source_product_id = %d AND status = %s AND group_key IS NOT NULL GROUP BY group_key ORDER BY MIN(id) ASC",
                $owner_user_id,
                $cart_item_key,
                $product_id,
                'in_cart'
            ),
            ARRAY_A
        );
        $group_keys   = array_values( array_filter( array_map( static function( $row ) { return (string) ( $row['group_key'] ?? '' ); }, (array) $existing ) ) );
        $current      = count( $group_keys );
        $difference   = $quantity - $current;

        if ( $difference > 0 ) {
            for ( $i = 0; $i < $difference; $i++ ) {
                $group_key = wp_generate_uuid4();
                foreach ( self::product_entitlement_types( $product_id ) as $type ) {
                    $assignment = self::next_assignment_for_type( $cart_item_key, $owner_user_id, $type );
                    $row_id = self::insert_row( [
                        'owner_user_id'      => $owner_user_id,
                        'type'               => $type,
                        'status'             => 'in_cart',
                        'group_key'          => $group_key,
                        'source_product_id'  => $product_id,
                        'cart_item_key'      => $cart_item_key,
                        'assigned_profile_id'=> $profile_id > 0 ? $profile_id : null,
                        'assigned_card_id'   => $assignment['assigned_card_id'],
                        'assigned_tag_id'    => $assignment['assigned_tag_id'],
                    ] );

                    self::attach_assignment_to_profile( $row_id, $type, $assignment, $profile_id );
                }
            }
        } elseif ( $difference < 0 ) {
            $remove = array_slice( array_reverse( $group_keys ), 0, abs( $difference ) );
            foreach ( $remove as $group_key ) {
                $wpdb->update(
                    $table,
                    [
                        'status'     => 'cancelled',
                        'updated_at' => current_time( 'mysql' ),
                    ],
                    [
                        'owner_user_id' => $owner_user_id,
                        'cart_item_key' => $cart_item_key,
                        'group_key'     => $group_key,
                        'status'        => 'in_cart',
                    ]
                );
            }
        }
    }

    private static function sync_single_type_rows( string $cart_item_key, int $product_id, string $type, int $quantity, int $owner_user_id, int $profile_id ) : void {
        global $wpdb;

        $table    = self::table_name();
        $existing = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE owner_user_id = %d AND cart_item_key = %s AND type = %s AND source_product_id = %d AND status = %s ORDER BY id ASC",
                $owner_user_id,
                $cart_item_key,
                $type,
                $product_id,
                'in_cart'
            ),
            ARRAY_A
        );

        $current    = count( $existing );
        $difference = $quantity - $current;

        if ( $difference > 0 ) {
            for ( $i = 0; $i < $difference; $i++ ) {
                $assignment = self::next_assignment_for_type( $cart_item_key, $owner_user_id, $type );
                $row_id = self::insert_row( [
                    'owner_user_id'       => $owner_user_id,
                    'type'                => $type,
                    'status'              => 'in_cart',
                    'group_key'           => null,
                    'source_product_id'   => $product_id,
                    'cart_item_key'       => $cart_item_key,
                    'assigned_profile_id' => $profile_id > 0 ? $profile_id : null,
                    'assigned_card_id'    => $assignment['assigned_card_id'],
                    'assigned_tag_id'     => $assignment['assigned_tag_id'],
                ] );

                self::attach_assignment_to_profile( $row_id, $type, $assignment, $profile_id );
            }
        } elseif ( $difference < 0 ) {
            $remove_rows = array_slice( array_reverse( $existing ), 0, abs( $difference ) );
            foreach ( $remove_rows as $row ) {
                self::update_row( (int) $row['id'], [ 'status' => 'cancelled' ] );
            }
        }
    }

    private static function create_missing_paid_rows( int $owner_user_id, int $product_id, int $quantity, int $profile_id = 0 ) : array {
        $created = [];
        if ( self::is_bundle_product( $product_id ) ) {
            for ( $i = 0; $i < $quantity; $i++ ) {
                $group_key = wp_generate_uuid4();
                foreach ( self::product_entitlement_types( $product_id ) as $type ) {
                    $created[] = self::row_by_id( self::insert_row( [
                        'owner_user_id'       => $owner_user_id,
                        'type'                => $type,
                        'status'              => $type === 'pro_upgrade' ? ( $profile_id > 0 ? 'paid_assigned' : 'paid_unassigned' ) : 'paid_assigned',
                        'group_key'           => $group_key,
                        'source_product_id'   => $product_id,
                        'assigned_profile_id' => $profile_id > 0 ? $profile_id : null,
                    ] ) );
                }
            }
        } else {
            foreach ( self::product_entitlement_types( $product_id ) as $type ) {
                for ( $i = 0; $i < $quantity; $i++ ) {
                    $created[] = self::row_by_id( self::insert_row( [
                        'owner_user_id'       => $owner_user_id,
                        'type'                => $type,
                        'status'              => $type === 'pro_upgrade' ? ( $profile_id > 0 ? 'paid_assigned' : 'paid_unassigned' ) : 'paid_assigned',
                        'source_product_id'   => $product_id,
                        'assigned_profile_id' => $profile_id > 0 ? $profile_id : null,
                    ] ) );
                }
            }
        }

        return array_values( array_filter( $created ) );
    }

    private static function find_rows_for_processing( int $owner_user_id, int $product_id, string $cart_item_key ) : array {
        global $wpdb;

        if ( $cart_item_key === '' ) {
            return [];
        }

        return (array) $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM " . self::table_name() . " WHERE owner_user_id = %d AND source_product_id = %d AND cart_item_key = %s AND status = %s ORDER BY id ASC",
                $owner_user_id,
                $product_id,
                $cart_item_key,
                'in_cart'
            ),
            ARRAY_A
        );
    }

    private static function find_processed_rows( int $owner_user_id, int $product_id, int $order_id, int $item_id, string $cart_item_key ) : array {
        global $wpdb;

        return (array) $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM " . self::table_name() . " WHERE owner_user_id = %d AND source_product_id = %d AND (
                    source_order_item_id = %d
                    OR (source_order_id = %d AND cart_item_key = %s)
                ) AND status NOT IN ('cancelled','refunded') ORDER BY id ASC",
                $owner_user_id,
                $product_id,
                $item_id,
                $order_id,
                $cart_item_key
            ),
            ARRAY_A
        );
    }

    private static function assign_bundle_companions( string $group_key, int $owner_user_id, int $profile_id ) : void {
        if ( $group_key === '' ) {
            return;
        }

        global $wpdb;
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM " . self::table_name() . " WHERE owner_user_id = %d AND group_key = %s AND type <> %s",
                $owner_user_id,
                $group_key,
                'pro_upgrade'
            ),
            ARRAY_A
        );

        foreach ( (array) $rows as $row ) {
            self::update_row( (int) $row['id'], [
                'assigned_profile_id' => $profile_id,
            ] );
            self::attach_entitlement_record_to_profile( $row, $profile_id );
        }
    }

    private static function attach_assignment_to_profile( int $row_id, string $type, array $assignment, int $profile_id ) : void {
        if ( $profile_id <= 0 ) {
            return;
        }

        $row = self::row_by_id( $row_id );
        if ( ! $row ) {
            return;
        }

        self::attach_entitlement_record_to_profile( $row, $profile_id );
    }

    private static function attach_entitlement_record_to_profile( array $row, int $profile_id ) : void {
        if ( $profile_id <= 0 || ! function_exists( 'toolset_connect_posts' ) ) {
            return;
        }

        $type = (string) $row['type'];
        if ( in_array( $type, [ 'classic_card', 'custom_card', 'phone_tag' ], true ) ) {
            $tag_id = (int) ( $type === 'phone_tag' ? $row['assigned_tag_id'] : $row['assigned_card_id'] );
            if ( $tag_id > 0 ) {
                toolset_connect_posts( 'mecard-profile-mecard-tag', $profile_id, $tag_id );
            }
        }
    }

    private static function consume_pro_upgrade( int $row_id, int $profile_id, int $order_id = 0 ) : void {
        update_post_meta( $profile_id, 'wpcf-profile-type', 'professional' );
        update_post_meta( $profile_id, '_me_pro_entitlement_id', $row_id );
        if ( $order_id > 0 ) {
            update_post_meta( $profile_id, '_me_pro_source_order_id', $order_id );
        }
        update_post_meta( $profile_id, '_me_pro_enabled_at', current_time( 'mysql' ) );

        self::update_row( $row_id, [
            'status'      => 'consumed',
            'consumed_at' => current_time( 'mysql' ),
        ] );
    }

    private static function next_assignment_for_type( string $cart_item_key, int $owner_user_id, string $type ) : array {
        $assignment = [
            'assigned_card_id' => null,
            'assigned_tag_id'  => null,
        ];

        $post_type = self::tag_post_type_for_entitlement( $type );
        if ( $post_type === '' ) {
            return $assignment;
        }

        $full_key = $cart_item_key . '-' . $owner_user_id;
        $used_ids = self::used_assignment_ids( $cart_item_key, $owner_user_id, $type );
        $tags     = function_exists( 'get_tags_by_item_key' ) ? (array) get_tags_by_item_key( $full_key ) : [];

        foreach ( $tags as $tag ) {
            if ( ! $tag instanceof \WP_Post ) {
                continue;
            }

            $tag_type = (string) get_post_meta( $tag->ID, 'wpcf-tag-type', true );
            if ( $tag_type !== $post_type || in_array( (int) $tag->ID, $used_ids, true ) ) {
                continue;
            }

            if ( $type === 'phone_tag' ) {
                $assignment['assigned_tag_id'] = (int) $tag->ID;
            } else {
                $assignment['assigned_card_id'] = (int) $tag->ID;
            }
            break;
        }

        return $assignment;
    }

    private static function used_assignment_ids( string $cart_item_key, int $owner_user_id, string $type ) : array {
        global $wpdb;

        $column = $type === 'phone_tag' ? 'assigned_tag_id' : 'assigned_card_id';
        $rows   = (array) $wpdb->get_col(
            $wpdb->prepare(
                "SELECT {$column} FROM " . self::table_name() . " WHERE owner_user_id = %d AND cart_item_key = %s AND type = %s AND {$column} IS NOT NULL AND status IN ('in_cart','paid_assigned','consumed')",
                $owner_user_id,
                $cart_item_key,
                $type
            )
        );

        return array_values( array_filter( array_map( 'intval', $rows ) ) );
    }

    private static function mark_cart_rows_cancelled( string $cart_item_key, int $owner_user_id ) : int {
        global $wpdb;

        $wpdb->update(
            self::table_name(),
            [
                'status'     => 'cancelled',
                'updated_at' => current_time( 'mysql' ),
            ],
            [
                'cart_item_key' => $cart_item_key,
                'owner_user_id' => $owner_user_id,
                'status'        => 'in_cart',
            ]
        );

        return (int) $wpdb->rows_affected;
    }

    private static function insert_row( array $data ) : int {
        global $wpdb;

        $now = current_time( 'mysql' );
        $row = [
            'owner_user_id'       => (int) ( $data['owner_user_id'] ?? 0 ),
            'team_id'             => isset( $data['team_id'] ) ? (int) $data['team_id'] : null,
            'type'                => (string) ( $data['type'] ?? '' ),
            'status'              => (string) ( $data['status'] ?? 'in_cart' ),
            'group_key'           => $data['group_key'] ?? null,
            'source_order_id'     => isset( $data['source_order_id'] ) ? (int) $data['source_order_id'] : null,
            'source_order_item_id'=> isset( $data['source_order_item_id'] ) ? (int) $data['source_order_item_id'] : null,
            'source_product_id'   => isset( $data['source_product_id'] ) ? (int) $data['source_product_id'] : null,
            'cart_item_key'       => $data['cart_item_key'] ?? null,
            'assigned_profile_id' => isset( $data['assigned_profile_id'] ) ? (int) $data['assigned_profile_id'] : null,
            'assigned_card_id'    => isset( $data['assigned_card_id'] ) ? (int) $data['assigned_card_id'] : null,
            'assigned_tag_id'     => isset( $data['assigned_tag_id'] ) ? (int) $data['assigned_tag_id'] : null,
            'meta_json'           => isset( $data['meta_json'] ) ? wp_json_encode( $data['meta_json'] ) : null,
            'created_at'          => $now,
            'updated_at'          => $now,
            'consumed_at'         => $data['consumed_at'] ?? null,
        ];

        $wpdb->insert( self::table_name(), $row );
        return (int) $wpdb->insert_id;
    }

    private static function update_row( int $row_id, array $updates ) : void {
        global $wpdb;

        $data = [];
        foreach ( $updates as $key => $value ) {
            if ( $key === 'meta_json' && is_array( $value ) ) {
                $data[ $key ] = wp_json_encode( $value );
            } else {
                $data[ $key ] = $value;
            }
        }
        $data['updated_at'] = current_time( 'mysql' );

        $wpdb->update(
            self::table_name(),
            $data,
            [ 'id' => $row_id ]
        );
    }

    private static function row_by_id( int $row_id ) : ?array {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare( "SELECT * FROM " . self::table_name() . " WHERE id = %d", $row_id ),
            ARRAY_A
        );
        return is_array( $row ) ? $row : null;
    }

    private static function table_name() : string {
        global $wpdb;
        return $wpdb->prefix . 'mecard_entitlements';
    }

    private static function product_entitlement_types( int $product_id ) : array {
        $mapping = [
            (int) ( defined( 'MECARD_PROFILE_UPGRADE_PRODUCT_ID' ) ? MECARD_PROFILE_UPGRADE_PRODUCT_ID : 0 ) => [ 'pro_upgrade' ],
            (int) ( defined( 'MECARD_CLASSIC_PRODUCT_ID' ) ? MECARD_CLASSIC_PRODUCT_ID : 0 ) => [ 'classic_card' ],
            (int) ( defined( 'MECARD_PRODUCT_ID' ) ? MECARD_PRODUCT_ID : 0 ) => [ 'custom_card' ],
            (int) ( defined( 'MECARD_PHONETAG_PRODUCT_ID' ) ? MECARD_PHONETAG_PRODUCT_ID : 0 ) => [ 'phone_tag' ],
            (int) ( defined( 'MECARD_CLASSIC_BUNDLE_PRODUCT_ID' ) ? MECARD_CLASSIC_BUNDLE_PRODUCT_ID : 0 ) => [ 'pro_upgrade', 'classic_card', 'phone_tag' ],
            (int) ( defined( 'MECARD_BUNDLE_PRODUCT_ID' ) ? MECARD_BUNDLE_PRODUCT_ID : 0 ) => [ 'pro_upgrade', 'custom_card', 'phone_tag' ],
        ];

        return $mapping[ $product_id ] ?? [];
    }

    private static function is_bundle_product( int $product_id ) : bool {
        return in_array(
            $product_id,
            [
                (int) ( defined( 'MECARD_CLASSIC_BUNDLE_PRODUCT_ID' ) ? MECARD_CLASSIC_BUNDLE_PRODUCT_ID : 0 ),
                (int) ( defined( 'MECARD_BUNDLE_PRODUCT_ID' ) ? MECARD_BUNDLE_PRODUCT_ID : 0 ),
            ],
            true
        );
    }

    private static function tag_post_type_for_entitlement( string $type ) : string {
        $mapping = [
            'classic_card' => 'classiccard',
            'custom_card'  => 'contactcard',
            'phone_tag'    => 'phonetag',
        ];

        return $mapping[ $type ] ?? '';
    }

    private static function profile_id_from_cart_data( array $cart_item_data ) : int {
        $profile_id = 0;

        if ( isset( $cart_item_data['mecard_profile_id'] ) ) {
            $profile_id = absint( $cart_item_data['mecard_profile_id'] );
        } elseif ( isset( $cart_item_data['profile_id'] ) ) {
            $profile_id = absint( $cart_item_data['profile_id'] );
        } elseif ( isset( $_REQUEST['profile_id'] ) ) {
            $profile_id = absint( wp_unslash( $_REQUEST['profile_id'] ) );
        }

        return $profile_id;
    }
}
