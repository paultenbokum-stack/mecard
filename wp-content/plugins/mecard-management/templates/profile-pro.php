<?php
/**
 * Pro profile template.
 * Variables in scope: $profile (array), $company (array), $context ('public'|'preview').
 *
 * Structure mirrors the live Toolset 'single-pro-profile-content-template':
 *   logo → photo → name → job → social icons + action buttons → company section
 *
 * In public context, [mecard_social_icons] renders the social icons + call/email/wa buttons.
 * In preview context, equivalent static HTML is rendered with data-me-field attributes for JS hydration.
 */

$profile_id      = $profile['id'] ?? 0;
$first           = $profile['first'] ?? '';
$last            = $profile['last'] ?? '';
$job             = $profile['job'] ?? '';
$email           = $profile['email'] ?? '';
$mobile          = $profile['mobile'] ?? '';
$wa_raw          = $profile['wa'] ?? '';
$direct_line     = $profile['direct_line'] ?? '';
$photo_url       = $profile['photo_url'] ?? '';
$soc             = $profile['soc'] ?? [];

$company_id      = $company['id'] ?? 0;
$company_title   = $company['title'] ?? '';
$company_logo    = $company['logo_url'] ?? '';
$company_address = $company['address'] ?? '';
$company_tel     = $company['tel'] ?? '';
$company_website = $company['website'] ?? '';
$company_desc    = $company['desc_html'] ?? '';

$is_public  = ( $context === 'public' );
$post_class = $profile_id ? ' post-' . (int) $profile_id : '';

// WhatsApp international number (for preview context)
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
<div class="pro-profile-container<?php echo esc_attr( $post_class ); ?>">

    <!-- Company logo -->
    <div class="pro-logo">
        <img data-me-field="company-logo"
             src="<?php echo esc_url( $company_logo ); ?>"
             alt="<?php echo esc_attr( $company_title ); ?>"
             <?php if ( ! $company_logo ) echo 'style="display:none"'; ?>>
    </div>

    <!-- Profile photo -->
    <div class="profile-image pro">
        <picture class="attachment-medium size-medium wp-post-image">
            <img data-me-field="photo"
                 src="<?php echo esc_url( $photo_url ); ?>"
                 alt="Profile picture"
                 <?php if ( ! $photo_url ) echo 'style="display:none"'; ?>>
        </picture>
        <div class="me-photo-placeholder"<?php if ( $photo_url ) echo ' style="display:none"'; ?>>
            <i class="fas fa-user"></i>
        </div>
    </div>

    <div style="height:20px" aria-hidden="true" class="wp-block-spacer"></div>

    <h1 class="has-text-align-center">
        <span data-me-field="first"><?php echo esc_html( $first ?: ( $is_public ? '' : 'First' ) ); ?></span>
        <span data-me-field="last"><?php echo esc_html( $last ?: ( $is_public ? '' : 'Last' ) ); ?></span>
    </h1>

    <div class="job-title">
        <span data-me-field="job"><?php echo esc_html( $job ?: ( $is_public ? '' : 'Job title' ) ); ?></span>
    </div>

    <?php if ( $is_public ) : ?>
        <?php
        // [mecard_social_icons] renders both the social icons row AND the call/email/wa buttons row.
        echo do_shortcode( '[mecard_social_icons]' );
        ?>
    <?php else : ?>
        <!-- Preview context: static equivalent of [mecard_social_icons] with data-me-field attributes -->
        <div class="container-md">
            <div class="row justify-content-center mecard-social">
                <?php foreach ( $social_icons as $net => $icon_class ) :
                    $url = $soc[ $net ] ?? '';
                ?>
                <div class="col-2 text-center mecard-social-item" data-me-field="soc-<?php echo esc_attr( $net ); ?>"<?php if ( ! $url ) echo ' style="display:none"'; ?>>
                    <a href="<?php echo $url ? esc_url( $url ) : '#'; ?>" target="_blank" rel="noopener">
                        <i class="<?php echo esc_attr( $icon_class ); ?>"></i>
                    </a>
                </div>
                <?php endforeach; ?>
            </div>
            <div class="row profile-buttons">
                <div class="col col-4">
                    <a data-me-field="call" href="<?php echo $mobile ? esc_url( 'tel:' . $mobile ) : '#'; ?>">
                        <button type="button" class="phone" aria-label="Call">
                            <i class="fas fa-mobile-alt"></i>
                        </button>
                    </a>
                </div>
                <div class="col col-4">
                    <a data-me-field="email" href="<?php echo $email ? esc_url( 'mailto:' . $email ) : '#'; ?>">
                        <button type="button" class="email" aria-label="Email">
                            <i class="fas fa-envelope"></i>
                        </button>
                    </a>
                </div>
                <div class="col col-4">
                    <a data-me-field="wa" href="<?php echo $wa_int ? esc_url( 'https://wa.me/' . $wa_int ) : '#'; ?>">
                        <button type="button" class="whatsapp" aria-label="WhatsApp">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                    </a>
                </div>
            </div>
        </div>
    <?php endif; ?>

    <div class="container-fluid">

        <div style="height:50px" aria-hidden="true" class="wp-block-spacer"></div>

        <div class="row">
            <div class="col col-sm-12">
                <h2 class="company" data-me-field="company-name"><?php echo esc_html( $company_title ); ?></h2>
            </div>
        </div>

        <div class="row" data-me-field="company-address-row"<?php if ( ! $company_address ) echo ' style="display:none"'; ?>>
            <div class="col col-sm-12">
                <?php if ( $company_address ) : ?>
                    <a data-me-field="company-address"
                       href="<?php echo esc_url( 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode( $company_address ) ); ?>"
                       target="_blank" rel="noopener" class="company-address" style="text-decoration:none">
                        <span data-me-field="company-address-text"><?php echo esc_html( $company_address ); ?></span>
                    </a>
                <?php else : ?>
                    <a data-me-field="company-address" href="#" target="_blank" rel="noopener" class="company-address" style="text-decoration:none">
                        <span data-me-field="company-address-text"></span>
                    </a>
                <?php endif; ?>
                <div style="height:20px" aria-hidden="true" class="wp-block-spacer"></div>
            </div>
        </div>

        <!-- Company description -->
        <div class="row"<?php if ( ! $company_desc ) echo ' style="display:none"'; ?>>
            <div class="col col-sm-12" data-me-field="company-description">
                <?php echo wp_kses_post( $company_desc ); ?>
            </div>
        </div>

        <div style="height:50px" aria-hidden="true" class="wp-block-spacer"></div>

        <!-- Company action buttons -->
        <div class="row">
            <div class="col col-sm-12">

                <a data-me-field="company-website"
                   href="<?php echo $company_website ? esc_url( $company_website ) : '#'; ?>"
                   target="_blank" rel="noopener"
                   <?php if ( ! $company_website ) echo 'style="display:none"'; ?>>
                    <button type="button" class="company website">
                        <i class="fas fa-globe"></i> Visit Website
                    </button>
                </a>

                <a data-me-field="company-phone"
                   href="<?php echo $company_tel ? esc_url( 'tel:' . $company_tel ) : '#'; ?>"
                   <?php if ( ! $company_tel ) echo 'style="display:none"'; ?>>
                    <button type="button" class="company phone">
                        <i class="fas fa-phone-alt"></i> Call the Office
                    </button>
                </a>

                <a data-me-field="direct-line"
                   href="<?php echo $direct_line ? esc_url( 'tel:' . $direct_line ) : '#'; ?>"
                   <?php if ( ! $direct_line ) echo 'style="display:none"'; ?>>
                    <button type="button" class="company phone">
                        <i class="fas fa-phone-alt"></i> Direct Line
                    </button>
                </a>

                <a data-me-field="company-directions"
                   href="<?php echo $company_address ? esc_url( 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode( $company_address ) ) : '#'; ?>"
                   target="_blank" rel="noopener"
                   <?php if ( ! $company_address ) echo 'style="display:none"'; ?>>
                    <button type="button" class="company directions">
                        <i class="fas fa-map-marker"></i> Directions
                    </button>
                </a>

            </div>
        </div>

        <?php if ( $is_public ) : ?>
            <?php
            // Toolset Views — public context only; cannot render inside the editor preview
            if ( $company_id ) {
                echo do_shortcode( "[wpv-view name='more-links-company' company='{$company_id}']" );
            }
            echo do_shortcode( "[wpv-view name='more-links']" );
            ?>
        <?php endif; ?>

    </div><!-- /.container-fluid -->

    <div class="row">
        <div class="col col-12">
            <div class="mecard-swipe-hint d-sm-none" aria-hidden="true" style="text-align:center;opacity:.7;margin-top:10px;">
                <small>Tip: swipe left/right for more sharing options</small>
            </div>
        </div>
    </div>

    <div style="height:50px" aria-hidden="true" class="wp-block-spacer"></div>

    <?php if ( $is_public ) : ?>
        <?php echo do_shortcode( '[mecard_share_panel]' ); ?>
    <?php endif; ?>

    <!-- vCard download bar -->
    <div data-me-field="vcard-button">
        <?php if ( $is_public && $profile_id ) : ?>
            <?php
            $auto = get_post_meta( $profile_id, 'wpcf-auto_download_vcard', true );
            echo do_shortcode( '[mecard_vcard_button auto="' . esc_attr( $auto ) . '"]' );
            ?>
        <?php else : ?>
            <div class="vcard-download">
                <div class="vcard-button">
                    <a data-me-field="vcard-link" href="#">Download Contact Card</a>
                </div>
            </div>
        <?php endif; ?>
    </div>

</div><!-- /.pro-profile-container -->
