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

// Add the profile_id into the data arrays so templates can use it
$profile['id'] = $profile_id;
$company['id'] = $company_id;

// Emit scoped CSS-var style block for pro profiles
\Me\Profile_Renderer\Module::render_design_style( $profile_id, $company );

// Render the canonical profile HTML
\Me\Profile_Renderer\Module::render( $profile, $company, 'public' );

// Edit button — replicates [toolset-edit-post-link] shortcode logic
if ( current_user_can( 'edit_post', $profile_id ) ) {
    echo '<a href="' . esc_url( get_edit_post_link( $profile_id ) ) . '"
             class="btn btn-primary btn-lg" style="width:100%">Edit Profile</a>';
}

get_footer();
