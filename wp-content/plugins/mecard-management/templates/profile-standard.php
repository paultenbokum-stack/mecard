<?php
/**
 * Standard profile template.
 * Variables in scope: $profile (array), $company (array), $context ('public'|'preview').
 * Uses data-me-field attributes so the editor JS can hydrate elements in preview context.
 */

// Defensive defaults
$profile_id      = $profile['id'] ?? 0;
$first           = $profile['first'] ?? '';
$last            = $profile['last'] ?? '';
$job             = $profile['job'] ?? '';
$email           = $profile['email'] ?? '';
$mobile          = $profile['mobile'] ?? '';
$wa_raw          = $profile['wa'] ?? '';
$website         = $profile['website'] ?? '';
$photo_url       = $profile['photo_url'] ?? '';
$soc             = $profile['soc'] ?? [];

$company_id      = $company['id'] ?? 0;
$company_title   = $company['title'] ?? '';
$profile_company = $profile['company_name'] ?? '';
$company_label   = $company_title ?: $profile_company;
$company_address = $company['address'] ?? '';
$company_tel     = $company['tel'] ?? '';
$company_website = $company['website'] ?? '';

$is_public  = ( $context === 'public' );

$wa_int = '';
if ( $wa_raw ) {
    $wa_norm = preg_replace( '/\s+/', '', $wa_raw );
    if ( substr( $wa_norm, 0, 1 ) === '0' ) {
        $wa_norm = '+27' . substr( $wa_norm, 1 );
    }
    $wa_int = preg_replace( '/[^\d]/', '', $wa_norm );
}

$social_icons = [
    'facebook'  => 'fab fa-facebook-square',
    'instagram' => 'fab fa-instagram-square',
    'linkedin'  => 'fab fa-linkedin',
    'youtube'   => 'fab fa-youtube-square',
    'twitter'   => 'fab fa-twitter-square',
    'tiktok'    => 'fab fa-tiktok',
];
?>
<div class="mc-page standard-profile-container">

    <?php if ( ! $is_public ) :
        $logo_id  = get_theme_mod( 'custom_logo' );
        $logo_url = $logo_id ? wp_get_attachment_image_url( $logo_id, 'medium' ) : '';
        $site_name = get_bloginfo( 'name' );
    ?>
    <header class="mc-topbar">
        <div class="mc-logo">
            <?php if ( $logo_url ) : ?>
                <img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php echo esc_attr( $site_name ); ?>" class="mc-logo__img">
            <?php else : ?>
                <span class="mc-logo__bold">me</span><span class="mc-logo__light">card</span>
            <?php endif; ?>
        </div>
        <div class="mc-topbar__actions">
            <button class="mc-iconbtn mc-iconbtn--outline" aria-label="Cart">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 4h2.5l2.4 11.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.55L21.5 8H6.5"/>
                    <circle cx="9.5" cy="20.5" r="1.3"/><circle cx="17.5" cy="20.5" r="1.3"/>
                </svg>
            </button>
            <button class="mc-iconbtn" aria-label="Menu">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                    <path d="M4 7h16M4 12h16M4 17h16"/>
                </svg>
            </button>
        </div>
    </header>
    <?php endif; ?>

    <main class="mc-main">

        <!-- Identity card -->
        <section class="mc-card">

            <div class="mc-card__avatar profile-image">
                <img data-me-field="photo"
                     src="<?php echo esc_url( $photo_url ); ?>"
                     alt="Profile picture"
                     <?php if ( ! $photo_url ) echo 'style="display:none"'; ?>>
                <div class="mc-card__avatar-placeholder me-photo-placeholder"<?php if ( $photo_url ) echo ' style="display:none"'; ?>>
                    <svg viewBox="0 0 64 64" width="70" height="70" fill="currentColor">
                        <circle cx="32" cy="24" r="11"/>
                        <path d="M12 56c0-11 9-19 20-19s20 8 20 19v2H12v-2Z"/>
                    </svg>
                </div>
            </div>

            <h1 class="mc-card__name">
                <span data-me-field="first"><?php echo esc_html( $first ?: ( $is_public ? '' : 'First' ) ); ?></span>
                <span data-me-field="last"><?php echo esc_html( $last ?: ( $is_public ? '' : 'Last' ) ); ?></span>
            </h1>

            <p class="mc-card__role">
                <span data-me-field="job"><?php echo esc_html( $job ?: ( $is_public ? '' : 'Job title' ) ); ?></span><span data-me-field="role-company"<?php if ( ! $company_label ) echo ' style="display:none"'; ?>><span class="mc-card__role-sep"> at </span><strong><?php echo esc_html( $company_label ); ?></strong></span>
            </p>

            <!-- Social icons -->
            <div class="mc-socials">
                <?php foreach ( $social_icons as $net => $icon_class ) :
                    $url = $soc[ $net ] ?? '';
                ?>
                <div class="mecard-social-item" data-me-field="soc-<?php echo esc_attr( $net ); ?>"<?php if ( ! $url ) echo ' style="display:none"'; ?>>
                    <a class="mc-social" href="<?php echo $url ? esc_url( $url ) : '#'; ?>" target="_blank" rel="noopener" aria-label="<?php echo esc_attr( ucfirst( $net ) ); ?>">
                        <i class="<?php echo esc_attr( $icon_class ); ?>"></i>
                    </a>
                </div>
                <?php endforeach; ?>
                <?php
                    $has_any_social = ! empty( array_filter( $soc ) );
                ?>
                <p class="mc-socials__placeholder me-single-editor__empty-text"<?php if ( $is_public || $has_any_social ) echo ' style="display:none"'; ?>>+ add social links</p>
            </div>

        </section>

        <!-- Action row -->
        <div class="mc-actions">
            <a class="mc-action" data-me-field="call" href="<?php echo $mobile ? esc_url( 'tel:' . $mobile ) : '#'; ?>" aria-label="Call">
                <span class="mc-action__icon mc-action__icon--call">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6.6 3h3.1a1 1 0 0 1 .95.68l1.34 4a1 1 0 0 1-.25 1.04l-1.86 1.74a13 13 0 0 0 5.66 5.66l1.74-1.86a1 1 0 0 1 1.04-.25l4 1.34a1 1 0 0 1 .68.95v3.1a2 2 0 0 1-2.13 2C10.66 20.91 3.09 13.34 2.6 5.13A2 2 0 0 1 4.6 3Z"/></svg>
                </span>
                <span class="mc-action__label">Call</span>
            </a>
            <a class="mc-action" data-me-field="email" href="<?php echo $email ? esc_url( 'mailto:' . $email ) : '#'; ?>" aria-label="Email">
                <span class="mc-action__icon mc-action__icon--email">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 7.2 11.4 13a1 1 0 0 0 1.2 0L21 7.2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.2Z"/><path d="M20.7 5.6A2 2 0 0 0 19 5H5a2 2 0 0 0-1.7.9L12 12l8.7-6.4Z"/></svg>
                </span>
                <span class="mc-action__label">Email</span>
            </a>
            <a class="mc-action" data-me-field="wa" href="<?php echo $wa_int ? esc_url( 'https://wa.me/' . $wa_int ) : '#'; ?>" aria-label="WhatsApp">
                <span class="mc-action__icon mc-action__icon--whatsapp">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.9c0 1.92.55 3.78 1.6 5.4L2 22l4.84-1.27a9.86 9.86 0 0 0 5.2 1.48h.01c5.46 0 9.91-4.44 9.91-9.9 0-2.65-1.03-5.14-2.9-7.01A9.87 9.87 0 0 0 12.04 2Zm5.81 14.16c-.24.68-1.41 1.3-1.97 1.34-.5.04-1.13.06-1.83-.12-.42-.13-.96-.31-1.65-.61-2.92-1.26-4.82-4.2-4.97-4.39-.15-.2-1.2-1.59-1.2-3.04 0-1.45.76-2.16 1.03-2.45.27-.3.59-.37.79-.37l.57.01c.18 0 .43-.07.67.51.24.6.83 2.05.9 2.2.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.32.39-.46.52-.15.15-.31.31-.13.61.18.3.78 1.29 1.67 2.08 1.15 1.02 2.12 1.34 2.42 1.49.3.15.48.13.66-.08.18-.21.76-.89.96-1.19.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.49.22.56.34.08.13.08.73-.16 1.42Z"/></svg>
                </span>
                <span class="mc-action__label">WhatsApp</span>
            </a>
        </div>

        <!-- Personal details -->
        <section class="mc-details">

            <div class="mc-details__row">
                <span class="mc-details__icon mc-details__icon--blue">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg>
                </span>
                <div class="mc-details__text">
                    <div class="mc-details__label">Email</div>
                    <div class="mc-details__value"><span data-me-field="email-text"><?php echo esc_html( $email ); ?></span></div>
                </div>
            </div>

            <div class="mc-details__row">
                <span class="mc-details__icon mc-details__icon--blue">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3h3l1.5 4.5L9 9.5a12 12 0 0 0 5.5 5.5l2-2L21 14.5v3a2 2 0 0 1-2.2 2C10.5 19 5 13.5 4.5 5.2A2 2 0 0 1 6.5 3Z"/></svg>
                </span>
                <div class="mc-details__text">
                    <div class="mc-details__label">Mobile</div>
                    <div class="mc-details__value"><span data-me-field="mobile-text"><?php echo esc_html( $mobile ); ?></span></div>
                </div>
            </div>

            <div class="mc-details__row" data-me-field="website-row"<?php if ( ! $website ) echo ' style="display:none"'; ?>>
                <span class="mc-details__icon mc-details__icon--blue">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3c-2 2.5-3 5.5-3 9s1 6.5 3 9M12 3c2 2.5 3 5.5 3 9s-1 6.5-3 9M3 12h18"/></svg>
                </span>
                <div class="mc-details__text">
                    <div class="mc-details__label">Website</div>
                    <div class="mc-details__value">
                        <a data-me-field="website"
                           href="<?php echo $website ? esc_url( $website ) : '#'; ?>"
                           target="_blank" rel="noopener">
                            <?php echo esc_html( $website ? preg_replace( '/^https?:\/\//', '', $website ) : '' ); ?>
                        </a>
                    </div>
                </div>
            </div>

        </section>

        <!-- Work -->
        <section class="mc-details mc-work">

            <h2 class="mc-details__section-title">Work</h2>

            <div class="mc-details__row">
                <span class="mc-details__icon mc-details__icon--blue">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                </span>
                <div class="mc-details__text">
                    <div class="mc-details__label">Company</div>
                    <div class="mc-details__value"><span class="company" data-me-field="company-name"><?php echo esc_html( $company_label ); ?></span></div>
                </div>
            </div>

            <div class="mc-details__row" data-me-field="company-address-row"<?php if ( ! $company_address ) echo ' style="display:none"'; ?>>
                <span class="mc-details__icon mc-details__icon--blue">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4-4-6-7.5-6-10a6 6 0 0 1 12 0c0 2.5-2 6-6 10Z"/><circle cx="12" cy="11" r="2"/></svg>
                </span>
                <div class="mc-details__text">
                    <div class="mc-details__label">Address</div>
                    <div class="mc-details__value"><span data-me-field="company-address"><?php echo esc_html( $company_address ); ?></span></div>
                </div>
            </div>

            <!-- Company action buttons -->
            <div class="mc-company-actions">

                <div data-me-field="btn-website"<?php if ( ! $company_website ) echo ' style="display:none"'; ?>>
                    <a data-me-field="company-website"
                       href="<?php echo $company_website ? esc_url( $company_website ) : '#'; ?>"
                       target="_blank" rel="noopener" class="mc-company-btn">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3c-2 2.5-3 5.5-3 9s1 6.5 3 9M12 3c2 2.5 3 5.5 3 9s-1 6.5-3 9M3 12h18"/></svg>
                        Website
                    </a>
                </div>

                <div data-me-field="btn-phone"<?php if ( ! $company_tel ) echo ' style="display:none"'; ?>>
                    <a data-me-field="company-phone"
                       href="<?php echo $company_tel ? esc_url( 'tel:' . $company_tel ) : '#'; ?>"
                       class="mc-company-btn">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3h3l1.5 4.5L9 9.5a12 12 0 0 0 5.5 5.5l2-2L21 14.5v3a2 2 0 0 1-2.2 2C10.5 19 5 13.5 4.5 5.2A2 2 0 0 1 6.5 3Z"/></svg>
                        Call Office
                    </a>
                </div>

                <div data-me-field="btn-directions"<?php if ( ! $company_address ) echo ' style="display:none"'; ?>>
                    <a data-me-field="company-directions"
                       href="<?php echo $company_address ? esc_url( 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode( $company_address ) ) : '#'; ?>"
                       target="_blank" rel="noopener" class="mc-company-btn">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 19-9-9 19-2-8-8-2Z"/></svg>
                        Directions
                    </a>
                </div>

            </div>

        </section>

        <?php if ( $is_public ) : ?>
            <?php echo do_shortcode( "[wpv-view name='more-links']" ); ?>
        <?php endif; ?>

        <div style="height:30px" aria-hidden="true"></div>

    </main>

    <!-- vCard / Save to contacts -->
    <div data-me-field="vcard-button">
        <?php if ( $is_public && $profile_id ) : ?>
            <?php
            $auto = get_post_meta( $profile_id, 'wpcf-auto_download_vcard', true );
            echo do_shortcode( '[mecard_vcard_button auto="' . esc_attr( $auto ) . '"]' );
            ?>
        <?php else : ?>
            <div class="mc-savebar">
                <button class="mc-savebar__btn">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="9" r="3.5"/><path d="M4 19c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5"/><path d="M18 6v6M15 9h6"/></svg>
                    <a data-me-field="vcard-link" href="#">Save to contacts</a>
                </button>
            </div>
        <?php endif; ?>
    </div>

    <?php if ( $is_public ) : ?>
        <?php echo do_shortcode( '[mecard_share_panel]' ); ?>
    <?php endif; ?>

</div><!-- /.mc-page -->
