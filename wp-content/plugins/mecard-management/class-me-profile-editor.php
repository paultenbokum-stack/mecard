<?php
namespace Me\Profile_Editor;

use Me\Preview\Module as Preview_Module;


if (!defined('ABSPATH')) exit;

class Module {

    public static function init() : void {
        add_action('wp_ajax_me_profile_load',      [__CLASS__, 'ajax_profile_load']);
        add_action('wp_ajax_me_save_profile_form', [__CLASS__, 'ajax_save_profile_form']);
    }

    public static function ajax_profile_load() : void {
        if (!check_ajax_referer('me-profile-edit-nonce', '_wpnonce', false)) {
            wp_send_json_error(['message' => 'Invalid nonce'], 403);
        }
        if (!is_user_logged_in()) {
            wp_send_json_error(['message' => 'Not allowed'], 403);
        }

        $post_id = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        if (!$post_id) {
            wp_send_json_error(['message' => 'Missing post_id'], 400);
        }

        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'mecard-profile') {
            wp_send_json_error(['message' => 'Invalid profile'], 404);
        }
        if (!current_user_can('edit_post', $post_id)) {
            wp_send_json_error(['message' => 'No permission'], 403);
        }

        // Reuse your existing helpers
        $profile = Preview_Module::get_profile_data($post_id);
        $company_id = $profile['company_parent'] ?? 0;
        $company = $company_id ? Preview_Module::get_company_data($company_id) : [];

        wp_send_json_success([
            'profile' => $profile,
            'company' => $company,
        ]);
    }

    public static function ajax_save_profile_form() : void {
        if (!check_ajax_referer('me-profile-edit-nonce', '_wpnonce', false)) {
            wp_send_json_error(['message' => 'Invalid nonce'], 403);
        }
        if (!is_user_logged_in()) {
            wp_send_json_error(['message' => 'Not allowed'], 403);
        }

        $post_id = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        if (!$post_id || !current_user_can('edit_post', $post_id)) {
            wp_send_json_error(['message' => 'No permission or invalid post'], 403);
        }

        // Save core meta – same keys you already use
        $fields = [
            'wpcf-first-name',
            'wpcf-last-name',
            'wpcf-job-title',
            'wpcf-email-address',
            'wpcf-mobile-number',
            'wpcf-whatsapp-number',
            'wpcf-work-phone-number',
            'wpcf-profile-type',
            'wpcf-facebook-url',
            'wpcf-twitter-url',
            'wpcf-linkedin-url',
            'wpcf-instagram-user',
            'wpcf-youtube-url',
            'wpcf-tiktok-url',
        ];
        foreach ($fields as $key) {
            if (isset($_POST[$key])) {
                update_post_meta($post_id, $key, sanitize_text_field($_POST[$key]));
            }
        }

        $company_parent = isset($_POST['company_parent']) ? absint($_POST['company_parent']) : 0;
        update_post_meta($post_id, 'company_parent', $company_parent);

        // Featured image (profile picture)
        if (isset($_POST['me_profile_photo_id'])) {
            $photo_id = absint($_POST['me_profile_photo_id']);
            if ($photo_id) {
                set_post_thumbnail($post_id, $photo_id);
            } else {
                delete_post_thumbnail($post_id);
            }
        }

        // Return fresh JSON so JS can refresh preview
        $profile = Preview_Module::get_profile_data($post_id);
        $company_id = $profile['company_parent'] ?? 0;
        $company = $company_id ? Preview_Module::get_company_data($company_id) : [];

        wp_send_json_success([
            'message' => 'Profile saved',
            'profile' => $profile,
            'company' => $company,
        ]);
    }
}

