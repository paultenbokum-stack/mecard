<?php

/*add_action( 'wp_enqueue_scripts', 'enqueue_parent_styles' );

function enqueue_parent_styles() {
    wp_enqueue_style( 'parent-style', get_template_directory_uri().'/style.css' );
}*/

/**
 * Astra Child Theme functions and definitions
 *
 * @link https://developer.wordpress.org/themes/basics/theme-functions/
 *
 * @package Astra Child
 * @since 1.0.0
 */

@ini_set('post_max_size','64M');
@ini_set('max_execution_time','300');

function wp_maintenance_mode() {
    if (!current_user_can('edit_themes') || !is_user_logged_in()) {
        wp_die('<h1>Under Maintenance</h1><br />Website under planned maintenance. Please check back later.');
    }
}
//add_action('get_header', 'wp_maintenance_mode');

/**
 * Define Constants
 */
define( 'CHILD_THEME_ASTRA_CHILD_VERSION', '1.0.0' );

/**
 * Enqueue styles
 */
function child_enqueue_styles() {

    wp_enqueue_style( 'astra-child-theme-css', get_stylesheet_directory_uri() . '/style.css', array('astra-theme-css'), CHILD_THEME_ASTRA_CHILD_VERSION, 'all' );

}

add_action( 'wp_enqueue_scripts', 'child_enqueue_styles', 15 );

add_filter( 'astra_single_post_navigation_enabled', '__return_false' );

function my_wp_nav_menu_args( $args = '' ) {
    if ($args['theme_location'] == 'primary') {
        if( is_user_logged_in()) {
            $args['menu'] = 'logged-in';
        } else {
            $args['menu'] = 'logged-out';
        }
    }

    return $args;
}
add_filter( 'wp_nav_menu_args', 'my_wp_nav_menu_args' );





add_role('taggable_admin',__( 'Taggable Admin' ),array(
        'read'         => true,  // true allows this capability
        'create_users '   => true,
    )
);


function disable_featured_image_for_posts( $status ) {

    // disable featured image for pages.
    if ( 'mecard-profile' == get_post_type() ) {
        $status = false;
    }

    return $status;
}

add_filter( 'astra_featured_image_enabled', 'disable_featured_image_for_posts' );

add_action('after_setup_theme', 'remove_admin_bar');
function remove_admin_bar() {
    if (!current_user_can('administrator') && !is_admin()) {
        show_admin_bar(false);
    }
}

add_action('wp_logout','auto_redirect_after_logout');

function auto_redirect_after_logout(){
    wp_safe_redirect( home_url() );
    exit;
}

function forgot_password_link() {
    return '<a href="'.get_site_url().'my-account/lost-password/">Lost your password?
</a>';
}

add_shortcode('lost_pass_link','forgot_password_link');

// Honour redirect_to param on WooCommerce registration (e.g. from /for-teams/ CTA)
add_filter( 'woocommerce_registration_redirect', 'mecard_registration_redirect' );
function mecard_registration_redirect( $redirect ) {
    $requested = isset( $_REQUEST['redirect_to'] ) ? wp_unslash( $_REQUEST['redirect_to'] ) : '';
    if ( $requested ) {
        $safe = wp_validate_redirect( sanitize_text_field( $requested ), '' );
        if ( $safe ) {
            return $safe;
        }
    }
    return $redirect;
}

add_filter( 'wp_nav_menu_objects', 'mecard_fix_single_profile_nav_link', 10, 2 );
function mecard_fix_single_profile_nav_link( $items, $args ) {
    if ( ! is_user_logged_in() || ! class_exists( '\Me\Single_Editor\Module' ) ) {
        return $items;
    }
    $profile_id = \Me\Single_Editor\Module::resolve_single_profile_id( get_current_user_id() );
    if ( $profile_id <= 0 ) {
        return $items;
    }
    $legacy = trailingslashit( home_url( '/manage-mecard-profiles/dashboard' ) );
    foreach ( $items as &$item ) {
        if ( trailingslashit( $item->url ) === $legacy ) {
            $item->url = home_url( '/manage/' );
        }
    }
    return $items;
}

