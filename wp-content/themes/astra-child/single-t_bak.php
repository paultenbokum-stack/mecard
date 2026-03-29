<?php
/**
 * Template for the 't' (tag/NFC tag) CPT.
 * Finds the linked mecard-profile via Toolset relationship and renders it.
 * Replaces the 'single-me-card-profile' Toolset View that the old template used.
 */

get_header();

global $post;
$tag_id = (int) $post->ID;

// Resolve the linked mecard-profile via Toolset relationship
$profile_id = 0;
if ( function_exists( 'toolset_get_related_post' ) ) {
    $profile_id = (int) toolset_get_related_post( $tag_id, 'mecard-profile-mecard-tag', 'parent' );
}

if ( $profile_id ) {
    $profile    = \Me\Preview\Module::get_profile_data( $profile_id );
    $company_id = $profile['company_parent'] ?? 0;
    $company    = $company_id ? \Me\Preview\Module::get_company_data( $company_id ) : [];

    // Add IDs into the data arrays so templates can use them
    $profile['id'] = $profile_id;
    $company['id'] = $company_id;

    // Emit scoped CSS-var style block for pro profiles
    \Me\Profile_Renderer\Module::render_design_style( $profile_id, $company );

    // Render the canonical profile HTML
    \Me\Profile_Renderer\Module::render( $profile, $company, 'public' );
}

get_footer();
