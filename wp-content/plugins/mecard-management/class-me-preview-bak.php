<?php
namespace Me\Preview;

if (!defined('ABSPATH')) exit;

class Module {

    public static function init() : void {
        add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue']);
        add_action('wp_enqueue_scripts',   [__CLASS__, 'enqueue']);
        add_action('wp_footer',            [__CLASS__, 'render_modal']);
    }

    public static function enqueue() : void {
        if (!is_user_logged_in()) return;

        $base_url = plugin_dir_url(__FILE__);
        $css_url  = $base_url . 'css/';
        $js_url   = $base_url . 'js/';

        // Re-use your existing CSS, just without the "new_" prefixes in PHP
        wp_enqueue_style(
            'me-profile-edit',
            $css_url . 'me-profile-edit.css',
            [],
            defined('ME_PLUGIN_VER') ? ME_PLUGIN_VER : '1.0'
        );
        wp_enqueue_style(
            'me-preview',
            $css_url . 'new_me-preview.css',
            [],
            defined('ME_PLUGIN_VER') ? ME_PLUGIN_VER : '1.0'
        );
        wp_enqueue_style(
            'me-editor-shell',
            $css_url . 'new_me-editor-shell.css',
            [],
            defined('ME_PLUGIN_VER') ? ME_PLUGIN_VER : '1.0'
        );

        wp_enqueue_media();

        wp_enqueue_script(
            'me-editor-shell',
            $js_url . 'me-editor-shell.js',
            ['jquery'],
            defined('ME_PLUGIN_VER') ? ME_PLUGIN_VER : '1.0',
            true
        );

        wp_localize_script(
            'me-editor-shell',
            'ME',
            [
                'ajaxurl'      => admin_url('admin-ajax.php'),
                'nonceField'   => '_wpnonce',
                'nonceProfile' => wp_create_nonce('me-profile-edit-nonce'),
                'nonceCompany' => wp_create_nonce('me-company-edit-nonce'),
            ]
        );
    }

    public static function render_modal() : void {
        if (!is_user_logged_in()) return;

        ?>
        <div class="modal fade modal-fullscreen" id="meProfileEditorModal" tabindex="-1" role="dialog" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-xl" role="document">
                <div class="modal-content">

                    <div class="modal-header">
                        <div>
                            <h5 class="modal-title" id="meProfileEditorTitle">Edit profile</h5>
                            <small class="text-muted" id="meProfileEditorSubtitle"></small>
                        </div>
                        <button type="button" class="close" data-dismiss="modal">
                            <span>&times;</span>
                        </button>
                    </div>

                    <div class="modal-body">
                        <!-- Loading state -->
                        <div id="meProfileLoading" class="text-center py-5" style="display:none;">
                            <!-- If your Bootstrap version has spinners, this will show nicely;
                                 otherwise you still get the "Loading profile…" text. -->
                            <div class="spinner-border" role="status" aria-hidden="true"></div>
                            <div class="mt-2">Loading profile…</div>
                        </div>

                        <!-- Actual editor (hidden while loading) -->
                        <div id="newMeEditor" style="display:none;">
                            <div class="row">
                                <!-- LEFT: form -->
                                <div class="col-md-8">
                                    <?php self::render_profile_form_shell(); ?>
                                </div>

                                <!-- RIGHT: preview -->
                                <div class="col-md-4 border-left">
                                    <?php self::render_profile_preview_shell(); ?>
                                </div>
                            </div>
                        </div>
                    </div>


                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary js-me-close" data-dismiss="modal">
                            Close
                        </button>
                        <button type="button" class="btn btn-primary js-me-save">
                            Save
                        </button>
                    </div>

                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Static Bootstrap 4 form shell.
     * IDs/names match your current form so saving logic can be reused.
     */
    protected static function render_profile_form_shell() : void {
        $current_user_id = get_current_user_id();

        $companies = get_posts([
            'post_type'      => 'company',
            'post_status'    => 'publish',
            'author'         => $current_user_id,
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC',
        ]);
        ?>
        <form id="newMeProfileForm">

            <input type="hidden" name="post_id" id="me_profile_post_id" value="">
            <input type="hidden" name="me_profile_photo_id" id="me_profile_photo_id" value="">

            <!-- Tabs -->
            <ul class="nav nav-tabs" id="meProfileTabs" role="tablist">
                <li class="nav-item">
                    <a class="nav-link active"
                       id="profile-main-tab"
                       data-toggle="tab"
                       href="#profile-main"
                       role="tab"
                       aria-controls="profile-main"
                       aria-selected="true">
                        Contact Info
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link"
                       id="profile-social-tab"
                       data-toggle="tab"
                       href="#profile-social"
                       role="tab"
                       aria-controls="profile-social"
                       aria-selected="false">
                        Social Profiles
                    </a>
                </li>
            </ul>

            <div class="tab-content" id="meProfileTabContent" style="margin-top:20px">

                <!-- CONTACT TAB -->
                <div class="tab-pane fade show active"
                     id="profile-main"
                     role="tabpanel"
                     aria-labelledby="profile-main-tab">

                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label for="wpcf-first-name">First name</label>
                            <input type="text" class="form-control" name="wpcf-first-name" id="wpcf-first-name" value="">
                        </div>
                        <div class="form-group col-md-6">
                            <label for="wpcf-last-name">Last name</label>
                            <input type="text" class="form-control" name="wpcf-last-name" id="wpcf-last-name" value="">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label for="wpcf-job-title">Job title</label>
                            <input type="text" class="form-control" name="wpcf-job-title" id="wpcf-job-title" value="">
                        </div>
                        <div class="form-group col-md-6">
                            <label for="company_parent">Company (parent)</label>
                            <select class="form-control" name="company_parent" id="company_parent">
                                <option value="0"><?php esc_html_e('— No company —'); ?></option>
                                <?php foreach ($companies as $company): ?>
                                    <option value="<?php echo esc_attr($company->ID); ?>">
                                        <?php echo esc_html(get_the_title($company)); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>

                    <!-- Profile type -->
                    <div class="form-row" style="display:none">
                        <div class="form-group col-md-6">
                            <label for="wpcf-profile-type">Profile type</label>
                            <select class="form-control" name="wpcf-profile-type" id="wpcf-profile-type">
                                <option value="standard">Standard</option>
                                <option value="pro">Pro</option>
                            </select>
                        </div>
                    </div>

                    <!-- Photo -->
                    <div class="form-row">

                    </div>

                    <!-- Contact details -->
                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label for="wpcf-email-address">Email address</label>
                            <input type="email" class="form-control" name="wpcf-email-address" id="wpcf-email-address" value="">
                        </div>
                        <div class="form-group col-md-6">
                            <label for="wpcf-mobile-number">Mobile number</label>
                            <input type="text" class="form-control" name="wpcf-mobile-number" id="wpcf-mobile-number" value="">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label for="wpcf-whatsapp-number">WhatsApp number</label><span class="badge bg-warning">Pro only</span>
                            <input type="text" class="form-control" name="wpcf-whatsapp-number" id="wpcf-whatsapp-number" value="">
                        </div>
                        <div class="form-group col-md-6">
                            <label for="wpcf-work-phone-number">Direct Line</label><span class="badge bg-warning">Pro only</span>
                            <input type="text" class="form-control" name="wpcf-work-phone-number" id="wpcf-work-phone-number" value="">
                        </div>
                    </div>
                    <div class="form-group col-md-6">
                        <label>Profile picture</label>
                        <div class="d-flex align-items-center">
                            <img id="meProfilePhotoPreview"
                                 src=""
                                 alt=""
                                 style="max-width:64px;max-height:64px;border-radius:50%;display:none;margin-right:10px;">
                            <button type="button"
                                    class="btn btn-outline-secondary btn-sm"
                                    id="meProfilePhotoButton">
                                Choose picture
                            </button>
                        </div>
                    </div>
                </div>

                <!-- SOCIAL TAB -->
                <div class="tab-pane fade"
                     id="profile-social"
                     role="tabpanel"
                     aria-labelledby="profile-social-tab">

                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label for="wpcf-facebook-url">Facebook URL</label>
                            <input type="url" class="form-control" name="wpcf-facebook-url" id="wpcf-facebook-url" value="">
                        </div>
                        <div class="form-group col-md-6">
                            <label for="wpcf-twitter-url">Twitter / X URL</label>
                            <input type="url" class="form-control" name="wpcf-twitter-url" id="wpcf-twitter-url" value="">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label for="wpcf-linkedin-url">LinkedIn URL</label>
                            <input type="url" class="form-control" name="wpcf-linkedin-url" id="wpcf-linkedin-url" value="">
                        </div>
                        <div class="form-group col-md-6">
                            <label for="wpcf-instagram-user">Instagram @user</label>
                            <input type="text" class="form-control" name="wpcf-instagram-user" id="wpcf-instagram-user" value="">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label for="wpcf-youtube-url">YouTube URL</label>
                            <input type="url" class="form-control" name="wpcf-youtube-url" id="wpcf-youtube-url" value="">
                        </div>
                        <div class="form-group col-md-6">
                            <label for="wpcf-tiktok-url">TikTok URL</label>
                            <input type="url" class="form-control" name="wpcf-tiktok-url" id="wpcf-tiktok-url" value="">
                        </div>
                    </div>
                </div>

            </div>
        </form>
        <?php
    }

    /**
     * Static preview frame (Pro layout) – JS injects content.
     */

    protected static function render_profile_preview_shell() : void {
        ?>
        <div id="proPreview" class="preview-scope is-pro">
            <div class="me-phone-frame">
                <div class="me-phone-screen">

                    <div class="pro-profile-container">

                        <!-- Company logo -->
                        <div class="pro-logo">
                            <img id="pv-company-logo" src="" alt="">
                        </div>

                        <!-- Profile image -->
                        <div class="profile-image pro">
                            <picture class="attachment-medium size-medium wp-post-image">
                                <img id="mePreviewPic" src="" alt="Profile picture">
                            </picture>
                        </div>

                        <div style="height:20px" aria-hidden="true" class="wp-block-spacer"></div>

                        <h1 class="has-text-align-center">
                            <span id="pv-first">First</span> <span id="pv-last">Last</span>
                        </h1>

                        <div class="job-title">
                            <span id="pv-job">Job title</span>
                        </div>

                        <!-- Social icons + 3 profile buttons (mirrors shortcode output) -->
                        <div class="container-md">
                            <div class="row">
                                <div class="col col-12 mecard-centered mecard-social" id="pv-socials">

                                    <div class="mecard-social-item" id="soc-facebook" style="display:none;">
                                        <a id="pv-facebook" href="#" target="_blank" rel="noopener">
                                            <i class="fab fa-facebook-square"></i>
                                        </a>
                                    </div>

                                    <div class="mecard-social-item" id="soc-instagram" style="display:none;">
                                        <a id="pv-instagram" href="#" target="_blank" rel="noopener">
                                            <i class="fab fa-instagram-square"></i>
                                        </a>
                                    </div>

                                    <div class="mecard-social-item" id="soc-linkedin" style="display:none;">
                                        <a id="pv-linkedin" href="#" target="_blank" rel="noopener">
                                            <i class="fab fa-linkedin"></i>
                                        </a>
                                    </div>

                                    <div class="mecard-social-item" id="soc-youtube" style="display:none;">
                                        <a id="pv-youtube" href="#" target="_blank" rel="noopener">
                                            <i class="fab fa-youtube-square"></i>
                                        </a>
                                    </div>

                                    <div class="mecard-social-item" id="soc-twitter" style="display:none;">
                                        <a id="pv-twitter" href="#" target="_blank" rel="noopener">
                                            <i class="fab fa-twitter-square"></i>
                                        </a>
                                    </div>

                                    <div class="mecard-social-item" id="soc-tiktok" style="display:none;">
                                        <a id="pv-tiktok" href="#" target="_blank" rel="noopener">
                                            <i class="fab fa-tiktok"></i>
                                        </a>
                                    </div>

                                </div>
                            </div>

                            <div class="row profile-buttons">
                                <div class="col col-4">
                                    <a id="pv-call" href="#">
                                        <button type="button" class="phone" aria-label="Call">
                                            <i class="fas fa-mobile-alt"></i>
                                        </button>
                                    </a>
                                </div>
                                <div class="col col-4">
                                    <a id="pv-email" href="#">
                                        <button type="button" class="email" aria-label="Email">
                                            <i class="fas fa-envelope"></i>
                                        </button>
                                    </a>
                                </div>
                                <div class="col col-4">
                                    <a id="pv-wa" href="#">
                                        <button type="button" class="whatsapp" aria-label="WhatsApp">
                                            <i class="fab fa-whatsapp"></i>
                                        </button>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div class="container-fluid">
                            <div style="height:50px" aria-hidden="true" class="wp-block-spacer"></div>

                            <div class="row">
                                <div class="col col-sm-12">
                                    <h2 class="company">
                                        <span id="pv-company-name">Company name</span>
                                    </h2>
                                </div>
                            </div>

                            <!-- Company address (optional) -->
                            <div class="row" id="pv-company-address-row" style="display:none;">
                                <div class="col col-sm-12">
                                    <a id="pv-company-address" href="#" target="_blank" rel="noopener" class="company-address" style="text-decoration:none">
                                        <span id="pv-company-address-text"></span>
                                    </a>
                                    <div style="height:20px" aria-hidden="true" class="wp-block-spacer"></div>
                                </div>
                            </div>

                            <!-- Long description (rich HTML) -->
                            <div class="row">
                                <div class="col col-sm-12">
                                    <div id="pv-company-description"></div>
                                </div>
                            </div>

                            <div style="height:50px" aria-hidden="true" class="wp-block-spacer"></div>

                            <!-- Company action buttons -->
                            <div class="row">
                                <div class="col col-sm-12">

                                    <a id="pv-company-website" href="#" target="_blank" rel="noopener" style="display:none;">
                                        <button type="button" class="company website">
                                            <i class="fas fa-globe"></i>&nbsp;Visit Website
                                        </button>
                                    </a>

                                    <a id="pv-company-phone" href="#" style="display:none;">
                                        <button type="button" class="company phone">
                                            <i class="fas fa-phone-alt"></i>&nbsp;Call the Office
                                        </button>
                                    </a>

                                    <a id="pv-direct-line" href="#" style="display:none;">
                                        <button type="button" class="company phone">
                                            <i class="fas fa-phone-alt"></i>&nbsp;Direct Line
                                        </button>
                                    </a>

                                    <a id="pv-company-directions" href="#" target="_blank" rel="noopener" style="display:none;">
                                        <button type="button" class="company directions">
                                            <i class="fas fa-map-marker"></i>&nbsp;Directions
                                        </button>
                                    </a>

                                </div>
                            </div>

                        </div>

                        <div class="row">
                            <div class="col col-12">
                                <div class="mecard-swipe-hint d-sm-none" aria-hidden="true" style="text-align:center;opacity:.7;margin-top:10px;">
                                    <small>Tip: swipe left/right for more sharing options</small>
                                </div>
                            </div>
                        </div>

                        <div style="height:50px" aria-hidden="true" class="wp-block-spacer"></div>

                        <!-- Download bar -->
                        <div id="pv-vcard-wrap">
                            <div class="vcard-download">
                                <div class="vcard-button" id="pv-vcard-button">
                                    <a id="pv-vcard-link" href="#">Download Contact Card</a>
                                </div>
                            </div>
                        </div>

                    </div><!-- /.pro-profile-container -->

                </div><!-- /.me-phone-screen -->
            </div><!-- /.me-phone-frame -->
        </div>
        <?php
    }

    public static function get_company_data(int $company_id): array {
        if (!$company_id) return [];
        $p = get_post($company_id); if (!$p) return [];
        $logo_id  = get_post_thumbnail_id($company_id);
        $logo_url = $logo_id ? wp_get_attachment_image_url($logo_id,'full') : '';
        $keys = [
            'wpcf-company-address','wpcf-company-telephone-number','wpcf-company-website','wpcf-support-email',
            'wpcf-heading-font','wpcf-heading-font-colour','wpcf-normal-font','wpcf-normal-font-colour',
            'wpcf-accent-colour','wpcf-button-text-colour','wpcf-download-button-colour','wpcf-download-button-text-colour',
            'wpcf-company-description','wpcf-custom-css'
        ];
        $m = [];
        foreach($keys as $k) {
            $m[$k] = get_post_meta($company_id,$k,true);
        }

        return [
            'id'        => $company_id,
            'title'     => get_the_title($company_id),
            'logo_url'  => $logo_url,
            'address'   => $m['wpcf-company-address'] ?? '',
            'tel'       => $m['wpcf-company-telephone-number'] ?? '',
            'website'   => $m['wpcf-company-website'] ?? '',
            'support'   => $m['wpcf-support-email'] ?? '',
            'desc_html' => $m['wpcf-company-description'] ?? '',
            'custom_css'=> $m['wpcf-custom-css'] ?? '',
            'design'    => [
                'heading_font'  => self::font_to_stack($m['wpcf-heading-font'] ?? ''),
                'heading_color' => $m['wpcf-heading-font-colour'] ?: '#000000',
                'body_font'     => self::font_to_stack($m['wpcf-normal-font'] ?? ''),
                'body_color'    => $m['wpcf-normal-font-colour'] ?: '#333333',
                'accent'        => $m['wpcf-accent-colour'] ?: '#0170b9',
                'button_text'   => $m['wpcf-button-text-colour'] ?: '#ffffff',
                'download'      => $m['wpcf-download-button-colour'] ?: '#30b030',
                'download_text' => $m['wpcf-download-button-text-colour'] ?: '#000000',
            ],
        ];
    }

    public static function get_profile_data(int $profile_id): array {
        if (!$profile_id) {
            return [];
        }

        $p = get_post($profile_id);
        if (!$p) {
            return [];
        }

        // Simple meta helper
        $m = function($k) use ($profile_id) {
            return get_post_meta($profile_id, $k, true);
        };

        // Company via Toolset relationship ONLY
        $company_id = 0;
        if (function_exists('toolset_get_related_posts')) {
            $parents = toolset_get_related_posts(
                $profile_id,
                'company-mecard-profile', // relationship slug: company → mecard-profile
                [
                    'query_by_role'  => 'child',
                    'role_to_return' => 'parent',
                    'limit'          => 1,
                ]
            );

            if (!empty($parents)) {
                // toolset_get_related_posts can return array of IDs or array of post objects
                $first = reset($parents);
                $company_id = is_object($first) ? (int) $first->ID : (int) $first;
            }
        }

        return [
            'first'          => $m('wpcf-first-name') ?: '',
            'last'           => $m('wpcf-last-name') ?: '',
            'job'            => $m('wpcf-job-title') ?: '',
            'email'          => $m('wpcf-email-address') ?: '',
            'mobile'         => $m('wpcf-mobile-number') ?: '',
            'wa'             => $m('wpcf-whatsapp-number') ?: '',
            'direct_line'    => $m('wpcf-work-phone-number') ?: '',
            'type'           => $m('wpcf-profile-type') ?: 'standard',
            'company_parent' => $company_id, // ✅ Toolset only
            'photo_url'      => get_the_post_thumbnail_url($profile_id, 'medium') ?: '',
            'soc'            => [
                'facebook'  => $m('wpcf-facebook-url') ?: '',
                'twitter'   => $m('wpcf-twitter-url') ?: '',
                'linkedin'  => $m('wpcf-linkedin-url') ?: '',
                'instagram' => ($u = $m('wpcf-instagram-user'))
                    ? 'https://instagram.com/' . ltrim($u, '@')
                    : '',
                'youtube'   => $m('wpcf-youtube-url') ?: '',
                'tiktok'    => $m('wpcf-tiktok-url') ?: '',
            ],
        ];
    }

    public static function font_to_stack(string $val): string {
        $map = [
            'opensans'=>'"Open Sans", sans-serif',
            'Montserrat'=>'Montserrat, sans-serif',
            'Roboto'=>'Roboto, sans-serif',
            'playfairdisplay'=>'"Playfair Display", serif',
            'Merriweather'=>'Merriweather, serif',
            'Helvetica'=>'Helvetica, Arial, sans-serif'
        ];
        return $map[$val] ?? ($val ?: '"Montserrat", sans-serif');
    }

}

