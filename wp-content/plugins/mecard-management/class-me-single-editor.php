<?php
namespace Me\Single_Editor;

use Me\Preview\Module as Preview_Module;
use Me\Profile_Renderer\Module as Profile_Renderer_Module;
use Me\Single_Manage\Module as Single_Manage_Module;

if ( ! defined( 'ABSPATH' ) ) exit;

class Module {
    public static function init() : void {
        add_shortcode( 'me_single_profile_editor', [ __CLASS__, 'render_shortcode' ] );
        add_shortcode( 'me_edit_profile', [ __CLASS__, 'render_shortcode' ] );
        add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue' ] );
        add_action( 'template_redirect', [ __CLASS__, 'maybe_redirect_dashboard' ] );
        add_action( 'template_redirect', [ __CLASS__, 'maybe_redirect_legacy_toolset_edit' ], 5 );
        add_action( 'template_redirect', [ __CLASS__, 'handle_editor_actions' ], 6 );
        add_action( 'wp_ajax_me_single_editor_load', [ __CLASS__, 'ajax_load' ] );
        add_action( 'wp_ajax_me_single_editor_save', [ __CLASS__, 'ajax_save' ] );
        add_action( 'wp_ajax_me_single_editor_add_upgrade', [ __CLASS__, 'ajax_add_upgrade' ] );
        add_filter( 'the_content', [ __CLASS__, 'replace_edit_profile_page' ], 20 );
        add_filter( 'ajax_query_attachments_args', [ __CLASS__, 'filter_editor_media_query' ] );
        add_filter( 'get_edit_post_link', [ __CLASS__, 'filter_profile_edit_link' ], 20, 3 );
    }

    public static function enqueue() : void {
        if ( ! self::should_render_editor() ) {
            return;
        }

        wp_enqueue_media();
        if ( function_exists( 'wp_enqueue_editor' ) ) {
            wp_enqueue_editor();
        }

        $google_places_key = self::google_places_api_key();
        if ( $google_places_key ) {
            wp_enqueue_script(
                'me-single-editor-google-places',
                'https://maps.googleapis.com/maps/api/js?key=' . rawurlencode( $google_places_key ) . '&libraries=places',
                [],
                null,
                true
            );
        }

        wp_enqueue_style(
            'me-single-editor',
            plugin_dir_url( __FILE__ ) . 'css/me-single-editor.css',
            [ 'me-profile', 'me-editor-shell' ],
            filemtime( plugin_dir_path( __FILE__ ) . 'css/me-single-editor.css' )
        );

        wp_enqueue_script(
            'me-single-editor',
            plugin_dir_url( __FILE__ ) . 'js/me-single-editor.js',
            [ 'jquery' ],
            filemtime( plugin_dir_path( __FILE__ ) . 'js/me-single-editor.js' ),
            true
        );

        wp_localize_script( 'me-single-editor', 'ME_SINGLE_EDITOR', [
            'ajaxurl'        => admin_url( 'admin-ajax.php' ),
            'nonce'          => wp_create_nonce( 'me-single-editor-nonce' ),
            'dashboardUrl'   => self::dashboard_url(),
            'editProfileUrl' => self::editor_url(),
            'currentUserId'  => get_current_user_id(),
            'googlePlacesEnabled' => (bool) $google_places_key,
            'images'         => [
                'companyPlaceholder' => plugin_dir_url( __FILE__ ) . 'images/image-placeholder.jpg',
                'profilePlaceholder' => plugin_dir_url( __FILE__ ) . 'images/profile.png',
            ],
        ] );
    }

    public static function replace_edit_profile_page( $content ) {
        if ( ! is_main_query() || ! in_the_loop() || ! is_page( 'profile' ) ) {
            return $content;
        }

        return do_shortcode( '[me_single_profile_editor]' );
    }

    public static function filter_editor_media_query( array $query = [] ) : array {
        if ( ! is_user_logged_in() ) {
            return $query;
        }

        $raw = isset( $_REQUEST['query'] ) ? (array) wp_unslash( $_REQUEST['query'] ) : [];
        if ( empty( $raw['mecard_owned_only'] ) ) {
            return $query;
        }

        $query['author']         = get_current_user_id();
        $query['post_mime_type'] = 'image';

        return $query;
    }

    public static function filter_profile_edit_link( $url, $post_id, $context ) {
        if ( is_admin() || ! is_user_logged_in() ) {
            return $url;
        }

        $post = get_post( $post_id );
        if ( ! $post || $post->post_type !== 'mecard-profile' ) {
            return $url;
        }

        if ( ! self::user_can_edit_profile( (int) $post_id ) ) {
            return $url;
        }

        $single_profile_id = self::resolve_single_profile_id( get_current_user_id() );
        if ( $single_profile_id !== (int) $post_id ) {
            return $url;
        }

        return self::editor_url( (int) $post_id );
    }

    public static function editor_url( int $profile_id = 0 ) : string {
        return site_url( '/manage/profile/' );
    }

    public static function dashboard_url() : string {
        return Single_Manage_Module::manage_url();
    }

    public static function cards_url() : string {
        return site_url( '/manage/cards/' );
    }

    private static function legacy_dashboard_url() : string {
        return site_url( '/manage-mecard-profiles/dashboard/' );
    }

    public static function maybe_redirect_dashboard() : void {
        if ( ! is_user_logged_in() ) {
            return;
        }

        $request_path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( home_url( wp_unslash( $_SERVER['REQUEST_URI'] ) ), PHP_URL_PATH ) : '';
        $dashboard_path = wp_parse_url( self::legacy_dashboard_url(), PHP_URL_PATH );
        if ( ! $request_path || ! $dashboard_path || untrailingslashit( $request_path ) !== untrailingslashit( $dashboard_path ) ) {
            return;
        }

        $profile_id = self::resolve_single_profile_id( get_current_user_id() );
        if ( $profile_id ) {
            wp_safe_redirect( self::editor_url( $profile_id ) );
            exit;
        }
    }

    public static function maybe_redirect_legacy_toolset_edit() : void {
        if ( ! is_user_logged_in() || is_admin() ) {
            return;
        }

        $has_toolset_edit_markers = isset( $_GET['cred_edit_post'] )
            || isset( $_GET['cred_action'] )
            || isset( $_GET['cred_referrer_form_id'] )
            || isset( $_GET['cred_form_id'] );

        if ( ! $has_toolset_edit_markers ) {
            return;
        }

        $profile_id = isset( $_GET['cred_edit_post'] ) ? absint( $_GET['cred_edit_post'] ) : 0;
        if ( ! $profile_id && is_singular( 'mecard-profile' ) ) {
            $profile_id = get_queried_object_id();
        }

        if ( ! $profile_id ) {
            return;
        }

        $single_profile_id = self::resolve_single_profile_id( get_current_user_id() );
        if ( $single_profile_id !== $profile_id ) {
            return;
        }

        if ( ! self::user_can_edit_profile( $profile_id ) ) {
            return;
        }

        wp_safe_redirect( self::editor_url( $profile_id ) );
        exit;
    }

    public static function handle_editor_actions() : void {
        if ( ! is_user_logged_in() || is_admin() || ! is_page( 'profile' ) ) {
            return;
        }

        $action = isset( $_GET['me_editor_action'] ) ? sanitize_text_field( wp_unslash( $_GET['me_editor_action'] ) ) : '';
        if ( $action !== 'add-upgrade' ) {
            return;
        }

        $profile_id = self::resolve_single_profile_id( get_current_user_id() );
        if ( ! $profile_id || ! self::user_can_edit_profile( $profile_id ) ) {
            return;
        }

        $nonce = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : '';
        if ( ! wp_verify_nonce( $nonce, 'me-single-editor-add-upgrade-' . $profile_id ) ) {
            wp_die( 'This upgrade link has expired. Please try again.' );
        }

        if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
            return;
        }

        $upgrade_product_id = defined( 'MECARD_PROFILE_UPGRADE_PRODUCT_ID' ) ? (int) MECARD_PROFILE_UPGRADE_PRODUCT_ID : 0;
        if ( $upgrade_product_id <= 0 ) {
            return;
        }

        if ( ! self::find_upgrade_cart_item_key( $profile_id ) ) {
            WC()->cart->add_to_cart(
                $upgrade_product_id,
                1,
                0,
                [],
                [
                    'mecard_profile_id' => $profile_id,
                ]
            );
        }

        wp_safe_redirect( add_query_arg( 'mode', 'pro', self::editor_url( $profile_id ) ) );
        exit;
    }

    public static function resolve_single_profile_id( int $user_id ) : int {
        $profiles = self::get_self_owned_profiles( $user_id );
        return count( $profiles ) === 1 ? (int) $profiles[0] : 0;
    }

    public static function get_self_owned_profiles( int $user_id ) : array {
        $by_owner = get_posts( [
            'post_type'      => 'mecard-profile',
            'post_status'    => [ 'publish', 'draft', 'private' ],
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'meta_query'     => [
                [
                    'key'   => 'me_profile_owner_user_id',
                    'value' => $user_id,
                ],
            ],
        ] );

        $by_author = get_posts( [
            'post_type'      => 'mecard-profile',
            'post_status'    => [ 'publish', 'draft', 'private' ],
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'author'         => $user_id,
        ] );

        $ids = array_values( array_unique( array_map( 'intval', array_merge( $by_owner, $by_author ) ) ) );
        sort( $ids );

        return $ids;
    }

    private static function should_render_editor() : bool {
        global $post;

        if ( ! is_user_logged_in() || ! $post instanceof \WP_Post ) {
            return false;
        }

        if ( is_page( 'profile' ) ) {
            return true;
        }

        return has_shortcode( (string) $post->post_content, 'me_single_profile_editor' )
            || has_shortcode( (string) $post->post_content, 'me_edit_profile' );
    }

    private static function google_places_api_key() : string {
        $constant_candidates = [
            'MECARD_GOOGLE_PLACES_API_KEY',
            'MECARD_GOOGLE_MAPS_API_KEY',
            'GOOGLE_PLACES_API_KEY',
            'GOOGLE_MAPS_API_KEY',
        ];

        foreach ( $constant_candidates as $constant_name ) {
            if ( defined( $constant_name ) && is_string( constant( $constant_name ) ) && constant( $constant_name ) !== '' ) {
                return (string) constant( $constant_name );
            }
        }

        $option_candidates = [
            'mecard_google_places_api_key',
            'mecard_google_maps_api_key',
            'google_places_api_key',
            'google_maps_api_key',
        ];

        foreach ( $option_candidates as $option_name ) {
            $value = get_option( $option_name );
            if ( is_string( $value ) && $value !== '' ) {
                return $value;
            }
        }

        return (string) apply_filters( 'me_single_editor_google_places_api_key', '' );
    }

    public static function render_shortcode() : string {
        if ( ! is_user_logged_in() ) {
            return '<div class="me-single-editor-login"><p>Please sign in to edit your MeCard profile.</p></div>';
        }

        $user_id    = get_current_user_id();
        $profile_id = self::resolve_single_profile_id( $user_id );

        if ( ! $profile_id ) {
            wp_safe_redirect( self::dashboard_url() );
            exit;
        }

        $bundle_journey = Single_Manage_Module::get_bundle_journey( $profile_id );
        $is_bundle_journey = ! empty( $bundle_journey['active'] );
        $profile_type   = strtolower( (string) get_post_meta( $profile_id, 'wpcf-profile-type', true ) );
        $is_pro_profile = $is_bundle_journey || in_array( $profile_type, [ 'professional', 'pro' ], true );
        $initial_mode   = $is_pro_profile ? 'pro' : 'standard';

        ob_start();
        ?>
        <div class="me-single-editor-page" data-profile-id="<?php echo esc_attr( $profile_id ); ?>" data-force-pro="<?php echo $is_pro_profile ? '1' : '0'; ?>" data-initial-mode="<?php echo esc_attr( $initial_mode ); ?>">
            <div class="me-single-editor__header">
                <div>
                    <p class="me-single-editor__eyebrow">Edit profile</p>
                    <h1>Manage your MeCard profile</h1>
                    <p class="me-single-editor__intro">Tap your name, photo, company name, or buttons to edit them.</p>
                    <?php if ( $is_bundle_journey ) : ?>
                        <p class="me-single-editor__intro">Step 1 of 3: Configure your Pro profile, then confirm your bundle items before checkout.</p>
                    <?php elseif ( ! $is_pro_profile ) : ?>
                        <p class="me-single-editor__intro">Use Standard and Pro to preview how each version will look.</p>
                    <?php endif; ?>
                </div>
            </div>

            <?php if ( ! $is_pro_profile ) : ?>
                <div class="me-single-editor__mode-switch" role="tablist" aria-label="Profile template preview">
                    <button type="button" class="me-single-editor__mode-btn is-active" data-mode="standard">Standard</button>
                    <button type="button" class="me-single-editor__mode-btn" data-mode="pro">Upgrade to Pro</button>
                </div>
            <?php endif; ?>

            <?php if ( ! $is_pro_profile ) : ?>
                <div class="me-single-editor__upgrade-benefits" id="me_single_upgrade_benefits" hidden>
                    <p>All standard features +</p>
                    <ul class="me-single-editor__upgrade-points">
                        <li>Rich company details</li>
                        <li>Company branding</li>
                        <li>Analytics</li>
                        <li>Team management and sharing</li>
                    </ul>
                </div>
            <?php endif; ?>

            <form id="meSingleEditorForm" class="me-single-editor__form" hidden>
                <input type="hidden" name="post_id" value="<?php echo esc_attr( $profile_id ); ?>">
                <input type="hidden" name="company_id" id="me_single_company_id" value="0">
                <input type="hidden" name="me_profile_photo_id" id="me_single_profile_photo_id" value="">
                <input type="hidden" name="me_profile_company_logo_id" id="me_single_company_logo_id" value="">
                <input type="hidden" name="wpcf-first-name" id="me_single_first_name" value="">
                <input type="hidden" name="wpcf-last-name" id="me_single_last_name" value="">
                <input type="hidden" name="wpcf-job-title" id="me_single_job" value="">
                <input type="hidden" name="wpcf-email-address" id="me_single_email" value="">
                <input type="hidden" name="wpcf-mobile-number" id="me_single_mobile" value="">
                <input type="hidden" name="wpcf-whatsapp-number" id="me_single_whatsapp" value="">
                <input type="hidden" name="wpcf-work-phone-number" id="me_single_work_phone" value="">
                <input type="hidden" name="wpcf-profile-type" id="me_single_profile_type" value="">
                <input type="hidden" name="wpcf-linkedin-url" id="me_single_linkedin" value="">
                <input type="hidden" name="wpcf-facebook-url" id="me_single_facebook" value="">
                <input type="hidden" name="wpcf-twitter-url" id="me_single_twitter" value="">
                <input type="hidden" name="wpcf-instagram-user" id="me_single_instagram" value="">
                <input type="hidden" name="wpcf-youtube-url" id="me_single_youtube" value="">
                <input type="hidden" name="wpcf-tiktok-url" id="me_single_tiktok" value="">
                <input type="hidden" name="company_post_title" id="me_single_company_name" value="">
                <input type="hidden" name="wpcf-company-website" id="me_single_company_website" value="">
                <input type="hidden" name="wpcf-company-telephone-number" id="me_single_company_tel" value="">
                <input type="hidden" name="wpcf-support-email" id="me_single_company_email" value="">
                <input type="hidden" name="wpcf-company-address" id="me_single_company_address" value="">
                <textarea name="wpcf-company-description" id="me_single_company_description" hidden></textarea>
                <input type="hidden" name="wpcf-heading-font" id="me_single_heading_font" value="">
                <input type="hidden" name="wpcf-heading-font-colour" id="me_single_heading_colour" value="">
                <input type="hidden" name="wpcf-normal-font" id="me_single_body_font" value="">
                <input type="hidden" name="wpcf-normal-font-colour" id="me_single_body_colour" value="">
                <input type="hidden" name="wpcf-accent-colour" id="me_single_accent" value="">
                <input type="hidden" name="wpcf-button-text-colour" id="me_single_button_text" value="">
                <input type="hidden" name="wpcf-download-button-colour" id="me_single_download" value="">
                <input type="hidden" name="wpcf-download-button-text-colour" id="me_single_download_text" value="">
                <textarea name="wpcf-custom-css" id="me_single_custom_css" hidden></textarea>
            </form>

            <div class="me-single-editor__canvas">
                <div id="meSinglePreviewStandard" class="me-single-editor__pane <?php echo $is_pro_profile ? '' : 'is-active'; ?>" data-mode="standard">
                    <div class="mecard-public-card me-single-editor__preview-card">
                            <?php Profile_Renderer_Module::render_standard( [], [], 'preview' ); ?>
                    </div>
                </div>
                <div id="meSinglePreviewPro" class="me-single-editor__pane <?php echo $is_pro_profile ? 'is-active' : ''; ?>" data-mode="pro">
                    <div class="mecard-public-card me-single-editor__preview-card">
                            <?php Profile_Renderer_Module::render_pro( [], [], 'preview' ); ?>
                    </div>
                </div>
            </div>

            <div class="me-single-editor__status" id="me_single_status" aria-live="polite"></div>

            <?php if ( ! $is_pro_profile ) : ?>
                <div class="me-single-editor__panel me-single-editor__upgrade-panel" id="me_single_upgrade_cta" hidden>
                    <div class="me-single-editor__panel-head">
                        <p class="me-single-editor__panel-kicker">Upgrade Now</p>
                        <h2>Pro profile - R199 per year</h2>
                        <p>Unlock branding, company details, richer buttons, and analytics.</p>
                    </div>
                    <div class="me-single-editor__panel-body" id="me_single_upgrade_panel_body">
                        <div class="me-single-editor__panel-actions">
                            <a class="me-single-editor__panel-button me-single-editor__panel-button--primary" id="me_single_upgrade_now" href="<?php echo esc_url( self::upgrade_add_url( $profile_id ) ); ?>">Add to basket</a>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <?php if ( $is_bundle_journey ) : ?>
                <div class="me-single-editor__panel me-single-editor__journey-panel">
                    <div class="me-single-editor__panel-head">
                        <p class="me-single-editor__panel-kicker">Bundle in progress</p>
                        <h2>Step 1 of 3: Configure your Pro profile</h2>
                        <p>Your classic bundle is already in your basket. Once this looks right, confirm the card and phone tag, then checkout.</p>
                    </div>
                    <div class="me-single-editor__panel-actions">
                        <a class="me-single-editor__panel-button me-single-editor__panel-button--primary" href="<?php echo esc_url( Single_Manage_Module::bundle_cards_url( $profile_id ) ); ?>">Next: Confirm bundle items</a>
                        <a class="me-single-editor__panel-button" href="<?php echo esc_url( wc_get_checkout_url() ); ?>">Checkout</a>
                        <a class="me-single-editor__panel-button me-single-editor__panel-button--secondary" href="<?php echo esc_url( Single_Manage_Module::bundle_remove_url( $profile_id ) ); ?>">Remove bundle</a>
                    </div>
                </div>
            <?php endif; ?>

            <div class="me-single-editor__footer">
                <a class="me-single-editor__back me-single-editor__back--bottom" id="me_single_done" href="<?php echo esc_url( self::dashboard_url() ); ?>">Back to My MeCard Home</a>
            </div>
        </div>

        <div class="me-single-editor__sheet-backdrop" id="me_single_sheet_backdrop" hidden></div>
        <div class="me-single-editor__sheet" id="me_single_sheet" hidden>
            <div class="me-single-editor__sheet-shell">
                <div class="me-single-editor__sheet-handle"></div>
                <div class="me-single-editor__sheet-head">
                    <div>
                        <strong id="me_single_sheet_title">Edit</strong>
                        <p id="me_single_sheet_hint"></p>
                    </div>
                    <button type="button" class="button button-secondary" id="me_single_sheet_close">Close</button>
                </div>
                <form id="me_single_sheet_form" class="me-single-editor__sheet-form"></form>
            </div>
        </div>
        <?php

        return ob_get_clean();
    }

    public static function ajax_load() : void {
        self::verify_request();

        $profile_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : self::resolve_single_profile_id( get_current_user_id() );
        if ( ! self::user_can_edit_profile( $profile_id ) ) {
            wp_send_json_error( [ 'message' => 'No permission to edit this profile.' ], 403 );
        }

        wp_send_json_success( self::build_payload( $profile_id ) );
    }

    public static function ajax_save() : void {
        self::verify_request();

        $profile_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : 0;
        if ( ! self::user_can_edit_profile( $profile_id ) ) {
            wp_send_json_error( [ 'message' => 'No permission to edit this profile.' ], 403 );
        }

        $profile_type = self::clean_text( 'wpcf-profile-type' ) ?: 'standard';

        $profile_fields = [
            'wpcf-first-name',
            'wpcf-last-name',
            'wpcf-job-title',
            'wpcf-email-address',
            'wpcf-mobile-number',
            'wpcf-whatsapp-number',
            'wpcf-work-phone-number',
            'wpcf-profile-type',
            'wpcf-facebook-url',
            'wpcf-twitter-url',
            'wpcf-linkedin-url',
            'wpcf-instagram-user',
            'wpcf-youtube-url',
            'wpcf-tiktok-url',
        ];

        foreach ( $profile_fields as $key ) {
            if ( isset( $_POST[ $key ] ) ) {
                update_post_meta( $profile_id, $key, self::sanitize_field_value( $key, $_POST[ $key ] ) );
            }
        }

        if ( ! empty( $_POST['me_profile_photo_id'] ) ) {
            set_post_thumbnail( $profile_id, absint( $_POST['me_profile_photo_id'] ) );
        }

        $company_name = self::clean_text( 'company_post_title' );
        if ( $company_name !== '' ) {
            update_post_meta( $profile_id, 'wpcf-company_name', $company_name );
            update_post_meta( $profile_id, 'wpcf-company-r', $company_name );
        }

        $company_logo_id = isset( $_POST['me_profile_company_logo_id'] ) ? absint( $_POST['me_profile_company_logo_id'] ) : 0;
        if ( $company_logo_id ) {
            update_post_meta( $profile_id, 'me_profile_company_logo_id', $company_logo_id );
        }

        if ( isset( $_POST['profile_links'] ) && is_string( $_POST['profile_links'] ) ) {
            $_POST['profile_links'] = json_decode( wp_unslash( $_POST['profile_links'] ), true );
        }
        if ( isset( $_POST['company_links'] ) && is_string( $_POST['company_links'] ) ) {
            $_POST['company_links'] = json_decode( wp_unslash( $_POST['company_links'] ), true );
        }

        $company_id = isset( $_POST['company_id'] ) ? absint( $_POST['company_id'] ) : 0;
        $company_payload_present = self::has_company_payload();

        if ( ! $company_id && $company_payload_present && ( in_array( strtolower( $profile_type ), [ 'professional', 'pro' ], true ) || self::has_pro_company_payload() ) ) {
            $company_id = self::create_company_for_profile( $profile_id, $company_name );
        }

        if ( $company_id ) {
            self::save_company_data( $company_id );
            update_post_meta( $profile_id, 'company_parent', $company_id );
            if ( function_exists( 'toolset_connect_posts' ) ) {
                toolset_connect_posts( 'company-mecard-profile', $company_id, $profile_id );
            }
        }

        self::save_repeatable_links( $profile_id, 'more-links', $_POST['profile_links'] ?? [] );
        if ( $company_id ) {
            self::save_repeatable_links( $company_id, 'more-links-company', $_POST['company_links'] ?? [] );
        }

        wp_send_json_success( array_merge(
            [ 'message' => 'Profile updated.' ],
            self::build_payload( $profile_id )
        ) );
    }

    public static function ajax_add_upgrade() : void {
        self::verify_request();

        $profile_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : self::resolve_single_profile_id( get_current_user_id() );
        if ( ! self::user_can_edit_profile( $profile_id ) ) {
            wp_send_json_error( [ 'message' => 'No permission to edit this profile.' ], 403 );
        }

        if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
            wp_send_json_error( [ 'message' => 'Basket is not available right now.' ], 500 );
        }

        $upgrade_product_id = defined( 'MECARD_PROFILE_UPGRADE_PRODUCT_ID' ) ? (int) MECARD_PROFILE_UPGRADE_PRODUCT_ID : 0;
        if ( $upgrade_product_id <= 0 ) {
            wp_send_json_error( [ 'message' => 'Upgrade product is not configured.' ], 500 );
        }

        $existing_key = self::find_upgrade_cart_item_key( $profile_id );
        if ( ! $existing_key ) {
            $added_key = WC()->cart->add_to_cart(
                $upgrade_product_id,
                1,
                0,
                [],
                [
                    'mecard_profile_id' => $profile_id,
                ]
            );

            if ( ! $added_key ) {
                wp_send_json_error( [ 'message' => 'Could not add the Pro upgrade to your basket.' ], 500 );
            }

            $existing_key = (string) $added_key;
        }

        wp_send_json_success( [
            'message'     => 'Pro profile upgrade added to your basket.',
            'cartItemKey' => $existing_key,
            'basket'      => self::build_basket_summary( $profile_id ),
            'redirect'    => add_query_arg( 'mode', 'pro', self::editor_url( $profile_id ) ),
        ] );
    }

    private static function verify_request() : void {
        if ( ! is_user_logged_in() ) {
            wp_send_json_error( [ 'message' => 'Please sign in first.' ], 403 );
        }

        if ( ! check_ajax_referer( 'me-single-editor-nonce', '_wpnonce', false ) ) {
            wp_send_json_error( [ 'message' => 'Invalid request.' ], 403 );
        }
    }

    private static function build_payload( int $profile_id ) : array {
        $profile = Preview_Module::get_profile_data( $profile_id );
        $company = [];
        if ( ! empty( $profile['company_parent'] ) ) {
            $company = Preview_Module::get_company_data( (int) $profile['company_parent'] );
            $company['logo_id'] = (int) get_post_thumbnail_id( (int) $profile['company_parent'] );
            $company['email'] = (string) get_post_meta( (int) $profile['company_parent'], 'wpcf-support-email', true );
            $company['desc_raw'] = (string) get_post_meta( (int) $profile['company_parent'], 'wpcf-company-description', true );
            $company['heading_font_raw'] = (string) get_post_meta( (int) $profile['company_parent'], 'wpcf-heading-font', true );
            $company['body_font_raw'] = (string) get_post_meta( (int) $profile['company_parent'], 'wpcf-normal-font', true );
            $company['design']['heading_font_raw'] = $company['heading_font_raw'];
            $company['design']['body_font_raw'] = $company['body_font_raw'];
        }

        return [
            'profile'        => $profile,
            'company'        => $company,
            'profileLinks'   => self::load_repeatable_links( $profile_id, 'more-links' ),
            'companyLinks'   => ! empty( $company['id'] ) ? self::load_repeatable_links( (int) $company['id'], 'more-links-company' ) : [],
            'cards'          => self::load_card_summary( $profile_id ),
            'availableCards' => self::load_available_cards( get_current_user_id() ),
            'profileUrl'     => get_permalink( $profile_id ),
            'doneUrl'        => self::dashboard_url(),
            'upgradeUrl'     => self::upgrade_add_url( $profile_id ),
            'basket'         => self::build_basket_summary( $profile_id ),
        ];
    }

    private static function build_basket_summary( int $profile_id ) : array {
        $upgrade_product_id = defined( 'MECARD_PROFILE_UPGRADE_PRODUCT_ID' ) ? (int) MECARD_PROFILE_UPGRADE_PRODUCT_ID : 0;
        $classic_product_id = defined( 'MECARD_CLASSIC_PRODUCT_ID' ) ? (int) MECARD_CLASSIC_PRODUCT_ID : 0;
        $custom_product_id  = defined( 'MECARD_PRODUCT_ID' ) ? (int) MECARD_PRODUCT_ID : 0;

        $summary = [
            'basketUrl'        => function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '',
            'checkoutUrl'      => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
            'cardsUrl'         => self::cards_url(),
            'customDesignUrl'  => add_query_arg( 'flow', 'custom', self::cards_url() ),
            'upgradeProductId' => $upgrade_product_id,
            'classicProductId' => $classic_product_id,
            'customProductId'  => $custom_product_id,
            'upgradeAddUrl'    => self::upgrade_add_url( $profile_id ),
            'upgradeInCart'    => false,
            'classicInCart'    => false,
            'customInCart'     => false,
            'items'            => [],
            'total'            => '',
            'hasItems'         => false,
        ];

        if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
            return $summary;
        }

        $relevant_product_ids = array_filter(
            [ $upgrade_product_id, $profile_id, $classic_product_id, $custom_product_id ],
            static function ( $id ) {
                return $id > 0;
            }
        );

        foreach ( WC()->cart->get_cart() as $cart_item_key => $item ) {
            $product_id = (int) ( $item['product_id'] ?? 0 );
            if ( ! in_array( $product_id, $relevant_product_ids, true ) ) {
                continue;
            }

            $quantity = max( 1, (int) ( $item['quantity'] ?? 1 ) );
            $label    = '';
            $item_profile_id = isset( $item['mecard_profile_id'] ) ? absint( $item['mecard_profile_id'] ) : 0;

            if ( $product_id === $upgrade_product_id && $item_profile_id === $profile_id ) {
                $label = 'Pro profile upgrade';
                $summary['upgradeInCart'] = true;
            } elseif ( $product_id === $profile_id ) {
                $label = 'Pro profile upgrade';
                $summary['upgradeInCart'] = true;
            } elseif ( $product_id === $classic_product_id ) {
                $label = 'Classic card';
                $summary['classicInCart'] = true;
            } elseif ( $product_id === $custom_product_id ) {
                $label = 'Custom design';
                $summary['customInCart'] = true;
            }

            if ( $label === '' ) {
                continue;
            }

            $summary['items'][] = [
                'key'      => (string) $cart_item_key,
                'label'    => $label,
                'quantity' => $quantity,
            ];
        }

        $summary['hasItems'] = ! empty( $summary['items'] );
        if ( $summary['hasItems'] ) {
            $summary['total'] = wp_strip_all_tags( WC()->cart->get_cart_total() );
        }

        return $summary;
    }

    private static function upgrade_add_url( int $profile_id ) : string {
        $url = add_query_arg(
            [
                'mode'             => 'pro',
                'me_editor_action' => 'add-upgrade',
            ],
            self::editor_url( $profile_id )
        );

        return wp_nonce_url( $url, 'me-single-editor-add-upgrade-' . $profile_id );
    }

    private static function find_upgrade_cart_item_key( int $profile_id ) : string {
        if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
            return '';
        }

        $upgrade_product_id = defined( 'MECARD_PROFILE_UPGRADE_PRODUCT_ID' ) ? (int) MECARD_PROFILE_UPGRADE_PRODUCT_ID : 0;

        foreach ( WC()->cart->get_cart() as $cart_item_key => $item ) {
            $product_id      = (int) ( $item['product_id'] ?? 0 );
            $item_profile_id = isset( $item['mecard_profile_id'] ) ? absint( $item['mecard_profile_id'] ) : 0;

            if ( $upgrade_product_id > 0 && $product_id === $upgrade_product_id && $item_profile_id === $profile_id ) {
                return (string) $cart_item_key;
            }

            if ( $product_id === $profile_id ) {
                return (string) $cart_item_key;
            }
        }

        return '';
    }

    private static function user_can_edit_profile( int $profile_id ) : bool {
        if ( ! $profile_id ) {
            return false;
        }

        $post = get_post( $profile_id );
        if ( ! $post || $post->post_type !== 'mecard-profile' ) {
            return false;
        }

        $user_id       = get_current_user_id();
        $owner_user_id = (int) get_post_meta( $profile_id, 'me_profile_owner_user_id', true );

        return (int) $post->post_author === $user_id
            || ( $owner_user_id > 0 && $owner_user_id === $user_id )
            || current_user_can( 'edit_post', $profile_id );
    }

    private static function clean_text( string $key ) : string {
        return isset( $_POST[ $key ] ) ? sanitize_text_field( wp_unslash( $_POST[ $key ] ) ) : '';
    }

    private static function sanitize_field_value( string $key, $value ) {
        $raw = wp_unslash( $value );
        if ( strpos( $key, 'email' ) !== false ) {
            return sanitize_email( $raw );
        }
        if ( strpos( $key, 'url' ) !== false || in_array( $key, [ 'wpcf-facebook-url', 'wpcf-twitter-url', 'wpcf-linkedin-url', 'wpcf-youtube-url', 'wpcf-tiktok-url' ], true ) ) {
            return esc_url_raw( $raw );
        }
        return sanitize_text_field( $raw );
    }

    private static function has_company_payload() : bool {
        $keys = [
            'company_post_title',
            'wpcf-company-website',
            'wpcf-company-telephone-number',
            'wpcf-support-email',
            'wpcf-company-address',
            'wpcf-company-description',
            'wpcf-custom-css',
            'wpcf-heading-font',
            'wpcf-heading-font-colour',
            'wpcf-normal-font',
            'wpcf-normal-font-colour',
            'wpcf-accent-colour',
            'wpcf-button-text-colour',
            'wpcf-download-button-colour',
            'wpcf-download-button-text-colour',
            'me_profile_company_logo_id',
        ];

        foreach ( $keys as $key ) {
            if ( ! empty( $_POST[ $key ] ) ) {
                return true;
            }
        }

        return ! empty( $_POST['company_links'] );
    }

    private static function has_pro_company_payload() : bool {
        $keys = [
            'wpcf-company-website',
            'wpcf-company-telephone-number',
            'wpcf-support-email',
            'wpcf-company-address',
            'wpcf-company-description',
            'wpcf-custom-css',
            'wpcf-heading-font',
            'wpcf-heading-font-colour',
            'wpcf-normal-font',
            'wpcf-normal-font-colour',
            'wpcf-accent-colour',
            'wpcf-button-text-colour',
            'wpcf-download-button-colour',
            'wpcf-download-button-text-colour',
            'me_profile_company_logo_id',
        ];

        foreach ( $keys as $key ) {
            if ( ! empty( $_POST[ $key ] ) ) {
                return true;
            }
        }

        return ! empty( $_POST['company_links'] );
    }

    private static function create_company_for_profile( int $profile_id, string $company_name ) : int {
        $post = get_post( $profile_id );
        if ( ! $post ) {
            return 0;
        }

        $default_title = trim( get_post_meta( $profile_id, 'wpcf-first-name', true ) . ' ' . get_post_meta( $profile_id, 'wpcf-last-name', true ) . ' Company' );

        $new_company_id = wp_insert_post( [
            'post_type'   => 'company',
            'post_status' => 'publish',
            'post_author' => (int) $post->post_author,
            'post_title'  => $company_name ?: $default_title,
        ] );

        if ( is_wp_error( $new_company_id ) ) {
            return 0;
        }

        return (int) $new_company_id;
    }

    private static function save_company_data( int $company_id ) : void {
        $title = self::clean_text( 'company_post_title' );
        if ( $title !== '' ) {
            wp_update_post( [ 'ID' => $company_id, 'post_title' => $title ] );
        }

        $logo_id = isset( $_POST['me_profile_company_logo_id'] ) ? absint( $_POST['me_profile_company_logo_id'] ) : 0;
        if ( $logo_id ) {
            set_post_thumbnail( $company_id, $logo_id );
        }

        $map = [
            'wpcf-company-website'             => 'url',
            'wpcf-company-telephone-number'    => 'text',
            'wpcf-support-email'               => 'email',
            'wpcf-company-address'             => 'text',
            'wpcf-company-description'         => 'html',
            'wpcf-custom-css'                  => 'css',
            'wpcf-heading-font'                => 'text',
            'wpcf-heading-font-colour'         => 'text',
            'wpcf-normal-font'                 => 'text',
            'wpcf-normal-font-colour'          => 'text',
            'wpcf-accent-colour'               => 'text',
            'wpcf-button-text-colour'          => 'text',
            'wpcf-download-button-colour'      => 'text',
            'wpcf-download-button-text-colour' => 'text',
        ];

        foreach ( $map as $key => $type ) {
            if ( ! isset( $_POST[ $key ] ) ) {
                continue;
            }

            $raw = wp_unslash( $_POST[ $key ] );
            switch ( $type ) {
                case 'url':
                    $value = esc_url_raw( $raw );
                    break;
                case 'email':
                    $value = sanitize_email( $raw );
                    break;
                case 'html':
                case 'css':
                    $value = wp_kses_post( $raw );
                    break;
                default:
                    $value = sanitize_text_field( $raw );
            }

            update_post_meta( $company_id, $key, $value );
        }
    }

    private static function load_repeatable_links( int $parent_id, string $relationship_slug ) : array {
        if ( ! $parent_id || ! function_exists( 'toolset_get_related_posts' ) ) {
            return [];
        }

        $rows = toolset_get_related_posts( $parent_id, $relationship_slug, [
            'query_by_role' => 'parent',
            'role'          => 'child',
            'limit'         => -1,
            'orderby'       => 'relationship',
            'return'        => 'post_object',
        ] );

        $items = [];
        foreach ( (array) $rows as $row ) {
            if ( ! $row instanceof \WP_Post ) {
                continue;
            }
            $items[] = [
                'child_id'    => (int) $row->ID,
                'button-text' => (string) get_post_meta( $row->ID, 'wpcf-button-text', true ),
                'button-url'  => (string) get_post_meta( $row->ID, 'wpcf-button-url', true ),
                'button-icon' => (string) get_post_meta( $row->ID, 'wpcf-button-icon', true ),
            ];
        }

        return $items;
    }

    private static function save_repeatable_links( int $parent_id, string $relationship_slug, $rows ) : void {
        if ( ! $parent_id || ! is_array( $rows ) ) {
            return;
        }

        $rfg_post_type = self::detect_relationship_child_post_type( $relationship_slug );
        $existing_ids = [];

        if ( function_exists( 'toolset_get_related_posts' ) ) {
            $existing_ids = array_map( 'intval', (array) toolset_get_related_posts( $parent_id, $relationship_slug, [
                'query_by_role' => 'parent',
                'role'          => 'child',
                'limit'         => -1,
                'return'        => 'post_id',
            ] ) );
        }

        $seen = [];
        $order = 0;

        foreach ( $rows as $row ) {
            $child_id = isset( $row['child_id'] ) ? absint( $row['child_id'] ) : 0;
            $text     = isset( $row['button-text'] ) ? sanitize_text_field( wp_unslash( $row['button-text'] ) ) : '';
            $url      = isset( $row['button-url'] ) ? esc_url_raw( wp_unslash( $row['button-url'] ) ) : '';
            $icon     = isset( $row['button-icon'] ) ? sanitize_text_field( wp_unslash( $row['button-icon'] ) ) : '';

            if ( $text === '' && $url === '' && $icon === '' ) {
                continue;
            }

            if ( ! $child_id && $rfg_post_type ) {
                $child_id = wp_insert_post( [
                    'post_type'   => $rfg_post_type,
                    'post_status' => 'publish',
                    'post_title'  => $text ?: 'Extra Button',
                    'menu_order'  => $order,
                ] );

                if ( function_exists( 'toolset_connect_posts' ) && $child_id && ! is_wp_error( $child_id ) ) {
                    toolset_connect_posts( $relationship_slug, $parent_id, $child_id );
                }
            } elseif ( $child_id ) {
                wp_update_post( [
                    'ID'         => $child_id,
                    'post_title' => $text ?: 'Extra Button',
                    'menu_order' => $order,
                ] );
            }

            if ( $child_id && ! is_wp_error( $child_id ) ) {
                update_post_meta( $child_id, 'wpcf-button-text', $text );
                update_post_meta( $child_id, 'wpcf-button-url', $url );
                update_post_meta( $child_id, 'wpcf-button-icon', $icon );
                $seen[] = (int) $child_id;
            }

            $order++;
        }

        foreach ( array_diff( $existing_ids, $seen ) as $delete_id ) {
            wp_trash_post( (int) $delete_id );
        }
    }

    private static function detect_relationship_child_post_type( string $relationship_slug ) : string {
        foreach ( [ 'wpcf-rfg-' . $relationship_slug, 'wpcf-' . $relationship_slug, $relationship_slug ] as $candidate ) {
            if ( post_type_exists( $candidate ) ) {
                return $candidate;
            }
        }

        return '';
    }

    private static function load_card_summary( int $profile_id ) : array {
        $items = [];

        if ( function_exists( 'toolset_get_related_posts' ) ) {
            $cards = toolset_get_related_posts( $profile_id, 'mecard-profile-mecard-tag', [
                'query_by_role' => 'parent',
                'return'        => 'post_object',
                'limit'         => -1,
            ] );

            foreach ( (array) $cards as $card ) {
                if ( ! $card instanceof \WP_Post ) {
                    continue;
                }
                $items[] = [
                    'id'     => (int) $card->ID,
                    'title'  => $card->post_title,
                    'type'   => (string) get_post_meta( $card->ID, 'wpcf-tag-type', true ),
                    'status' => get_post_status( $card->ID ),
                ];
            }
        }

        return $items;
    }

    private static function load_available_cards( int $user_id ) : array {
        global $wpdb;

        $linked_query = $wpdb->prepare(
            "select tags.ID as tag_id from wp_toolset_connected_elements child
             inner join wp_toolset_associations link on child.group_id = link.child_id
             inner join wp_toolset_connected_elements parent on link.parent_id = parent.group_id
             inner join wp_toolset_relationships rel on link.relationship_id = rel.id
             inner join wp_posts tags on child.element_id = tags.ID
             where tags.post_author = %d and rel.slug = 'mecard-profile-mecard-tag'",
            $user_id
        );

        $linked = $wpdb->get_col( $linked_query );
        $args = [
            'post_type'      => 't',
            'post_status'    => [ 'publish', 'private', 'draft' ],
            'posts_per_page' => -1,
            'author'         => $user_id,
            'orderby'        => 'title',
            'order'          => 'ASC',
        ];

        if ( ! empty( $linked ) ) {
            $args['post__not_in'] = array_map( 'intval', $linked );
        }

        return array_map( static function( \WP_Post $card ) : array {
            return [
                'id'    => (int) $card->ID,
                'title' => $card->post_title,
                'type'  => (string) get_post_meta( $card->ID, 'wpcf-tag-type', true ),
            ];
        }, get_posts( $args ) );
    }
}
