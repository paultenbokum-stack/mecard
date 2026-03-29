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
$website         = $profile['website'] ?? '';
$photo_url       = $profile['photo_url'] ?? '';
$soc             = $profile['soc'] ?? [];

$company_id      = $company['id'] ?? 0;
$company_title   = $company['title'] ?? '';
$company_address = $company['address'] ?? '';
$company_tel     = $company['tel'] ?? '';
$company_website = $company['website'] ?? '';

$is_public  = ( $context === 'public' );

$social_icons = [
    'facebook'  => 'fab fa-facebook-square',
    'instagram' => 'fab fa-instagram-square',
    'linkedin'  => 'fab fa-linkedin',
    'youtube'   => 'fab fa-youtube-square',
    'twitter'   => 'fab fa-twitter-square',
    'tiktok'    => 'fab fa-tiktok',
];
?>
<div class="standard-profile-container">

    <h1 class="has-text-align-center">
        <span data-me-field="first"><?php echo esc_html( $first ?: ( $is_public ? '' : 'First' ) ); ?></span>
        <span data-me-field="last"><?php echo esc_html( $last ?: ( $is_public ? '' : 'Last' ) ); ?></span>
    </h1>

    <div style="height:20px" aria-hidden="true" class="wp-block-spacer"></div>

    <!-- Profile photo -->
    <div class="profile-image">
        <img data-me-field="photo"
             src="<?php echo esc_url( $photo_url ); ?>"
             alt="Profile picture"
             <?php if ( ! $photo_url ) echo 'style="display:none"'; ?>>
    </div>

    <div class="job-title">
        <span data-me-field="job"><?php echo esc_html( $job ?: ( $is_public ? '' : 'Job title' ) ); ?></span>
    </div>

    <!-- Social icons -->
    <?php if ( $is_public ) : ?>
        <?php echo do_shortcode( '[mecard_social_icons]' ); ?>
    <?php else : ?>
        <div class="container-md">
            <div class="row">
                <div class="col col-12 mecard-centered mecard-social">
                    <?php foreach ( $social_icons as $net => $icon_class ) :
                        $url = $soc[ $net ] ?? '';
                    ?>
                    <div class="mecard-social-item" data-me-field="soc-<?php echo esc_attr( $net ); ?>"<?php if ( ! $url ) echo ' style="display:none"'; ?>>
                        <a href="<?php echo $url ? esc_url( $url ) : '#'; ?>" target="_blank" rel="noopener">
                            <i class="<?php echo esc_attr( $icon_class ); ?>"></i>
                        </a>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    <?php endif; ?>

    <div class="container-fluid">

        <!-- Personal Details -->
        <div class="row">
            <div class="col col-12 mecard-section">Personal Details</div>
        </div>

        <div class="row">
            <div class="col col-4">Email:</div>
            <div class="col col-8"><span data-me-field="email-text"><?php echo esc_html( $email ); ?></span></div>
        </div>

        <div class="row">
            <div class="col col-4">Mobile:</div>
            <div class="col col-8"><span data-me-field="mobile-text"><?php echo esc_html( $mobile ); ?></span></div>
        </div>

        <div class="row" data-me-field="website-row"<?php if ( ! $website ) echo ' style="display:none"'; ?>>
            <div class="col col-4">Website:</div>
            <div class="col col-8">
                <a data-me-field="website"
                   href="<?php echo $website ? esc_url( $website ) : '#'; ?>"
                   target="_blank" rel="noopener">
                    <?php echo esc_html( $website ? preg_replace( '/^https?:\/\//', '', $website ) : '' ); ?>
                </a>
            </div>
        </div>

        <!-- Work -->
        <div class="row">
            <div class="col col-sm-12 mecard-section">Work</div>
        </div>

        <div class="row">
            <div class="col col-sm-12">
                <h3 class="company" data-me-field="company-name"><?php echo esc_html( $company_title ); ?></h3>
                <p></p>
            </div>
        </div>

        <div class="row" data-me-field="company-address-row"<?php if ( ! $company_address ) echo ' style="display:none"'; ?>>
            <div class="col col-sm-12" data-me-field="company-address"><?php echo esc_html( $company_address ); ?></div>
        </div>

        <!-- Company buttons -->
        <div class="d-flex flex-row justify-content-start">

            <div class="p-1" data-me-field="btn-website"<?php if ( ! $company_website ) echo ' style="display:none"'; ?>>
                <a data-me-field="company-website"
                   href="<?php echo $company_website ? esc_url( $company_website ) : '#'; ?>"
                   target="_blank" rel="noopener">
                    <button class="company website" type="button">Website</button>
                </a>
            </div>

            <div class="p-1" data-me-field="btn-phone"<?php if ( ! $company_tel ) echo ' style="display:none"'; ?>>
                <a data-me-field="company-phone"
                   href="<?php echo $company_tel ? esc_url( 'tel:' . $company_tel ) : '#'; ?>">
                    <button class="company phone" type="button">Call</button>
                </a>
            </div>

            <div class="p-1" data-me-field="btn-directions"<?php if ( ! $company_address ) echo ' style="display:none"'; ?>>
                <a data-me-field="company-directions"
                   href="<?php echo $company_address ? esc_url( 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode( $company_address ) ) : '#'; ?>"
                   target="_blank" rel="noopener">
                    <button class="company directions" type="button">Directions</button>
                </a>
            </div>

        </div>

        <?php if ( $is_public ) : ?>
            <?php echo do_shortcode( "[wpv-view name='more-links']" ); ?>
        <?php endif; ?>

        <div style="height:30px" aria-hidden="true" class="wp-block-spacer"></div>

    </div><!-- /.container-fluid -->

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

</div><!-- /.standard-profile-container -->
