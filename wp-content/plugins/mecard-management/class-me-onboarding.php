<?php
namespace Me\Onboarding;

use Me\Single_Manage\Module as Single_Manage_Module;

if (!defined('ABSPATH')) {
    exit;
}

class Module {
    private const STEP_ORDER = [
        'basics',
        'contact',
        'preview',
        'install',
        'ready',
        'card',
        'pro',
    ];

    public static function init(): void {
        add_shortcode('me_onboarding', [__CLASS__, 'render_onboarding_shortcode']);
        add_shortcode('me_signup', [__CLASS__, 'render_signup_shortcode']);
        add_shortcode('me_signup_email', [__CLASS__, 'render_signup_email_shortcode']);
        add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue_assets']);
        add_action('template_redirect', [__CLASS__, 'maybe_redirect_existing_users']);
        add_action('wp_ajax_me_onboarding_bootstrap', [__CLASS__, 'ajax_bootstrap']);
        add_action('wp_ajax_me_onboarding_save_step', [__CLASS__, 'ajax_save_step']);
        add_action('wp_ajax_me_onboarding_classic_card_cart', [__CLASS__, 'ajax_classic_card_cart']);
        add_action('wp_ajax_me_send_profile_link', [__CLASS__, 'ajax_send_profile_link']);
        add_filter('ajax_query_attachments_args', [__CLASS__, 'filter_onboarding_media_query']);
    }

    public static function render_onboarding_shortcode($atts = []): string {
        if (!is_user_logged_in()) {
            $signup_url = self::get_signup_url();
            return '<div class="me-onboarding-login"><p>Please sign up or log in before starting your MeCard onboarding.</p><p><a class="me-onboarding-link" href="' . esc_url($signup_url) . '">Go to sign up</a></p></div>';
        }

        if (!self::current_user_can_use_onboarding()) {
            $dashboard_url = self::get_dashboard_url();
            return '<div class="me-onboarding-login"><p>Your account already has MeCard data, so you will manage it from the dashboard.</p><p><a class="me-onboarding-link" href="' . esc_url($dashboard_url) . '">Go to dashboard</a></p></div>';
        }

        ob_start();
        $template = ME_PLUGIN_DIR . 'templates/onboarding-shell.php';
        if (file_exists($template)) {
            include $template;
        }
        return (string) ob_get_clean();
    }

    public static function render_signup_shortcode($atts = []): string {
        if (!is_user_logged_in()) {
            return self::render_signup_entry();
        }

        if (!self::current_user_can_use_onboarding()) {
            $dashboard_url = self::get_dashboard_url();
            return '<div class="me-onboarding-login"><p>Your account already has MeCard data, so you will manage it from the dashboard.</p><p><a class="me-onboarding-link" href="' . esc_url($dashboard_url) . '">Go to dashboard</a></p></div>';
        }

        return self::render_onboarding_shortcode($atts);
    }

    public static function render_signup_email_shortcode($atts = []): string {
        if (is_user_logged_in()) {
            if (!self::current_user_can_use_onboarding()) {
                $dashboard_url = self::get_dashboard_url();
                return '<div class="me-onboarding-login"><p>Your account already has MeCard data, so you will manage it from the dashboard.</p><p><a class="me-onboarding-link" href="' . esc_url($dashboard_url) . '">Go to dashboard</a></p></div>';
            }

            return self::render_onboarding_shortcode($atts);
        }

        return self::render_signup_email_entry();
    }

    private static function render_signup_entry(): string {
        $login_url = wp_login_url(get_permalink());
        $google_button = do_shortcode('[nextend_social_login provider="google" redirect="current" align="left" customlabel="Continue with {{providerName}}"]');
        $email_signup_url = self::get_signup_email_url();

        if ($google_button === '') {
            $google_button = '<a class="me-auth-fallback-button" href="' . esc_url($login_url) . '">Continue with Google</a>';
        }

        return '
        <div class="me-auth-entry">
          <div class="me-auth-card me-auth-card--single">
            <p class="me-auth-entry__eyebrow">Step 1</p>
            <h2 class="me-auth-entry__title">Create your MeCard Profile</h2>
            <p class="me-auth-card__text">Create your free shareable profile in seconds, then add it to your home screen for instant sharing.</p>
            <div class="me-auth-screen__nsl">' . $google_button . '</div>
            <div class="me-auth-divider"><span>or</span></div>
            <a class="me-auth-email-link" href="' . esc_url($email_signup_url) . '">
              <span class="me-auth-email-link__icon">@</span>
              <span>Sign up with email</span>
            </a>
            <p class="me-auth-screen__footer">Already have an account? <a href="' . esc_url($login_url) . '">Log in</a></p>
            ' . self::render_signup_features() . '
          </div>
          ' . self::render_progress_tracker('signup') . '
        </div>';
    }

    private static function render_signup_email_entry(): string {
        $errors = [];
        $values = [
            'first_name' => '',
            'last_name'  => '',
            'email'      => '',
            'mobile'     => '',
        ];

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['me_email_signup_nonce'])) {
            if (!wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['me_email_signup_nonce'])), 'me_email_signup')) {
                $errors[] = 'Your session expired. Please try again.';
            } else {
                // Honeypot: bots fill hidden fields, humans don't.
                $honeypot = isset($_POST['me_website']) ? sanitize_text_field(wp_unslash($_POST['me_website'])) : '';
                if ($honeypot !== '') {
                    // Silently succeed to avoid tipping off bots.
                    wp_safe_redirect(self::get_signup_url());
                    exit;
                }

                // Time check: reject if submitted in under 3 seconds.
                $form_time = isset($_POST['me_form_time']) ? absint($_POST['me_form_time']) : 0;
                if ($form_time > 0 && (time() - $form_time) < 3) {
                    wp_safe_redirect(self::get_signup_url());
                    exit;
                }

                // reCAPTCHA Enterprise score check.
                $recaptcha_token = sanitize_text_field(wp_unslash($_POST['me_recaptcha_token'] ?? ''));
                if (defined('MECARD_RECAPTCHA_SITE_KEY') && MECARD_RECAPTCHA_SITE_KEY) {
                    if (!self::verify_recaptcha_token($recaptcha_token)) {
                        wp_safe_redirect(self::get_signup_url());
                        exit;
                    }
                }

                $values['first_name'] = sanitize_text_field(wp_unslash($_POST['first_name'] ?? ''));
                $values['last_name']  = sanitize_text_field(wp_unslash($_POST['last_name'] ?? ''));
                $values['email']      = sanitize_email(wp_unslash($_POST['email'] ?? ''));
                $values['mobile']     = sanitize_text_field(wp_unslash($_POST['mobile'] ?? ''));
                $password             = wp_unslash($_POST['me_password'] ?? '');

                if ($values['first_name'] === '') {
                    $errors[] = 'First name is required.';
                }
                if ($values['last_name'] === '') {
                    $errors[] = 'Last name is required.';
                }
                if ($values['email'] === '' || !is_email($values['email'])) {
                    $errors[] = 'A valid email address is required.';
                }
                if ($values['mobile'] === '') {
                    $errors[] = 'Mobile number is required.';
                }
                if (strlen($password) < 8) {
                    $errors[] = 'Password must be at least 8 characters.';
                }
                if ($values['email'] !== '' && email_exists($values['email'])) {
                    $errors[] = 'An account with that email already exists. Please log in instead.';
                }

                if (empty($errors)) {
                    $user_login = sanitize_user(current(explode('@', $values['email'])), true);
                    if ($user_login === '') {
                        $user_login = 'mecarduser';
                    }
                    $base_login = $user_login;
                    $suffix = 1;
                    while (username_exists($user_login)) {
                        $suffix++;
                        $user_login = $base_login . $suffix;
                    }

                    $user_id = wp_create_user($user_login, $password, $values['email']);

                    if (is_wp_error($user_id)) {
                        $errors[] = $user_id->get_error_message();
                    } else {
                        wp_update_user([
                            'ID'           => $user_id,
                            'display_name' => trim($values['first_name'] . ' ' . $values['last_name']),
                            'first_name'   => $values['first_name'],
                            'last_name'    => $values['last_name'],
                        ]);

                        update_user_meta($user_id, 'first_name', $values['first_name']);
                        update_user_meta($user_id, 'last_name', $values['last_name']);
                        update_user_meta($user_id, 'wpcf-mobile-number', $values['mobile']);

                        wp_set_current_user($user_id);
                        wp_set_auth_cookie($user_id, true);

                        wp_safe_redirect(self::get_signup_url());
                        exit;
                    }
                }
            }
        }

        $login_url = wp_login_url(self::get_signup_url());
        $error_html = '';
        if (!empty($errors)) {
            $items = '';
            foreach ($errors as $error) {
                $items .= '<li>' . esc_html($error) . '</li>';
            }
            $error_html = '<div class="me-auth-error"><ul>' . $items . '</ul></div>';
        }

        return '
        <div class="me-auth-entry">
          <div class="me-auth-card me-auth-card--single">
            <p class="me-auth-entry__eyebrow">Step 1</p>
            <h2 class="me-auth-entry__title">Create your MeCard Profile</h2>
            <p class="me-auth-card__text">Start with the basics here and we will carry them into your free profile.</p>
            ' . $error_html . '
            <form class="me-auth-form" method="post" id="me-signup-form">
              <label>First name
                <input type="text" name="first_name" value="' . esc_attr($values['first_name']) . '" autocomplete="given-name" required>
              </label>
              <label>Last name
                <input type="text" name="last_name" value="' . esc_attr($values['last_name']) . '" autocomplete="family-name" required>
              </label>
              <label>Email address
                <input type="email" name="email" value="' . esc_attr($values['email']) . '" autocomplete="email" required>
              </label>
              <label>Mobile number
                <input type="text" name="mobile" value="' . esc_attr($values['mobile']) . '" autocomplete="tel" required>
              </label>
              <label>Password <span class="me-step__optional">to log back in later</span>
                <input type="password" name="me_password" autocomplete="new-password" minlength="8" required>
              </label>
              <input type="text" name="me_website" value="" autocomplete="off" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;">
              <input type="hidden" name="me_form_time" value="' . esc_attr((string) time()) . '">
              <input type="hidden" name="me_recaptcha_token" id="me_recaptcha_token" value="">
              ' . wp_nonce_field('me_email_signup', 'me_email_signup_nonce', true, false) . '
              <button class="me-auth-form__submit" type="submit">Create my free profile</button>
            </form>
            ' . self::render_recaptcha_script() . '
            <p class="me-auth-screen__footer">Already have an account? <a href="' . esc_url($login_url) . '">Log in</a></p>
            ' . self::render_signup_features() . '
            <div class="me-auth-card__actions">
              <a class="me-auth-back-anchor" href="' . esc_url(self::get_signup_url()) . '">Back to social sign up</a>
            </div>
          </div>
          ' . self::render_progress_tracker('signup') . '
        </div>';
    }

    private static function is_local_env(): bool {
        $host = isset($_SERVER['HTTP_HOST']) ? strtolower((string) $_SERVER['HTTP_HOST']) : '';
        return in_array($host, ['localhost', '127.0.0.1', '::1'], true)
            || str_starts_with($host, 'localhost:');
    }

    private static function render_recaptcha_script(): string {
        if (!defined('MECARD_RECAPTCHA_SITE_KEY') || !MECARD_RECAPTCHA_SITE_KEY || self::is_local_env()) {
            return '';
        }
        $site_key = esc_js(MECARD_RECAPTCHA_SITE_KEY);
        return '<script>
(function() {
  var form = document.getElementById("me-signup-form");
  if (!form) return;
  form.addEventListener("submit", function(e) {
    if (document.getElementById("me_recaptcha_token").value !== "") return;
    e.preventDefault();
    grecaptcha.enterprise.ready(function() {
      grecaptcha.enterprise.execute("' . $site_key . '", {action: "SIGNUP"}).then(function(token) {
        document.getElementById("me_recaptcha_token").value = token;
        form.submit();
      });
    });
  });
})();
</script>';
    }

    private static function verify_recaptcha_token(string $token): bool {
        if (
            self::is_local_env() ||
            !defined('MECARD_RECAPTCHA_SITE_KEY') || !MECARD_RECAPTCHA_SITE_KEY ||
            !defined('MECARD_RECAPTCHA_API_KEY')  || !MECARD_RECAPTCHA_API_KEY  ||
            !defined('MECARD_RECAPTCHA_PROJECT')   || !MECARD_RECAPTCHA_PROJECT
        ) {
            return true; // skip on localhost or when keys not configured
        }

        if ($token === '') {
            return false;
        }

        $url = 'https://recaptchaenterprise.googleapis.com/v1/projects/' . rawurlencode(MECARD_RECAPTCHA_PROJECT) . '/assessments?key=' . rawurlencode(MECARD_RECAPTCHA_API_KEY);

        $response = wp_remote_post($url, [
            'headers' => ['Content-Type' => 'application/json'],
            'body'    => wp_json_encode([
                'event' => [
                    'token'          => $token,
                    'siteKey'        => MECARD_RECAPTCHA_SITE_KEY,
                    'expectedAction' => 'SIGNUP',
                ],
            ]),
            'timeout' => 10,
        ]);

        if (is_wp_error($response)) {
            return false;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($body)) {
            return false;
        }

        $valid  = isset($body['tokenProperties']['valid']) && $body['tokenProperties']['valid'] === true;
        $action = isset($body['tokenProperties']['action']) && $body['tokenProperties']['action'] === 'SIGNUP';
        $score  = isset($body['riskAnalysis']['score']) ? (float) $body['riskAnalysis']['score'] : 0.0;

        return $valid && $action && $score >= 0.5;
    }

    public static function enqueue_assets(): void {
        if (is_admin() || !is_singular()) {
            return;
        }

        global $post;
        if (
            !$post instanceof \WP_Post
            || (!has_shortcode($post->post_content, 'me_onboarding') && !has_shortcode($post->post_content, 'me_signup') && !has_shortcode($post->post_content, 'me_signup_email'))
        ) {
            return;
        }

        wp_enqueue_media();

        if (defined('MECARD_RECAPTCHA_SITE_KEY') && MECARD_RECAPTCHA_SITE_KEY && !self::is_local_env()) {
            wp_enqueue_script(
                'recaptcha-enterprise',
                'https://www.google.com/recaptcha/enterprise.js?render=' . urlencode(MECARD_RECAPTCHA_SITE_KEY),
                [],
                null,
                false
            );
        }

        wp_enqueue_style(
            'me-onboarding',
            plugin_dir_url(__FILE__) . 'css/me-onboarding.css',
            [],
            filemtime(plugin_dir_path(__FILE__) . 'css/me-onboarding.css')
        );

        wp_enqueue_script(
            'me-onboarding',
            plugin_dir_url(__FILE__) . 'js/me-onboarding.js',
            [],
            filemtime(plugin_dir_path(__FILE__) . 'js/me-onboarding.js'),
            true
        );

        wp_localize_script('me-onboarding', 'MECARD_ONBOARDING', [
            'ajaxurl'              => admin_url('admin-ajax.php'),
            'nonce'                => wp_create_nonce('me-onboarding-nonce'),
            'steps'                => self::get_steps(),
            'siteUrl'              => site_url('/'),
            'basketUrl'            => wc_get_cart_url(),
            'manageUrl'            => self::get_dashboard_url(),
            'manageCardsUrl'       => site_url('/manage/cards/'),
            'editProfileUrl'       => site_url('/manage/profile/'),
            'installGifUrl'        => plugin_dir_url(__FILE__) . 'images/add-to-home.gif',
            'launchDemoUrl'        => plugin_dir_url(__FILE__) . 'images/launchdemo.gif',
            'standardProfileImageUrl' => plugin_dir_url(__FILE__) . 'images/alessio-standard-profile-phone.png',
            'proProfileImageUrl'      => plugin_dir_url(__FILE__) . 'images/alessio-pro-profile.png',
            'currentUserId'        => get_current_user_id(),
            'currentUserEmail'     => wp_get_current_user()->user_email,
            'classicCardProductId' => defined('MECARD_CLASSIC_PRODUCT_ID') ? (int) MECARD_CLASSIC_PRODUCT_ID : 0,
            'customCardProductId'  => defined('MECARD_PRODUCT_ID') ? (int) MECARD_PRODUCT_ID : 0,
            'customBundleImageUrl' => plugin_dir_url(__FILE__) . 'images/custom_bundle_new.png',
        ]);
    }

    public static function ajax_bootstrap(): void {
        self::guard_request();

        if (!self::current_user_can_use_onboarding()) {
            wp_send_json_error([
                'message'      => 'This account should use the dashboard instead of first-time onboarding.',
                'redirect_url' => self::get_dashboard_url(),
            ], 409);
        }

        $profile_id = self::ensure_current_user_profile();
        $profile    = self::get_profile_payload($profile_id);
        if (self::is_local_test_user(get_current_user_id())) {
            $profile['onboardingStage'] = 'basics';
        }

        wp_send_json_success([
            'profileId' => $profile_id,
            'profile'   => $profile,
            'shareUrl'  => get_permalink($profile_id),
            'steps'     => self::get_steps(),
            'classicCardCart' => self::get_classic_card_cart_state(),
        ]);
    }

    public static function ajax_save_step(): void {
        self::guard_request();

        if (!self::current_user_can_use_onboarding()) {
            wp_send_json_error([
                'message'      => 'This account should use the dashboard instead of first-time onboarding.',
                'redirect_url' => self::get_dashboard_url(),
            ], 409);
        }

        $profile_id = isset($_POST['profile_id']) ? absint($_POST['profile_id']) : 0;
        $step       = isset($_POST['step']) ? sanitize_key(wp_unslash($_POST['step'])) : '';

        if (!$profile_id || get_post_type($profile_id) !== 'mecard-profile') {
            wp_send_json_error(['message' => 'Invalid profile.'], 400);
        }

        $post = get_post($profile_id);
        if (!$post || ((int) $post->post_author !== get_current_user_id() && !current_user_can('edit_post', $profile_id))) {
            wp_send_json_error(['message' => 'Not allowed.'], 403);
        }

        $step_fields = [
            'basics' => [
                'wpcf-first-name'         => 'text',
                'wpcf-last-name'          => 'text',
                'wpcf-email-address'      => 'email',
                'wpcf-mobile-number'      => 'text',
                'me_profile_photo_id'     => 'absint',
            ],
            'contact' => [
                'wpcf-job-title'          => 'text',
                'wpcf-company-r'          => 'text',
                'wpcf-company_name'       => 'text',
                'me_profile_company_logo_id' => 'absint',
                'wpcf-linkedin-url'       => 'url',
            ],
            'pro' => [
                'wpcf-whatsapp-number'    => 'text',
                'wpcf-work-phone-number'  => 'text',
            ],
        ];

        if (isset($step_fields[$step])) {
            foreach ($step_fields[$step] as $meta_key => $type) {
                if (!isset($_POST[$meta_key])) {
                    continue;
                }

                $value = self::sanitize_request_value($type, wp_unslash($_POST[$meta_key]));

                if ($meta_key === 'me_profile_photo_id') {
                    if ($value > 0) {
                        set_post_thumbnail($profile_id, $value);
                    }
                    continue;
                }

                if ($meta_key === 'me_profile_company_logo_id') {
                    if ($value > 0) {
                        update_post_meta($profile_id, 'me_profile_company_logo_id', $value);
                    } else {
                        delete_post_meta($profile_id, 'me_profile_company_logo_id');
                    }
                    continue;
                }

                update_post_meta($profile_id, $meta_key, $value);
            }
        }

        if ($step === 'basics') {
            update_post_meta($profile_id, 'me_onboarding_stage', 'contact');
        } elseif ($step === 'contact') {
            update_post_meta($profile_id, 'me_onboarding_stage', 'preview');
        } elseif ($step === 'preview') {
            update_post_meta($profile_id, 'me_onboarding_stage', 'install');
        } elseif ($step === 'install') {
            $install_status = isset($_POST['install_status']) ? sanitize_key(wp_unslash($_POST['install_status'])) : 'done';
            $install_skipped = $install_status === 'skipped' ? 1 : 0;
            update_post_meta($profile_id, 'me_onboarding_install_done', $install_skipped ? 0 : 1);
            update_post_meta($profile_id, 'me_onboarding_install_skipped', $install_skipped);
            update_post_meta($profile_id, 'me_onboarding_stage', 'ready');
            update_post_meta($profile_id, 'me_onboarding_completed', 1);
        } elseif ($step === 'ready') {
            update_post_meta($profile_id, 'me_onboarding_stage', 'ready');
        }

        $first = (string) get_post_meta($profile_id, 'wpcf-first-name', true);
        $last  = (string) get_post_meta($profile_id, 'wpcf-last-name', true);
        $title = trim($first . ' ' . $last);
        if ($title !== '') {
            wp_update_post([
                'ID'         => $profile_id,
                'post_title' => $title,
            ]);
        }

        do_action('mecard_onboarding_step_saved', $step, $profile_id, get_current_user_id());

        $response = [
            'profileId' => $profile_id,
            'profile'   => self::get_profile_payload($profile_id),
            'shareUrl'  => get_permalink($profile_id),
            'classicCardCart' => self::get_classic_card_cart_state(),
        ];

        if ($step === 'install') {
            $response['redirectUrl'] = self::get_dashboard_url();
        }

        wp_send_json_success($response);
    }

    public static function ajax_classic_card_cart(): void {
        self::guard_request();

        if (!function_exists('WC') || !WC()->cart) {
            wp_send_json_error(['message' => 'Basket is not available right now.'], 500);
        }

        $product_id = defined('MECARD_CLASSIC_PRODUCT_ID') ? (int) MECARD_CLASSIC_PRODUCT_ID : 0;
        if ($product_id <= 0) {
            wp_send_json_error(['message' => 'Classic card product is not configured.'], 500);
        }

        $operation = isset($_POST['operation']) ? sanitize_key(wp_unslash($_POST['operation'])) : 'status';

        if ($operation === 'add') {
            $state = self::get_classic_card_cart_state();
            if (!$state['inCart']) {
                $added = WC()->cart->add_to_cart($product_id, 1);
                if (!$added) {
                    wp_send_json_error(['message' => 'Could not add the classic card to the basket.'], 500);
                }
            }
        } elseif ($operation === 'remove') {
            foreach (WC()->cart->get_cart() as $cart_item_key => $item) {
                if ((int) ($item['product_id'] ?? 0) === $product_id) {
                    WC()->cart->remove_cart_item($cart_item_key);
                }
            }
        }

        wp_send_json_success([
            'classicCardCart' => self::get_classic_card_cart_state(),
        ]);
    }

    public static function ajax_send_profile_link(): void {
        self::guard_request();

        $user      = wp_get_current_user();
        $share_url = esc_url_raw(wp_unslash($_POST['share_url'] ?? ''));

        if (empty($share_url)) {
            wp_send_json_error('Profile link not available.');
        }

        $subject = 'Your MeCard profile link';
        $message = "Hi {$user->display_name},\n\nHere's your MeCard profile link:\n\n{$share_url}\n\nOpen this on your phone, tap the Share button, then choose \"Add to Home Screen\" to add your MeCard launch button.\n\nThe MeCard Team";

        if (wp_mail($user->user_email, $subject, $message)) {
            wp_send_json_success();
        } else {
            wp_send_json_error('Could not send the email. Please try again.');
        }
    }

    private static function guard_request(): void {
        if (!check_ajax_referer('me-onboarding-nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Invalid nonce.'], 403);
        }

        if (!is_user_logged_in()) {
            wp_send_json_error(['message' => 'You must be signed in.'], 403);
        }
    }

    private static function ensure_current_user_profile(): int {
        $user_id = get_current_user_id();

        $existing = get_posts([
            'post_type'      => 'mecard-profile',
            'author'         => $user_id,
            'post_status'    => ['publish', 'draft', 'pending', 'private'],
            'posts_per_page' => 1,
            'orderby'        => 'date',
            'order'          => 'ASC',
            'fields'         => 'ids',
        ]);

        if (!empty($existing[0])) {
            return (int) $existing[0];
        }

        $user  = wp_get_current_user();
        $first = (string) get_user_meta($user_id, 'first_name', true);
        $last  = (string) get_user_meta($user_id, 'last_name', true);
        $title = trim($first . ' ' . $last);
        if ($title === '') {
            $title = $user->display_name ?: $user->user_login;
        }

        $profile_id = wp_insert_post([
            'post_type'   => 'mecard-profile',
            'post_status' => 'publish',
            'post_title'  => $title,
            'post_author' => $user_id,
        ]);

        if (is_wp_error($profile_id) || !$profile_id) {
            wp_send_json_error(['message' => 'Could not create profile.'], 500);
        }

        if ($first !== '') {
            update_post_meta($profile_id, 'wpcf-first-name', $first);
        }
        if ($last !== '') {
            update_post_meta($profile_id, 'wpcf-last-name', $last);
        }
        if (!empty($user->user_email)) {
            update_post_meta($profile_id, 'wpcf-email-address', sanitize_email($user->user_email));
        }
        update_post_meta($profile_id, 'wpcf-profile-type', 'standard');
        update_post_meta($profile_id, 'me_profile_owner_user_id', $user_id);
        update_post_meta($profile_id, 'me_onboarding_started', 1);
        update_post_meta($profile_id, 'me_onboarding_completed', 0);
        update_post_meta($profile_id, 'me_onboarding_stage', 'basics');
        update_post_meta($profile_id, 'me_onboarding_install_done', 0);
        update_post_meta($profile_id, 'me_onboarding_install_skipped', 0);

        $social_avatar_id = self::get_current_user_social_avatar_id($user_id);
        if ($social_avatar_id && !has_post_thumbnail($profile_id)) {
            set_post_thumbnail($profile_id, $social_avatar_id);
        }

        do_action('mecard_profile_autocreated', $profile_id, $user_id);

        return (int) $profile_id;
    }

    private static function get_profile_payload(int $profile_id): array {
        $meta = static function (string $key) use ($profile_id): string {
            return (string) get_post_meta($profile_id, $key, true);
        };

        return [
            'first'       => $meta('wpcf-first-name'),
            'last'        => $meta('wpcf-last-name'),
            'job'         => $meta('wpcf-job-title'),
            'email'       => $meta('wpcf-email-address'),
            'mobile'      => $meta('wpcf-mobile-number'),
            'whatsapp'    => $meta('wpcf-whatsapp-number'),
            'directLine'  => $meta('wpcf-work-phone-number'),
            'linkedin'    => $meta('wpcf-linkedin-url'),
            'companyName' => $meta('wpcf-company-r') ?: $meta('wpcf-company_name'),
            'companyId'   => (int) get_post_meta($profile_id, 'company_parent', true),
            'companyLogoId'  => (int) get_post_meta($profile_id, 'me_profile_company_logo_id', true),
            'companyLogoUrl' => self::get_attachment_image_url((int) get_post_meta($profile_id, 'me_profile_company_logo_id', true)),
            'photoId'     => (int) get_post_thumbnail_id($profile_id),
            'photoUrl'    => (string) get_the_post_thumbnail_url($profile_id, 'medium'),
            'profileType' => $meta('wpcf-profile-type') ?: 'standard',
            'onboardingStage' => self::get_onboarding_stage($profile_id),
            'installDone' => (int) get_post_meta($profile_id, 'me_onboarding_install_done', true),
            'installSkipped' => (int) get_post_meta($profile_id, 'me_onboarding_install_skipped', true),
        ];
    }

    private static function get_steps(): array {
        return apply_filters('mecard_onboarding_steps', self::STEP_ORDER);
    }

    private static function get_classic_card_cart_state(): array {
        $product_id = defined('MECARD_CLASSIC_PRODUCT_ID') ? (int) MECARD_CLASSIC_PRODUCT_ID : 0;
        $state = [
            'inCart' => false,
            'quantity' => 0,
            'cartItemKey' => '',
            'productId' => $product_id,
            'basketUrl' => function_exists('wc_get_cart_url') ? wc_get_cart_url() : '',
        ];

        if ($product_id <= 0 || !function_exists('WC') || !WC()->cart) {
            return $state;
        }

        foreach (WC()->cart->get_cart() as $cart_item_key => $item) {
            if ((int) ($item['product_id'] ?? 0) !== $product_id) {
                continue;
            }

            $state['inCart'] = true;
            $state['quantity'] += (int) ($item['quantity'] ?? 0);
            if ($state['cartItemKey'] === '') {
                $state['cartItemKey'] = (string) $cart_item_key;
            }
        }

        return $state;
    }

    public static function current_user_can_use_onboarding(): bool {
        $user_id = get_current_user_id();
        if (!$user_id) {
            return false;
        }

        if (self::is_local_test_user($user_id)) {
            return true;
        }

        $state = self::get_account_state($user_id);
        return $state === 'first_time' || $state === 'onboarding';
    }

    public static function get_account_state(int $user_id): string {
        if ($user_id <= 0) {
            return 'anonymous';
        }

        $profile_id = self::get_user_profile_id($user_id);
        if ($profile_id > 0) {
            $stage = self::get_onboarding_stage($profile_id);
            $completed = (int) get_post_meta($profile_id, 'me_onboarding_completed', true);
            if ($completed === 1 && $stage === 'ready') {
                return 'existing';
            }
            if (in_array($stage, self::STEP_ORDER, true)) {
                return 'onboarding';
            }
            if ($completed === 1) {
                return 'existing';
            }

            $started = (int) get_post_meta($profile_id, 'me_onboarding_started', true);
            if ($started === 1) {
                return 'onboarding';
            }

            return 'existing';
        }

        if (self::user_has_owned_profile_meta($user_id)) {
            return 'existing';
        }

        if (self::user_has_legacy_profile_links($user_id)) {
            return 'existing';
        }

        if (self::user_has_tag_posts($user_id)) {
            return 'existing';
        }

        return 'first_time';
    }

    public static function get_dashboard_url(): string {
        return (string) apply_filters('mecard_onboarding_dashboard_url', mecard_user_home_url());
    }

    public static function get_signup_url(): string {
        return (string) apply_filters('mecard_onboarding_signup_url', site_url('/sign-up'));
    }

    public static function get_signup_email_url(): string {
        return (string) apply_filters('mecard_onboarding_signup_email_url', site_url('/sign-up/email'));
    }

    public static function maybe_redirect_existing_users(): void {
        if (is_admin() || !is_singular()) {
            return;
        }

        global $post;
        if (!$post instanceof \WP_Post) {
            return;
        }

        $has_onboarding = has_shortcode($post->post_content, 'me_onboarding');
        $has_signup = has_shortcode($post->post_content, 'me_signup');
        $has_signup_email = has_shortcode($post->post_content, 'me_signup_email');

        if (!$has_onboarding && !$has_signup && !$has_signup_email) {
            return;
        }

        if (!is_user_logged_in() && $has_onboarding) {
            wp_safe_redirect(self::get_signup_url());
            exit;
        }

        if (is_user_logged_in() && !self::current_user_can_use_onboarding()) {
            wp_safe_redirect(self::get_dashboard_url());
            exit;
        }
    }

    public static function filter_onboarding_media_query(array $query = []): array {
        if (!is_user_logged_in()) {
            return $query;
        }

        if (empty($query['mecard_owned_only'])) {
            return $query;
        }

        $query['author'] = get_current_user_id();
        $query['post_mime_type'] = 'image';

        return $query;
    }

    private static function sanitize_request_value(string $type, $value) {
        switch ($type) {
            case 'email':
                return sanitize_email($value);
            case 'url':
                return esc_url_raw($value);
            case 'absint':
                return absint($value);
            case 'text':
            default:
                return sanitize_text_field($value);
        }
    }

    private static function get_onboarding_stage(int $profile_id): string {
        $stage = (string) get_post_meta($profile_id, 'me_onboarding_stage', true);
        if ($stage === '') {
            $completed = (int) get_post_meta($profile_id, 'me_onboarding_completed', true);
            if ($completed === 1) {
                return 'ready';
            }

            $started = (int) get_post_meta($profile_id, 'me_onboarding_started', true);
            if ($started === 1) {
                return 'basics';
            }
        }

        return $stage;
    }

    private static function render_signup_features(): string {
        return '
        <div class="me-feature-list">
          <div class="me-feature-list__item"><strong>Launch sharing tools from your phone\'s home screen</strong><span>Share via WhatsApp, QR code, or NFC tap — always one tap away.</span></div>
          <div class="me-feature-list__item"><strong>Your details downloaded into recipient\'s contacts app</strong><span>One tap saves your card directly to their phone.</span></div>
          <div class="me-feature-list__item"><strong>Personal &amp; company details in one place</strong><span>Mobile, email, social links and basic company info — all included free.</span></div>
        </div>';
    }

    private static function render_progress_tracker(string $current_group = 'signup'): string {
        $groups = [
            'signup' => 'Sign up',
            'profile' => 'Create your free profile',
            'install' => 'Add launch button',
            'ready' => "You're ready to share!",
        ];

        $completed = [];
        if ($current_group === 'profile') {
            $completed = ['signup'];
        } elseif ($current_group === 'install') {
            $completed = ['signup', 'profile'];
        } elseif ($current_group === 'ready') {
            $completed = ['signup', 'profile', 'install', 'ready'];
        }

        $items = '';
        foreach ($groups as $key => $label) {
            $classes = ['me-progress__step'];
            if (in_array($key, $completed, true)) {
                $classes[] = 'is-complete';
            }
            if ($current_group === $key) {
                $classes[] = 'is-current';
            }

            $badge = in_array($key, $completed, true) ? '&#10003;' : '';
            $items .= '<li class="' . esc_attr(implode(' ', $classes)) . '" data-progress-step="' . esc_attr($key) . '"><span class="me-progress__dot">' . $badge . '</span><span class="me-progress__label">' . esc_html($label) . '</span></li>';
        }

        $bundle_img = esc_url(plugin_dir_url(__FILE__) . 'images/custom_bundle_new.png');

        return '
        <div class="me-progress me-progress--bottom">
          <ol class="me-progress__list">' . $items . '</ol>
          <div class="me-progress__extra">Then: Add Cards and configure more features</div>
          <div class="me-progress-upsell">
            <div class="me-progress-upsell__section">
              <p class="me-progress-upsell__heading">Profile enhancements</p>
              <ul class="me-progress-upsell__list">
                <li>Custom branding &amp; colours</li>
                <li>Pro layouts &amp; themes</li>
                <li>Rich company information</li>
              </ul>
            </div>
            <div class="me-progress-upsell__section">
              <p class="me-progress-upsell__heading">Cards &amp; bundles</p>
              <img class="me-progress-upsell__bundle-img" src="' . $bundle_img . '" alt="MeCard custom card bundle">
            </div>
          </div>
        </div>';
    }

    private static function is_local_test_user(int $user_id): bool {
        if ($user_id <= 0) {
            return false;
        }

        $user = get_user_by('id', $user_id);
        if (!$user instanceof \WP_User) {
            return false;
        }

        $allow = false;
        $home_url = home_url('/');
        if (strpos($home_url, 'localhost') !== false || strpos($home_url, '127.0.0.1') !== false) {
            $allow = $user->user_email === 'paul.tenbokum@gmail.com';
        }

        return (bool) apply_filters('mecard_onboarding_local_test_user', $allow, $user);
    }

    private static function get_current_user_social_avatar_id(int $user_id): int {
        global $wpdb;

        $meta_key = $wpdb->get_blog_prefix(get_current_blog_id()) . 'user_avatar';
        return (int) get_user_meta($user_id, $meta_key, true);
    }

    private static function get_attachment_image_url(int $attachment_id): string {
        if (!$attachment_id) {
            return '';
        }

        $url = wp_get_attachment_image_url($attachment_id, 'medium');
        if (!$url) {
            $url = wp_get_attachment_image_url($attachment_id, 'thumbnail');
        }
        if (!$url) {
            $url = wp_get_attachment_url($attachment_id);
        }

        return (string) ($url ?: '');
    }

    private static function get_user_profile_id(int $user_id): int {
        $profiles = get_posts([
            'post_type'      => 'mecard-profile',
            'author'         => $user_id,
            'post_status'    => ['publish', 'draft', 'pending', 'private'],
            'posts_per_page' => 1,
            'orderby'        => 'date',
            'order'          => 'ASC',
            'fields'         => 'ids',
        ]);

        if (!empty($profiles[0])) {
            return (int) $profiles[0];
        }

        return 0;
    }

    private static function user_has_profile_posts(int $user_id): bool {
        return !empty(get_posts([
            'post_type'      => 'mecard-profile',
            'author'         => $user_id,
            'post_status'    => ['publish', 'draft', 'pending', 'private'],
            'posts_per_page' => 1,
            'fields'         => 'ids',
        ]));
    }

    private static function user_has_owned_profile_meta(int $user_id): bool {
        return !empty(get_posts([
            'post_type'      => 'mecard-profile',
            'post_status'    => ['publish', 'draft', 'pending', 'private'],
            'posts_per_page' => 1,
            'fields'         => 'ids',
            'meta_query'     => [
                [
                    'key'   => 'me_profile_owner_user_id',
                    'value' => $user_id,
                ],
            ],
        ]));
    }

    private static function user_has_legacy_profile_links(int $user_id): bool {
        return !empty(get_posts([
            'post_type'      => 'user-role',
            'author'         => $user_id,
            'post_status'    => ['publish', 'draft', 'pending', 'private'],
            'posts_per_page' => 1,
            'fields'         => 'ids',
        ]));
    }

    private static function user_has_tag_posts(int $user_id): bool {
        return !empty(get_posts([
            'post_type'      => 't',
            'author'         => $user_id,
            'post_status'    => ['publish', 'draft', 'pending', 'private'],
            'posts_per_page' => 1,
            'fields'         => 'ids',
        ]));
    }
}
