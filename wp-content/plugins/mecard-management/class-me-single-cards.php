<?php
namespace Me\Single_Cards;

use Me\Single_Editor\Module as Single_Editor_Module;
use Me\Single_Manage\Module as Single_Manage_Module;

if ( ! defined( 'ABSPATH' ) ) exit;

class Module {
    public static function init() : void {
        add_shortcode( 'me_single_cards', [ __CLASS__, 'render_shortcode' ] );
        add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue' ] );
        add_filter( 'the_content', [ __CLASS__, 'replace_cards_page' ], 20 );
        add_action( 'wp_ajax_me_single_cards_save_bundle_classic', [ __CLASS__, 'ajax_save_bundle_classic' ] );
        add_action( 'wp_ajax_me_single_cards_save_bundle_custom', [ __CLASS__, 'ajax_save_bundle_custom' ] );
        add_filter( 'ajax_query_attachments_args', [ __CLASS__, 'filter_cards_media_query' ] );
    }

    public static function filter_cards_media_query( array $query = [] ) : array {
        $raw = isset( $_REQUEST['query'] ) ? (array) wp_unslash( $_REQUEST['query'] ) : [];
        if ( ! is_user_logged_in() || empty( $raw['mecard_owned_only'] ) ) {
            return $query;
        }
        $query['author']         = get_current_user_id();
        $query['post_mime_type'] = 'image';
        return $query;
    }

    public static function enqueue() : void {
        if ( ! self::should_render_cards() ) {
            return;
        }

        wp_enqueue_media();
        wp_enqueue_script( 'jquery-ui-draggable' );
        wp_enqueue_script( 'jquery-ui-resizable' );
        wp_enqueue_script(
            'me-single-cards-qrcode',
            plugin_dir_url( __FILE__ ) . 'js/qrcode.js',
            [],
            filemtime( plugin_dir_path( __FILE__ ) . 'js/qrcode.js' ),
            true
        );

        wp_enqueue_style(
            'me-single-manage',
            plugin_dir_url( __FILE__ ) . 'css/me-single-manage.css',
            [],
            filemtime( plugin_dir_path( __FILE__ ) . 'css/me-single-manage.css' )
        );

        wp_enqueue_style(
            'me-single-cards',
            plugin_dir_url( __FILE__ ) . 'css/me-single-cards.css',
            [ 'me-single-manage' ],
            filemtime( plugin_dir_path( __FILE__ ) . 'css/me-single-cards.css' )
        );

        wp_enqueue_script(
            'me-single-cards',
            plugin_dir_url( __FILE__ ) . 'js/me-single-cards.js',
            [ 'jquery', 'jquery-ui-draggable', 'jquery-ui-resizable', 'me-single-cards-qrcode' ],
            filemtime( plugin_dir_path( __FILE__ ) . 'js/me-single-cards.js' ),
            true
        );

        wp_localize_script( 'me-single-cards', 'ME_SINGLE_CARDS', [
            'ajaxurl'       => admin_url( 'admin-ajax.php' ),
            'nonce'         => wp_create_nonce( 'me-single-cards-nonce' ),
            'currentUserId' => get_current_user_id(),
            'assets'        => [
                'uploadPlaceholder' => plugin_dir_url( __FILE__ ) . 'images/upload.png',
            ],
        ] );
    }

    public static function replace_cards_page( $content ) {
        if ( ! is_main_query() || ! in_the_loop() || ! is_page( 'cards' ) ) {
            return $content;
        }

        return do_shortcode( '[me_single_cards]' );
    }

    public static function cards_url( int $profile_id = 0 ) : string {
        return site_url( '/manage/cards/' );
    }

    public static function render_shortcode() : string {
        if ( ! is_user_logged_in() ) {
            return '<div class="me-single-cards__notice"><p>Please log in to manage your cards.</p></div>';
        }

        $user_id    = get_current_user_id();
        $profile_id = self::resolve_profile_id( $user_id );
        $groups     = self::get_current_card_groups( $user_id, $profile_id );
        $bundle     = Single_Manage_Module::get_bundle_journey( $profile_id );

        if ( $bundle['active'] ) {
            return self::render_bundle_journey( $profile_id, $groups, $bundle );
        }

        if ( self::requested_flow() === 'custom' ) {
            return self::render_custom_card_flow( $profile_id, $groups );
        }

        ob_start();
        echo Single_Manage_Module::render_subnav( 'cards' );
        ?>
        <section class="me-single-cards">
            <header class="me-single-cards__header">
                <p class="me-single-cards__eyebrow">Cards</p>
                <h1>Manage your MeCard cards</h1>
                <p>Cards already in your basket, in progress, or live will show here.</p>
            </header>

            <?php if ( empty( $groups['basket'] ) && empty( $groups['in_progress'] ) && empty( $groups['live'] ) ) : ?>
                <section class="me-single-cards__empty">
                    <h2>No active cards yet</h2>
                    <p>Your first bundle or card order will show up here as soon as it is in your basket or in production.</p>
                </section>
            <?php else : ?>
                <?php foreach ( [
                    'basket'      => 'In your basket',
                    'in_progress' => 'In progress',
                    'live'        => 'Live',
                ] as $group_key => $heading ) : ?>
                    <?php if ( empty( $groups[ $group_key ] ) ) { continue; } ?>
                    <section class="me-single-cards__stage">
                        <h2><?php echo esc_html( $heading ); ?></h2>
                        <div class="me-single-cards__grid">
                            <?php foreach ( $groups[ $group_key ] as $card ) : ?>
                                <article class="me-single-cards__item">
                                    <?php if ( $group_key === 'basket' && $card['kind'] === 'classic' && ! ( $card['submitted'] ?? false ) ) : ?>
                                        <?php $classic_card_data = self::bundle_classic_card_data( $card['profile_id'] ?? 0, $card['id'] ?? 0 ); ?>
                                        <div class="me-bundle-card" data-card-id="<?php echo esc_attr( $card['id'] ); ?>">
                                            <div class="me-bundle-card__preview">
                                                <?php echo self::render_card_preview( $card ); ?>
                                            </div>
                                            <div class="me-bundle-card__actions">
                                                <button type="button" class="me-single-cards__button" data-bundle-edit-toggle>Edit card details</button>
                                            </div>
                                            <form class="me-bundle-card__form" data-bundle-card-form hidden>
                                                <input type="hidden" name="card_id" value="<?php echo esc_attr( $card['id'] ); ?>">
                                                <input type="hidden" name="logo_id" value="<?php echo esc_attr( $classic_card_data['logo_id'] ?? 0 ); ?>">
                                                <input type="hidden" name="logo_url" value="<?php echo esc_attr( $classic_card_data['front_url'] ?? '' ); ?>">
                                                <label>
                                                    <span>Logo</span>
                                                    <div class="me-bundle-card__logo-field">
                                                        <img class="me-bundle-card__logo-preview" src="<?php echo esc_url( $classic_card_data['front_url'] ?: ( plugin_dir_url( __FILE__ ) . 'images/image-placeholder.jpg' ) ); ?>" alt="Classic card logo preview">
                                                        <button type="button" class="me-single-cards__button" data-bundle-card-pick-logo>Choose logo</button>
                                                    </div>
                                                </label>
                                                <label>
                                                    <span>Name on card</span>
                                                    <input type="text" name="name" value="<?php echo esc_attr( $classic_card_data['name'] ?? '' ); ?>">
                                                </label>
                                                <label>
                                                    <span>Job title on card</span>
                                                    <input type="text" name="job_title" value="<?php echo esc_attr( $classic_card_data['job_title'] ?? '' ); ?>">
                                                </label>
                                                <div class="me-bundle-card__form-actions">
                                                    <button type="submit" class="me-single-cards__button me-single-cards__button--primary">Save card details</button>
                                                </div>
                                                <div class="me-bundle-card__status" data-bundle-card-status aria-live="polite"></div>
                                            </form>
                                        </div>
                                    <?php else : ?>
                                        <?php echo self::render_card_preview( $card ); ?>
                                        <div class="me-single-cards__item-meta">
                                            <strong><?php echo esc_html( $card['label'] ); ?></strong>
                                            <span><?php echo esc_html( $card['status_label'] ); ?></span>
                                        </div>
                                        <?php if ( $group_key === 'basket' && ( $card['kind'] ?? '' ) === 'custom' && ! ( $card['submitted'] ?? false ) ) : ?>
                                            <div class="me-single-cards__item-actions">
                                                <a class="me-single-cards__button me-single-cards__button--primary" href="<?php echo esc_url( add_query_arg( 'flow', 'custom', self::cards_url() ) ); ?>">Configure card</a>
                                            </div>
                                        <?php endif; ?>
                                    <?php endif; ?>
                                </article>
                            <?php endforeach; ?>
                        </div>

                        <?php if ( $group_key === 'basket' ) : ?>
                            <div class="me-single-cards__stage-actions">
                                <a class="me-single-cards__button me-single-cards__button--cta" href="<?php echo esc_url( wc_get_checkout_url() ); ?>">View basket and checkout</a>
                            </div>
                        <?php endif; ?>
                    </section>
                <?php endforeach; ?>
            <?php endif; ?>

            <div class="me-single-cards__footer">
                <a class="me-single-cards__button me-single-cards__button--secondary" href="<?php echo esc_url( Single_Manage_Module::manage_url( $profile_id ) ); ?>">Back to My MeCard Home</a>
            </div>
        </section>
        <?php
        return (string) ob_get_clean();
    }

    public static function ajax_save_bundle_classic() : void {
        if ( ! is_user_logged_in() ) {
            wp_send_json_error( [ 'message' => 'Please sign in first.' ], 403 );
        }

        if ( ! check_ajax_referer( 'me-single-cards-nonce', '_wpnonce', false ) ) {
            wp_send_json_error( [ 'message' => 'Invalid request.' ], 403 );
        }

        $card_id = isset( $_POST['card_id'] ) ? absint( $_POST['card_id'] ) : 0;
        if ( $card_id <= 0 || get_post_type( $card_id ) !== 't' ) {
            wp_send_json_error( [ 'message' => 'Could not find that classic card.' ], 400 );
        }

        $post = get_post( $card_id );
        if ( ! $post || (int) $post->post_author !== get_current_user_id() ) {
            wp_send_json_error( [ 'message' => 'You cannot edit this card.' ], 403 );
        }

        $logo_id = isset( $_POST['logo_id'] ) ? absint( $_POST['logo_id'] ) : 0;
        $logo_url = '';
        if ( $logo_id > 0 ) {
            $logo_url = (string) wp_get_attachment_image_url( $logo_id, 'medium' );
        } elseif ( isset( $_POST['logo_url'] ) ) {
            $logo_url = esc_url_raw( wp_unslash( $_POST['logo_url'] ) );
        }

        $name = isset( $_POST['name'] ) ? sanitize_text_field( wp_unslash( $_POST['name'] ) ) : '';
        $job  = isset( $_POST['job_title'] ) ? sanitize_text_field( wp_unslash( $_POST['job_title'] ) ) : '';

        if ( $logo_url !== '' ) {
            update_post_meta( $card_id, 'wpcf-card-front', $logo_url );
        } else {
            delete_post_meta( $card_id, 'wpcf-card-front' );
        }

        update_post_meta( $card_id, 'wpcf-name-on-card', $name );
        update_post_meta( $card_id, 'wpcf-job-title-on-card', $job );

        wp_send_json_success( [
            'card' => self::bundle_classic_card_data( self::profile_id_for_card( $card_id ), $card_id ),
        ] );
    }

    public static function ajax_save_bundle_custom() : void {
        if ( ! is_user_logged_in() ) {
            wp_send_json_error( [ 'message' => 'Please sign in first.' ], 403 );
        }

        if ( ! check_ajax_referer( 'me-single-cards-nonce', '_wpnonce', false ) ) {
            wp_send_json_error( [ 'message' => 'Invalid request.' ], 403 );
        }

        $card_id = isset( $_POST['card_id'] ) ? absint( $_POST['card_id'] ) : 0;
        if ( $card_id <= 0 || get_post_type( $card_id ) !== 't' ) {
            wp_send_json_error( [ 'message' => 'Could not find that custom card.' ], 400 );
        }

        $post = get_post( $card_id );
        if ( ! $post || (int) $post->post_author !== get_current_user_id() ) {
            wp_send_json_error( [ 'message' => 'You cannot edit this card.' ], 403 );
        }

        $front_url = isset( $_POST['wpcf-card-front'] ) ? esc_url_raw( wp_unslash( $_POST['wpcf-card-front'] ) ) : ( isset( $_POST['front_url'] ) ? esc_url_raw( wp_unslash( $_POST['front_url'] ) ) : '' );
        $back_url  = isset( $_POST['wpcf-card-back'] ) ? esc_url_raw( wp_unslash( $_POST['wpcf-card-back'] ) ) : ( isset( $_POST['back_url'] ) ? esc_url_raw( wp_unslash( $_POST['back_url'] ) ) : '' );
        $qr_width  = isset( $_POST['wpcf-qr-width'] ) ? max( 60, absint( $_POST['wpcf-qr-width'] ) ) : ( isset( $_POST['qr_width'] ) ? max( 60, absint( $_POST['qr_width'] ) ) : 140 );
        $qr_x      = isset( $_POST['wpcf-qr-x'] ) ? max( 0, intval( $_POST['wpcf-qr-x'] ) ) : ( isset( $_POST['qr_x'] ) ? max( 0, intval( $_POST['qr_x'] ) ) : 32 );
        $qr_y      = isset( $_POST['wpcf-qr-y'] ) ? max( 0, intval( $_POST['wpcf-qr-y'] ) ) : ( isset( $_POST['qr_y'] ) ? max( 0, intval( $_POST['qr_y'] ) ) : 32 );
        $qr_code   = isset( $_POST['wpcf-qr-code-colour'] ) ? sanitize_hex_color( wp_unslash( $_POST['wpcf-qr-code-colour'] ) ) : ( isset( $_POST['qr_code_colour'] ) ? sanitize_hex_color( wp_unslash( $_POST['qr_code_colour'] ) ) : '#000000' );
        $qr_fill   = isset( $_POST['wpcf-qr-fill-colour'] ) ? sanitize_hex_color( wp_unslash( $_POST['wpcf-qr-fill-colour'] ) ) : ( isset( $_POST['qr_fill_colour'] ) ? sanitize_hex_color( wp_unslash( $_POST['qr_fill_colour'] ) ) : '#ffffff' );

        if ( $front_url !== '' ) {
            update_post_meta( $card_id, 'wpcf-card-front', $front_url );
        } else {
            delete_post_meta( $card_id, 'wpcf-card-front' );
        }

        if ( $back_url !== '' ) {
            update_post_meta( $card_id, 'wpcf-card-back', $back_url );
        } else {
            delete_post_meta( $card_id, 'wpcf-card-back' );
        }

        update_post_meta( $card_id, 'wpcf-qr-width', $qr_width );
        update_post_meta( $card_id, 'wpcf-qr-x', $qr_x );
        update_post_meta( $card_id, 'wpcf-qr-y', $qr_y );
        update_post_meta( $card_id, 'wpcf-qr-code-colour', $qr_code ?: '#000000' );
        update_post_meta( $card_id, 'wpcf-qr-fill-colour', $qr_fill ?: '#ffffff' );

        wp_send_json_success( [
            'card' => self::bundle_custom_card_data( self::profile_id_for_card( $card_id ), $card_id ),
        ] );
    }

    private static function render_bundle_journey( int $profile_id, array $groups, array $bundle ) : string {
        $basket_cards = $groups['basket'] ?? [];
        $classic_card = null;
        $custom_card  = null;
        $phone_tag    = null;
        $bundle_type  = $bundle['bundle_type'] ?? 'classic';

        foreach ( $basket_cards as $card ) {
            if ( $card['kind'] === 'classic' && ! $classic_card ) {
                $classic_card = $card;
            }
            if ( $card['kind'] === 'custom' && ! $custom_card ) {
                $custom_card = $card;
            }
            if ( $card['kind'] === 'phone_tag' && ! $phone_tag ) {
                $phone_tag = $card;
            }
        }

        if ( ! $phone_tag ) {
            $phone_tag = self::build_phone_tag_preview();
        }

        if ( $bundle_type === 'custom' ) {
            $custom_card = self::bundle_custom_card_data( $profile_id, $custom_card['id'] ?? 0 );
            return self::render_custom_bundle_journey( $profile_id, $custom_card, $phone_tag, $bundle_type );
        }

        $classic_card = self::bundle_classic_card_data( $profile_id, $classic_card['id'] ?? 0 );

        ob_start();
        ?>
        <section class="me-single-cards me-single-cards--journey">
            <header class="me-single-cards__header">
                <p class="me-single-cards__eyebrow">Bundle in progress</p>
                <h1>Step 2 of 3: Confirm your bundle items</h1>
                <p>Review the classic card and phone tag included in your bundle, then continue to checkout.</p>
            </header>

            <section class="me-single-cards__stage">
                <div class="me-single-cards__journey-grid">
                    <article class="me-single-cards__item">
                        <h2>Classic card</h2>
                        <div class="me-bundle-card" data-card-id="<?php echo esc_attr( $classic_card['id'] ?? 0 ); ?>">
                            <div class="me-bundle-card__toggle" role="tablist" aria-label="Classic card preview side">
                                <button type="button" class="me-bundle-card__toggle-btn is-active" data-card-side="front">Front</button>
                                <button type="button" class="me-bundle-card__toggle-btn" data-card-side="back">Back</button>
                            </div>
                            <div class="me-bundle-card__pane is-active" data-card-pane="front">
                                <div class="me-bundle-card__preview">
                                    <?php echo self::render_card_preview( $classic_card ); ?>
                                </div>
                            </div>
                            <div class="me-bundle-card__pane" data-card-pane="back">
                                <div class="me-bundle-card__preview me-bundle-card__preview--back">
                                    <img src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'images/classic-back.png' ); ?>" alt="Classic card back">
                                </div>
                            </div>
                            <?php if ( ! empty( $classic_card['id'] ) ) : ?>
                                <div class="me-bundle-card__actions">
                                    <button type="button" class="me-single-cards__button" data-bundle-edit-toggle>Edit card details</button>
                                </div>
                                <form class="me-bundle-card__form" data-bundle-card-form hidden>
                                    <input type="hidden" name="card_id" value="<?php echo esc_attr( $classic_card['id'] ); ?>">
                                    <input type="hidden" name="logo_id" value="<?php echo esc_attr( $classic_card['logo_id'] ?? 0 ); ?>">
                                    <input type="hidden" name="logo_url" value="<?php echo esc_attr( $classic_card['front_url'] ?? '' ); ?>">
                                    <label>
                                        <span>Logo</span>
                                        <div class="me-bundle-card__logo-field">
                                            <img class="me-bundle-card__logo-preview" src="<?php echo esc_url( $classic_card['front_url'] ?: ( plugin_dir_url( __FILE__ ) . 'images/image-placeholder.jpg' ) ); ?>" alt="Classic card logo preview">
                                            <button type="button" class="me-single-cards__button" data-bundle-card-pick-logo>Choose logo</button>
                                        </div>
                                    </label>
                                    <label>
                                        <span>Name on card</span>
                                        <input type="text" name="name" value="<?php echo esc_attr( $classic_card['name'] ?? '' ); ?>">
                                    </label>
                                    <label>
                                        <span>Job title on card</span>
                                        <input type="text" name="job_title" value="<?php echo esc_attr( $classic_card['job_title'] ?? '' ); ?>">
                                    </label>
                                    <div class="me-bundle-card__form-actions">
                                        <button type="submit" class="me-single-cards__button me-single-cards__button--primary">Save card details</button>
                                    </div>
                                    <div class="me-bundle-card__status" data-bundle-card-status aria-live="polite"></div>
                                </form>
                            <?php endif; ?>
                        </div>
                    </article>
                    <article class="me-single-cards__item">
                        <h2>Phone tag</h2>
                        <?php echo self::render_card_preview( $phone_tag ); ?>
                    </article>
                </div>
                <div class="me-single-cards__stage-actions">
                    <a class="me-single-cards__button" href="<?php echo esc_url( Single_Manage_Module::bundle_profile_url( $profile_id, $bundle_type ) ); ?>">Back to profile</a>
                    <a class="me-single-cards__button me-single-cards__button--cta" href="<?php echo esc_url( wc_get_checkout_url() ); ?>">Continue to checkout</a>
                    <a class="me-single-cards__button me-single-cards__button--secondary" href="<?php echo esc_url( Single_Manage_Module::bundle_remove_url( $profile_id, $bundle_type ) ); ?>">Remove bundle</a>
                </div>
            </section>
        </section>
        <?php
        return (string) ob_get_clean();
    }

    private static function render_custom_bundle_journey( int $profile_id, array $custom_card, array $phone_tag, string $bundle_type ) : string {
        ob_start();
        ?>
        <section class="me-single-cards me-single-cards--journey">
            <header class="me-single-cards__header">
                <p class="me-single-cards__eyebrow">Bundle in progress</p>
                <h1>Step 2 of 3: Confirm your bundle items</h1>
                <p>Upload your front and back design files, adjust the QR setup, then continue to checkout.</p>
            </header>

            <section class="me-single-cards__stage">
                <div class="me-single-cards__journey-grid">
                    <article class="me-single-cards__item">
                        <h2>Custom card</h2>
                        <?php echo self::render_custom_card_editor( $profile_id, $custom_card ); ?>
                    </article>
                    <article class="me-single-cards__item">
                        <h2>Phone tag</h2>
                        <?php echo self::render_card_preview( $phone_tag ); ?>
                    </article>
                </div>
                <div class="me-single-cards__stage-actions">
                    <a class="me-single-cards__button" href="<?php echo esc_url( Single_Manage_Module::bundle_profile_url( $profile_id, $bundle_type ) ); ?>">Back to profile</a>
                    <a class="me-single-cards__button me-single-cards__button--cta" href="<?php echo esc_url( wc_get_checkout_url() ); ?>">Continue to checkout</a>
                    <a class="me-single-cards__button me-single-cards__button--secondary" href="<?php echo esc_url( Single_Manage_Module::bundle_remove_url( $profile_id, $bundle_type ) ); ?>">Remove bundle</a>
                </div>
            </section>
        </section>
        <?php
        return (string) ob_get_clean();
    }

    private static function render_custom_card_flow( int $profile_id, array $groups ) : string {
        $custom_card = self::find_first_card_by_kind( $groups, 'custom' );
        $card_data   = self::bundle_custom_card_data( $profile_id, $custom_card['id'] ?? 0 );

        ob_start();
        ?>
        <section class="me-single-cards me-single-cards--journey">
            <header class="me-single-cards__header">
                <p class="me-single-cards__eyebrow">Custom card</p>
                <h1>Set up your custom card</h1>
                <p>Upload your front and back design files, then drag, resize and colour the QR code on the back.</p>
            </header>

            <section class="me-single-cards__stage">
                <?php echo self::render_custom_card_editor( $profile_id, $card_data ); ?>
                <div class="me-single-cards__stage-actions">
                    <a class="me-single-cards__button" href="<?php echo esc_url( Single_Manage_Module::manage_url( $profile_id ) ); ?>">Back to My MeCard Home</a>
                    <a class="me-single-cards__button me-single-cards__button--cta" href="<?php echo esc_url( wc_get_checkout_url() ); ?>">View basket and checkout</a>
                </div>
            </section>
        </section>
        <?php
        return (string) ob_get_clean();
    }

    public static function get_current_card_groups( int $user_id, int $profile_id = 0 ) : array {
        $groups = [
            'basket'      => [],
            'in_progress' => [],
            'live'        => [],
        ];

        foreach ( self::get_current_cards( $user_id, $profile_id ) as $card ) {
            $groups[ $card['status_group'] ][] = $card;
        }

        return $groups;
    }

    public static function get_current_cards( int $user_id, int $profile_id = 0 ) : array {
        $posts = self::get_candidate_cards( $user_id, $profile_id );
        if ( empty( $posts ) ) {
            return [];
        }

        $cart_keys = self::current_cart_keys();
        $cards     = [];

        foreach ( $posts as $post ) {
            if ( ! $post instanceof \WP_Post ) {
                continue;
            }

            $card = self::build_card_payload( $post, $cart_keys );
            if ( ! $card ) {
                continue;
            }

            $cards[] = $card;
        }

        usort( $cards, static function( array $a, array $b ) : int {
            $priority = [ 'basket' => 0, 'in_progress' => 1, 'live' => 2 ];
            $a_sort   = $priority[ $a['status_group'] ] ?? 99;
            $b_sort   = $priority[ $b['status_group'] ] ?? 99;

            if ( $a_sort !== $b_sort ) {
                return $a_sort <=> $b_sort;
            }

            return ( $b['id'] ?? 0 ) <=> ( $a['id'] ?? 0 );
        } );

        return $cards;
    }

    public static function render_card_preview( array $card ) : string {
        $label = esc_attr( $card['label'] );

        ob_start();
        ?>
        <div class="me-card-preview me-card-preview--<?php echo esc_attr( $card['kind'] ); ?>">
            <?php if ( $card['kind'] === 'classic' ) : ?>
                <div class="me-card-preview__surface me-card-preview__surface--classic">
                    <div class="me-card-preview__logo-shell">
                        <?php if ( ! empty( $card['front_url'] ) ) : ?>
                            <img class="me-card-preview__logo" src="<?php echo esc_url( $card['front_url'] ); ?>" alt="<?php echo $label; ?>">
                        <?php else : ?>
                            <div class="me-card-preview__placeholder">Logo</div>
                        <?php endif; ?>
                    </div>
                    <div class="me-card-preview__name"><?php echo esc_html( $card['name'] ); ?></div>
                    <?php if ( $card['job_title'] !== '' ) : ?>
                        <div class="me-card-preview__title"><?php echo esc_html( $card['job_title'] ); ?></div>
                    <?php endif; ?>
                </div>
            <?php elseif ( $card['kind'] === 'custom' ) : ?>
                <div class="me-card-preview__surface me-card-preview__surface--custom">
                    <div class="me-card-preview__image-shell">
                        <?php if ( ! empty( $card['front_url'] ) ) : ?>
                            <img class="me-card-preview__image" src="<?php echo esc_url( $card['front_url'] ); ?>" alt="<?php echo $label; ?>">
                        <?php else : ?>
                            <div class="me-card-preview__placeholder me-card-preview__placeholder--image">
                                <img class="me-card-preview__placeholder-image" src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'images/upload.png' ); ?>" alt="Upload custom card artwork">
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            <?php else : ?>
                <div class="me-card-preview__surface me-card-preview__surface--tag">
                    <div class="me-card-preview__tag-shell">
                        <img class="me-card-preview__tag-image" src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'images/phonetag.png' ); ?>" alt="<?php echo $label; ?>">
                    </div>
                </div>
            <?php endif; ?>
        </div>
        <?php
        return (string) ob_get_clean();
    }

    public static function has_active_cards( int $user_id, int $profile_id = 0 ) : bool {
        $groups = self::get_current_card_groups( $user_id, $profile_id );
        return ! empty( $groups['basket'] ) || ! empty( $groups['in_progress'] ) || ! empty( $groups['live'] );
    }

    private static function should_render_cards() : bool {
        global $post;

        if ( ! is_user_logged_in() || ! $post instanceof \WP_Post ) {
            return false;
        }

        return is_page( 'cards' ) || has_shortcode( (string) $post->post_content, 'me_single_cards' );
    }

    private static function resolve_profile_id( int $user_id ) : int {
        if ( isset( $_GET['profile_id'] ) ) {
            return absint( wp_unslash( $_GET['profile_id'] ) );
        }

        return Single_Editor_Module::resolve_single_profile_id( $user_id );
    }

    private static function requested_flow() : string {
        return isset( $_GET['flow'] ) ? sanitize_key( wp_unslash( $_GET['flow'] ) ) : '';
    }

    private static function get_candidate_cards( int $user_id, int $profile_id ) : array {
        if ( $profile_id > 0 && function_exists( 'toolset_get_related_posts' ) ) {
            $ids = array_map( 'intval', (array) toolset_get_related_posts( $profile_id, 'mecard-profile-mecard-tag', [
                'query_by_role' => 'parent',
                'return'        => 'post_id',
                'limit'         => 1000,
            ] ) );

            if ( ! empty( $ids ) ) {
                return get_posts( [
                    'post_type'      => 't',
                    'post__in'       => $ids,
                    'orderby'        => 'post__in',
                    'posts_per_page' => -1,
                    'post_status'    => [ 'publish', 'draft', 'private' ],
                ] );
            }
        }

        return get_posts( [
            'post_type'      => 't',
            'author'         => $user_id,
            'posts_per_page' => -1,
            'post_status'    => [ 'publish', 'draft', 'private' ],
            'orderby'        => 'date',
            'order'          => 'DESC',
        ] );
    }

    private static function current_cart_keys() : array {
        $keys = [];

        if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
            return $keys;
        }

        foreach ( WC()->cart->get_cart() as $item ) {
            $key = (string) ( $item['key'] ?? '' );
            if ( $key !== '' ) {
                $keys[] = $key . '-' . get_current_user_id();
            }
        }

        return $keys;
    }

    private static function build_card_payload( \WP_Post $post, array $cart_keys ) : ?array {
        $tag_type = (string) get_post_meta( $post->ID, 'wpcf-tag-type', true );
        $kind     = self::kind_from_tag_type( $tag_type );
        if ( $kind === '' ) {
            return null;
        }

        $profile_id    = self::profile_id_for_card( (int) $post->ID );

        if ( $profile_id <= 0 && (int) $post->post_author > 0 ) {
            $author_profiles = get_posts( [
                'post_type'      => 'mecard-profile',
                'author'         => (int) $post->post_author,
                'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
                'posts_per_page' => 1,
                'orderby'        => 'date',
                'order'          => 'ASC',
                'fields'         => 'ids',
            ] );
            if ( ! empty( $author_profiles[0] ) ) {
                $profile_id = (int) $author_profiles[0];
            }
        }

        $profile_title = $profile_id > 0 ? get_the_title( $profile_id ) : $post->post_title;
        $job_title     = '';

        if ( $profile_id > 0 ) {
            $job_title = (string) get_post_meta( $profile_id, 'wpcf-job-title', true );
        }

        $name = (string) get_post_meta( $post->ID, 'wpcf-name-on-card', true );
        if ( $name === '' ) {
            $name = (string) $profile_title;
        }

        $card_job_title = (string) get_post_meta( $post->ID, 'wpcf-job-title-on-card', true );
        if ( $card_job_title !== '' ) {
            $job_title = $card_job_title;
        }

        $front_url = '';
        if ( $kind === 'classic' ) {
            $front_url = self::classic_logo_url( (int) $post->ID, $profile_id );
        } elseif ( $kind === 'custom' ) {
            $front_url = (string) get_post_meta( $post->ID, 'wpcf-card-front', true );
        }

        $label        = (string) get_post_meta( $post->ID, 'wpcf-card-label', true );
        $cart_key     = (string) get_post_meta( $post->ID, 'wpcf-cart-item-key', true );
        $packaged     = (string) get_post_meta( $post->ID, 'wpcf-packaged', true );
        $shipped      = (string) get_post_meta( $post->ID, 'wpcf-shipped', true );
        $submitted    = (string) get_post_meta( $post->ID, 'wpcf-design-submitted', true );
        $order_id     = function_exists( 'get_tag_order_id' ) ? (int) get_tag_order_id( (int) $post->ID ) : 0;

        if ( $cart_key === '' && $packaged !== '1' && $shipped !== '1' && $submitted !== '1' && $order_id <= 0 ) {
            return null;
        }

        $status_group = 'in_progress';
        $status_label = 'In progress';

        if ( $cart_key !== '' && in_array( $cart_key, $cart_keys, true ) ) {
            $status_group = 'basket';
            $status_label = 'In basket';
        } elseif ( $shipped === '1' || $packaged === '1' ) {
            $status_group = 'live';
            $status_label = $shipped === '1' ? 'Shipped' : 'Packaged';
        } elseif ( $submitted === '1' ) {
            $status_label = 'Design submitted';
        } elseif ( $order_id > 0 ) {
            $status_label = 'Order received';
        }

        return [
            'id'           => (int) $post->ID,
            'kind'         => $kind,
            'label'        => $label !== '' ? $label : self::default_label_for_kind( $kind ),
            'name'         => $name,
            'job_title'    => $job_title,
            'front_url'    => $front_url,
            'status_group' => $status_group,
            'status_label' => $status_label,
            'profile_id'   => $profile_id,
            'order_id'     => $order_id,
            'submitted'    => $submitted === '1',
        ];
    }

    private static function kind_from_tag_type( string $tag_type ) : string {
        $mapping = [
            'classiccard' => 'classic',
            'contactcard' => 'custom',
            'phonetag'    => 'phone_tag',
        ];

        return $mapping[ $tag_type ] ?? '';
    }

    private static function default_label_for_kind( string $kind ) : string {
        $labels = [
            'classic'   => 'Classic card',
            'custom'    => 'Custom card',
            'phone_tag' => 'Phone tag',
        ];

        return $labels[ $kind ] ?? 'Card';
    }

    private static function profile_id_for_card( int $card_id ) : int {
        if ( ! function_exists( 'toolset_get_related_posts' ) ) {
            return 0;
        }

        $ids = (array) toolset_get_related_posts( $card_id, 'mecard-profile-mecard-tag', [
            'query_by_role' => 'child',
            'return'        => 'post_id',
            'limit'         => 1,
        ] );

        return empty( $ids ) ? 0 : (int) $ids[0];
    }

    private static function classic_logo_url( int $card_id, int $profile_id ) : string {
        $card_front = (string) get_post_meta( $card_id, 'wpcf-card-front', true );
        if ( $card_front !== '' ) {
            return $card_front;
        }

        if ( $profile_id > 0 && function_exists( 'toolset_get_related_posts' ) ) {
            $company_ids = (array) toolset_get_related_posts( $profile_id, 'company-mecard-profile', [
                'query_by_role' => 'child',
                'return'        => 'post_id',
                'limit'         => 1,
            ] );

            if ( ! empty( $company_ids ) ) {
                $logo = get_the_post_thumbnail_url( (int) $company_ids[0], 'medium' );
                if ( is_string( $logo ) && $logo !== '' ) {
                    return $logo;
                }
            }
        }

        return '';
    }

    private static function bundle_classic_card_data( int $profile_id, int $card_id = 0 ) : array {
        $name      = $profile_id > 0 ? get_the_title( $profile_id ) : 'Your name';
        $job_title = $profile_id > 0 ? (string) get_post_meta( $profile_id, 'wpcf-job-title', true ) : '';
        $front_url = '';
        $logo_id   = 0;

        if ( $card_id > 0 ) {
            $card_name = (string) get_post_meta( $card_id, 'wpcf-name-on-card', true );
            $card_job  = (string) get_post_meta( $card_id, 'wpcf-job-title-on-card', true );
            $card_logo = (string) get_post_meta( $card_id, 'wpcf-card-front', true );

            if ( $card_name !== '' ) {
                $name = $card_name;
            }
            if ( $card_job !== '' ) {
                $job_title = $card_job;
            }
            if ( $card_logo !== '' ) {
                $front_url = $card_logo;
            }
        }

        if ( $front_url === '' && $profile_id > 0 && function_exists( 'toolset_get_related_posts' ) ) {
            $company_ids = (array) toolset_get_related_posts( $profile_id, 'company-mecard-profile', [
                'query_by_role' => 'child',
                'return'        => 'post_id',
                'limit'         => 1,
            ] );

            if ( ! empty( $company_ids ) ) {
                $company_id = (int) $company_ids[0];
                $logo_id    = (int) get_post_thumbnail_id( $company_id );
                $front_url  = (string) get_the_post_thumbnail_url( $company_id, 'medium' );
            }
        }

        return [
            'id'           => $card_id,
            'kind'         => 'classic',
            'label'        => 'Classic card',
            'name'         => $name,
            'job_title'    => $job_title,
            'front_url'    => $front_url,
            'logo_id'      => $logo_id,
            'status_group' => 'basket',
            'status_label' => 'In basket',
        ];
    }

    private static function render_custom_card_editor( int $profile_id, array $custom_card ) : string {
        $placeholder = plugin_dir_url( __FILE__ ) . 'images/upload.png';

        ob_start();
        ?>
        <div class="me-bundle-card me-bundle-card--custom" data-card-id="<?php echo esc_attr( $custom_card['id'] ?? 0 ); ?>">
            <?php if ( ! empty( $custom_card['id'] ) ) : ?>
                <form class="me-bundle-custom__form tag-form" data-bundle-custom-form data-tag_id="<?php echo esc_attr( $custom_card['id'] ); ?>">
                    <input type="hidden" name="card_id" value="<?php echo esc_attr( $custom_card['id'] ); ?>">
                    <input type="hidden" name="wpcf-card-front" value="<?php echo esc_attr( $custom_card['front_url'] ?? '' ); ?>">
                    <input type="hidden" name="wpcf-card-back" value="<?php echo esc_attr( $custom_card['back_url'] ?? '' ); ?>">
                    <div class="me-bundle-custom__copy">
                        <p class="me-bundle-custom__spec">You need to provide your own front and back design files in 856 x 540px, PNG or JPG.</p>
                    </div>
                    <div class="me-bundle-custom__preview-grid">
                        <div class="me-bundle-custom__preview-card">
                            <div class="me-bundle-custom__preview-label">Card front</div>
                            <div class="me-bundle-custom__preview-frame" data-bundle-custom-front-artwork>
                                <div class="me-bundle-custom__preview-shell">
                                    <img src="<?php echo esc_url( ! empty( $custom_card['front_url'] ) ? $custom_card['front_url'] : $placeholder ); ?>" alt="Custom card front artwork">
                                </div>
                            </div>
                            <button type="button" class="me-single-cards__button" data-bundle-custom-pick="front">Upload front image</button>
                        </div>
                        <div class="me-bundle-custom__preview-card">
                            <div class="me-bundle-custom__preview-label">Card back</div>
                            <div class="me-bundle-custom__preview-frame" data-bundle-custom-back-artwork-card>
                                <div class="me-bundle-custom__preview-shell">
                                    <img src="<?php echo esc_url( ! empty( $custom_card['back_url'] ) ? $custom_card['back_url'] : $placeholder ); ?>" alt="Custom card back artwork">
                                </div>
                            </div>
                            <button type="button" class="me-single-cards__button" data-bundle-custom-pick="back">Upload back image</button>
                        </div>
                    </div>
                    <div class="me-bundle-custom__qr-stage">
                        <div class="me-bundle-custom__preview-label">QR placement preview</div>
                        <p class="me-bundle-custom__spec">QR code generated automatically, you control size colour and placement.</p>
                        <p class="me-bundle-custom__spec me-bundle-custom__spec--hint">Drag the QR code into place on the back preview and use the resize handle to adjust the size.</p>
                        <?php echo self::render_custom_bundle_back_preview( $profile_id, $custom_card ); ?>
                    </div>
                    <div class="me-bundle-custom__grid me-bundle-custom__grid--controls">
                        <label>
                            <span>QR width</span>
                            <input type="number" name="wpcf-qr-width" min="60" max="240" value="<?php echo esc_attr( $custom_card['qr_width'] ); ?>">
                        </label>
                        <label>
                            <span>QR code colour</span>
                            <div class="me-colour-field" data-colour-field>
                                <input type="hidden" name="wpcf-qr-code-colour" value="<?php echo esc_attr( $custom_card['qr_code_colour'] ); ?>">
                                <button type="button" class="me-colour-field__trigger" data-colour-trigger aria-expanded="false">
                                    <span class="me-colour-field__preview" style="background:<?php echo esc_attr( $custom_card['qr_code_colour'] ); ?>"></span>
                                    <span class="me-colour-field__hex"><?php echo esc_html( $custom_card['qr_code_colour'] ); ?></span>
                                </button>
                                <div class="me-colour-field__panel" hidden>
                                    <input type="color" class="me-colour-field__native" value="<?php echo esc_attr( $custom_card['qr_code_colour'] ); ?>" tabindex="-1">
                                    <input type="text" class="me-colour-field__text" value="<?php echo esc_attr( $custom_card['qr_code_colour'] ); ?>" maxlength="7" placeholder="#000000" autocomplete="off">
                                    <button type="button" class="me-colour-field__eyedropper" data-eyedropper title="Pick colour from screen" aria-label="Eyedropper"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7-3-3-7 7v3z"/><path d="M18 9l-1-1 2-2-3-3-2 2-1-1a2 2 0 0 0-2.83 0L3 12l3 3"/></svg></button>
                                </div>
                            </div>
                        </label>
                        <label>
                            <span>QR fill colour</span>
                            <div class="me-colour-field" data-colour-field>
                                <input type="hidden" name="wpcf-qr-fill-colour" value="<?php echo esc_attr( $custom_card['qr_fill_colour'] ); ?>">
                                <button type="button" class="me-colour-field__trigger" data-colour-trigger aria-expanded="false">
                                    <span class="me-colour-field__preview" style="background:<?php echo esc_attr( $custom_card['qr_fill_colour'] ); ?>"></span>
                                    <span class="me-colour-field__hex"><?php echo esc_html( $custom_card['qr_fill_colour'] ); ?></span>
                                </button>
                                <div class="me-colour-field__panel" hidden>
                                    <input type="color" class="me-colour-field__native" value="<?php echo esc_attr( $custom_card['qr_fill_colour'] ); ?>" tabindex="-1">
                                    <input type="text" class="me-colour-field__text" value="<?php echo esc_attr( $custom_card['qr_fill_colour'] ); ?>" maxlength="7" placeholder="#ffffff" autocomplete="off">
                                    <button type="button" class="me-colour-field__eyedropper" data-eyedropper title="Pick colour from screen" aria-label="Eyedropper"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7-3-3-7 7v3z"/><path d="M18 9l-1-1 2-2-3-3-2 2-1-1a2 2 0 0 0-2.83 0L3 12l3 3"/></svg></button>
                                </div>
                            </div>
                        </label>
                        <input type="hidden" name="wpcf-qr-x" value="<?php echo esc_attr( $custom_card['qr_x'] ); ?>">
                        <input type="hidden" name="wpcf-qr-y" value="<?php echo esc_attr( $custom_card['qr_y'] ); ?>">
                    </div>
                    <div class="me-bundle-card__form-actions">
                        <button type="submit" class="me-single-cards__button me-single-cards__button--primary">Save custom card details</button>
                    </div>
                    <div class="me-bundle-card__status" data-bundle-custom-status aria-live="polite"></div>
                </form>
            <?php endif; ?>
        </div>
        <?php
        return (string) ob_get_clean();
    }

    private static function bundle_custom_card_data( int $profile_id, int $card_id = 0 ) : array {
        $label          = $profile_id > 0 ? get_the_title( $profile_id ) : 'Custom card';
        $front_url      = '';
        $back_url       = '';
        $qr_width       = 140;
        $qr_x           = 32;
        $qr_y           = 32;
        $qr_code_colour = '#000000';
        $qr_fill_colour = '#ffffff';

        if ( $card_id > 0 ) {
            $stored_label = (string) get_post_meta( $card_id, 'wpcf-card-label', true );
            if ( $stored_label !== '' ) {
                $label = $stored_label;
            }

            $front_url      = (string) get_post_meta( $card_id, 'wpcf-card-front', true );
            $back_url       = (string) get_post_meta( $card_id, 'wpcf-card-back', true );
            $qr_width       = max( 60, absint( get_post_meta( $card_id, 'wpcf-qr-width', true ) ) );
            $qr_x           = max( 0, intval( get_post_meta( $card_id, 'wpcf-qr-x', true ) ) );
            $qr_y           = max( 0, intval( get_post_meta( $card_id, 'wpcf-qr-y', true ) ) );
            $qr_code_colour = (string) get_post_meta( $card_id, 'wpcf-qr-code-colour', true ) ?: $qr_code_colour;
            $qr_fill_colour = (string) get_post_meta( $card_id, 'wpcf-qr-fill-colour', true ) ?: $qr_fill_colour;
        }

        return [
            'id'             => $card_id,
            'kind'           => 'custom',
            'label'          => $label,
            'name'           => '',
            'job_title'      => '',
            'front_url'      => $front_url,
            'back_url'       => $back_url,
            'qr_width'       => $qr_width,
            'qr_x'           => $qr_x,
            'qr_y'           => $qr_y,
            'qr_code_colour' => $qr_code_colour,
            'qr_fill_colour' => $qr_fill_colour,
            'status_group'   => 'basket',
            'status_label'   => 'In basket',
        ];
    }

    private static function render_custom_bundle_back_preview( int $profile_id, array $card ) : string {
        $placeholder = plugin_dir_url( __FILE__ ) . 'images/upload.png';
        $back_url    = $card['back_url'] ?? '';
        $card_id     = (int) ( $card['id'] ?? 0 );
        $profile_url = $profile_id > 0 ? get_permalink( $profile_id ) : site_url( '/' );
        $qr_width    = (int) ( $card['qr_width'] ?? 140 );
        $qr_x        = (int) ( $card['qr_x'] ?? 32 );
        $qr_y        = (int) ( $card['qr_y'] ?? 32 );
        $qr_colour   = (string) ( $card['qr_code_colour'] ?? '#000000' );
        $qr_fill     = (string) ( $card['qr_fill_colour'] ?? '#ffffff' );

        ob_start();
        ?>
        <div class="me-bundle-card__preview me-bundle-card__preview--back me-bundle-custom__back-preview" data-bundle-custom-back-preview data-tag_id="<?php echo esc_attr( $card_id ); ?>">
            <div class="me-bundle-custom__back-artwork" data-bundle-custom-back-artwork>
                <?php if ( $back_url !== '' ) : ?>
                <div class="me-bundle-custom__preview-shell">
                    <img src="<?php echo esc_url( $back_url ); ?>" alt="Custom card back artwork">
                </div>
                <?php endif; ?>
            </div>
            <div class="me-bundle-custom__qr qr-container editable" data-bundle-custom-qr style="<?php echo esc_attr( sprintf( 'width:%1$dpx; top:%2$dpx; left:%3$dpx;', $qr_width, $qr_y, $qr_x ) ); ?>">
                <div id="me_bundle_custom_qr_<?php echo esc_attr( $card_id ); ?>" class="me-bundle-custom__qr-code qr-code" data-url="<?php echo esc_url( $profile_url ); ?>" data-qr_colour="<?php echo esc_attr( $qr_colour ); ?>" data-qr_bg="<?php echo esc_attr( $qr_fill ); ?>" data-tag="<?php echo esc_attr( $card_id ); ?>"></div>
            </div>
        </div>
        <?php
        return (string) ob_get_clean();
    }

    private static function build_phone_tag_preview() : array {
        return [
            'kind'         => 'phone_tag',
            'label'        => 'Phone tag',
            'name'         => '',
            'job_title'    => '',
            'front_url'    => '',
            'status_group' => 'basket',
            'status_label' => 'In basket',
        ];
    }

    private static function find_first_card_by_kind( array $groups, string $kind ) : ?array {
        foreach ( [ 'basket', 'in_progress', 'live' ] as $group_key ) {
            foreach ( $groups[ $group_key ] ?? [] as $card ) {
                if ( ( $card['kind'] ?? '' ) === $kind ) {
                    return $card;
                }
            }
        }

        return null;
    }
}
