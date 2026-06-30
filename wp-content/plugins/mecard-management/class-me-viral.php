<?php
namespace Me\Viral;

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Viral Growth Engine — Phase 1
 *
 * Surfaces:
 *  1. Profile page watermark strip (recipient-facing, free profiles)
 *  2. Share message footer (appended in JS, free profiles)
 *  3. vCard NOTE append (free profiles)
 *  4. Share panel Pro upsell strip (owner-facing, free profiles)
 *  5. Post-save conversion CTA (recipient-facing, free profiles)
 *  + OG meta tags (free vs pro)
 *  + QR branding flag for JS
 */
class Module {

    public static function init(): void {
        // OG meta tags on public profile pages
        add_action( 'wp_head', [ __CLASS__, 'render_og_meta' ], 5 );

        // Profile page watermark strip — inline after profile content
        add_action( 'mecard_after_profile_content', [ __CLASS__, 'render_watermark_strip' ] );

        // Post-save CTA overlay — injected in footer for free profiles
        add_action( 'wp_footer', [ __CLASS__, 'render_post_save_cta' ] );

        // Share panel Pro upsell strip — filter the share panel shortcode
        add_filter( 'mecard_share_panel_html', [ __CLASS__, 'inject_share_panel_upsell' ], 10, 1 );

        // vCard NOTE append
        add_filter( 'mecard_vcard_output', [ __CLASS__, 'append_vcard_note' ], 10, 2 );

        // Enqueue viral JS/CSS on public profile pages
        add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ], 100 );
    }

    // ─── Helpers ─────────────────────────────────────────────

    /**
     * Determine if the current page is a public profile page.
     */
    private static function is_public_profile(): bool {
        return is_singular( [ 'mecard-profile', 't' ] );
    }

    /**
     * Determine if the currently viewed profile is free (standard/basic).
     */
    private static function is_free_profile( int $profile_id = 0 ): bool {
        if ( ! $profile_id ) {
            global $post;
            $profile_id = $post ? (int) $post->ID : 0;
        }
        if ( ! $profile_id ) return true;

        // Resolve through tag → profile if this is a /t/ page
        $profile_id = self::resolve_profile_id( $profile_id );

        $type = strtolower( (string) get_post_meta( $profile_id, 'wpcf-profile-type', true ) );
        return ! in_array( $type, [ 'professional', 'pro' ], true );
    }

    /**
     * Determine if the current viewer is the profile owner.
     */
    private static function is_owner( int $profile_id = 0 ): bool {
        if ( ! is_user_logged_in() ) return false;
        if ( ! $profile_id ) {
            global $post;
            $profile_id = $post ? (int) $post->ID : 0;
        }
        if ( ! $profile_id ) return false;

        $profile_id = self::resolve_profile_id( $profile_id );
        $uid        = get_current_user_id();
        $post_obj   = get_post( $profile_id );
        $owner_id   = (int) get_post_meta( $profile_id, 'me_profile_owner_user_id', true );

        return $post_obj && ( (int) $post_obj->post_author === $uid || ( $owner_id > 0 && $owner_id === $uid ) );
    }

    /**
     * Resolve tag post to its linked profile ID if needed.
     */
    private static function resolve_profile_id( int $post_id ): int {
        if ( function_exists( 'mecard_resolve_profile_id' ) ) {
            return mecard_resolve_profile_id( $post_id ) ?: $post_id;
        }
        return $post_id;
    }

    /**
     * Get profile data needed for viral surfaces.
     */
    private static function get_profile_context(): array {
        if ( ! self::is_public_profile() ) return [];

        global $post;
        $post_id    = $post ? (int) $post->ID : 0;
        $profile_id = self::resolve_profile_id( $post_id );
        if ( ! $profile_id ) return [];

        $first   = get_post_meta( $profile_id, 'wpcf-first-name', true ) ?: '';
        $last    = get_post_meta( $profile_id, 'wpcf-last-name', true ) ?: '';
        $job     = get_post_meta( $profile_id, 'wpcf-job-title', true ) ?: '';
        $email   = get_post_meta( $profile_id, 'wpcf-email-address', true ) ?: '';
        $type    = strtolower( get_post_meta( $profile_id, 'wpcf-profile-type', true ) ?: 'standard' );
        $is_free = ! in_array( $type, [ 'professional', 'pro' ], true );

        // Company name
        $company_name = '';
        $company_id   = 0;
        if ( function_exists( 'toolset_get_related_posts' ) ) {
            $parents = toolset_get_related_posts( $profile_id, 'company-mecard-profile', [
                'query_by_role'  => 'child',
                'role_to_return' => 'parent',
                'limit'          => 1,
            ] );
            if ( ! empty( $parents ) ) {
                $first_parent = reset( $parents );
                $company_id   = is_object( $first_parent ) ? (int) $first_parent->ID : (int) $first_parent;
                $company_name = get_the_title( $company_id );
            }
        }
        if ( ! $company_name ) {
            $company_name = get_post_meta( $profile_id, 'wpcf-company-r', true )
                ?: ( get_post_meta( $profile_id, 'wpcf-company_name', true ) ?: '' );
        }

        return [
            'profile_id'   => $profile_id,
            'post_id'      => $post_id,
            'first'        => $first,
            'last'         => $last,
            'full_name'    => trim( "$first $last" ),
            'job'          => $job,
            'email'        => $email,
            'company_name' => $company_name,
            'company_id'   => $company_id,
            'type'         => $type,
            'is_free'      => $is_free,
            'is_owner'     => self::is_owner( $profile_id ),
            'photo_url'    => get_the_post_thumbnail_url( $profile_id, 'medium' ) ?: '',
            'permalink'    => get_permalink( $profile_id ),
        ];
    }

    // ─── Surface 1: Profile page watermark strip ─────────────

    public static function render_watermark_strip(): void {
        if ( ! self::is_free_profile() ) return;
        if ( self::is_owner() ) return;
        ?>
        <div class="mecard-watermark-strip" id="mecard-watermark-strip">
            <a href="<?php echo esc_url( site_url( '/sign-up/?utm_source=watermark&utm_medium=profile&utm_campaign=free_viral' ) ); ?>"
               class="mecard-watermark-strip__link"
               data-mecard-viral="profile_strip">Get your own MeCard &rarr;</a>
        </div>
        <?php
    }

    // ─── Surface 4: Share panel Pro upsell strip ─────────────

    public static function inject_share_panel_upsell( string $html ): string {
        if ( ! self::is_public_profile() ) return $html;

        $ctx = self::get_profile_context();
        if ( empty( $ctx ) || ! $ctx['is_free'] || ! $ctx['is_owner'] ) return $html;

        $upsell = '<div class="mecard-share-upsell" id="mecard-share-upsell">'
            . '<a href="' . esc_url( site_url( '/sign-up/?utm_source=watermark&utm_medium=share_panel&utm_campaign=pro_upsell' ) ) . '"'
            . ' class="mecard-share-upsell__link" data-mecard-viral="share_panel">'
            . '<span class="mecard-share-upsell__icon">&#9733;</span> '
            . '<span class="mecard-share-upsell__text">Go Pro to remove MeCard branding from your shares</span>'
            . '</a></div>';

        // Insert upsell strip at the top of the panel content (after opening container-fluid)
        $html = str_replace(
            '<div class="container-fluid py-3">',
            '<div class="container-fluid py-3">' . $upsell,
            $html
        );

        return $html;
    }

    // ─── Surface 5: Post-save conversion CTA ─────────────────

    public static function render_post_save_cta(): void {
        $ctx = self::get_profile_context();
        if ( empty( $ctx ) || ! $ctx['is_free'] ) return;
        if ( $ctx['is_owner'] ) return;

        $signup_url = esc_url( site_url( '/sign-up/?utm_source=post_save&utm_medium=profile&utm_campaign=free_viral&ref_profile=' . $ctx['profile_id'] ) );
        ?>
        <!-- Inline CTA for Android (injected into download-message by JS) -->
        <template id="mecard-post-save-cta-tpl">
            <div class="mecard-post-save-cta-inline">
                <p class="mecard-post-save-cta-inline__text">Impressed? Want your own digital business card?</p>
                <a href="<?php echo $signup_url; ?>"
                   class="mecard-post-save-cta-inline__btn"
                   data-mecard-viral="post_save">
                    Create your free MeCard &rarr;
                </a>
            </div>
        </template>
        <!-- Floating CTA for non-Android (iPhone/desktop) -->
        <div class="mecard-post-save-cta" id="mecard-post-save-cta" style="display:none;">
            <div class="mecard-post-save-cta__card">
                <button class="mecard-post-save-cta__close" id="mecard-post-save-cta-close" aria-label="Close">&times;</button>
                <p class="mecard-post-save-cta__text">Impressed? Want your own digital business card?</p>
                <a href="<?php echo $signup_url; ?>"
                   class="mecard-post-save-cta__btn"
                   id="mecard-post-save-cta-signup"
                   data-mecard-viral="post_save">
                    Create your free MeCard
                </a>
            </div>
        </div>
        <?php
    }

    // ─── Surface 3: vCard NOTE append ──────────────────────────

    public static function append_vcard_note( string $vcard, int $profile_id ): string {
        if ( ! self::is_free_profile( $profile_id ) ) return $vcard;

        $note_line = "\nNOTE:Get your own digital business card at mecard.co.za";

        // If there's already a NOTE field, append to it
        if ( preg_match( '/^NOTE:/m', $vcard ) ) {
            $vcard = preg_replace(
                '/^(NOTE:.*)$/m',
                '$1\\nGet your own digital business card at mecard.co.za',
                $vcard
            );
        } else {
            // Insert before END:VCARD
            $vcard = str_replace( 'END:VCARD', $note_line . "\nEND:VCARD", $vcard );
        }

        return $vcard;
    }

    // ─── OG Meta Tags ────────────────────────────────────────

    public static function render_og_meta(): void {
        $ctx = self::get_profile_context();
        if ( empty( $ctx ) ) return;

        $name     = $ctx['full_name'];
        $job      = $ctx['job'];
        $company  = $ctx['company_name'];
        $is_free  = $ctx['is_free'];
        $photo    = $ctx['photo_url'];
        $url      = $ctx['permalink'];

        // Title: "Name — Job Title at Company"
        $title_parts = [ $name ];
        if ( $job && $company ) {
            $title_parts[] = "$job at $company";
        } elseif ( $job ) {
            $title_parts[] = $job;
        } elseif ( $company ) {
            $title_parts[] = $company;
        }
        $og_title = implode( ' — ', $title_parts );

        // Description differs by tier
        if ( $is_free ) {
            $og_desc = "$name's digital business card, powered by MeCard. Tap to save their contact details.";
        } else {
            $og_desc = "$name's digital business card. Tap to save their contact details.";
        }

        // Site name differs by tier
        $og_site = $is_free ? 'MeCard' : ( $company ?: 'MeCard' );

        echo '<meta property="og:type" content="profile" />' . "\n";
        echo '<meta property="og:title" content="' . esc_attr( $og_title ) . '" />' . "\n";
        echo '<meta property="og:description" content="' . esc_attr( $og_desc ) . '" />' . "\n";
        echo '<meta property="og:url" content="' . esc_url( $url ) . '" />' . "\n";
        echo '<meta property="og:site_name" content="' . esc_attr( $og_site ) . '" />' . "\n";

        if ( $photo ) {
            echo '<meta property="og:image" content="' . esc_url( $photo ) . '" />' . "\n";
        }

        // Twitter card
        echo '<meta name="twitter:card" content="summary" />' . "\n";
        echo '<meta name="twitter:title" content="' . esc_attr( $og_title ) . '" />' . "\n";
        echo '<meta name="twitter:description" content="' . esc_attr( $og_desc ) . '" />' . "\n";
        if ( $photo ) {
            echo '<meta name="twitter:image" content="' . esc_url( $photo ) . '" />' . "\n";
        }
    }

    // ─── Asset enqueue ───────────────────────────────────────

    public static function enqueue_assets(): void {
        if ( ! self::is_public_profile() ) return;

        $ctx = self::get_profile_context();
        if ( empty( $ctx ) ) return;

        $base_url  = plugin_dir_url( __FILE__ );
        $base_path = plugin_dir_path( __FILE__ );

        wp_enqueue_style(
            'mecard-viral',
            $base_url . 'css/me-viral.css',
            [],
            filemtime( $base_path . 'css/me-viral.css' )
        );

        wp_enqueue_script(
            'mecard-viral',
            $base_url . 'js/mecard-viral.js',
            [],
            filemtime( $base_path . 'js/mecard-viral.js' ),
            true
        );

        wp_add_inline_script(
            'mecard-viral',
            'window.MECARD_VIRAL = ' . wp_json_encode( [
                'isFree'    => $ctx['is_free'],
                'isOwner'   => $ctx['is_owner'],
                'profileId' => $ctx['profile_id'],
                'ownerName' => $ctx['full_name'],
                'shareFooter' => $ctx['is_free']
                    ? $ctx['full_name'] . "'s MeCard — Get yours at mecard.co.za"
                    : '',
            ] ) . ';',
            'before'
        );
    }
}
