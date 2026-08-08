<?php
namespace Me\Profile_Editor;

use Me\Preview\Module as Preview_Module;


if (!defined('ABSPATH')) exit;

class Module {

    /** Depth counter for suspend_upgrade_autoassign() / resume_upgrade_autoassign(). */
    private static $autoassign_suspended = 0;

    /**
     * What happened to a Pro request during this save:
     * '' not requested | 'granted' | 'basketed' | 'unavailable'.
     */
    private static $pro_outcome = '';

    /** Why the basket refused the upgrade, when $pro_outcome is 'unavailable'. */
    private static $pro_error = '';

    public static function init() : void {
        add_action('wp_ajax_me_profile_load',            [__CLASS__, 'ajax_profile_load']);
        add_action('wp_ajax_me_save_profile_form',       [__CLASS__, 'ajax_save_profile_form']);
        add_action('wp_ajax_me_profile_create',          [__CLASS__, 'ajax_profile_create']);
        add_action('wp_ajax_me_profile_company_preview', [__CLASS__, 'ajax_company_preview']);
        add_action('wp_ajax_me_profile_add_upgrade',     [__CLASS__, 'ajax_add_upgrade']);
        add_action('wp_ajax_me_profile_remove_upgrade',  [__CLASS__, 'ajax_remove_upgrade']);
        add_action('template_redirect',                  [__CLASS__, 'maybe_handle_upgrade_link']);
    }

    /**
     * Loads a profile for the editor. A post_id of 0 means "adding a new one",
     * in which case a blank skeleton is returned so add and edit share one path.
     */
    public static function ajax_profile_load() : void {
        if (!check_ajax_referer('me-profile-edit-nonce', '_wpnonce', false)) {
            wp_send_json_error(['message' => 'Invalid nonce'], 403);
        }
        if (!is_user_logged_in()) {
            wp_send_json_error(['message' => 'Not allowed'], 403);
        }

        $post_id = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;

        if ($post_id) {
            $post = get_post($post_id);
            if (!$post || $post->post_type !== 'mecard-profile') {
                wp_send_json_error(['message' => 'Invalid profile'], 404);
            }
            $is_owner = (int) $post->post_author === get_current_user_id();
            if (!$is_owner && !current_user_can('edit_post', $post_id)) {
                wp_send_json_error(['message' => 'No permission'], 403);
            }

            // Reuse your existing helpers
            $profile = Preview_Module::get_profile_data($post_id);
        } else {
            $profile = self::blank_profile_data();
        }

        $company_id = $profile['company_parent'] ?? 0;
        $company = $company_id ? Preview_Module::get_company_data($company_id) : [];

        wp_send_json_success([
            'profile'      => $profile,
            'company'      => $company,
            'entitlements' => self::entitlement_state($post_id),
        ]);
    }

    /**
     * Empty profile in the same shape as Preview_Module::get_profile_data(), used
     * when the editor opens in add mode. A new profile starts as Pro when the
     * user has a paid upgrade waiting to be spent.
     */
    protected static function blank_profile_data() : array {
        $has_upgrade = self::available_upgrade_count() > 0;

        return [
            'first'                => '',
            'last'                 => '',
            'job'                  => '',
            'email'                => '',
            'mobile'               => '',
            'wa'                   => '',
            'direct_line'          => '',
            'company_name'         => '',
            'company_logo_id'      => 0,
            'company_logo_url'     => '',
            'type'                 => $has_upgrade ? 'professional' : 'standard',
            'company_parent'       => 0,
            'company_link_enabled' => $has_upgrade,
            'photo_id'             => 0,
            'photo_url'            => '',
            'soc'                  => [
                'facebook'  => '',
                'twitter'   => '',
                'linkedin'  => '',
                'instagram' => '',
                'youtube'   => '',
                'tiktok'    => '',
            ],
        ];
    }

    /**
     * Everything the profile-type radio needs: how many paid upgrades are left,
     * whether this profile is already Pro (and therefore locked), and what the
     * "buy one" call to action should say.
     */
    protected static function entitlement_state(int $post_id) : array {
        $type    = $post_id ? strtolower((string) get_post_meta($post_id, 'wpcf-profile-type', true)) : '';
        $is_pro  = in_array($type, ['pro', 'professional'], true);
        $product = self::upgrade_product_id();

        $price = '';
        if ($product && function_exists('wc_get_product')) {
            $wc_product = wc_get_product($product);
            if ($wc_product && function_exists('wc_price')) {
                // wc_price() returns markup with an entity-encoded currency symbol.
                $price = trim(html_entity_decode(
                    wp_strip_all_tags(wc_price($wc_product->get_price())),
                    ENT_QUOTES,
                    'UTF-8'
                ));
            }
        }

        return [
            'available'        => self::available_upgrade_count(),
            'isPro'            => $is_pro,
            'upgradeProductId' => $product,
            'upgradePrice'     => $price ?: 'R199',
            'upgradeInCart'    => $product ? self::upgrade_in_cart($post_id) : false,
            'basketUrl'        => function_exists('wc_get_cart_url') ? wc_get_cart_url() : '',
            // What happened to a Pro request on this save. The radio follows the
            // user's choice, not the basket, so a failed add is reported rather
            // than silently flipping them back to Standard.
            'proOutcome'       => self::$pro_outcome,
            'proError'         => self::$pro_error,
        ];
    }

    protected static function available_upgrade_count() : int {
        if (!class_exists('\\Me\\Entitlements\\Module')) {
            return 0;
        }
        return \Me\Entitlements\Module::available_pro_upgrade_count(get_current_user_id());
    }

    protected static function upgrade_product_id() : int {
        return defined('MECARD_PROFILE_UPGRADE_PRODUCT_ID') ? (int) MECARD_PROFILE_UPGRADE_PRODUCT_ID : 0;
    }

    /**
     * Cart item key for the Pro upgrade tied to this profile, or '' if there
     * isn't one. Public so the console list can render its own basket state.
     */
    public static function upgrade_cart_item_key(int $post_id) : string {
        if (!function_exists('WC') || !WC()->cart) {
            return '';
        }
        $product = self::upgrade_product_id();
        foreach (WC()->cart->get_cart() as $key => $item) {
            if ((int) ($item['product_id'] ?? 0) !== $product) {
                continue;
            }
            if ((int) ($item['mecard_profile_id'] ?? 0) === $post_id) {
                return (string) $key;
            }
        }
        return '';
    }

    /** Is a Pro upgrade for this profile already in the basket? */
    protected static function upgrade_in_cart(int $post_id) : bool {
        return self::upgrade_cart_item_key($post_id) !== '';
    }

    /**
     * Company details for the live preview, so switching the company picker
     * re-skins the Pro preview without saving first.
     */
    public static function ajax_company_preview() : void {
        if (!check_ajax_referer('me-profile-edit-nonce', '_wpnonce', false)) {
            wp_send_json_error(['message' => 'Invalid nonce'], 403);
        }
        if (!is_user_logged_in()) {
            wp_send_json_error(['message' => 'Not allowed'], 403);
        }

        $company_id = isset($_POST['company_id']) ? absint($_POST['company_id']) : 0;
        if (!$company_id) {
            wp_send_json_success(['company' => []]);
        }

        $company = get_post($company_id);
        if (!$company || $company->post_type !== 'company') {
            wp_send_json_error(['message' => 'Invalid company'], 404);
        }
        $is_owner = (int) $company->post_author === get_current_user_id();
        if (!$is_owner && !current_user_can('edit_post', $company_id)) {
            wp_send_json_error(['message' => 'No permission'], 403);
        }

        wp_send_json_success([
            'company' => Preview_Module::get_company_data($company_id),
        ]);
    }

    /**
     * Put a Pro upgrade for this profile in the basket, unless one is there
     * already. Records why it failed so the editor can say so instead of
     * quietly dropping the user back to Standard.
     */
    protected static function add_upgrade_to_basket(int $post_id) : bool {
        $product = self::upgrade_product_id();

        if ($product <= 0) {
            self::$pro_error = 'The Pro upgrade product is not configured.';
            return false;
        }
        if (!function_exists('WC') || !WC()->cart) {
            self::$pro_error = 'The basket is not available right now.';
            return false;
        }
        if (self::upgrade_in_cart($post_id)) {
            return true;
        }

        $added = WC()->cart->add_to_cart($product, 1, 0, [], ['mecard_profile_id' => $post_id]);
        if ($added) {
            self::persist_cart();
            return true;
        }

        // WooCommerce explains refusals through notices (not purchasable, out of
        // stock, blocked by a validation filter, ...). Surface the first one.
        if (function_exists('wc_get_notices')) {
            foreach ((array) wc_get_notices('error') as $notice) {
                $text = is_array($notice) ? ($notice['notice'] ?? '') : (string) $notice;
                $text = trim(wp_strip_all_tags($text));
                if ($text !== '') {
                    self::$pro_error = $text;
                    break;
                }
            }
            wc_clear_notices();
        }

        if (self::$pro_error === '') {
            self::$pro_error = 'The basket would not accept the Pro upgrade.';
        }

        error_log(sprintf(
            '[MeCard] Pro upgrade (product %d) could not be added to the basket for profile %d: %s',
            $product,
            $post_id,
            self::$pro_error
        ));

        return false;
    }

    /** Drop an unpaid Pro upgrade for this profile back out of the basket. */
    protected static function remove_upgrade_from_basket(int $post_id) : void {
        $key = self::upgrade_cart_item_key($post_id);
        if ($key !== '' && function_exists('WC') && WC()->cart) {
            WC()->cart->remove_cart_item($key);
            self::persist_cart();
        }
    }

    /**
     * Write the cart to the session now rather than waiting for shutdown.
     *
     * The editor re-fetches the profiles list the moment the save response
     * lands, which can beat WooCommerce's shutdown handler and render the list
     * from a cart that doesn't yet contain the upgrade.
     */
    protected static function persist_cart() : void {
        if (!function_exists('WC')) {
            return;
        }
        if (WC()->cart && method_exists(WC()->cart, 'set_session')) {
            WC()->cart->set_session();
        }
        if (WC()->session && method_exists(WC()->session, 'save_data')) {
            WC()->session->save_data();
        }
    }

    /**
     * Nonce-protected link that puts a Pro upgrade for $profile_id in the basket
     * and returns to the current page. Used by the console list's upgrade button.
     */
    public static function upgrade_add_url(int $profile_id) : string {
        $url = add_query_arg(
            'mecard_add_upgrade',
            $profile_id,
            remove_query_arg(['mecard_add_upgrade', '_wpnonce'])
        );

        return wp_nonce_url($url, 'mecard-add-upgrade-' . $profile_id);
    }

    /**
     * WooCommerce cart fragments, so the theme's menu basket widget updates
     * without a page reload. Astra hooks woocommerce_add_to_cart_fragments to
     * return 'a.cart-container' and 'div.widget_shopping_cart_content'.
     */
    protected static function cart_fragments() : array {
        if (!function_exists('WC') || !WC()->cart || !function_exists('woocommerce_mini_cart')) {
            return ['fragments' => [], 'cart_hash' => ''];
        }

        // The mini cart renders from the totals, so make sure they're current.
        WC()->cart->calculate_totals();

        ob_start();
        woocommerce_mini_cart();
        $mini_cart = ob_get_clean();

        return [
            'fragments' => apply_filters('woocommerce_add_to_cart_fragments', [
                'div.widget_shopping_cart_content' => '<div class="widget_shopping_cart_content">' . $mini_cart . '</div>',
            ]),
            'cart_hash' => WC()->cart->get_cart_hash(),
        ];
    }

    /** Guard shared by the upgrade add/remove AJAX endpoints. */
    protected static function verify_upgrade_request() : int {
        if (!check_ajax_referer('me-profile-edit-nonce', '_wpnonce', false)) {
            wp_send_json_error(['message' => 'Invalid nonce'], 403);
        }
        if (!is_user_logged_in()) {
            wp_send_json_error(['message' => 'Not allowed'], 403);
        }

        $post_id  = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        $post     = $post_id ? get_post($post_id) : null;
        $is_owner = $post && (int) $post->post_author === get_current_user_id();

        if (!$post || $post->post_type !== 'mecard-profile' || (!$is_owner && !current_user_can('edit_post', $post_id))) {
            wp_send_json_error(['message' => 'No permission or invalid post'], 403);
        }

        return $post_id;
    }

    /** Console list: add the Pro upgrade without a page reload. */
    public static function ajax_add_upgrade() : void {
        $post_id = self::verify_upgrade_request();

        self::$pro_error = '';
        if (!self::add_upgrade_to_basket($post_id)) {
            wp_send_json_error([
                'message' => self::$pro_error ?: 'Could not add the Pro upgrade to your basket.',
            ], 500);
        }

        $key = self::upgrade_cart_item_key($post_id);

        wp_send_json_success(array_merge([
            'inCart'      => true,
            'cartItemKey' => $key,
            'removeUrl'   => ($key && function_exists('wc_get_cart_remove_url')) ? wc_get_cart_remove_url($key) : '',
        ], self::cart_fragments()));
    }

    /** Console list: take the Pro upgrade back out without a page reload. */
    public static function ajax_remove_upgrade() : void {
        $post_id = self::verify_upgrade_request();

        self::remove_upgrade_from_basket($post_id);

        wp_send_json_success(array_merge([
            'inCart' => false,
            'addUrl' => self::upgrade_add_url($post_id),
        ], self::cart_fragments()));
    }

    public static function maybe_handle_upgrade_link() : void {
        if (empty($_GET['mecard_add_upgrade'])) {
            return;
        }

        $profile_id = absint($_GET['mecard_add_upgrade']);
        $nonce      = isset($_GET['_wpnonce']) ? sanitize_text_field(wp_unslash($_GET['_wpnonce'])) : '';

        if (!$profile_id || !is_user_logged_in() || !wp_verify_nonce($nonce, 'mecard-add-upgrade-' . $profile_id)) {
            wp_die('This upgrade link has expired. Please go back and try again.');
        }

        $post     = get_post($profile_id);
        $is_owner = $post && (int) $post->post_author === get_current_user_id();
        if (!$post || $post->post_type !== 'mecard-profile' || (!$is_owner && !current_user_can('edit_post', $profile_id))) {
            wp_die('You do not have permission to upgrade this profile.');
        }

        self::add_upgrade_to_basket($profile_id);

        wp_safe_redirect(remove_query_arg(['mecard_add_upgrade', '_wpnonce']));
        exit;
    }

    /**
     * Create a brand new mecard-profile from the shared editor form.
     *
     * Replaces the Toolset "Add MeCard Profile" CRED form so adding and editing
     * both run through the same markup and the same save routine.
     */
    public static function ajax_profile_create() : void {
        if (!check_ajax_referer('me-profile-edit-nonce', '_wpnonce', false)) {
            wp_send_json_error(['message' => 'Invalid nonce'], 403);
        }
        if (!is_user_logged_in()) {
            wp_send_json_error(['message' => 'Not allowed'], 403);
        }

        $user_id = get_current_user_id();

        $first = isset($_POST['wpcf-first-name']) ? sanitize_text_field($_POST['wpcf-first-name']) : '';
        $last  = isset($_POST['wpcf-last-name'])  ? sanitize_text_field($_POST['wpcf-last-name'])  : '';
        if ($first === '') {
            wp_send_json_error(['message' => 'Please enter a first name for this profile.'], 400);
        }

        // The profile is born Standard; going Pro is decided by the form and paid
        // for out of an upgrade entitlement (see apply_requested_profile_type).
        self::suspend_upgrade_autoassign();
        $post_id = wp_insert_post([
            'post_type'   => 'mecard-profile',
            'post_status' => 'publish',
            'post_title'  => trim($first . ' ' . $last),
            'post_author' => $user_id,
            'meta_input'  => [
                'me_profile_owner_user_id' => $user_id,
                'wpcf-profile-type'        => 'standard',
            ],
        ], true);
        self::resume_upgrade_autoassign();

        if (is_wp_error($post_id) || !$post_id) {
            wp_send_json_error(['message' => 'Could not create the profile.'], 500);
        }

        $post_id = (int) $post_id;

        self::save_profile_meta($post_id);

        // first_profile_created is normally flagged on save_post_mecard-profile,
        // but that hook skips AJAX requests, so flag the team route here.
        if (!get_user_meta($user_id, '_mecard_conv_fired', true)) {
            update_user_meta($user_id, '_mecard_conv_pending', 'team');
        }

        $profile    = Preview_Module::get_profile_data($post_id);
        $company_id = $profile['company_parent'] ?? 0;
        $company    = $company_id ? Preview_Module::get_company_data($company_id) : [];

        wp_send_json_success(array_merge([
            'message'      => 'Profile created',
            'post_id'      => $post_id,
            'profile'      => $profile,
            'company'      => $company,
            'entitlements' => self::entitlement_state($post_id),
        ], self::cart_fragments()));
    }

    public static function ajax_save_profile_form() : void {
        if (!check_ajax_referer('me-profile-edit-nonce', '_wpnonce', false)) {
            wp_send_json_error(['message' => 'Invalid nonce'], 403);
        }
        if (!is_user_logged_in()) {
            wp_send_json_error(['message' => 'Not allowed'], 403);
        }

        $post_id = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        if (!$post_id) {
            wp_send_json_error(['message' => 'No permission or invalid post'], 403);
        }
        $save_post = get_post($post_id);
        $is_owner  = $save_post && (int) $save_post->post_author === get_current_user_id();
        if (!$is_owner && !current_user_can('edit_post', $post_id)) {
            wp_send_json_error(['message' => 'No permission or invalid post'], 403);
        }

        self::save_profile_meta($post_id);

        // Return fresh JSON so JS can refresh preview
        $profile = Preview_Module::get_profile_data($post_id);
        $company_id = $profile['company_parent'] ?? 0;
        $company = $company_id ? Preview_Module::get_company_data($company_id) : [];

        wp_send_json_success(array_merge([
            'message'      => 'Profile saved',
            'profile'      => $profile,
            'company'      => $company,
            'entitlements' => self::entitlement_state($post_id),
        ], self::cart_fragments()));
    }

    /**
     * Write the posted editor form onto a profile. Shared by create and save.
     * Assumes the caller has already checked the nonce and permissions.
     */
    protected static function save_profile_meta(int $post_id) : void {
        self::suspend_upgrade_autoassign();

        // Save core meta – same keys you already use.
        // wpcf-profile-type is deliberately absent: Pro is granted by spending an
        // upgrade entitlement, not by whatever the form posted.
        $fields = [
            'wpcf-first-name',
            'wpcf-last-name',
            'wpcf-job-title',
            'wpcf-email-address',
            'wpcf-mobile-number',
            'wpcf-whatsapp-number',
            'wpcf-work-phone-number',
            'wpcf-company-r',
            'wpcf-company_name',
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

        // Only touch the company link when the picker was actually on the form.
        // Standard profiles show a plain company-name text box instead, and a
        // missing field must not be read as "detach the company".
        $company_posted = isset($_POST['company_parent']);
        $company_parent = 0;

        if ($company_posted) {
            $requested = sanitize_text_field($_POST['company_parent']);

            if ($requested === 'new') {
                // The user named a company that doesn't exist yet. Nothing in the
                // editor could create one before — both company save handlers
                // require an existing ID — so make it here.
                $new_name = isset($_POST['me_new_company_name'])
                    ? sanitize_text_field($_POST['me_new_company_name'])
                    : '';
                $company_parent = $new_name !== '' ? self::create_company($new_name) : 0;
            } else {
                $company_parent = absint($requested);
            }

            update_post_meta($post_id, 'company_parent', $company_parent);
        }

        // Keep Toolset relationship in sync with the post meta value
        if ($company_posted && function_exists('toolset_get_related_posts')) {
            $existing_parents = toolset_get_related_posts(
                $post_id,
                'company-mecard-profile',
                [
                    'query_by_role'  => 'child',
                    'role_to_return' => 'parent',
                    'limit'          => 1,
                ]
            );
            $old_company = !empty($existing_parents)
                ? (is_object(reset($existing_parents)) ? (int) reset($existing_parents)->ID : (int) reset($existing_parents))
                : 0;

            // Disconnect old relationship first (required before connecting a new one)
            if ($old_company && $old_company !== $company_parent && function_exists('toolset_disconnect_posts')) {
                toolset_disconnect_posts('company-mecard-profile', $old_company, $post_id);
            }

            // Connect new company
            if ($company_parent && $company_parent !== $old_company && function_exists('toolset_connect_posts')) {
                toolset_connect_posts('company-mecard-profile', $company_parent, $post_id);
            }
        }

        // Featured image (profile picture) — only update when a valid attachment ID is supplied.
        // An empty/zero value means the user did not change the photo, so leave it alone.
        if ( ! empty( $_POST['me_profile_photo_id'] ) ) {
            $photo_id = absint( $_POST['me_profile_photo_id'] );
            if ( $photo_id ) {
                set_post_thumbnail( $post_id, $photo_id );
            }
        }

        if ( isset( $_POST['me_profile_company_logo_id'] ) ) {
            $company_logo_id = absint( $_POST['me_profile_company_logo_id'] );
            if ( $company_logo_id ) {
                update_post_meta( $post_id, 'me_profile_company_logo_id', $company_logo_id );
            } else {
                delete_post_meta( $post_id, 'me_profile_company_logo_id' );
            }
        }

        // Keep the post title in step with the name, the way the Toolset forms did.
        $first = isset($_POST['wpcf-first-name']) ? sanitize_text_field($_POST['wpcf-first-name']) : '';
        $last  = isset($_POST['wpcf-last-name'])  ? sanitize_text_field($_POST['wpcf-last-name'])  : '';
        $title = trim($first . ' ' . $last);
        if ($title !== '' && $title !== get_the_title($post_id)) {
            wp_update_post([
                'ID'         => $post_id,
                'post_title' => $title,
            ]);
        }

        self::resume_upgrade_autoassign();

        self::apply_requested_profile_type($post_id);
    }

    /**
     * Create a company owned by the current user. Mirrors
     * Single_Editor\Module::create_company_for_profile(); branding is filled in
     * afterwards via the "Edit company design" button.
     */
    protected static function create_company(string $name) : int {
        $company_id = wp_insert_post([
            'post_type'   => 'company',
            'post_status' => 'publish',
            'post_author' => get_current_user_id(),
            'post_title'  => $name,
        ], true);

        return is_wp_error($company_id) ? 0 : (int) $company_id;
    }

    /**
     * Honour the Standard / Pro radio.
     *
     * Pro is only ever granted by spending a paid upgrade entitlement, and once a
     * profile is Pro this form will not take it back — releasing a consumed
     * upgrade is a refund decision, not an edit.
     */
    protected static function apply_requested_profile_type(int $post_id) : void {
        self::$pro_outcome = '';
        self::$pro_error   = '';

        $current = strtolower((string) get_post_meta($post_id, 'wpcf-profile-type', true));
        if (in_array($current, ['pro', 'professional'], true)) {
            self::$pro_outcome = 'granted';
            return;
        }

        $requested = isset($_POST['wpcf-profile-type'])
            ? strtolower(sanitize_text_field($_POST['wpcf-profile-type']))
            : '';

        if (!in_array($requested, ['pro', 'professional'], true)) {
            if ($current === '') {
                update_post_meta($post_id, 'wpcf-profile-type', 'standard');
            }
            // Backing out of Pro should not leave an unpaid upgrade in the basket.
            self::remove_upgrade_from_basket($post_id);
            return;
        }

        if (class_exists('\\Me\\Entitlements\\Module')) {
            $owner = (int) get_post_meta($post_id, 'me_profile_owner_user_id', true);
            if ($owner <= 0) {
                $owner = (int) get_post_field('post_author', $post_id);
            }
            // Consumes one paid_unassigned pro_upgrade row and flips the meta to
            // "professional". Does nothing when the user has none left.
            \Me\Entitlements\Module::assign_available_entitlements_for_profile($post_id, $owner);
        }

        $after = strtolower((string) get_post_meta($post_id, 'wpcf-profile-type', true));
        if (in_array($after, ['pro', 'professional'], true)) {
            self::$pro_outcome = 'granted';
            return;
        }

        // Nothing to spend — the profile stays Standard and the R199 upgrade goes
        // into the basket. Checkout consumes it and flips the profile to Pro.
        update_post_meta($post_id, 'wpcf-profile-type', 'standard');
        self::$pro_outcome = self::add_upgrade_to_basket($post_id) ? 'basketed' : 'unavailable';
    }

    /**
     * Entitlements auto-assigns any spare upgrade on every profile save. That
     * would override the radio, so it is muted while this editor writes and the
     * assignment is made explicitly instead.
     */
    protected static function suspend_upgrade_autoassign() : void {
        if (self::$autoassign_suspended === 0 && class_exists('\\Me\\Entitlements\\Module')) {
            remove_action('save_post_mecard-profile', ['Me\\Entitlements\\Module', 'maybe_assign_on_profile_save'], 20);
        }
        self::$autoassign_suspended++;
    }

    protected static function resume_upgrade_autoassign() : void {
        self::$autoassign_suspended = max(0, self::$autoassign_suspended - 1);
        if (self::$autoassign_suspended === 0 && class_exists('\\Me\\Entitlements\\Module')) {
            add_action('save_post_mecard-profile', ['Me\\Entitlements\\Module', 'maybe_assign_on_profile_save'], 20, 3);
        }
    }
}

