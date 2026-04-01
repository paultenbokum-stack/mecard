<?php
namespace Me\Company_Editor;
use Me\Preview\Renderer;

if (!defined('ABSPATH')) exit;

class Module {
    public static function init() : void {
        add_action('wp_ajax_me_new_load_company_form',    [__CLASS__, 'ajax_load_form']);
        add_action('wp_ajax_me_new_load_company_preview', [__CLASS__, 'ajax_load_preview']);
        add_action('wp_ajax_me_new_save_company_form',    [__CLASS__, 'ajax_save']);
    }

    public static function ajax_load_form() : void {
        if (!check_ajax_referer('me-company-edit-nonce', '_wpnonce', false)) {
            wp_send_json_error(['message'=>'Invalid company nonce.'], 403);
        }
        $post_id = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        $is_edit = $post_id && get_post($post_id);

        $title   = $is_edit ? get_the_title($post_id) : '';
        $logo_id = $is_edit ? get_post_thumbnail_id($post_id) : 0;
        $logo_url= $logo_id ? wp_get_attachment_image_url($logo_id,'medium') : '';
        $m = fn($k,$d='')=> $is_edit ? get_post_meta($post_id,$k,true) ?: $d : $d;

        ob_start(); ?>
        <form id="newMeCompanyForm" class="grid" data-post-id="<?php echo esc_attr($post_id); ?>">
            <input type="hidden" name="post_id" value="<?php echo esc_attr($post_id); ?>">
            <input type="hidden" name="_wpnonce" value="<?php echo esc_attr(wp_create_nonce('me-company-edit-nonce')); ?>">

            <div class="cell"><label>Company Name</label><input name="post_title" value="<?php echo esc_attr($title); ?>"></div>
            <div class="cell"><label>Website</label><input name="wpcf-company-website" value="<?php echo esc_attr($m('wpcf-company-website')); ?>"></div>
            <div class="cell"><label>Telephone</label><input name="wpcf-company-telephone-number" value="<?php echo esc_attr($m('wpcf-company-telephone-number')); ?>"></div>
            <div class="cell"><label>Support Email</label><input name="wpcf-support-email" value="<?php echo esc_attr($m('wpcf-support-email')); ?>"></div>
            <div class="cell full"><label>Address</label><input name="wpcf-company-address" value="<?php echo esc_attr($m('wpcf-company-address')); ?>"></div>

            <fieldset class="cell full">
                <legend>Logo</legend>
                <button type="button" class="js-me-pick-logo">Select / Upload</button>
                <input type="hidden" name="_company_logo_id" value="<?php echo esc_attr($logo_id); ?>">
                <div><img id="newMeCompanyLogoPreview" src="<?php echo esc_url($logo_url); ?>" style="max-height:60px" alt=""></div>
            </fieldset>

            <fieldset class="cell full">
                <legend>Design (Pro)</legend>
                <div class="grid">
                    <div class="cell"><label>Heading Font</label><input name="_me_heading_font" value="<?php echo esc_attr($m('wpcf-heading-font')); ?>"></div>
                    <div class="cell"><label>Body Font</label><input name="_me_body_font" value="<?php echo esc_attr($m('wpcf-normal-font')); ?>"></div>
                    <div class="cell"><label>Heading Color</label><input name="_me_heading_color" value="<?php echo esc_attr($m('wpcf-heading-font-colour','#000000')); ?>"></div>
                    <div class="cell"><label>Body Color</label><input name="_me_body_color" value="<?php echo esc_attr($m('wpcf-normal-font-colour','#333333')); ?>"></div>
                    <div class="cell"><label>Accent</label><input name="_me_accent" value="<?php echo esc_attr($m('wpcf-accent-colour','#0170b9')); ?>"></div>
                    <div class="cell"><label>Button Text</label><input name="_me_button_text" value="<?php echo esc_attr($m('wpcf-button-text-colour','#ffffff')); ?>"></div>
                    <div class="cell"><label>Download</label><input name="_me_download" value="<?php echo esc_attr($m('wpcf-download-button-colour','#30b030')); ?>"></div>
                    <div class="cell"><label>Download Text</label><input name="_me_download_text" value="<?php echo esc_attr($m('wpcf-download-button-text-colour','#000000')); ?>"></div>
                </div>
            </fieldset>

            <div class="cell full"><label>Description (Pro)</label>
                <textarea name="wpcf-company-description" rows="6"><?php echo esc_textarea($m('wpcf-company-description')); ?></textarea>
            </div>
            <div class="cell full"><label>Custom CSS (Pro)</label>
                <textarea name="wpcf-custom-css" rows="4"><?php echo esc_textarea($m('wpcf-custom-css')); ?></textarea>
            </div>
        </form>
        <?php
        $form_html = ob_get_clean();
        wp_send_json_success(['form_html'=>$form_html]);
    }

    public static function ajax_load_preview() : void {
        if (!check_ajax_referer('me-company-edit-nonce', '_wpnonce', false)) {
            wp_send_json_error(['message'=>'Invalid nonce (company preview).'], 403);
        }
        $post_id = absint($_POST['post_id'] ?? 0);
        $company = $post_id ? Renderer::get_company_data($post_id) : [
            'title'=>'','logo_url'=>'','address'=>'','website'=>'','tel'=>'','desc_html'=>'','design'=>[]
        ];

        $company['design'] = array_filter([
                'heading_font'=>Renderer::font_to_stack(sanitize_text_field($_POST['_me_heading_font'] ?? '')),
                'body_font'   =>Renderer::font_to_stack(sanitize_text_field($_POST['_me_body_font'] ?? '')),
                'heading_color'=>sanitize_text_field($_POST['_me_heading_color'] ?? ''),
                'body_color'  =>sanitize_text_field($_POST['_me_body_color'] ?? ''),
                'accent'      =>sanitize_text_field($_POST['_me_accent'] ?? ''),
                'button_text' =>sanitize_text_field($_POST['_me_button_text'] ?? ''),
                'download'    =>sanitize_text_field($_POST['_me_download'] ?? ''),
                'download_text'=>sanitize_text_field($_POST['_me_download_text'] ?? ''),
            ]) + ($company['design'] ?? []);

        if (!empty($_POST['_company_logo_id'])) {
            $logo_url = wp_get_attachment_image_url(absint($_POST['_company_logo_id']), 'full');
            if ($logo_url) $company['logo_url'] = $logo_url;
        }

        $ctx = ['company'=>$company, 'profile'=>[]];
        $html = Renderer::render_company_both($ctx);
        wp_send_json_success(['preview_html'=>$html]);
    }

    public static function ajax_save() : void {
        if (!check_ajax_referer('me-company-edit-nonce', '_wpnonce', false)) {
            wp_send_json_error(['message'=>'Invalid nonce.'], 403);
        }
        $post_id = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        if (!$post_id) {
            wp_send_json_error(['message'=>'No permission or invalid post.'], 403);
        }
        $company_post = get_post($post_id);
        $is_owner = $company_post && (int) $company_post->post_author === get_current_user_id();
        if (!$is_owner && !current_user_can('edit_post', $post_id)) {
            wp_send_json_error(['message'=>'No permission or invalid post.'], 403);
        }

        if (isset($_POST['post_title'])) {
            wp_update_post(['ID'=>$post_id, 'post_title'=>wp_strip_all_tags($_POST['post_title'])]);
        }
        if (!empty($_POST['_company_logo_id'])) {
            set_post_thumbnail($post_id, absint($_POST['_company_logo_id']));
        }

        $meta_keys = [
            'wpcf-company-website','wpcf-company-telephone-number','wpcf-support-email','wpcf-company-address',
            'wpcf-company-description','wpcf-custom-css',
            'wpcf-heading-font','wpcf-heading-font-colour','wpcf-normal-font','wpcf-normal-font-colour',
            'wpcf-accent-colour','wpcf-button-text-colour','wpcf-download-button-colour','wpcf-download-button-text-colour',
        ];
        foreach($meta_keys as $k){ if (isset($_POST[$k])) update_post_meta($post_id,$k,wp_unslash($_POST[$k])); }

        wp_send_json_success(['saved'=>true]);
    }
}
