<?php
namespace Me\Single_Cards;

use Me\Preview\Module as Preview_Module;
use Me\Single_Editor\Module as Single_Editor_Module;
use Me\Single_Manage\Module as Single_Manage_Module;

if ( ! defined( 'ABSPATH' ) ) exit;

class Module {
    public static function init() : void {
        add_shortcode( 'me_single_cards', [ __CLASS__, 'render_shortcode' ] );
        add_shortcode( 'me_manage_cards', [ __CLASS__, 'render_shortcode' ] );
        add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue' ] );
        add_action( 'template_redirect', [ __CLASS__, 'maybe_handle_cards_add_to_cart' ], 4 );
        add_action( 'template_redirect', [ __CLASS__, 'maybe_redirect_legacy_cards' ], 5 );
        add_action( 'woocommerce_add_to_cart', [ __CLASS__, 'sync_cart_item_to_profile' ], 20, 6 );
        add_action( 'wp_ajax_me_single_cards_load', [ __CLASS__, 'ajax_load' ] );
        add_action( 'wp_ajax_me_single_cards_save_classic', [ __CLASS__, 'ajax_save_classic' ] );
        add_action( 'wp_ajax_me_single_cards_save_custom', [ __CLASS__, 'ajax_save_custom' ] );
        add_filter( 'the_content', [ __CLASS__, 'replace_manage_cards_page' ], 20 );
        add_filter( 'ajax_query_attachments_args', [ __CLASS__, 'filter_media_query' ] );
    }

    public static function enqueue() : void {
        if ( ! self::should_render_cards() ) {
            return;
        }

        wp_enqueue_media();
        wp_enqueue_style(
            'me-single-cards',
            plugin_dir_url( __FILE__ ) . 'css/me-single-cards.css',
            [ 'me-profile' ],
            filemtime( plugin_dir_path( __FILE__ ) . 'css/me-single-cards.css' )
        );

        if ( ! wp_script_is( 'qrcode-generator', 'registered' ) ) {
            wp_register_script(
                'qrcode-generator',
                plugin_dir_url( __FILE__ ) . 'js/qrcode.js',
                [],
                filemtime( plugin_dir_path( __FILE__ ) . 'js/qrcode.js' ),
                true
            );
        }
        wp_enqueue_script( 'qrcode-generator' );

        wp_enqueue_script(
            'me-single-cards',
            plugin_dir_url( __FILE__ ) . 'js/me-single-cards.js',
            [ 'jquery', 'qrcode-generator' ],
            filemtime( plugin_dir_path( __FILE__ ) . 'js/me-single-cards.js' ),
            true
        );

        wp_localize_script( 'me-single-cards', 'ME_SINGLE_CARDS', [
            'ajaxurl'        => admin_url( 'admin-ajax.php' ),
            'nonce'          => wp_create_nonce( 'me-single-cards-nonce' ),
            'currentUserId'  => get_current_user_id(),
            'manageCardsUrl' => self::cards_url(),
            'editProfileUrl' => Single_Editor_Module::editor_url(),
            'images'         => [
                'companyPlaceholder' => plugin_dir_url( __FILE__ ) . 'images/image-placeholder.jpg',
                'profilePlaceholder' => plugin_dir_url( __FILE__ ) . 'images/profile.png',
                'cardPlaceholder'    => plugin_dir_url( __FILE__ ) . 'images/upload.png',
            ],
        ] );
    }

    public static function cards_url( int $profile_id = 0, string $flow = '' ) : string {
        $url = site_url( '/manage/cards/' );
        if ( $profile_id ) {
            $url = add_query_arg( 'profile_id', $profile_id, $url );
        }
        if ( $flow !== '' ) {
            $url = add_query_arg( 'flow', sanitize_key( $flow ), $url );
        }
        return $url;
    }

    public static function maybe_handle_cards_add_to_cart() : void {
        if ( ! is_user_logged_in() || is_admin() || ! function_exists( 'WC' ) || ! WC()->cart ) {
            return;
        }

        $product_id = isset( $_GET['me_add_card'] ) ? absint( wp_unslash( $_GET['me_add_card'] ) ) : 0;
        if ( $product_id <= 0 ) {
            return;
        }

        $profile_id = isset( $_GET['profile_id'] ) ? absint( wp_unslash( $_GET['profile_id'] ) ) : self::resolve_single_profile_id( get_current_user_id() );
        if ( ! self::user_can_manage_cards( $profile_id ) ) {
            return;
        }

        $flow = isset( $_GET['flow'] ) ? sanitize_key( wp_unslash( $_GET['flow'] ) ) : 'classic';
        WC()->cart->add_to_cart( $product_id, 1, 0, [], [
            'mecard_profile_id' => $profile_id,
        ] );

        wp_safe_redirect( self::cards_url( $profile_id, $flow ) );
        exit;
    }

    private static function legacy_cards_url() : string {
        return site_url( '/manage-mecard-profiles/new-cards-and-tags/' );
    }

    public static function replace_manage_cards_page( $content ) {
        if ( ! is_main_query() || ! in_the_loop() || ! is_page( 'cards' ) ) {
            return $content;
        }

        return do_shortcode( '[me_single_cards]' );
    }

    public static function maybe_redirect_legacy_cards() : void {
        if ( ! is_user_logged_in() || is_admin() ) {
            return;
        }

        $request_path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( home_url( wp_unslash( $_SERVER['REQUEST_URI'] ) ), PHP_URL_PATH ) : '';
        $legacy_path  = wp_parse_url( self::legacy_cards_url(), PHP_URL_PATH );
        if ( ! $request_path || ! $legacy_path || untrailingslashit( $request_path ) !== untrailingslashit( $legacy_path ) ) {
            return;
        }

        $profile_id = self::resolve_single_profile_id( get_current_user_id() );
        if ( ! $profile_id ) {
            return;
        }

        $flow = '';
        if ( isset( $_GET['card-flow'] ) && sanitize_key( wp_unslash( $_GET['card-flow'] ) ) === 'custom-design' ) {
            $flow = 'custom';
        }

        wp_safe_redirect( self::cards_url( $profile_id, $flow ) );
        exit;
    }

    public static function render_shortcode() : string {
        if ( ! is_user_logged_in() ) {
            return '<div class="me-single-cards-login"><p>Please sign in to manage your cards.</p></div>';
        }

        $profile_id = self::resolve_single_profile_id( get_current_user_id() );
        if ( ! $profile_id ) {
            wp_safe_redirect( Single_Editor_Module::dashboard_url() );
            exit;
        }

        ob_start();
        ?>
        <div class="me-single-cards-page" data-profile-id="<?php echo esc_attr( $profile_id ); ?>">
            <div class="me-single-cards__header">
                <p class="me-single-cards__eyebrow">Cards</p>
                <h1>Manage your MeCard cards</h1>
                <p class="me-single-cards__intro">Cards already in progress appear first. Start a new classic or custom card below when you really need another one.</p>
            </div>

            <div class="me-single-cards__status" id="me_single_cards_status" aria-live="polite"></div>

            <section class="me-single-cards__list-wrap" id="me_single_cards_list" hidden>
                <div class="me-single-cards__collapsed-action" id="me_single_cards_list_toggle" hidden>
                    <button type="button" class="me-single-cards__button me-single-cards__button--secondary" id="me_single_cards_show_list">View live cards</button>
                </div>
                <div id="me_single_cards_list_body" class="me-single-cards__list"></div>
            </section>

            <section class="me-single-cards__panel me-single-cards__panel--new" id="me_single_cards_mode_panel">
                <div class="me-single-cards__panel-head">
                    <p class="me-single-cards__panel-kicker">Start a new card</p>
                    <h2>Choose what you want to create next</h2>
                    <p>Already have a card in progress? Open it above to avoid duplicates.</p>
                </div>

                <div class="me-single-cards__collapsed-action" id="me_single_cards_mode_toggle" hidden>
                    <button type="button" class="me-single-cards__button me-single-cards__button--primary" id="me_single_cards_expand_new">+ Add another card</button>
                </div>

                <div class="me-single-cards__switch" role="tablist" aria-label="Card flows">
                    <button type="button" class="me-single-cards__switch-btn is-active" data-flow="classic">Classic card</button>
                    <button type="button" class="me-single-cards__switch-btn" data-flow="custom">Custom design</button>
                </div>

                <div class="me-single-cards__panel--new-body">

            <section class="me-single-cards__panel me-single-cards__panel--classic is-active" id="me_single_cards_classic">
                <div class="me-single-cards__panel-head">
                    <p class="me-single-cards__panel-kicker">Classic card</p>
                    <h2 id="me_single_cards_classic_title">Fastest option</h2>
                    <p>We’ll use the details already on your profile: logo, name, and job title.</p>
                </div>
                <div class="me-single-cards__existing-note" id="me_single_cards_classic_notice" hidden></div>
                <div class="me-single-cards__classic-preview-wrap">
                    <div class="me-single-cards__classic-preview card-front classic" id="me_single_cards_classic_preview">
                        <div class="classic-logo"><img id="me_single_cards_classic_logo" src="" alt=""></div>
                        <div class="classic-name" id="me_single_cards_classic_name"></div>
                        <div class="classic-job-title" id="me_single_cards_classic_job"></div>
                    </div>
                </div>
                <form id="meSingleCardsClassicForm" class="me-single-cards__classic-form" hidden>
                    <input type="hidden" name="post_id" value="<?php echo esc_attr( $profile_id ); ?>">
                    <input type="hidden" name="card_id" id="me_single_cards_classic_card_id" value="">
                    <input type="hidden" name="wpcf-card-front" id="me_single_cards_classic_front" value="">

                    <div class="me-single-cards__upload-card me-single-cards__upload-card--compact">
                        <strong>Logo</strong>
                        <div class="me-single-cards__upload-frame is-placeholder" id="me_single_cards_classic_logo_frame">
                            <img id="me_single_cards_classic_logo_preview" class="me-single-cards__upload-preview" src="" alt="">
                        </div>
                        <button type="button" class="me-single-cards__button me-single-cards__button--secondary" data-media-target="classic-logo">Choose logo</button>
                    </div>

                    <div class="me-single-cards__field-grid me-single-cards__field-grid--classic">
                        <label>
                            Name on card
                            <input type="text" name="wpcf-name-on-card" id="me_single_cards_classic_name_input" maxlength="120">
                        </label>
                        <label>
                            Job title on card
                            <input type="text" name="wpcf-job-title-on-card" id="me_single_cards_classic_job_input" maxlength="120">
                        </label>
                    </div>

                    <div class="me-single-cards__panel-actions">
                        <button type="submit" class="me-single-cards__button me-single-cards__button--primary" id="me_single_cards_classic_save">Save changes</button>
                        <button type="button" class="me-single-cards__button me-single-cards__button--secondary" id="me_single_cards_done_editing_classic">Done editing</button>
                    </div>
                </form>
                <div class="me-single-cards__panel-actions">
                    <a class="me-single-cards__button me-single-cards__button--primary" id="me_single_cards_classic_cta" href="#">Add to basket</a>
                    <a class="me-single-cards__button me-single-cards__button--secondary" id="me_single_cards_open_list" href="#me_single_cards_list">View current cards</a>
                </div>
            </section>

            <section class="me-single-cards__panel me-single-cards__panel--custom" id="me_single_cards_custom" hidden>
                <div class="me-single-cards__panel-head">
                    <p class="me-single-cards__panel-kicker">Custom design</p>
                    <h2 id="me_single_cards_custom_title">Upload and configure your design</h2>
                    <p>You’ll need 2 artwork files: front and back. Use PNG or JPG (RGB), and leave space on the back for the QR code.</p>
                </div>

                <div class="me-single-cards__existing-note" id="me_single_cards_custom_notice" hidden></div>

                <form id="meSingleCardsCustomForm" class="me-single-cards__custom-form">
                    <input type="hidden" name="post_id" value="<?php echo esc_attr( $profile_id ); ?>">
                    <input type="hidden" name="card_id" id="me_single_cards_card_id" value="">
                    <input type="hidden" name="wpcf-card-front" id="me_single_cards_front" value="">
                    <input type="hidden" name="wpcf-card-back" id="me_single_cards_back" value="">
                    <input type="hidden" name="wpcf-card-label" id="me_single_cards_label" value="">

                    <div class="me-single-cards__upload-grid">
                        <div class="me-single-cards__upload-card">
                            <strong>Card front</strong>
                            <p class="me-single-cards__upload-spec">856 x 540px · PNG or JPG · Max 2MB</p>
                            <div class="me-single-cards__upload-frame is-placeholder" id="me_single_cards_front_frame">
                                <img id="me_single_cards_front_preview" class="me-single-cards__upload-preview" src="" alt="">
                            </div>
                            <button type="button" class="me-single-cards__button me-single-cards__button--secondary" data-media-target="front">Upload front image</button>
                        </div>
                        <div class="me-single-cards__upload-card">
                            <strong>Card back</strong>
                            <p class="me-single-cards__upload-spec">856 x 540px · PNG or JPG · Max 2MB</p>
                            <div class="me-single-cards__upload-frame is-placeholder" id="me_single_cards_back_frame">
                                <img id="me_single_cards_back_preview" class="me-single-cards__upload-preview" src="" alt="">
                            </div>
                            <button type="button" class="me-single-cards__button me-single-cards__button--secondary" data-media-target="back">Upload back image</button>
                        </div>
                    </div>

                    <div class="me-single-cards__preview-block">
                        <div class="me-single-cards__preview-head">
                            <strong>QR placement</strong>
                            <p>Drag the QR box into place on the back preview, then use the handle to resize it.</p>
                        </div>
                        <div class="me-single-cards__custom-preview" id="me_single_cards_custom_preview">
                            <img id="me_single_cards_custom_back_image" class="me-single-cards__custom-back-image" src="" alt="">
                            <div class="me-single-cards__qr-shell" id="me_single_cards_qr_shell">
                                <div class="me-single-cards__qr-code" id="me_single_cards_qr_code"></div>
                                <button type="button" class="me-single-cards__qr-resize" id="me_single_cards_qr_resize" aria-label="Resize QR code"></button>
                            </div>
                        </div>
                    </div>

                    <div class="me-single-cards__field-grid">
                        <label>
                            QR width
                            <input type="number" name="wpcf-qr-width" id="me_single_cards_qr_width" min="40" step="1">
                        </label>
                        <input type="hidden" name="wpcf-qr-x" id="me_single_cards_qr_x" value="40">
                        <input type="hidden" name="wpcf-qr-y" id="me_single_cards_qr_y" value="40">
                        <label class="me-single-cards__colour-field">
                            QR code colour
                            <input type="color" name="wpcf-qr-code-colour" id="me_single_cards_qr_colour" value="#000000">
                        </label>
                        <label class="me-single-cards__colour-field">
                            QR fill colour
                            <input type="color" name="wpcf-qr-fill-colour" id="me_single_cards_qr_fill" value="#ffffff">
                        </label>
                    </div>

                    <div class="me-single-cards__panel-actions">
                        <button type="submit" class="me-single-cards__button me-single-cards__button--secondary" id="me_single_cards_save">Save design</button>
                        <button type="button" class="me-single-cards__button me-single-cards__button--primary" id="me_single_cards_submit">Submit design</button>
                        <button type="button" class="me-single-cards__button me-single-cards__button--secondary" id="me_single_cards_done_editing_custom" hidden>Done editing</button>
                    </div>
                    <div class="me-single-cards__validation-list">
                        <div class="me-single-cards__validation-summary" id="me_single_cards_validation_summary" hidden></div>
                        <div class="me-single-cards__upload-error" id="me_single_cards_front_error" hidden></div>
                        <div class="me-single-cards__upload-error" id="me_single_cards_back_error" hidden></div>
                    </div>
                </form>
            </section>
                </div>
            </section>

            <div class="me-single-cards__footer">
                <a class="me-single-cards__back" id="me_single_cards_back" href="<?php echo esc_url( Single_Manage_Module::manage_url() ); ?>">Back to My MeCard Home</a>
            </div>
        </div>
        <?php

        return ob_get_clean();
    }

    public static function ajax_load() : void {
        self::verify_request();

        $profile_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : self::resolve_single_profile_id( get_current_user_id() );
        if ( ! self::user_can_manage_cards( $profile_id ) ) {
            wp_send_json_error( [ 'message' => 'No permission to manage cards for this profile.' ], 403 );
        }

        wp_send_json_success( self::build_payload( $profile_id ) );
    }

    public static function ajax_save_custom() : void {
        self::verify_request();

        $profile_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : 0;
        if ( ! self::user_can_manage_cards( $profile_id ) ) {
            wp_send_json_error( [ 'message' => 'No permission to manage cards for this profile.' ], 403 );
        }

        $profile     = Preview_Module::get_profile_data( $profile_id );
        $label       = self::clean_text( 'wpcf-card-label' );
        $front       = isset( $_POST['wpcf-card-front'] ) ? esc_url_raw( wp_unslash( $_POST['wpcf-card-front'] ) ) : '';
        $back        = isset( $_POST['wpcf-card-back'] ) ? esc_url_raw( wp_unslash( $_POST['wpcf-card-back'] ) ) : '';
        $qr_width    = self::clean_absint( 'wpcf-qr-width', 120 );
        $qr_x        = self::clean_absint( 'wpcf-qr-x', 40 );
        $qr_y        = self::clean_absint( 'wpcf-qr-y', 40 );
        $qr_colour   = self::clean_hex( 'wpcf-qr-code-colour', '#000000' );
        $qr_fill     = self::clean_hex( 'wpcf-qr-fill-colour', '#ffffff' );
        $card_id     = isset( $_POST['card_id'] ) ? absint( $_POST['card_id'] ) : 0;
        $submit      = ! empty( $_POST['submit_design'] );
        $full_name   = trim( (string) ( $profile['first'] ?? '' ) . ' ' . (string) ( $profile['last'] ?? '' ) );
        $job_title   = (string) ( $profile['job'] ?? '' );
        $card_label  = $label !== '' ? $label : ( $full_name !== '' ? $full_name : 'Custom card' );

        if ( ! $card_id ) {
            $card_id = self::create_card_post( $profile_id, 'contactcard', $card_label );
        } elseif ( ! self::user_owns_card( $card_id ) ) {
            wp_send_json_error( [ 'message' => 'You cannot edit this card.' ], 403 );
        } elseif ( self::card_is_locked( $card_id ) ) {
            wp_send_json_error( [ 'message' => 'This card has already been submitted and can no longer be edited here.' ], 403 );
        }

        update_post_meta( $card_id, 'wpcf-tag-type', 'contactcard' );
        update_post_meta( $card_id, 'wpcf-card-front', $front );
        update_post_meta( $card_id, 'wpcf-card-back', $back );
        update_post_meta( $card_id, 'wpcf-qr-width', $qr_width );
        update_post_meta( $card_id, 'wpcf-qr-x', $qr_x );
        update_post_meta( $card_id, 'wpcf-qr-y', $qr_y );
        update_post_meta( $card_id, 'wpcf-qr-code-colour', $qr_colour );
        update_post_meta( $card_id, 'wpcf-qr-fill-colour', $qr_fill );
        update_post_meta( $card_id, 'wpcf-card-label', $card_label );
        update_post_meta( $card_id, 'wpcf-name-on-card', $full_name );
        update_post_meta( $card_id, 'wpcf-job-title-on-card', $job_title );
        update_post_meta( $card_id, 'wpcf-auto_download_vcard', 1 );
        $redirect_url = '';
        if ( $submit ) {
            update_post_meta( $card_id, 'wpcf-design-submitted', 1 );
            $redirect_url = self::submit_custom_design_to_basket( $profile_id, $card_id );
        } else {
            update_post_meta( $card_id, 'wpcf-design-submitted', (int) get_post_meta( $card_id, 'wpcf-design-submitted', true ) );
        }

        wp_update_post( [
            'ID'         => $card_id,
            'post_title' => $card_label,
        ] );

        wp_send_json_success( array_merge(
            [
                'message'     => $submit ? 'Design submitted.' : 'Design saved.',
                'savedCardId' => $card_id,
                'redirectUrl' => $redirect_url,
            ],
            self::build_payload( $profile_id )
        ) );
    }

    public static function ajax_save_classic() : void {
        self::verify_request();

        $profile_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : 0;
        if ( ! self::user_can_manage_cards( $profile_id ) ) {
            wp_send_json_error( [ 'message' => 'No permission to manage cards for this profile.' ], 403 );
        }

        $card_id = isset( $_POST['card_id'] ) ? absint( $_POST['card_id'] ) : 0;
        if ( ! $card_id || ! self::user_owns_card( $card_id ) ) {
            wp_send_json_error( [ 'message' => 'You cannot edit this card.' ], 403 );
        }

        if ( self::card_is_locked( $card_id ) ) {
            wp_send_json_error( [ 'message' => 'This card has already been submitted and can no longer be edited here.' ], 403 );
        }

        $profile    = Preview_Module::get_profile_data( $profile_id );
        $company    = ! empty( $profile['company_parent'] ) ? Preview_Module::get_company_data( (int) $profile['company_parent'] ) : [];
        $logo       = isset( $_POST['wpcf-card-front'] ) ? esc_url_raw( wp_unslash( $_POST['wpcf-card-front'] ) ) : '';
        $name       = self::clean_text( 'wpcf-name-on-card' );
        $job_title  = self::clean_text( 'wpcf-job-title-on-card' );
        $fallback_name = trim( (string) ( $profile['first'] ?? '' ) . ' ' . (string) ( $profile['last'] ?? '' ) );
        $fallback_job  = (string) ( $profile['job'] ?? '' );
        $name       = $name !== '' ? $name : $fallback_name;
        $job_title  = $job_title !== '' ? $job_title : $fallback_job;
        $card_label = $name !== '' ? $name : trim( (string) ( $profile['first'] ?? '' ) . ' ' . (string) ( $profile['last'] ?? '' ) );

        if ( $logo === '' ) {
            $logo = self::profile_logo_url( $profile, $company );
        }

        update_post_meta( $card_id, 'wpcf-tag-type', 'classiccard' );
        update_post_meta( $card_id, 'wpcf-card-front', $logo );
        update_post_meta( $card_id, 'wpcf-card-label', $card_label );
        update_post_meta( $card_id, 'wpcf-name-on-card', $name );
        update_post_meta( $card_id, 'wpcf-job-title-on-card', $job_title );
        update_post_meta( $card_id, 'wpcf-auto_download_vcard', 1 );

        wp_update_post( [
            'ID'         => $card_id,
            'post_title' => $card_label !== '' ? $card_label : get_the_title( $card_id ),
        ] );

        wp_send_json_success( array_merge(
            [
                'message'     => 'Classic card updated.',
                'savedCardId' => $card_id,
            ],
            self::build_payload( $profile_id )
        ) );
    }

    public static function sync_cart_item_to_profile( $cart_item_key, $product_id, $quantity, $variation_id, $variation, $cart_item_data ) : void {
        if ( ! is_user_logged_in() ) {
            return;
        }

        $profile_id = isset( $_REQUEST['profile_id'] ) ? absint( wp_unslash( $_REQUEST['profile_id'] ) ) : 0;
        if ( ! self::user_can_manage_cards( $profile_id ) ) {
            return;
        }

        $profile = Preview_Module::get_profile_data( $profile_id );
        $company = ! empty( $profile['company_parent'] ) ? Preview_Module::get_company_data( (int) $profile['company_parent'] ) : [];
        $name    = trim( (string) ( $profile['first'] ?? '' ) . ' ' . (string) ( $profile['last'] ?? '' ) );
        $job     = (string) ( $profile['job'] ?? '' );
        $label   = $name !== '' ? $name : get_the_title( $profile_id );
        $logo    = self::profile_logo_url( $profile, $company );
        $key     = sanitize_text_field( (string) $cart_item_key ) . '-' . get_current_user_id();

        $tags = get_posts( [
            'post_type'      => 't',
            'posts_per_page' => -1,
            'author'         => get_current_user_id(),
            'orderby'        => 'date',
            'order'          => 'DESC',
            'meta_query'     => [
                [
                    'key'   => 'wpcf-cart-item-key',
                    'value' => $key,
                ],
            ],
        ] );

        foreach ( (array) $tags as $tag ) {
            if ( ! $tag instanceof \WP_Post ) {
                continue;
            }

            if ( function_exists( 'toolset_connect_posts' ) ) {
                toolset_connect_posts( 'mecard-profile-mecard-tag', $profile_id, $tag->ID );
            }

            $type = (string) get_post_meta( $tag->ID, 'wpcf-tag-type', true );
            update_post_meta( $tag->ID, 'wpcf-card-label', $label );
            update_post_meta( $tag->ID, 'wpcf-name-on-card', $name );
            update_post_meta( $tag->ID, 'wpcf-job-title-on-card', $job );
            update_post_meta( $tag->ID, 'wpcf-auto_download_vcard', 1 );

            if ( $type === 'classiccard' && $logo ) {
                update_post_meta( $tag->ID, 'wpcf-card-front', $logo );
            }

            wp_update_post( [
                'ID'         => $tag->ID,
                'post_title' => $label,
            ] );
        }
    }

    private static function build_payload( int $profile_id ) : array {
        $profile = Preview_Module::get_profile_data( $profile_id );
        $company = ! empty( $profile['company_parent'] ) ? Preview_Module::get_company_data( (int) $profile['company_parent'] ) : [];
        $cards   = self::load_profile_cards( $profile_id );
        $name    = trim( (string) ( $profile['first'] ?? '' ) . ' ' . (string) ( $profile['last'] ?? '' ) );

        return [
            'profile' => [
                'id'             => $profile_id,
                'name'           => $name,
                'job'            => (string) ( $profile['job'] ?? '' ),
                'profileUrl'     => get_permalink( $profile_id ),
                'photoUrl'       => (string) ( $profile['photo_url'] ?? '' ),
                'companyName'    => (string) ( $profile['company_name'] ?? '' ),
                'companyLogoUrl' => self::profile_logo_url( $profile, $company ),
                'companyLogoRaw' => ! empty( $company['logo_url'] ) ? (string) $company['logo_url'] : (string) ( $profile['company_logo_url'] ?? '' ),
                'cardLabel'      => $name !== '' ? $name : get_the_title( $profile_id ),
            ],
            'cards'          => $cards,
            'classicCardUrl' => self::build_add_to_cart_url( (int) ( defined( 'MECARD_CLASSIC_PRODUCT_ID' ) ? MECARD_CLASSIC_PRODUCT_ID : 0 ), $profile_id, 'classic' ),
            'customCardUrl'  => self::build_add_to_cart_url( (int) ( defined( 'MECARD_PRODUCT_ID' ) ? MECARD_PRODUCT_ID : 0 ), $profile_id, 'custom' ),
            'manageUrl'      => self::cards_url( $profile_id ),
            'basket'         => self::build_basket_state( $profile_id ),
        ];
    }

    private static function build_basket_state( int $profile_id ) : array {
        $classic_product_id = defined( 'MECARD_CLASSIC_PRODUCT_ID' ) ? (int) MECARD_CLASSIC_PRODUCT_ID : 0;
        $custom_product_id  = defined( 'MECARD_PRODUCT_ID' ) ? (int) MECARD_PRODUCT_ID : 0;

        $state = [
            'basketUrl'      => function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '',
            'checkoutUrl'    => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
            'classicInCart'  => false,
            'customInCart'   => false,
            'classicProduct' => $classic_product_id,
            'customProduct'  => $custom_product_id,
        ];

        if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
            return $state;
        }

        foreach ( WC()->cart->get_cart() as $item ) {
            $product_id = (int) ( $item['product_id'] ?? 0 );
            if ( $product_id === $classic_product_id ) {
                $state['classicInCart'] = true;
            }
            if ( $product_id === $custom_product_id ) {
                $state['customInCart'] = true;
            }
        }

        return $state;
    }

    private static function build_add_to_cart_url( int $product_id, int $profile_id, string $flow ) : string {
        if ( $product_id <= 0 ) {
            return '#';
        }
        return add_query_arg( 'me_add_card', $product_id, self::cards_url( $profile_id, $flow ) );
    }

    private static function profile_logo_url( array $profile, array $company ) : string {
        if ( ! empty( $company['logo_url'] ) ) {
            return (string) $company['logo_url'];
        }
        if ( ! empty( $profile['company_logo_url'] ) ) {
            return (string) $profile['company_logo_url'];
        }
        return plugin_dir_url( __FILE__ ) . 'images/image-placeholder.jpg';
    }

    private static function load_profile_cards( int $profile_id ) : array {
        $posts = [];
        if ( function_exists( 'toolset_get_related_posts' ) ) {
            $posts = toolset_get_related_posts( $profile_id, 'mecard-profile-mecard-tag', [
                'query_by_role' => 'parent',
                'return'        => 'post_object',
                'limit'         => -1,
            ] );
        }

        $author_posts = get_posts( [
            'post_type'      => 't',
            'post_status'    => [ 'publish', 'draft', 'private' ],
            'posts_per_page' => -1,
            'author'         => get_current_user_id(),
            'orderby'        => 'modified',
            'order'          => 'DESC',
        ] );

        $merged = [];
        foreach ( array_merge( (array) $posts, (array) $author_posts ) as $candidate ) {
            if ( ! $candidate instanceof \WP_Post || $candidate->post_type !== 't' ) {
                continue;
            }
            $merged[ $candidate->ID ] = $candidate;
        }

        $items = [];
        foreach ( $merged as $post ) {
            if ( ! $post instanceof \WP_Post || $post->post_type !== 't' ) {
                continue;
            }
            $type = (string) get_post_meta( $post->ID, 'wpcf-tag-type', true );
            if ( ! in_array( $type, [ 'classiccard', 'contactcard' ], true ) ) {
                continue;
            }

            $design_submitted = (int) get_post_meta( $post->ID, 'wpcf-design-submitted', true );
            $cart_key         = (string) get_post_meta( $post->ID, 'wpcf-cart-item-key', true );
            $packaged         = (int) get_post_meta( $post->ID, 'wpcf-packaged', true );
            $shipped          = (int) get_post_meta( $post->ID, 'wpcf-shipped', true );
            $card_status      = (string) get_post_meta( $post->ID, 'wpcf-card-status', true );
            $has_order        = self::card_has_order( $post->ID );
            $status_label     = self::card_status_label( [
                'cart_key'          => $cart_key,
                'design_submitted'  => $design_submitted,
                'packaged'          => $packaged,
                'shipped'           => $shipped,
                'card_status'       => $card_status,
                'has_order'         => $has_order,
            ] );
            $has_artwork       = (string) get_post_meta( $post->ID, 'wpcf-card-front', true ) !== '' || (string) get_post_meta( $post->ID, 'wpcf-card-back', true ) !== '';
            $is_in_basket      = $cart_key !== '';
            $has_status        = $card_status !== '' && $card_status !== 'draft';
            $is_submitted      = $design_submitted || $card_status === 'design-submitted';
            $is_ordered        = $has_order || $packaged || $shipped || in_array( $card_status, [ 'order-received', 'design-submitted', 'packaged', 'shipped' ], true );
            $is_draft          = ! $is_in_basket && ! $is_ordered && ( $type === 'contactcard' ? $has_artwork : false );
            $show_in_current   = $is_in_basket || $is_ordered || $design_submitted || $is_draft || $has_status;
            $editable          = false;
            if ( $type === 'classiccard' ) {
                $editable = ! $is_submitted && ! $has_order && ! $packaged && ! $shipped && $card_status !== 'order-received';
            } elseif ( $type === 'contactcard' ) {
                $editable = ! $is_submitted && ! $has_order && ! $packaged && ! $shipped && $card_status !== 'order-received';
            }
            $items[] = [
                'id'              => (int) $post->ID,
                'type'            => $type,
                'label'           => (string) get_post_meta( $post->ID, 'wpcf-card-label', true ) ?: $post->post_title,
                'front'           => (string) get_post_meta( $post->ID, 'wpcf-card-front', true ),
                'back'            => (string) get_post_meta( $post->ID, 'wpcf-card-back', true ),
                'qrX'             => (int) get_post_meta( $post->ID, 'wpcf-qr-x', true ),
                'qrY'             => (int) get_post_meta( $post->ID, 'wpcf-qr-y', true ),
                'qrWidth'         => (int) get_post_meta( $post->ID, 'wpcf-qr-width', true ),
                'qrColour'        => (string) get_post_meta( $post->ID, 'wpcf-qr-code-colour', true ) ?: '#000000',
                'qrFill'          => (string) get_post_meta( $post->ID, 'wpcf-qr-fill-colour', true ) ?: '#ffffff',
                'nameOnCard'      => (string) get_post_meta( $post->ID, 'wpcf-name-on-card', true ),
                'jobTitleOnCard'  => (string) get_post_meta( $post->ID, 'wpcf-job-title-on-card', true ),
                'autoDownload'    => (int) get_post_meta( $post->ID, 'wpcf-auto_download_vcard', true ),
                'designSubmitted' => $design_submitted,
                'statusLabel'     => $status_label,
                'showInCurrent'   => (bool) $show_in_current,
                'isDraft'         => (bool) $is_draft,
                'isInBasket'      => (bool) $is_in_basket,
                'isOrdered'       => (bool) $is_ordered,
                'editable'        => (bool) $editable,
                'isSubmitted'     => (bool) $is_submitted,
                'cardStatus'      => $card_status,
                'packaged'        => $packaged,
                'shipped'         => $shipped,
                'hasOrder'        => (bool) $has_order,
                'updated'         => get_the_modified_date( 'Y-m-d H:i:s', $post ),
            ];
        }

        usort( $items, static function ( array $a, array $b ) : int {
            return strcmp( (string) $b['updated'], (string) $a['updated'] );
        } );

        return $items;
    }

    private static function card_has_order( int $card_id ) : bool {
        if ( ! function_exists( 'toolset_get_related_posts' ) ) {
            return false;
        }

        $orders = toolset_get_related_posts( $card_id, 'order-mecard-tag', [
            'query_by_role' => 'child',
            'return'        => 'post_id',
            'limit'         => 1,
        ] );

        return ! empty( $orders );
    }

    private static function card_status_label( array $status ) : string {
        if ( ! empty( $status['shipped'] ) ) {
            return 'Shipped';
        }

        if ( ! empty( $status['packaged'] ) ) {
            return 'Packaged';
        }

        if ( ! empty( $status['card_status'] ) ) {
            $mapped = [
                'order-received'  => 'Order received',
                'design-submitted'=> 'Design submitted',
                'packaged'        => 'Packaged',
                'shipped'         => 'Shipped',
            ];
            if ( isset( $mapped[ $status['card_status'] ] ) ) {
                return $mapped[ $status['card_status'] ];
            }
            return ucwords( str_replace( '-', ' ', (string) $status['card_status'] ) );
        }

        if ( ! empty( $status['has_order'] ) ) {
            return 'Order received';
        }

        if ( ! empty( $status['design_submitted'] ) ) {
            return 'Design submitted';
        }

        if ( ! empty( $status['cart_key'] ) ) {
            return 'In basket';
        }

        return 'Draft';
    }

    private static function create_card_post( int $profile_id, string $type, string $label ) : int {
        $card_id = wp_insert_post( [
            'post_title'  => $label,
            'post_author' => get_current_user_id(),
            'post_status' => 'publish',
            'post_type'   => 't',
        ] );

        update_post_meta( $card_id, 'wpcf-tag-type', $type );
        update_post_meta( $card_id, 'wpcf-auto_download_vcard', 1 );
        update_post_meta( $card_id, 'wpcf-design-submitted', 0 );
        update_post_meta( $card_id, 'wpcf-shipped', 0 );
        update_post_meta( $card_id, 'wpcf-packaged', 0 );

        if ( function_exists( 'toolset_connect_posts' ) ) {
            toolset_connect_posts( 'mecard-profile-mecard-tag', $profile_id, $card_id );
        }

        return (int) $card_id;
    }

    private static function resolve_single_profile_id( int $user_id ) : int {
        return class_exists( Single_Editor_Module::class )
            ? (int) Single_Editor_Module::resolve_single_profile_id( $user_id )
            : 0;
    }

    private static function should_render_cards() : bool {
        global $post;
        if ( ! $post ) {
            return false;
        }

        return is_page( 'cards' )
            || has_shortcode( (string) $post->post_content, 'me_single_cards' )
            || has_shortcode( (string) $post->post_content, 'me_manage_cards' );
    }

    private static function submit_custom_design_to_basket( int $profile_id, int $card_id ) : string {
        if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
            return '';
        }

        $product_id = defined( 'MECARD_PRODUCT_ID' ) ? (int) MECARD_PRODUCT_ID : 0;
        if ( $product_id <= 0 ) {
            return '';
        }

        $existing_key = (string) get_post_meta( $card_id, 'wpcf-cart-item-key', true );
        if ( $existing_key !== '' ) {
            return function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '';
        }

        $cart_item_key = WC()->cart->add_to_cart( $product_id, 1, 0, [], [
            'mecard_profile_id' => $profile_id,
            'mecard_card_id'    => $card_id,
        ] );

        if ( ! $cart_item_key ) {
            return '';
        }

        update_post_meta( $card_id, 'wpcf-cart-item-key', sanitize_text_field( (string) $cart_item_key ) . '-' . get_current_user_id() );

        return function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '';
    }

    private static function verify_request() : void {
        if ( ! is_user_logged_in() ) {
            wp_send_json_error( [ 'message' => 'Please sign in first.' ], 403 );
        }

        if ( ! check_ajax_referer( 'me-single-cards-nonce', '_wpnonce', false ) ) {
            wp_send_json_error( [ 'message' => 'Invalid request.' ], 403 );
        }
    }

    public static function filter_media_query( array $query = [] ) : array {
        if ( ! is_user_logged_in() || empty( $query['mecard_owned_only'] ) ) {
            return $query;
        }

        $query['author']         = get_current_user_id();
        $query['post_mime_type'] = 'image';
        return $query;
    }

    private static function user_can_manage_cards( int $profile_id ) : bool {
        if ( ! $profile_id ) {
            return false;
        }

        return Single_Editor_Module::resolve_single_profile_id( get_current_user_id() ) === $profile_id
            && current_user_can( 'read_post', $profile_id );
    }

    private static function user_owns_card( int $card_id ) : bool {
        $post = get_post( $card_id );
        return $post && $post->post_type === 't' && (int) $post->post_author === get_current_user_id();
    }

    private static function card_is_locked( int $card_id ) : bool {
        $design_submitted = (int) get_post_meta( $card_id, 'wpcf-design-submitted', true );
        $packaged         = (int) get_post_meta( $card_id, 'wpcf-packaged', true );
        $shipped          = (int) get_post_meta( $card_id, 'wpcf-shipped', true );
        $card_status      = (string) get_post_meta( $card_id, 'wpcf-card-status', true );

        return (bool) (
            $design_submitted
            || $packaged
            || $shipped
            || in_array( $card_status, [ 'design-submitted', 'order-received', 'packaged', 'shipped' ], true )
            || self::card_has_order( $card_id )
        );
    }

    private static function clean_text( string $key ) : string {
        return isset( $_POST[ $key ] ) ? sanitize_text_field( wp_unslash( $_POST[ $key ] ) ) : '';
    }

    private static function clean_absint( string $key, int $default = 0 ) : int {
        if ( ! isset( $_POST[ $key ] ) ) {
            return $default;
        }
        return max( 0, absint( wp_unslash( $_POST[ $key ] ) ) );
    }

    private static function clean_hex( string $key, string $default ) : string {
        $raw = isset( $_POST[ $key ] ) ? sanitize_text_field( wp_unslash( $_POST[ $key ] ) ) : '';
        return preg_match( '/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $raw ) ? strtolower( $raw ) : $default;
    }
}
