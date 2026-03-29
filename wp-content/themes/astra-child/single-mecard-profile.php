<?php
/**
 * Template for single mecard-profile CPT.
 * Takes priority over Toolset Content Templates (WordPress resolves
 * single-{post_type}.php in child theme before Toolset applies its templates).
 */

get_header();

global $post;
$profile_id = (int) $post->ID;

$profile    = \Me\Preview\Module::get_profile_data( $profile_id );
$company_id = $profile['company_parent'] ?? 0;
$company    = $company_id ? \Me\Preview\Module::get_company_data( $company_id ) : [];

$profile['id'] = $profile_id;
$company['id'] = $company_id;

// Scoped CSS — only meaningful for pro profiles
$profile_type = $profile['type'] ?? 'standard';
if ( $profile_type === 'pro' || $profile_type === 'professional' ) {
    \Me\Profile_Renderer\Module::render_design_style( $profile_id, $company );
}
?>
<div class="mecard-public-card">
    <?php \Me\Profile_Renderer\Module::render( $profile, $company, 'public' ); ?>
    <?php if ( current_user_can( 'edit_post', $profile_id ) ) : ?>
    <div class="mecard-edit-bar">
        <button type="button" class="btn btn-outline-secondary btn-sm"
                onclick="NewMeOpenProfileEditor(<?php echo (int) $profile_id; ?>)">
            <i class="fas fa-pencil-alt"></i> Edit Profile
        </button>
    </div>
    <?php endif; ?>
</div>
<?php
get_footer();
