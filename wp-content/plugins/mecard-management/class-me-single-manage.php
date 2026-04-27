<?php
namespace Me\Single_Manage;

use Me\Single_Cards\Module as Single_Cards_Module;
use Me\Single_Editor\Module as Single_Editor_Module;

if ( ! defined( 'ABSPATH' ) ) exit;

class Module {
    private const PRO_PRICE = 'R199 once off';

    public static function init() : void {
        add_shortcode( 'me_single_manage', [ __CLASS__, 'render_shortcode' ] );
        add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue' ] );
        add_filter( 'the_content', [ __CLASS__, 'replace_manage_page' ], 20 );
        add_action( 'template_redirect', [ __CLASS__, 'maybe_redirect_logged_out' ], 1 );
        add_action( 'template_redirect', [ __CLASS__, 'handle_offer_actions' ], 5 );
    }

    public static function enqueue() : void {
        if ( ! self::should_render_manage() ) {
            return;
        }

        wp_enqueue_style(
            'me-single-cards',
            plugin_dir_url( __FILE__ ) . 'css/me-single-cards.css',
            [],
            filemtime( plugin_dir_path( __FILE__ ) . 'css/me-single-cards.css' )
        );

        wp_enqueue_style(
            'me-single-manage',
            plugin_dir_url( __FILE__ ) . 'css/me-single-manage.css',
            [ 'me-single-cards' ],
            filemtime( plugin_dir_path( __FILE__ ) . 'css/me-single-manage.css' )
        );

        wp_enqueue_script(
            'me-single-cards',
            plugin_dir_url( __FILE__ ) . 'js/me-single-cards.js',
            [ 'jquery' ],
            filemtime( plugin_dir_path( __FILE__ ) . 'js/me-single-cards.js' ),
            true
        );
    }

    public static function replace_manage_page( $content ) {
        if ( ! is_main_query() || ! in_the_loop() || ! is_page( 'manage' ) ) {
            return $content;
        }

        return do_shortcode( '[me_single_manage]' );
    }

    public static function manage_url( int $profile_id = 0 ) : string {
        return site_url( '/manage/' );
    }

    public static function render_subnav( string $active ) : string {
        $links = [
            'home'    => [ 'label' => 'Home',         'url' => site_url( '/manage/' ) ],
            'profile' => [ 'label' => 'Edit Profile',  'url' => site_url( '/manage/profile/' ) ],
            'cards'   => [ 'label' => 'My Cards',      'url' => site_url( '/manage/cards/' ) ],
        ];
        $html = '<nav class="me-subnav">';
        foreach ( $links as $key => $link ) {
            $class = 'me-subnav__link' . ( $active === $key ? ' me-subnav__link--active' : '' );
            $html .= '<a class="' . esc_attr( $class ) . '" href="' . esc_url( $link['url'] ) . '">' . esc_html( $link['label'] ) . '</a>';
        }
        $html .= '</nav>';
        return $html;
    }

    public static function maybe_redirect_logged_out() : void {
        if ( is_user_logged_in() || ! is_page( 'manage' ) ) {
            return;
        }
        wp_safe_redirect( wc_get_page_permalink( 'myaccount' ) );
        exit;
    }

    public static function render_shortcode() : string {
        $user_id      = get_current_user_id();
        $profile_id   = self::resolve_profile_id( $user_id );
        $profile_url  = $profile_id > 0 ? get_permalink( $profile_id ) : site_url( '/' );
        $cards_url    = Single_Cards_Module::cards_url( $profile_id );
        $bundle       = self::get_bundle_journey( $profile_id );
        $edit_url     = $bundle['active'] ? self::bundle_profile_url( $profile_id, $bundle['bundle_type'] ) : Single_Editor_Module::editor_url( $profile_id );
        $active_cards = Single_Cards_Module::get_current_card_groups( $user_id, $profile_id );
        $has_cards    = ! empty( $active_cards['basket'] ) || ! empty( $active_cards['in_progress'] ) || ! empty( $active_cards['live'] );
        $is_pro       = self::is_pro_profile( $profile_id );

        ob_start();
        echo self::render_subnav( 'home' );
        ?>
        <section class="me-single-manage">
            <header class="me-single-manage__header">
                <p class="me-single-manage__eyebrow">My MeCard Home</p>
                <h1>Manage MeCard</h1>
                <p>Your free profile is live and ready whenever you need it.</p>
            </header>

            <section class="me-single-manage__panel">
                <h2>Manage your profile</h2>
                <p>Open your live profile or jump straight into the inline editor.</p>
                <div class="me-single-manage__actions">
                    <a class="me-single-manage__button me-single-manage__button--secondary" href="<?php echo esc_url( $profile_url ); ?>">View profile</a>
                    <a class="me-single-manage__button me-single-manage__button--primary" href="<?php echo esc_url( $edit_url ); ?>"><?php echo $bundle['active'] ? 'Continue profile setup' : 'Edit profile'; ?></a>
                </div>
            </section>

            <?php if ( $bundle['active'] ) : ?>
                <section class="me-single-manage__panel me-single-manage__panel--journey">
                    <p class="me-single-manage__kicker">Bundle in progress</p>
                    <h2><?php echo esc_html( $bundle['bundle_type'] === 'custom' ? 'Finish setting up your custom bundle' : 'Finish setting up your classic bundle' ); ?></h2>
                    <p>Your bundle is already in your basket. The quickest path now is to configure your Pro profile, confirm the bundle items, and then checkout.</p>
                    <ol class="me-single-manage__steps">
                        <li><strong>Step 1.</strong> Configure your Pro profile</li>
                        <li><strong>Step 2.</strong> <?php echo esc_html( $bundle['bundle_type'] === 'custom' ? 'Configure your custom card and confirm your phone tag' : 'Confirm your classic card and phone tag' ); ?></li>
                        <li><strong>Step 3.</strong> Checkout</li>
                    </ol>
                    <div class="me-single-manage__actions">
                        <a class="me-single-manage__button me-single-manage__button--primary" href="<?php echo esc_url( self::bundle_profile_url( $profile_id, $bundle['bundle_type'] ) ); ?>">Continue profile setup</a>
                        <a class="me-single-manage__button" href="<?php echo esc_url( self::bundle_cards_url( $profile_id, $bundle['bundle_type'] ) ); ?>">Confirm bundle items</a>
                        <a class="me-single-manage__button me-single-manage__button--cta" href="<?php echo esc_url( wc_get_checkout_url() ); ?>">Checkout</a>
                        <a class="me-single-manage__button me-single-manage__button--secondary" href="<?php echo esc_url( self::bundle_remove_url( $profile_id, $bundle['bundle_type'] ) ); ?>">Remove bundle</a>
                    </div>
                </section>
            <?php elseif ( $has_cards ) : ?>
                <?php
                $has_basket_cards   = ! empty( $active_cards['basket'] );
                $has_editable_cards = $has_basket_cards && ! ( $active_cards['basket'][0]['submitted'] ?? false );
                ?>

                <?php if ( ! $is_pro ) : ?>
                    <section class="me-single-manage__panel me-single-manage__panel--upsell">
                        <p class="me-single-manage__kicker">Upgrade to Pro</p>
                        <h2>Supercharge your Profile</h2>
                        <div class="me-single-manage__compare">
                            <div class="me-single-manage__compare-image">
                                <img src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'images/alessio-standard-profile-phone.png' ); ?>" alt="Standard profile preview">
                            </div>
                            <div class="me-single-manage__compare-arrow" aria-hidden="true">A &rarr; B</div>
                            <div class="me-single-manage__compare-image">
                                <img src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'images/alessio-pro-profile.png' ); ?>" alt="Pro profile preview">
                            </div>
                        </div>
                        <ul class="me-single-manage__benefits">
                            <li>Customise look and feel to your company branding</li>
                            <li>Add company info</li>
                            <li>Extra buttons and links</li>
                        </ul>
                        <p class="me-single-manage__price"><?php echo esc_html( self::PRO_PRICE ); ?></p>
                        <div class="me-single-manage__actions">
                            <a class="me-single-manage__button me-single-manage__button--primary" href="<?php echo esc_url( add_query_arg( 'mode', 'pro', $edit_url ) ); ?>">Design Pro Profile</a>
                        </div>
                    </section>
                <?php endif; ?>

                <section class="me-single-manage__panel">
                    <h2>Your current cards</h2>
                    <p>These cards are already in your basket, in progress, or live.</p>
                    <div class="me-single-manage__cards">
                        <?php
                        foreach ( [ 'basket', 'in_progress', 'live' ] as $group_key ) {
                            foreach ( array_slice( $active_cards[ $group_key ], 0, 3 ) as $card ) {
                                echo Single_Cards_Module::render_card_preview( $card );
                            }
                        }
                        ?>
                    </div>
                    <div class="me-single-manage__actions">
                        <?php if ( $has_basket_cards ) : ?>
                            <a class="me-single-manage__button me-single-manage__button--cta" href="<?php echo esc_url( wc_get_checkout_url() ); ?>">Checkout</a>
                        <?php endif; ?>
                        <?php if ( $has_editable_cards ) : ?>
                            <a class="me-single-manage__button" href="<?php echo esc_url( $cards_url ); ?>">Configure card</a>
                        <?php endif; ?>
                        <a class="me-single-manage__button me-single-manage__button--secondary" href="<?php echo esc_url( $cards_url ); ?>">Manage cards</a>
                    </div>
                </section>

                <?php echo self::render_bundle_offer_panel( $profile_id, $cards_url ); ?>
                <?php echo self::render_card_offer_panel( $profile_id ); ?>

            <?php else : ?>
                <?php echo self::render_bundle_offer_panel( $profile_id, $cards_url ); ?>

                <?php if ( ! $is_pro ) : ?>
                    <section class="me-single-manage__panel me-single-manage__panel--upsell">
                        <p class="me-single-manage__kicker">Upgrade to Pro</p>
                        <h2>Supercharge your Profile</h2>
                        <div class="me-single-manage__compare">
                            <div class="me-single-manage__compare-image">
                                <img src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'images/alessio-standard-profile-phone.png' ); ?>" alt="Standard profile preview">
                            </div>
                            <div class="me-single-manage__compare-arrow" aria-hidden="true">A &rarr; B</div>
                            <div class="me-single-manage__compare-image">
                                <img src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'images/alessio-pro-profile.png' ); ?>" alt="Pro profile preview">
                            </div>
                        </div>
                        <ul class="me-single-manage__benefits">
                            <li>Customise look and feel to your company branding</li>
                            <li>Add company info</li>
                            <li>Extra buttons and links</li>
                        </ul>
                        <p class="me-single-manage__price"><?php echo esc_html( self::PRO_PRICE ); ?></p>
                        <div class="me-single-manage__actions">
                            <a class="me-single-manage__button me-single-manage__button--primary" href="<?php echo esc_url( add_query_arg( 'mode', 'pro', $edit_url ) ); ?>">Design Pro Profile</a>
                        </div>
                    </section>
                <?php endif; ?>

                <?php echo self::render_card_offer_panel( $profile_id ); ?>
            <?php endif; ?>
        </section>
        <?php
        return (string) ob_get_clean();
    }

    public static function handle_offer_actions() : void {
        if ( ! is_user_logged_in() || ! is_page( [ 'manage', 'profile', 'cards' ] ) ) {
            return;
        }

        $action = isset( $_GET['me_add_offer'] ) ? sanitize_text_field( wp_unslash( $_GET['me_add_offer'] ) ) : '';
        $remove = isset( $_GET['me_bundle_action'] ) ? sanitize_text_field( wp_unslash( $_GET['me_bundle_action'] ) ) : '';
        if ( $action === '' && $remove === '' ) {
            return;
        }

        $nonce = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : '';
        if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
            return;
        }

        $profile_id = isset( $_GET['profile_id'] ) ? absint( wp_unslash( $_GET['profile_id'] ) ) : self::resolve_profile_id( get_current_user_id() );
        if ( $remove !== '' ) {
            if ( ! wp_verify_nonce( $nonce, 'me-bundle-action-' . $remove ) ) {
                wp_die( 'This bundle action link has expired. Please try again.' );
            }

            if ( $remove === 'remove' ) {
                $bundle = self::get_bundle_journey( $profile_id );
                if ( $bundle['active'] && $bundle['cart_item_key'] !== '' ) {
                    mecard_remove_cart_item_and_related_objects( (string) $bundle['cart_item_key'], get_current_user_id() );
                }
                wp_safe_redirect( self::manage_url( $profile_id ) );
                exit;
            }

            return;
        }

        if ( ! wp_verify_nonce( $nonce, 'me-add-offer-' . $action ) ) {
            wp_die( 'This offer link has expired. Please try again.' );
        }

        $cart_data  = [];
        if ( $profile_id > 0 ) {
            $cart_data['mecard_profile_id'] = $profile_id;
        }

        if ( $action === 'classic-bundle' ) {
            WC()->cart->add_to_cart( (int) MECARD_CLASSIC_BUNDLE_PRODUCT_ID, 1, 0, [], $cart_data );
            wp_safe_redirect( self::bundle_profile_url( $profile_id, 'classic' ) );
            exit;
        }

        if ( $action === 'custom-bundle' ) {
            WC()->cart->add_to_cart( (int) MECARD_BUNDLE_PRODUCT_ID, 1, 0, [], $cart_data );
            wp_safe_redirect( self::bundle_profile_url( $profile_id, 'custom' ) );
            exit;
        }

        if ( $action === 'classic-card' ) {
            WC()->cart->add_to_cart( (int) MECARD_CLASSIC_PRODUCT_ID, 1, 0, [], $cart_data );
        } elseif ( $action === 'custom-card' ) {
            WC()->cart->add_to_cart( (int) MECARD_PRODUCT_ID, 1, 0, [], $cart_data );
            wp_safe_redirect( add_query_arg( 'flow', 'custom', Single_Cards_Module::cards_url( $profile_id ) ) );
            exit;
        } else {
            return;
        }

        wp_safe_redirect( self::manage_url( $profile_id ) );
        exit;
    }

    private static function classic_bundle_url( int $profile_id = 0 ) : string {
        $url = self::offer_url( 'classic-bundle', $profile_id );
        return wp_nonce_url( $url, 'me-add-offer-classic-bundle' );
    }

    private static function classic_card_url( int $profile_id = 0 ) : string {
        $url = self::offer_url( 'classic-card', $profile_id );
        return wp_nonce_url( $url, 'me-add-offer-classic-card' );
    }

    private static function custom_bundle_url( int $profile_id = 0 ) : string {
        $url = self::offer_url( 'custom-bundle', $profile_id );
        return wp_nonce_url( $url, 'me-add-offer-custom-bundle' );
    }

    private static function custom_card_url( int $profile_id = 0 ) : string {
        $url = self::offer_url( 'custom-card', $profile_id );
        return wp_nonce_url( $url, 'me-add-offer-custom-card' );
    }

    public static function bundle_profile_url( int $profile_id = 0, string $bundle_type = 'classic' ) : string {
        return add_query_arg(
            [
                'journey' => 'bundle',
                'bundle'  => $bundle_type,
            ],
            Single_Editor_Module::editor_url( $profile_id )
        );
    }

    public static function bundle_cards_url( int $profile_id = 0, string $bundle_type = 'classic' ) : string {
        return add_query_arg(
            [
                'journey' => 'bundle',
                'bundle'  => $bundle_type,
            ],
            Single_Cards_Module::cards_url( $profile_id )
        );
    }

    public static function bundle_remove_url( int $profile_id = 0, string $bundle_type = 'classic' ) : string {
        $url = add_query_arg(
            [
                'journey'          => 'bundle',
                'bundle'           => $bundle_type,
                'me_bundle_action' => 'remove',
            ],
            self::manage_url( $profile_id )
        );

        return wp_nonce_url( $url, 'me-bundle-action-remove' );
    }

    public static function get_bundle_journey( int $profile_id = 0 ) : array {
        $journey = [
            'active'        => false,
            'cart_item_key' => '',
            'product_id'    => 0,
            'bundle_type'   => 'classic',
        ];

        if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
            return $journey;
        }

        foreach ( WC()->cart->get_cart() as $item ) {
            $product_id = (int) ( $item['product_id'] ?? 0 );
            $bundle_type = '';
            if ( $product_id === (int) MECARD_CLASSIC_BUNDLE_PRODUCT_ID ) {
                $bundle_type = 'classic';
            } elseif ( $product_id === (int) MECARD_BUNDLE_PRODUCT_ID ) {
                $bundle_type = 'custom';
            }

            if ( $bundle_type === '' ) {
                continue;
            }

            $item_profile_id = isset( $item['mecard_profile_id'] ) ? absint( $item['mecard_profile_id'] ) : 0;
            if ( $profile_id > 0 && $item_profile_id !== $profile_id ) {
                continue;
            }

            $journey['active']        = true;
            $journey['cart_item_key'] = (string) ( $item['key'] ?? '' );
            $journey['product_id']    = $product_id;
            $journey['bundle_type']   = $bundle_type;
            break;
        }

        return $journey;
    }

    private static function should_render_manage() : bool {
        global $post;

        if ( ! is_user_logged_in() || ! $post instanceof \WP_Post ) {
            return false;
        }

        return is_page( 'manage' ) || has_shortcode( (string) $post->post_content, 'me_single_manage' );
    }

    private static function resolve_profile_id( int $user_id ) : int {
        if ( isset( $_GET['profile_id'] ) ) {
            return absint( wp_unslash( $_GET['profile_id'] ) );
        }

        return Single_Editor_Module::resolve_single_profile_id( $user_id );
    }

    private static function offer_url( string $action, int $profile_id = 0 ) : string {
        return add_query_arg(
            [
                'me_add_offer' => $action,
            ],
            self::manage_url( $profile_id )
        );
    }

    private static function is_pro_profile( int $profile_id ) : bool {
        if ( $profile_id <= 0 ) {
            return false;
        }

        $profile_type = strtolower( (string) get_post_meta( $profile_id, 'wpcf-profile-type', true ) );
        return in_array( $profile_type, [ 'professional', 'pro' ], true );
    }

    private static function build_classic_offer_preview( int $profile_id ) : array {
        $name      = $profile_id > 0 ? get_the_title( $profile_id ) : 'Your name';
        $job_title = $profile_id > 0 ? (string) get_post_meta( $profile_id, 'wpcf-job-title', true ) : '';
        $front_url = '';

        if ( $profile_id > 0 && function_exists( 'toolset_get_related_posts' ) ) {
            $company_ids = (array) toolset_get_related_posts( $profile_id, 'company-mecard-profile', [
                'query_by_role' => 'child',
                'return'        => 'post_id',
                'limit'         => 1,
            ] );

            if ( ! empty( $company_ids ) ) {
                $front_url = (string) get_the_post_thumbnail_url( (int) $company_ids[0], 'medium' );
            }
        }

        return [
            'kind'         => 'classic',
            'label'        => 'Classic card',
            'name'         => $name,
            'job_title'    => $job_title,
            'front_url'    => $front_url,
            'status_group' => 'offer',
            'status_label' => '',
        ];
    }

    private static function render_bundle_offer_panel( int $profile_id, string $cards_url ) : string {
        ob_start();
        ?>
        <section class="me-single-manage__panel me-single-manage__panel--offer" data-me-offer-switcher="bundle" data-offer-variant="classic">
            <div class="me-single-manage__offer-panel" data-me-offer-panel="classic">
                <p class="me-single-manage__kicker">Classic Bundle Offer</p>
                <div class="me-single-manage__offer-heading">
                    <h2>Get your Classic MeCard bundle</h2>
                    <p class="me-single-manage__offer-price">Only R499</p>
                </div>
                <div class="me-single-manage__bundle-artwork">
                    <img src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'images/classic_bundle_new_250_v2.png' ); ?>" alt="Classic bundle preview">
                </div>
                <div class="me-single-manage__offer-switch-row">
                    <button type="button" class="me-single-manage__button me-single-manage__button--secondary is-active" data-me-offer-toggle="classic">Classic</button>
                    <button type="button" class="me-single-manage__button me-single-manage__button--secondary" data-me-offer-toggle="custom">Custom</button>
                </div>
                <p>Includes a classic card, a phone tag and the Pro upgrade for a year (renews at R199 in year 2).</p>
                <p class="me-single-manage__offer-note">Classic is the quickest route for you and the easiest for us to manufacture. No design files required.</p>
                <div class="me-single-manage__actions">
                    <a class="me-single-manage__button me-single-manage__button--primary" data-me-basket-action="1" data-adding-label="Adding..." href="<?php echo esc_url( self::classic_bundle_url( $profile_id ) ); ?>">Add classic bundle</a>
                    <a class="me-single-manage__button me-single-manage__button--secondary" href="<?php echo esc_url( $cards_url ); ?>">Manage cards</a>
                </div>
            </div>

            <div class="me-single-manage__offer-panel" data-me-offer-panel="custom" hidden>
                <p class="me-single-manage__kicker">Custom Bundle Offer</p>
                <div class="me-single-manage__offer-heading me-single-manage__offer-heading--custom">
                    <h2>Order a Custom MeCard bundle</h2>
                    <p class="me-single-manage__offer-price">Only R599</p>
                </div>
                <div class="me-single-manage__bundle-artwork">
                    <img src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'images/custom_bundle_new.png' ); ?>" alt="Custom bundle preview">
                </div>
                <div class="me-single-manage__offer-switch-row">
                    <button type="button" class="me-single-manage__button me-single-manage__button--secondary" data-me-offer-toggle="classic">Classic</button>
                    <button type="button" class="me-single-manage__button me-single-manage__button--secondary is-active" data-me-offer-toggle="custom">Custom</button>
                </div>
                <p>Includes a custom card, a phone tag and the Pro upgrade for a year (renews at R199 in year 2).</p>
                <p class="me-single-manage__custom-spec">You need to provide your own front and back design files in 856 x 540px, PNG or JPG.</p>
                <p class="me-single-manage__custom-spec">QR code generated automatically, you control size colour and placement.</p>
                <div class="me-single-manage__actions">
                    <a class="me-single-manage__button me-single-manage__button--primary" data-me-basket-action="1" data-adding-label="Adding..." href="<?php echo esc_url( self::custom_bundle_url( $profile_id ) ); ?>">Add custom bundle</a>
                </div>
            </div>
        </section>
        <?php
        return (string) ob_get_clean();
    }

    private static function render_card_offer_panel( int $profile_id ) : string {
        ob_start();
        ?>
        <section class="me-single-manage__panel" data-me-offer-switcher="card" data-offer-variant="classic">
            <div class="me-single-manage__offer-panel" data-me-offer-panel="classic">
                <p class="me-single-manage__kicker">Order a card</p>
                <div class="me-single-manage__offer-heading me-single-manage__offer-heading--custom">
                    <h2>Classic card</h2>
                    <p class="me-single-manage__offer-price">Only R299</p>
                </div>
                <p>Fastest option. We&rsquo;ll use the details already on your profile.</p>
                <div class="me-single-manage__classic-offer">
                    <?php echo Single_Cards_Module::render_card_preview( self::build_classic_offer_preview( $profile_id ) ); ?>
                </div>
                <div class="me-single-manage__offer-switch-row">
                    <button type="button" class="me-single-manage__button me-single-manage__button--secondary is-active" data-me-offer-toggle="classic">Classic</button>
                    <button type="button" class="me-single-manage__button me-single-manage__button--secondary" data-me-offer-toggle="custom">Custom</button>
                </div>
                <div class="me-single-manage__actions">
                    <a class="me-single-manage__button me-single-manage__button--primary" data-me-basket-action="1" data-adding-label="Adding..." href="<?php echo esc_url( self::classic_card_url( $profile_id ) ); ?>">Add classic card</a>
                </div>
            </div>

            <div class="me-single-manage__offer-panel" data-me-offer-panel="custom" hidden>
                <p class="me-single-manage__kicker">Custom card</p>
                <div class="me-single-manage__offer-heading me-single-manage__offer-heading--custom">
                    <h2>Order a Custom card</h2>
                    <p class="me-single-manage__offer-price">Only R399</p>
                </div>
                <p class="me-single-manage__custom-spec">You need to provide your own front and back design files in 856 x 540px, PNG or JPG.</p>
                <div class="me-single-manage__custom-card-previews">
                    <figure class="me-single-manage__custom-card-shell">
                        <img src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'images/alessio-card-rounded_front.png' ); ?>" alt="Custom card front example">
                        <figcaption>Front example</figcaption>
                    </figure>
                    <figure class="me-single-manage__custom-card-shell">
                        <img src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'images/alessio-back.png' ); ?>" alt="Custom card back example">
                        <figcaption>Back example</figcaption>
                    </figure>
                </div>
                <div class="me-single-manage__offer-switch-row">
                    <button type="button" class="me-single-manage__button me-single-manage__button--secondary" data-me-offer-toggle="classic">Classic</button>
                    <button type="button" class="me-single-manage__button me-single-manage__button--secondary is-active" data-me-offer-toggle="custom">Custom</button>
                </div>
                <p class="me-single-manage__custom-spec">QR code generated automatically, you control size colour and placement.</p>
                <div class="me-single-manage__actions">
                    <a class="me-single-manage__button me-single-manage__button--primary" data-me-basket-action="1" data-adding-label="Adding..." href="<?php echo esc_url( self::custom_card_url( $profile_id ) ); ?>">Add custom card</a>
                </div>
            </div>
        </section>
        <?php
        return (string) ob_get_clean();
    }
}
