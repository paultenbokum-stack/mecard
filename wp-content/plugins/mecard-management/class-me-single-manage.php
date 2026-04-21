<?php
namespace Me\Single_Manage;

use Me\Preview\Module as Preview_Module;
use Me\Single_Cards\Module as Single_Cards_Module;
use Me\Single_Editor\Module as Single_Editor_Module;

if ( ! defined( 'ABSPATH' ) ) exit;

class Module {
    public static function init() : void {
        add_shortcode( 'me_single_manage_home', [ __CLASS__, 'render_shortcode' ] );
        add_shortcode( 'me_manage_home', [ __CLASS__, 'render_shortcode' ] );
        add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue' ] );
        add_filter( 'the_content', [ __CLASS__, 'replace_manage_page' ], 20 );
    }

    public static function manage_url() : string {
        return site_url( '/manage/' );
    }

    public static function enqueue() : void {
        if ( ! self::should_render_manage() ) {
            return;
        }

        wp_enqueue_style(
            'me-single-manage',
            plugin_dir_url( __FILE__ ) . 'css/me-single-manage.css',
            [ 'me-profile' ],
            filemtime( plugin_dir_path( __FILE__ ) . 'css/me-single-manage.css' )
        );

        wp_enqueue_script(
            'me-single-manage',
            plugin_dir_url( __FILE__ ) . 'js/me-single-manage.js',
            [ 'jquery' ],
            filemtime( plugin_dir_path( __FILE__ ) . 'js/me-single-manage.js' ),
            true
        );
    }

    public static function replace_manage_page( $content ) {
        if ( ! is_main_query() || ! in_the_loop() || ! is_page( 'manage' ) ) {
            return $content;
        }

        return do_shortcode( '[me_single_manage_home]' );
    }

    public static function render_shortcode() : string {
        if ( ! is_user_logged_in() ) {
            return '<div class="me-single-manage-login"><p>Please sign in to manage your MeCard profile.</p></div>';
        }

        $profile_id = Single_Editor_Module::resolve_single_profile_id( get_current_user_id() );
        if ( ! $profile_id ) {
            return '<div class="me-single-manage-login"><p>We could not find a single self-owned MeCard profile for this account yet.</p></div>';
        }

        $profile_url = get_permalink( $profile_id );
        $edit_url    = Single_Editor_Module::editor_url( $profile_id );
        $cards_url   = Single_Cards_Module::cards_url( $profile_id );
        $classic_url = Single_Cards_Module::cards_url( $profile_id, 'classic' );
        $custom_url  = Single_Cards_Module::cards_url( $profile_id, 'custom' );
        $profile     = Preview_Module::get_profile_data( $profile_id );
        $company     = ! empty( $profile['company_parent'] ) ? Preview_Module::get_company_data( (int) $profile['company_parent'] ) : [];
        $full_name   = trim( (string) ( $profile['first'] ?? '' ) . ' ' . (string) ( $profile['last'] ?? '' ) );
        $job_title   = (string) ( $profile['job'] ?? '' );
        $company_name = (string) ( $profile['company_name'] ?? '' );
        $logo_url    = '';
        if ( ! empty( $company['logo_url'] ) ) {
            $logo_url = (string) $company['logo_url'];
        } elseif ( ! empty( $profile['company_logo_url'] ) ) {
            $logo_url = (string) $profile['company_logo_url'];
        }
        $profile_type = strtolower( (string) ( $profile['type'] ?? 'standard' ) );
        $show_upgrade = ! in_array( $profile_type, [ 'professional', 'pro' ], true );
        $standard_image = plugin_dir_url( __FILE__ ) . 'images/alessio-standard-profile-phone.png';
        $pro_image      = plugin_dir_url( __FILE__ ) . 'images/alessio-pro-profile.png';
        $classic_back_image = plugin_dir_url( __FILE__ ) . 'images/classic-back.png';
        $card_placeholder   = plugin_dir_url( __FILE__ ) . 'images/upload.png';
        $classic_in_cart    = self::classic_card_in_cart();
        $current_cards      = self::load_current_cards( $profile_id, $profile, $company );
        $has_current_cards  = ! empty( $current_cards );

        ob_start();
        ?>
        <div class="me-single-manage-page">
            <section class="me-single-manage__panel">
                <div class="me-single-manage__panel-head">
                    <p class="me-single-manage__panel-kicker">Profile</p>
                    <h2>Manage your profile</h2>
                    <p>Update your Standard profile, preview Pro, and keep everything ready to share.</p>
                </div>
                <div class="me-single-manage__actions">
                    <a class="me-single-manage__button" href="<?php echo esc_url( $profile_url ); ?>" target="_blank" rel="noopener">View profile</a>
                    <a class="me-single-manage__button me-single-manage__button--primary" href="<?php echo esc_url( $edit_url ); ?>">Edit profile</a>
                </div>
            </section>

            <?php if ( $show_upgrade ) : ?>
                <section class="me-single-manage__panel me-single-manage__panel--upgrade">
                    <div class="me-single-manage__panel-head">
                        <p class="me-single-manage__panel-kicker">Upgrade Now</p>
                        <h2>Pro profile - R199 per year</h2>
                        <p>Supercharge your profile with richer branding, company details, and smarter sharing tools.</p>
                    </div>
                    <div class="me-single-manage__upgrade-compare">
                        <div class="me-single-manage__upgrade-image">
                            <img src="<?php echo esc_url( $standard_image ); ?>" alt="Standard MeCard profile example">
                            <span class="me-single-manage__upgrade-label">A</span>
                        </div>
                        <div class="me-single-manage__upgrade-arrow" aria-hidden="true"><span>&rarr;</span></div>
                        <div class="me-single-manage__upgrade-image">
                            <img src="<?php echo esc_url( $pro_image ); ?>" alt="Pro MeCard profile example">
                            <span class="me-single-manage__upgrade-label">B</span>
                        </div>
                    </div>
                    <div class="me-single-manage__feature-list">
                        <div class="me-single-manage__feature-item"><strong>Customise look and feel</strong><span>Match your profile to your company branding.</span></div>
                        <div class="me-single-manage__feature-item"><strong>Add company info</strong><span>Address, telephone number, support email, rich description, and extra buttons and links.</span></div>
                        <div class="me-single-manage__feature-item"><strong>Grow your sharing setup</strong><span>Team contact sharing and sharing analytics.</span></div>
                    </div>
                    <div class="me-single-manage__price">R199 per year</div>
                    <div class="me-single-manage__actions">
                        <a class="me-single-manage__button me-single-manage__button--primary" href="<?php echo esc_url( add_query_arg( 'mode', 'pro', $edit_url ) ); ?>">Design Pro Profile</a>
                    </div>
                </section>
            <?php endif; ?>

            <?php if ( $has_current_cards ) : ?>
            <section class="me-single-manage__panel">
                <div class="me-single-manage__panel-head">
                    <p class="me-single-manage__panel-kicker">Cards</p>
                    <h2>Your current cards</h2>
                    <p>These cards are already in your basket, in progress, or live. Open them here, then manage everything in one place.</p>
                </div>
                <div class="me-single-manage__current-grid">
                    <?php foreach ( $current_cards as $card ) : ?>
                        <article class="me-single-manage__current-card">
                            <div class="me-single-manage__current-preview">
                                <?php if ( $card['type'] === 'classiccard' ) : ?>
                                    <div class="me-single-manage__classic-surface me-single-manage__classic-surface--mini card-front classic">
                                        <div class="me-single-manage__classic-logo classic-logo">
                                            <?php if ( ! empty( $card['logo'] ) ) : ?>
                                                <img src="<?php echo esc_url( $card['logo'] ); ?>" alt="<?php echo esc_attr( $card['company'] ?: 'Company logo' ); ?>">
                                            <?php else : ?>
                                                <div class="me-single-manage__classic-logo-placeholder"><?php echo esc_html( $card['company'] ?: 'Your logo' ); ?></div>
                                            <?php endif; ?>
                                        </div>
                                        <div class="me-single-manage__classic-name classic-name"><?php echo esc_html( $card['name'] ?: 'Your Name' ); ?></div>
                                        <div class="me-single-manage__classic-title classic-job-title"><?php echo esc_html( $card['job'] ?: 'Your title' ); ?></div>
                                    </div>
                                <?php else : ?>
                                    <div class="me-single-manage__custom-preview-card">
                                        <div class="me-single-manage__custom-preview-frame<?php echo empty( $card['front'] ) ? ' is-placeholder' : ''; ?>">
                                            <img src="<?php echo esc_url( $card['front'] ?: $card_placeholder ); ?>" alt="<?php echo esc_attr( $card['label'] ?: 'Custom card preview' ); ?>">
                                        </div>
                                    </div>
                                <?php endif; ?>
                            </div>
                            <div class="me-single-manage__current-copy">
                                <strong><?php echo esc_html( $card['label'] ); ?></strong>
                                <span><?php echo esc_html( $card['status'] ); ?></span>
                            </div>
                        </article>
                    <?php endforeach; ?>
                </div>
                <div class="me-single-manage__actions">
                    <a class="me-single-manage__button me-single-manage__button--primary" href="<?php echo esc_url( $cards_url ); ?>">Manage cards</a>
                </div>
            </section>
            <?php else : ?>
            <section class="me-single-manage__panel">
                <div class="me-single-manage__panel-head">
                    <p class="me-single-manage__panel-kicker">Cards and design</p>
                    <h2>Order or manage cards</h2>
                    <p>Choose the quickest classic option or upload a custom front and back design when your artwork is ready.</p>
                </div>
                <div class="me-single-manage__choice-list">
                    <div class="me-single-manage__choice-card">
                        <strong>Classic card</strong>
                        <p>Fastest option. We’ll use the details already on your profile.</p>
                        <div class="me-single-manage__card-toggle" role="tablist" aria-label="Classic card preview side">
                            <button type="button" class="me-single-manage__card-toggle-btn is-active" data-card-side="front">Front</button>
                            <button type="button" class="me-single-manage__card-toggle-btn" data-card-side="back">Back</button>
                        </div>
                        <div class="me-single-manage__classic-card">
                            <div class="me-single-manage__classic-pane is-active" data-card-preview="front">
                                <div class="me-single-manage__classic-surface card-front classic">
                                    <div class="me-single-manage__classic-logo classic-logo">
                                        <?php if ( $logo_url ) : ?>
                                            <img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php echo esc_attr( $company_name ?: 'Company logo' ); ?>">
                                        <?php else : ?>
                                            <div class="me-single-manage__classic-logo-placeholder"><?php echo esc_html( $company_name ?: 'Your logo' ); ?></div>
                                        <?php endif; ?>
                                    </div>
                                    <div class="me-single-manage__classic-name classic-name"><?php echo esc_html( $full_name ?: 'Your Name' ); ?></div>
                                    <div class="me-single-manage__classic-title classic-job-title"><?php echo esc_html( $job_title ?: 'Your title' ); ?></div>
                                </div>
                            </div>
                            <div class="me-single-manage__classic-pane" data-card-preview="back" hidden>
                                <div class="me-single-manage__classic-surface me-single-manage__classic-surface--back">
                                    <img src="<?php echo esc_url( $classic_back_image ); ?>" alt="Classic card back preview">
                                </div>
                            </div>
                        </div>
                        <a class="me-single-manage__button me-single-manage__button--primary" href="<?php echo esc_url( $classic_url ); ?>">Add classic card</a>
                        <?php if ( $classic_in_cart ) : ?>
                            <p class="me-single-manage__choice-note">Classic card already in basket.</p>
                        <?php endif; ?>
                    </div>
                    <div class="me-single-manage__choice-card">
                        <strong>Custom design</strong>
                        <p>You’ll need 2 artwork files: front and back, in the required format.</p>
                        <p>Not ready yet? Come back anytime to upload them.</p>
                        <a class="me-single-manage__button" href="<?php echo esc_url( $custom_url ); ?>">Upload custom design</a>
                    </div>
                </div>
                <div class="me-single-manage__actions">
                    <a class="me-single-manage__button" href="<?php echo esc_url( $cards_url ); ?>">Manage cards</a>
                </div>
            </section>
            <?php endif; ?>
        </div>
        <?php

        return (string) ob_get_clean();
    }

    private static function should_render_manage() : bool {
        global $post;

        if ( ! is_user_logged_in() || ! $post instanceof \WP_Post ) {
            return false;
        }

        if ( is_page( 'manage' ) ) {
            return true;
        }

        return has_shortcode( (string) $post->post_content, 'me_single_manage_home' )
            || has_shortcode( (string) $post->post_content, 'me_manage_home' );
    }

    private static function classic_card_in_cart() : bool {
        $product_id = defined( 'MECARD_CLASSIC_PRODUCT_ID' ) ? (int) MECARD_CLASSIC_PRODUCT_ID : 0;
        if ( $product_id <= 0 || ! function_exists( 'WC' ) || ! WC()->cart ) {
            return false;
        }

        foreach ( WC()->cart->get_cart() as $item ) {
            if ( (int) ( $item['product_id'] ?? 0 ) === $product_id ) {
                return true;
            }
        }

        return false;
    }

    private static function load_current_cards( int $profile_id, array $profile, array $company ) : array {
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

        $full_name    = trim( (string) ( $profile['first'] ?? '' ) . ' ' . (string) ( $profile['last'] ?? '' ) );
        $job_title    = (string) ( $profile['job'] ?? '' );
        $company_name = ! empty( $company['name'] ) ? (string) $company['name'] : (string) ( $profile['company_name'] ?? '' );
        $profile_logo = '';

        if ( ! empty( $company['logo_url'] ) ) {
            $profile_logo = (string) $company['logo_url'];
        } elseif ( ! empty( $profile['company_logo_url'] ) ) {
            $profile_logo = (string) $profile['company_logo_url'];
        }

        $items = [];
        foreach ( $merged as $post ) {
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

            $is_in_basket = $cart_key !== '';
            $is_live      = $has_order || $packaged || $shipped || in_array( $card_status, [ 'order-received', 'packaged', 'shipped' ], true );
            $is_progress  = ! $is_live && ( $design_submitted || $card_status === 'design-submitted' );

            if ( ! $is_in_basket && ! $is_progress && ! $is_live ) {
                continue;
            }

            $items[] = [
                'id'      => (int) $post->ID,
                'type'    => $type,
                'label'   => (string) get_post_meta( $post->ID, 'wpcf-card-label', true ) ?: $post->post_title,
                'front'   => (string) get_post_meta( $post->ID, 'wpcf-card-front', true ),
                'name'    => (string) get_post_meta( $post->ID, 'wpcf-name-on-card', true ) ?: $full_name,
                'job'     => (string) get_post_meta( $post->ID, 'wpcf-job-title-on-card', true ) ?: $job_title,
                'company' => $company_name,
                'logo'    => (string) get_post_meta( $post->ID, 'wpcf-card-front', true ) ?: $profile_logo,
                'status'  => self::card_status_label( [
                    'cart_key'         => $cart_key,
                    'design_submitted' => $design_submitted,
                    'packaged'         => $packaged,
                    'shipped'          => $shipped,
                    'card_status'      => $card_status,
                    'has_order'        => $has_order,
                ] ),
                'updated' => get_the_modified_date( 'Y-m-d H:i:s', $post ),
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
                'order-received'   => 'Order received',
                'design-submitted' => 'Design submitted',
                'packaged'         => 'Packaged',
                'shipped'          => 'Shipped',
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
}
