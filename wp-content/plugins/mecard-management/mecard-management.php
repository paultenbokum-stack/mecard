<?php
/**
 * Plugin Name: MeCard Management
 */

if ( ! defined( 'ABSPATH' ) ) {
    return;
}

include 'custom_product.php';

// Define base paths if not already defined
if (!defined('ME_PLUGIN_DIR')) define('ME_PLUGIN_DIR', plugin_dir_path(__FILE__));
if (!defined('ME_PLUGIN_URL')) define('ME_PLUGIN_URL', plugin_dir_url(__FILE__));
if (!defined('ME_PLUGIN_VER')) define('ME_PLUGIN_VER', '1.1');


/**
 * Init MeCard modular editors (frontend only, on specific page slugs)
 */

// Load editor classes only when needed

require_once ME_PLUGIN_DIR . 'class-me-company-editor.php';

require_once ME_PLUGIN_DIR . 'class-me-profile-renderer.php';
require_once ME_PLUGIN_DIR .'class-me-preview.php';
require_once ME_PLUGIN_DIR .'class-me-profile-editor.php';

add_action( 'init', function () {
    // These only add wp_ajax_* actions, no output/enqueue
    Me\Profile_Editor\Module::init();
    Me\Company_Editor\Module::init();
} );
function mecard_init_modular_editors() {
    // Frontend only
    if ( is_admin() ) {
        return;
    }



    // 🔧 EDIT: add the slugs where the editor should be available
    $editor_pages = array(
        'profiles',
        'companies',
        // 'another-page-slug',
    );



    if ( ! is_page($editor_pages)) {
        //return;
    }


    Me\Preview\Module::init();


    // Output the Bootstrap 4 modal shell in the footer

}
add_action( 'wp', 'mecard_init_modular_editors' );

/**
 * Minimal Bootstrap 4 modal shell for the shared editor
 * (JS expects #newMeEditor and its child IDs/classes inside)
 */

add_action( 'wp_footer', 'mecard_render_editor_modal', 20 );

function mecard_render_editor_modal() {
    ?>
    <div class="modal fade modal-fullscreen" id="meProfileEditorModal" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-xl" role="document">
            <div class="modal-content">

                <div id="newMeEditor" class="me-editor">
                    <div class="modal-header">
                        <div class="me-editor__title">
                            <h5 class="mb-0" id="newMeEditorTitle">Edit Profile</h5>
                            <small class="text-muted d-block" id="newMeEditorSub"></small>
                        </div>

                    </div>

                    <div class="me-editor__tabs-mobile d-md-none">
                        <button type="button" class="js-me-tab is-active" data-tab="form">Form</button>
                        <button type="button" class="js-me-tab" data-tab="preview">Preview</button>
                    </div>

                    <div class="me-editor__body modal-body">
                        <div class="me-editor__left col-md-9">
                            <div id="newMeFormWrap">
                                <div class="me-loading">Loading…</div>
                            </div>
                        </div>
                        <div class="me-editor__right col-md-3">
                            <div id="newMePreviewWrap">
                                <div class="me-loading">Loading preview…</div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="me-actions">
                            <button type="button" class="btn btn-secondary js-me-close" data-dismiss="modal">
                                Close
                            </button>
                            <button type="button" class="btn btn-primary js-me-save">
                                Save
                            </button>
                        </div>
                    </div>
                </div><!-- /#newMeEditor -->

            </div>
        </div>
    </div>
    <?php
}



/* ====== BEGIN: RFG constants (keep rel + meta keys; drop hard-coded post type) ====== */
const ME_RFG_REL_SLUG  = 'more-links-company';   // Toolset relationship (RFG) slug
// DO NOT hardcode ME_RFG_POST_TYPE — we’ll detect at runtime

const ME_RFG_META_TEXT = 'wpcf-button-text';
const ME_RFG_META_URL  = 'wpcf-button-url';
const ME_RFG_META_ICON = 'wpcf-button-icon';
/* ====== END: RFG constants ====== */

add_action( 'wp_enqueue_scripts', 'load_qr_js',10 );
add_action( 'wp_enqueue_scripts', 'load_jquery_ui' ,11);

add_action('wp_enqueue_scripts', function(){
    // Spectrum CSS & JS (CDN example)
    wp_enqueue_style( 'spectrum-css', 'https://cdn.jsdelivr.net/npm/spectrum-colorpicker2/dist/spectrum.min.css', [], '2.0.6' );
    wp_enqueue_script('spectrum-js', 'https://cdn.jsdelivr.net/npm/spectrum-colorpicker2/dist/spectrum.min.js', ['jquery'], '2.0.6', true );
});
function load_jquery_ui() {

        wp_enqueue_script('jquery-ui','https://code.jquery.com/ui/1.13.2/jquery-ui.min.js');
        wp_register_style('jquery-ui-css','https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css');
        wp_enqueue_style('jquery-ui-css');

}

function load_qr_js() {
    if (is_page(array('manage-mecard-profiles','card-processing','profiles','new-cards-and-tags','live-cards-and-tags')) || is_singular(['mecard-profile','t'])) {
        wp_register_script('qrcode-generator', plugin_dir_url(__FILE__) . 'js/qrcode.js');
        wp_enqueue_script('qrcode-generator');
    }
}

function install_scripts(): void
{
    //wp_enqueue_script('mecard-font-awesome','https://kit.fontawesome.com/f684c74f6f.js');
    wp_enqueue_style(
        'font-awesome-6',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
        [],
        '6.5.2'
    );
    wp_register_script( 'mecard_management', plugin_dir_url( __FILE__ ).'js/mecard-management.js' );
    wp_enqueue_script('mecard_management');
    wp_localize_script('mecard_management','MECARD_MGMT', [
        'ajaxurl'   => admin_url('admin-ajax.php'),
        'nonce'     => wp_create_nonce('myajax-next-nonce'),
        'siteurl'   => site_url(),
        'cred_edit_company_form_id' => CRED_EDIT_COMPANY_FORM_ID,
    ]);

    wp_register_script(
        'me-company-edit-js',
        plugin_dir_url(__FILE__) . 'js/me-company-edit.js',
        ['jquery'],
        filemtime(plugin_dir_path(__FILE__) . 'js/me-company-edit.js'),
        true
    );

    // Build the FA list (use your cached/transient logic if you want)
    $fa_json_path = plugin_dir_path(__FILE__) . 'data/fa-allowlist.json';
    $fa_icons = [];
    if (file_exists($fa_json_path) && is_readable($fa_json_path)) {
        $json = file_get_contents($fa_json_path);
        $fa_icons = json_decode($json, true);
        if (!is_array($fa_icons)) {
            $fa_icons = [];
        }
    }

    // Optional: minimal hardcoded fallback so the UI isn't empty if file missing
    if (empty($fa_icons)) {
        $fa_icons = [
            ['class' => 'fa-solid fa-globe',    'label' => 'Globe'],
            ['class' => 'fa-solid fa-phone',    'label' => 'Phone'],
            ['class' => 'fa-solid fa-envelope', 'label' => 'Email'],
            ['class' => 'fa-brands fa-whatsapp','label' => 'WhatsApp'],
            ['class' => 'fa-brands fa-linkedin','label' => 'LinkedIn'],
        ];
    }

    wp_enqueue_script('me-company-edit-js');
    wp_localize_script('me-company-edit-js', 'MECARD_COMPANY', [
        'ajaxurl' => admin_url('admin-ajax.php'),
        'nonce'   => wp_create_nonce('me-company-edit-nonce'),
        'faIcons' => $fa_icons,
    ]);

    // Finally enqueue

    wp_register_style('mecard-styles', plugin_dir_url( __FILE__ ).'css/style.css' );
    wp_enqueue_style('mecard-styles');
}

add_action( 'wp_enqueue_scripts', 'install_scripts',99);

add_action( 'wp_enqueue_scripts', 'mecard_share_setup',99);

function mecard_share_setup() {
    // Localize runtime data for the current page
    if (is_singular(['mecard-profile','t'])) {
        global $post;
        $post_id   = $post ? (int) $post->ID : 0;
        $page_url  = (is_ssl() ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];

        // If these Toolset parent fields exist, fetch them; otherwise fall back to safe defaults
        $parent_id = function_exists('toolset_get_related_post') ? toolset_get_related_post($post_id, 'company-mecard-profile', 'parent') : 0;
        $accent    = $parent_id ? get_post_meta($parent_id, 'wpcf-accent-colour', true) : '';
        $btn_text  = $parent_id ? get_post_meta($parent_id, 'wpcf-button-text-colour', true) : '';

        wp_enqueue_script('mecard-qrcode');
        wp_enqueue_script('mecard-share');
        wp_enqueue_style('mecard-share');

        wp_localize_script('mecard_management', 'MECARD_SHARE', [
            'postId'         => $post_id,
            'url'            => $page_url,
            'accent'         => $accent ?: '#0066ff',
            'buttonText'     => $btn_text ?: '#ffffff',
            'i18n'           => [
                'copySuccess' => 'Link copied',
                'copyFail'    => 'Press and hold to copy',
                'smsBodyNote' => 'If SMS does not prefill on your device, paste the link.',
                'invalidMsisdn'=> 'Please enter a valid mobile number.',
            ],
        ]);
    }

}

// Our CSS
add_action( 'wp_enqueue_scripts',    'mecard_enqueue_company_edit_css' );
add_action( 'admin_enqueue_scripts', 'mecard_enqueue_company_edit_css' );
function mecard_enqueue_company_edit_css() {
    wp_enqueue_style(
        'me-company-edit-css',
        plugin_dir_url(__FILE__) . 'css/me-company-edit.css',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'css/me-company-edit.css')
    );
}

add_filter( 'user_has_cap', 'mecard_grant_profile_author_edit_cap', 10, 4 );
function mecard_grant_profile_author_edit_cap( $caps, $cap, $args, $user ) {
    $post_id = $args[2] ?? 0;
    if ( ! $post_id ) return $caps;
    $post = get_post( $post_id );
    if ( ! $post || $post->post_type !== 'mecard-profile' ) return $caps;
    if ( (int) $post->post_author === (int) $user->ID ) {
        foreach ( $cap as $primitive ) {
            $caps[ $primitive ] = true;
        }
    }
    return $caps;
}

// Our JS
add_action('wp_enqueue_scripts', function () {
    // Register first
    wp_register_script(
        'me-company-edit-js',
        plugin_dir_url(__FILE__) . 'js/me-company-edit.js',
        ['jquery'],
        filemtime(plugin_dir_path(__FILE__) . 'js/me-company-edit.js'),
        true
    );

    // Build the FA list (use your cached/transient logic if you want)
    $fa_json_path = plugin_dir_path(__FILE__) . 'data/fa-allowlist.json';
    $fa_icons = [];
    if (file_exists($fa_json_path) && is_readable($fa_json_path)) {
        $json = file_get_contents($fa_json_path);
        $fa_icons = json_decode($json, true);
        if (!is_array($fa_icons)) {
            $fa_icons = [];
        }
    }

    // Optional: minimal hardcoded fallback so the UI isn't empty if file missing
    if (empty($fa_icons)) {
        $fa_icons = [
            ['class' => 'fa-solid fa-globe',    'label' => 'Globe'],
            ['class' => 'fa-solid fa-phone',    'label' => 'Phone'],
            ['class' => 'fa-solid fa-envelope', 'label' => 'Email'],
            ['class' => 'fa-brands fa-whatsapp','label' => 'WhatsApp'],
            ['class' => 'fa-brands fa-linkedin','label' => 'LinkedIn'],
        ];
    }

});



add_action('wp_enqueue_scripts', function () {
    if (function_exists('wp_enqueue_editor')) {
        wp_enqueue_editor();     // loads wp.editor + TinyMCE + quicktags
    }
    wp_enqueue_media();          // you already need this for the media modal
});

remove_filter( 'the_content', 'wpautop' );
//add_filter( 'the_content', 'wpautop' , 99);

add_action('wp_head','me_load_fonts');

function me_load_fonts() {
    echo "<style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600&display=swap');
            </style>";
    if (is_post_type_archive('riscura') || is_singular('riscura')) {
        echo "<style>
                @import url('https://fonts.googleapis.com/css2?family=Lato&family=Merriweather&display=swap');
                </style>";
    }
}

add_shortcode('mecard-management-script-path',function($atts) {
    if (!$atts) {
        return plugin_dir_url( __FILE__ ).'js/mecard-management.js';
    } else {
        return plugin_dir_url( __FILE__ ).$atts['path'];
    }

});

function install_bootstrap() {
    wp_enqueue_style('bootstrap','https://cdn.jsdelivr.net/npm/bootstrap@5.1.1/dist/css/bootstrap.min.css');
    wp_enqueue_script('bootstrap','https://cdn.jsdelivr.net/npm/bootstrap@5.1.1/dist/js/bootstrap.bundle.min.js');
}

//add_action( 'wp_enqueue_scripts', 'install_bootstrap',1 );

// Remove core big sizes & medium_large (WP 5.3+)
add_action('after_setup_theme', function () {
    remove_image_size('medium_large'); // 768w
    remove_image_size('1536x1536');
    remove_image_size('2048x2048');
}, 100);

// Also disable the 2560px “-scaled” originals
add_filter('big_image_size_threshold', '__return_false');

// Belt-and-braces: remove Woo sizes late on init (Woo may add on init)
add_action('init', function () {
    foreach ([
                 'woocommerce_thumbnail',
                 'woocommerce_single',
                 'woocommerce_gallery_thumbnail',
             ] as $s) {
        remove_image_size($s);
    }
}, 1000);

// Final safety net: only allow the sizes you actually want generated
add_filter('intermediate_image_sizes_advanced', function ($sizes) {
    $keep = ['thumbnail', 'large','full','270x270','ast-logo-size']; // adjust for your 2–3 keepers
    return array_intersect_key($sizes, array_flip($keep));
}, 999);


// Sets when the session is about to expire
add_filter( 'wc_session_expiring', 'woocommerce_cart_session_about_to_expire');
function woocommerce_cart_session_about_to_expire() {

    // Default value is 47
    return 59 * 60 * 24 * 7;

}

// Sets when the session will expire
add_filter( 'wc_session_expiration', 'woocommerce_cart_session_expires');
function woocommerce_cart_session_expires() {

    // Default value is 48
    return 60 * 60 * 24 * 7;

}

add_action('wp_ajax_assign_card','mecard_assign_card');

function mecard_assign_card() {
    $nonce = $_POST['_wpnonce'] ?? '';
    if ( ! wp_verify_nonce($nonce, 'myajax-next-nonce') ) {
        wp_send_json_error(['message' => 'Not allowed'], 403);
    }
    $profile_id = $_POST['profile_id'];
    $card_id = $_POST['card_id'];
    $output = toolset_connect_posts('mecard-profile-mecard-tag',$profile_id,$card_id);
    $json = wp_json_encode($output);
    wp_send_json($json);
    exit;
}


function render_social_icons() {

    if (is_page('profile')) {
        $user_id = get_current_user_id();
    } else //if (is_singular('mecard-profile'))
        {
        global $post;
        $company = '';
        $user_id = $post->post_author;
    }

    $current_user_id = get_current_user_id();
    $user = get_user_by("ID",$user_id);
    $post_meta = get_post_meta($post->ID);


    $editable = ($current_user_id == $user_id) ? true : false;

    $edit_link = '<a href="'.get_site_url() .'/edit-profile/" class="mecard-edit">edit</a>';

    $headings = array(
        "name" => "Name",
        "mobile_number" => "Mobile number",
        "email" => "Email",
        "facebook" => '<i class="fab fa-facebook-square"></i>',
        "instagram" => '<i class="fab fa-instagram-square"></i>',
        "linkedin" => '<i class="fab fa-linkedin"></i>',
        "youtube" => '<i class="fab fa-youtube-square"></i>',
        "twitter" => '<i class="fab fa-twitter-square"></i>',
        "tiktok" => '<i class="fab fa-tiktok"></i>'

    );

    $profile_values = array(
        "personal" => array(
            "name" => $post_meta['wpcf-first-name'][0].' '.$post_meta['wpcf-last-name'][0],
            "mobile_number" => $post_meta['wpcf-mobile-number'][0],
            "whatsapp_number" => $post_meta['wpcf-whatsapp-number'][0],
            "email" => $post_meta['wpcf-email-address'][0]
        ),
        /*"company" => array (
            "company_name" => $user_meta['wpcf-company_name'][0],
            "job_title" => $user_meta['wpcf-job_title'][0],
            "company_phone_number" => $user_meta['wpcf-company_phone_number'][0],
            "company_email" => $user_meta['wpcf-company_email'][0],
            "company_website_url" => '<a target="_blank" href="'.$user_meta['wpcf-company_website_url'][0].'">'.$user_meta['wpcf-company_website_url'][0].'</a>',
            "company_website_url" => '<a target="_blank" href="'.$user_meta['wpcf-company_website_url'][0].'">'.$user_meta['wpcf-company_website_url'][0].'</a>',
            "company_address" => $user_meta['wpcf-company_address'][0]
        ),*/
        "social" => array (
            "facebook" => $post_meta['wpcf-facebook-url'][0],
            "twitter" => $post_meta['wpcf-twitter-url'][0],
            "linkedin" => $post_meta['wpcf-linkedin-url'][0],
            "youtube" => $post_meta['wpcf-youtube-url'][0],
            "tiktok" => $post_meta['wpcf-tiktok-url'][0]
        )

    );
    $countryCode = '27';
    $whatsapp = ($profile_values['personal']['whatsapp_number']) ? $profile_values['personal']['whatsapp_number'] : $profile_values['personal']['mobile_number'];
    $whatsapp_int =  str_replace(' ','',preg_replace('/^0/', '+'.$countryCode, $whatsapp));

    if ($post_meta['wpcf-instagram-user'][0]) {
        $profile_values['social']['instagram'] = 'https://instagram.com/'.ltrim($post_meta['wpcf-instagram-user'][0],'@');
    }

    if (isset($post_meta['wpcf-tiktok-url'][0])) {
        $profile_values['social']['tiktok'] = $post_meta['wpcf-tiktok-url'][0];
    }

    $html = ' <div class="container-md">
                <div class="row">
                    <div class="col col-12 mecard-centered mecard-social">';

                        foreach ($profile_values['social'] as $key=>$profile_value) {
                            if ($profile_value) {
                                $html .= '<div class="mecard-social-item"><a href="'.$profile_value.'" target="_blank">'.$headings[$key].'</a></div>';
                            }
                        }
                       $html .= ' </div>
                </div>
               <div class="row profile-buttons">
                    
                        <div class="col col-4"><a href="tel:'.$profile_values['personal']['mobile_number'].'"><button class="phone"><i class="fas fa-mobile-alt"></i></button></a></div>
                        <div class="col col-4"><a href="mailto:'.$profile_values['personal']['email'].'"><button class="email"><i class="fas fa-envelope"></i></button></a></div>
                        <div class="col col-4"><a href="https://wa.me/'.$whatsapp_int.'"><button class="whatsapp"><i class="fab fa-whatsapp"></i></button></a></div>
                    
                </div> 
                </div>
                ';

                        return $html;
}

add_shortcode('mecard_social_icons','render_social_icons');

function vcard_download_button($atts) {
global $post;
    $src = site_url().'/vcard/?profile_id='.$post->ID.'&profile_name='.$post->post_title;
    $iframe_src = '';
    $autodownload = 0;
    if (isset($atts['auto'])) {
        if ($atts['auto'] ==1) {
            $autodownload = 1;
        }
    }


$html = '    
<div class="vcard-download">
<div id="download-message">

    <button type="button" id="download-close" class="close"  aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
         <div>
    <p>Click on the downloaded file</p><p><span class="vcard-file">"'.$post->post_title.'.vcf"</span></p><p>to import into your phone\'s contacts.</p>
</div>
</div>
<div class="vcard-button" id="vcard-button-'.$post->ID.'" style=""><a href="#" style="">Download Contact Card</a> </div>
</div>
    
<iframe id="vcard-download"></iframe>
<script type="text/javascript">
    jQuery(document).ready(function() {
        var autodownload = '.$autodownload.';
        if (autodownload && !me_getCookie("me_'.$post->ID.'")) {
            console.log("click");
            set_download(jQuery(".vcard-button a"));
        }
        
        
        
        function set_download(el) {
            var isAndroid = / Android/i.test(navigator.userAgent.toLowerCase());
            var isiPhone = / iPhone/i.test(navigator.userAgent.toLowerCase());  
            var download_url = "'.$src.'";
            download_url = (isiPhone) ? download_url + "&iphone=1" : download_url;
            me_setCookie("me_'.$post->ID.'","1",10000);
            jQuery("#vcard-download").attr("src",download_url);
            
             if (isAndroid)  
            {  
                jQuery("#download-message").slideDown(500);
            }  
            
            jQuery(el).html("Downloading...").delay(5000).queue(function(n) {
            jQuery(el).html("Downloaded");n();
                }).delay(2000).queue(function(n) {
                    jQuery(el).html("Download Again");n();
                });
        }
        
        
        jQuery(".vcard-button a").click(function() {
        set_download(this);        
    });
        jQuery("#download-close").click(function() {
            jQuery("#download-message").slideUp(500);
        });
        
    });
    
</script>
    ';

    return $html;
}

add_shortcode('mecard_vcard_button','vcard_download_button');

function download_vcard() {
    if (is_page('vcard')) {
        $profile_id = $_GET['profile_id'];
        $profile_name = $_GET['profile_name'];
        $isiPhone = $_GET['iphone'];

        $profile = get_post($profile_id);
        if ($profile->post_type == 'mecard-profile') {
            $companies = toolset_get_related_posts($profile,'company-mecard-profile', array('query_by_role'=>'child','return' => 'post_object'));
            if (!empty($companies)) {
                $company_meta = get_post_meta($companies[0]->ID);
                $company_name = $companies[0]->post_title;
                $company_address = $company_meta['wpcf-company-address'][0];
                $company_phone = $company_meta['wpcf-company-telephone-number'][0];
                $company_website = $company_meta['wpcf-company-website'][0];
                $support_email = $company_meta['wpcf-support-email'][0];

            }
        }

        $link = get_permalink($profile_id);
        $profile_meta = get_post_meta($profile->ID);
        $hide_profile_link = $profile_meta['wpcf-hide-profile-link-on-vcard'][0];
        $profile_data = '';
        if (!$hide_profile_link) {
            $profile_data = 'URL;type=WORK;CHARSET=UTF-8:' . $link . '
NOTE: More links and social profile on mecard.co.za';
        }


        if ($profile->post_name == $profile_name || 1 == 1) {
            header('Content-Type: text/x-vcard;charset=utf-8');
// the above line is needed or else the .vcf file will be downloaded as a .htm file
            header('Content-disposition: attachment; filename="' . $profile_name . '.vcf"');
//header('Content-Disposition: attachment');


            /*    $vcard4 = 'BEGIN:VCARD
            VERSION:4.0
            N:'.$user->last_name.';'.$user->first_name.';;;
            FN:'.$user->display_name.'
            ORG:'.$user_meta['company_name'][0].'
            TITLE:'.$user_meta['job_title'][0].'
            PHOTO;MEDIATYPE=image/gif:'.get_avatar_url($tag->post_author).'
            TEL;TYPE=work,voice;VALUE=uri:'.$user_meta['company_phone_number'][0].'
            TEL;TYPE=cell,voice;VALUE=uri:'.$user_meta['mobile_number'][0].'
            ADR;TYPE=WORK;PREF=1;LABEL="'.(is_array($company_address))? implode('\n',$company_address) : $company_address.'":;;'.$company_address['address1'].', '.$company_address['address2'].';'.$company_address['city'].';'.$company_address['state'].';'.$company_address['zip'].';'.$company_address['country'].'
            EMAIL:'.$user->user_email.'
            REV:20080424T195243Z
            x-qq:21588891
            END:VCARD' ;*/

 switch ($profile->post_type) {
     case 'riscura':
        $firstname = $profile_meta['wpcf-first-name-r'][0];
         $lastname = $profile_meta['wpcf-last-name-r'][0];
         $email = $profile_meta['wpcf-email-r'][0];
         $mobile = $profile_meta['wpcf-mobile-number-r'][0];
         $company_name = $profile_meta['wpcf-company-r'][0];
         $company_address = '';
         $company_phone = '';
         $profile_data = 'NOTE: Powered by RisCura';
         $job_title = '';
         $company_website = '';
         break;
     default:
         $firstname = $profile_meta['wpcf-first-name'][0];
         $lastname = $profile_meta['wpcf-last-name'][0];
         $email = $profile_meta['wpcf-email-address'][0];
         $mobile = $profile_meta['wpcf-mobile-number'][0];
         $company_phone_direct = $profile_meta['wpcf-work-phone-number'][0];
         $whatsapp = $profile_meta['wpcf-whatsapp-number'][0];
         $job_title = $profile_meta['wpcf-job-title'][0];
 }



 $soc_fields = array('Facebook'=>'wpcf-facebook-url','Twitter'=>'wpcf-twitter-url','LinkedIn'=>'wpcf-linkedin-url','YouTube'=>'wpcf-youtube-url','Tiktok'=>'wpcf-tiktok-url','INSTAGRAM'=>'wpcf-instagram-user');
    $soc_data = '';

 if ($isiPhone == 1)   {
     foreach ($soc_fields as $key => $field) {
         $soc_data .= ($profile_meta[$field][0]) ? 'X-SOCIALPROFILE;TYPE='.strtoupper($key).':'.$profile_meta[$field][0].'
' :'';
     }
 } else {
     $counter = 0;
     foreach ($soc_fields as $key => $field) {
         $counter++;
         $soc_data .= ($profile_meta[$field][0]) ? 'X-CUSTOM(CHARSET=UTF-8,ENCODING=QUOTED-PRINTABLE,'.$key.'):'.$profile_meta[$field][0].'
' : '';     }
 }



 $pro_fields = '';

if ($profile_meta['wpcf-profile-type'][0] == 'professional') {

    $pro_fields = ($whatsapp) ? 'X-WHATSAPP:'.$whatsapp.'
'  : '';

    $pro_fields .= ($company_phone_direct) ? 'TEL;TYPE=WORK:' . $company_phone_direct . '
' : '';
}



            $vcard3 = 'BEGIN:VCARD
VERSION:3.0
FN;CHARSET=UTF-8:' . $firstname. ' '.$lastname . '
N;CHARSET=UTF-8:' . $lastname . ';' . $firstname . ';;;
PHOTO;ENCODING=b;TYPE='.imageEncodeURL(get_the_post_thumbnail_url($profile)) .'
EMAIL;CHARSET=UTF-8;type=WORK,INTERNET:' . $email . '
TEL;TYPE=CELL;type=PREF:' . $mobile . '
'.$pro_fields.'
TEL;TYPE=WORK:' . $company_phone . '
ADR;CHARSET=UTF-8;TYPE=WORK:;;' . $company_address .'
TITLE;CHARSET=UTF-8:' . htmlspecialchars_decode($job_title) . '
ORG;CHARSET=UTF-8:' . htmlspecialchars_decode($company_name) . '
URL;type=WORK;CHARSET=UTF-8:' . $company_website . '
'.$profile_data.'
'.$soc_data.'
REV:2021-06-03T14:52:38.742Z
END:VCARD
';




            echo $vcard3;

        }

        exit;
    }
}

function imageEncodeURL($path)
{
    $image = get_content($path);
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $type  = $finfo->buffer($image);
    //return "data:".$type.";charset=utf-8;base64,".base64_encode($image);
    return $type.':'.base64_encode($image);
}

function get_content($URL){
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_URL, $URL);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
    $data = curl_exec($ch);
    curl_close($ch);
    return $data;
}

add_action('template_redirect','download_vcard',1);

add_filter( 'wpv_filter_query', 'filter_relationship_custom_fn', 99 , 3 );
function filter_relationship_custom_fn( $query_args, $view_settings ) {

    if ( !is_admin() && ( isset($view_settings['view_id']) && $view_settings['view_id'] == 351) ) {

        $query_args['author'] = get_current_user_id();

    }

    return $query_args;
}

add_filter('woocommerce_thankyou_order_received_text', 'woo_change_order_received_text', 10, 2 );
function woo_change_order_received_text( $str, $order ) {
    $is_mecard = 1;
    /*foreach ($order->get_items() as $item_id => $item) {
        if (strpos( strtolower($item->get_name()),'mecard')) {
            $is_mecard = 1;
        }
    }*/
    if ($is_mecard) {
        $str = sprintf( '<div class="mecard-box"><h3>Thanks for your MeCard order, %s!</h3>', esc_html( $order->get_billing_first_name() ) );
        //$str = '<div class="mecard-box"><h3>Thanks for your MeCard order, '.esc_html( $order->get_billing_first_name()).'</h3>' ;
        $str .= '<br/><p>What next?</p>';
        $str .='<ol>
                <li>If you haven\'t done so yet, pay for this order using the account details below</li>
                <li>Upload your card designs in the <a href="'.site_url().'/manage-mecard-profiles/new-cards-and-tags/">management console</a> (also accessible via the "Manage Mecard Profiles" link in the top navigation)</li>
                <li>We\'ll check your designs for issues and feed back if we find any</li>
                <li>Your order will be manufactured and shipped to the address on this order</li>
                </ol>
                </div>
                ';
    }
    //$str = '';
    return $str;
}

add_action( 'woocommerce_new_order', 'link_cards_to_order',  99, 2  );


function link_cards_to_order($order_id,$order) {
    $arr_qty = array();
    $card_id = 0;
    //$order = wc_get_order($order_id);
    foreach ($order->get_items() as $item_id => $item) {
        $product = $item->get_product();
        if ($product->get_type() == 'mecard-profile') {
            update_post_meta($product->get_id(),'wpcf-profile-type','professional');
        } else {
            $args = array(
                'post_type'  => 't',
                'posts_per_page' => -1,
                'author' => get_current_user_id(),
                'meta_query' => array(
                    array(
                        'key'   => 'wpcf-cart-item-key',
                        'value' => $item->legacy_cart_item_key.'-'.get_current_user_id()
                    )
                )
            );
            $tags = get_posts($args);
            if (count($tags) != $item->get_quantity()) {
                // do something to fix it.
                wp_mail('info@taggable.co.za','Order tag quantity mismatch: #'.$order_id,'Dear admin, \n\n Order '.$order_id.'has a mismatched order quantity vs tags created.\n\n\ Qty: '.$item->get_quantity().'\nTags: '.count($tags));
            }
            // for backwards compatibility in case cart item key doesn't have user_id appended
            /*if (!count($tags) > 0) {
                $args = array(
                    'post_type'  => 't',
                    'posts_per_page' => -1,
                    'author' => get_current_user_id(),
                    'meta_query' => array(
                        array(
                            'key'   => 'wpcf-cart-item-key',
                            'value' => $item->legacy_cart_item_key
                        )
                    )
                );
                $tags = get_posts($args);
            }*/
            foreach ($tags as $tag) {
                $output = toolset_connect_posts( 'order-mecard-tag', $order_id, $tag->ID );
                //$delete_success = delete_post_meta($tag->ID,'wpcf-cart-item-key');
            }
        }

    }

}

add_action( 'woocommerce_order_status_pending_to_cancelled', 'delink_cards_from_cancelled_order',  99, 1  );

function delink_cards_from_cancelled_order($order_id) {

    $tags = toolset_get_related_posts($order_id,'order-mecard-tag',array('query_by_role'=> 'parent','return' => 'post_id'));
    foreach ($tags as $tag) {
        toolset_disconnect_posts('order-mecard-tag',$order_id,$tag);
    }

}

add_action('woocommerce_order_status_on-hold','remove_cart_item_key');
add_action('woocommerce_order_status_pending_to_processing','remove_cart_item_key');

function remove_cart_item_key($order_id) {
    $tag_ids = toolset_get_related_posts($order_id,'order-mecard-tag',array('query_by_role'=> 'parent','return' => 'post_id','limit' => 1000));
    foreach ($tag_ids as $tag_id) {
        delete_post_meta($tag_id,'wpcf-cart-item-key');
    }
}

function create_tag($product_type,$cart_item_key = null) {
    $fields = array(
        'post_title' => $product_type.'-'.get_current_user_id().'-'.substr(uniqid('', true), -5),
        'post_author'    => get_current_user_id(),
        'post_status'    => 'publish',
        'post_type' => 't'
    );
    $card_id = wp_insert_post($fields);
    //update_post_meta($card_id,'wpcf-card-status','order-received');
    update_post_meta($card_id,'wpcf-tag-type',$product_type);
    update_post_meta($card_id,'wpcf-shipped',0);
    update_post_meta($card_id,'wpcf-packaged',0);
    update_post_meta($card_id,'wpcf-auto_download_vcard',1);
    update_post_meta($card_id,'wpcf-cart-item-key',$cart_item_key.'-'.get_current_user_id());
    return $card_id;
}

function me_product_array($product_id) : array
{
    $arr_products = array(
        MECARD_PRODUCT_ID => 'contactcard',
        MECARD_KEYRING_PRODUCT_ID => 'keyring',
        MECARD_PHONETAG_PRODUCT_ID => 'phonetag',
//        MECARD_PROFILE_UPGRADE_PRODUCT_ID => 'profile_upgrade',
        MECARD_BUNDLE_PRODUCT_ID => 'bundle',
        MECARD_CLASSIC_BUNDLE_PRODUCT_ID => 'classic-bundle',
        MECARD_CLASSIC_PRODUCT_ID => 'classiccard',
        MECARD_CLASSIC_CORP_PRODUCT_ID => 'classiccard'
    );
    $bundle = ($product_id == MECARD_CLASSIC_BUNDLE_PRODUCT_ID) ? array('classiccard',  'phonetag') : array('contactcard', 'phonetag');
    $product = wc_get_product($product_id);
    $product_type = $arr_products[$product_id];
    $allowed = array('contactcard', 'phonetag', 'bundle', 'classiccard', 'classic-bundle');
    if (in_array($arr_products[$product_id], $allowed)) {
        return ($arr_products[$product_id] == 'bundle' || $arr_products[$product_id] == 'classic-bundle') ? $bundle : array($arr_products[$product_id]);
    } else {
        return [];
    }
}

add_action( 'woocommerce_add_to_cart', 'add_tags_to_account',  10, 6  );

function add_tags_to_account($cart_item_key, $product_id, $quantity, $variation_id, $variation, $cart_item_data ) {

    if(!is_user_logged_in()) {
        return;
    }
    

        $loop = me_product_array($product_id);
        foreach ($loop as $product_type) {
            for ($x=1;$x<= $quantity;$x++) {
                $tag_id = create_tag($product_type,$cart_item_key);
                //$output = toolset_connect_posts( 'order-mecard-tag', $order_id, $card_id );
            }
        }

}

/*add_action( 'woocommerce_add_to_cart', 'add_profile_to_account',  10, 6  );

function add_profile_to_account($cart_item_key, $product_id, $quantity, $variation_id, $variation, $cart_item_data ) {

}*/

// define the woocommerce_remove_cart_item callback
function action_woocommerce_remove_cart_item( $cart_item_key, $instance ) {
    $args = array(
        'post_type'  => 't',
        'posts_per_page' => -1,
        'author' => get_current_user_id(),
        'meta_query' => array(
            array(
                'key'   => 'wpcf-cart-item-key',
                'value' => $cart_item_key.'-'.get_current_user_id()
            )
        )
    );
    $tags = get_posts($args);
    if (!empty($tags)) {
        //safeguard: if the first tag has a related order, then all tags already have an order, don't trash any of them
        if (!get_tag_order_id($tags[0]->ID) > 0) {
            foreach ($tags as $tag) {
                $result = wp_trash_post($tag->ID);
            }
        }
    }



};

add_action( 'woocommerce_after_cart_item_quantity_update', 'add_remove_cards', 20, 4 );
function add_remove_cards( $cart_item_key, $quantity, $old_quantity, $cart ){
    //if( ! is_cart() ) return; // Only on cart page
    if (!preg_match('/\/basket\//',$_REQUEST['_wp_http_referer'])) return;
    $user_id = get_current_user_id();
    $tag_key = $cart_item_key.'-'.$user_id;
    $tags = get_tags_by_item_key($tag_key);
    $product_id = 0;
    $items = $cart->get_cart();
    foreach ($items as $item => $values) {
        if ($values['key'] == $cart_item_key) {
            $product_id = $values['product_id'];
            break;
        }
    }


    $diff = $quantity - $old_quantity;


    if (count($tags) > 0) {
        if ($diff > 0) {
            // add more tags of the same type
            add_tags_to_account($cart_item_key, $product_id, $diff, null, null, null);
        } elseif ($diff < 0) {
            // remove the number of tags that the order was reduced by
            $products = me_product_array($product_id);

                foreach ($products as $product) {
                    $arr_tags = array_filter($tags, function($obj) use ($product) {
                        $type = get_post_meta($obj->ID,'wpcf-tag-type',true);
                        return $type == $product;
                    });

                    for ($x = $diff; $x < 0; $x++) {
                        $removed = array_pop($arr_tags);
                        wp_trash_post($removed->ID);
                    }
                }
            }
        }
}

// add the action
add_action( 'woocommerce_remove_cart_item', 'action_woocommerce_remove_cart_item', 10, 2 );

add_filter( 'wc_add_to_cart_params', function( $params ) {
// Don't modify params if we're on a WooCommerce page (delete if not needed).
    if ( is_woocommerce() ) {
    //    return $params;
    }

if (is_shop()) {
    // Set the 'View cart' text
    $params['i18n_view_cart'] = 'Configure cards and tags';
// Set the 'View cart' URL
    $params['cart_url'] = site_url('manage-mecard-profiles/new-cards-and-tags');;
} else {
    $params['i18n_view_cart'] = '';
// Set the 'View cart' URL
    $params['cart_url'] = site_url('');
    }

    return $params;
} );

function save_card_label( $post_id, $form_data ) {
    $status = get_post_meta($post_id,'wpcf-card-status',true);
    $post_type = get_post_type($post_id);
    if (in_array($status, array('order-received','design-submitted')) && $post_type == 't') {
        $custom_title = "";
        if ($_POST['wpcf-card-label'] == '') {
            if ($_POST['@mecard-profile-mecard-tag_parent']) {
                $profile_name = get_the_title($_POST['@company-mecard-tag_parent']);
                update_post_meta($post_id,'wpcf-card-label',$profile_name);
            }

        } else {
            $custom_title = $_POST['wpcf-card-label'];
        }
        /*if ($custom_title) {
            $title = strtolower(preg_replace('/\s/','-',$custom_title));
            $updated_data = array(
                'post_title' => $title,
                'post_name' => sanitize_title($title),
            );
            wp_update_post( $updated_data );
        }*/


    }
}

add_action( 'cred_save_data', 'save_card_label', 33, 2 );

function submit_design($post_id,$form_data) {
    if ($form_data['post_type'] == 't') {
        if ($_POST['save_submit']) {
            update_post_meta($post_id,'wpcf-design-submitted',1);
        }
    }
}

//add_action( 'cred_save_data', 'submit_design', 33, 2 );

function migrate_profiles() {
    if (is_page('migrate')) {
        $userids = $_POST['musers'];
        $users = '';
        if ($userids) {
            $users = get_users(array(
                'fields'=> 'all_with_meta',
                'include' => array($userids)
            ));
        }




        $companies = array();
        foreach ($users as $user) {

            $targs = array("post_type" => "t", "author" => $user->get('ID'));
            $tquery = get_posts( $targs );
            $tag_id = '';

            if ($tquery) {
                $tag_id = $tquery[0]->ID;
            }
            $usermeta = get_user_meta($user->ID);
            $meta = array_map(function( $a ){ return $a[0]; },$usermeta);
            print_r($meta);
            $profile = array(
                'post_title' => $user->get('first_name').' '.$user->get('last_name'),
                'post_type' => 'mecard-profile',
                'post_status' => 'Publish',
                'post_author' => $user->ID
            );
            $profile_meta = array(
                'first-name'=> $user->get('first_name'),
                'last-name'=> $user->get('last_name'),
                'email-address'=> $user->get('user_email'),
                'instagram'=> $meta['instagram'],
                'mobile-number'=> $meta['mobile_number'],
                'facebook'=> $meta['facebook'],
                'youtube-url'=> $meta['youtube'],
                'linkedin-url'=> $meta['linkedin'],
                'twitter-url'=> $meta['twitter'],
                'job-title'=> $meta['job_title']
            );

            $profileargs = array("post_type" => "mecard-profile", "title" => $user->get('first_name').' '.$user->get('last_name'));
            $profile_query = get_posts( $profileargs );

            if ($profile_query) {
                $profile_id = $profile_query[0]->ID;
                echo '<br><h1><strong>Found Profile: '.$user->first_name.' '.$user->last_name.':'.$profile_id.'</strong></h1>';
            } else {
                $profile_id = wp_insert_post($profile);
                echo '<br><h1><strong>Created Profile: '.$user->first_name.' '.$user->last_name.'</strong></h1>';
                foreach ($profile as $key=>$val) {
                    echo $key.': '.$val.'<br>';
                }

            }
            foreach ($profile_meta as $key=>$val) {
                update_post_meta($profile_id,'wpcf-'.$key,$val);
                echo $key.': '.$val.'<br>';
            }

            if ($profile_id && $tag_id) {
                toolset_connect_posts('mecard-profile-mecard-tag',$profile_id,$tag_id);
                echo '<br> connecting profile '.$profile_id.' to tag '.$tag_id.'<br>';
            } else {
                echo '<br> Could not connect  profile '.$profile_id.' to tag '.$tag_id.'<br>';
            }


            $company_base = array(
                'post_title' => $meta['company_name'],
                'post_type' => 'company',
                'post_status' => 'Publish',
                'post_author' => $user->ID
            );

            $arr_address = maybe_unserialize($meta['company_address']);
            if (is_array($arr_address)) {
            $address = implode(', ',$arr_address);
            } else {
                $address = '';
            }

            if (!strpos($meta['company_website_url'],'http')) {
                $pre = 'http://';
            }

            $company_meta = array(
                'support-email' => $meta['company_email'],
                'company-telephone-number' => $meta['company_phone_number'],
                'company-website' => $pre.$meta['company_website_url'],
                'company-address' => str_replace(' ,','',$address) ,
            );


            $company = $meta['company_name'];
            if ($company) {
                $args = array("post_type" => "company", "s" => $company, 'posts_per_page' => -1);
                $query = get_posts( $args );
                if (!$query) {
                    $company_id = wp_insert_post($company_base);
                    echo 'New company '.$company.' added';
                    '<h3><h3>company</h3>';
                    foreach ($company_base as $key=>$val) {
                        echo $key.': '.$val.'<br>';
                    }
                    foreach ($company_meta as $key=>$val) {
                        echo $key.': '.$val.'<br>';
                        update_post_meta($company_id,'wpcf-'.$key,$val);
                    }
                } else {
                    $company_id = $query[0]->ID;
                    echo 'Company '.$company.' attached to profile';
                }
                toolset_connect_posts('company-mecard-profile',$company_id,$profile_id);
                echo '<br> connecting company '.$company_id.' to profile '.$profile_id.'<br>';
                toolset_connect_posts('company-mecard-tag',$company_id,$tag_id);
                echo '<br> connecting company '.$company_id.' to '.$tag_id.'<br>';
            }



        }
    }

}

add_action('template_redirect','migrate_profiles');

/*filter attachments to only own ones*/

add_filter( 'ajax_query_attachments_args', 'show_current_user_attachments' );

function show_current_user_attachments( $query ) {
    $user_id = get_current_user_id();

    if ( $user_id && current_user_can('author')) {
        $query['author'] = $user_id;
    }
    return $query;
}

//Allow Contributors to Upload Media
add_action('init', 'allow_customer_uploads',99,0);


function allow_customer_uploads() {
    $contributor = get_role('customer');
    $contributor->add_cap('upload_files');
}

add_action( 'cred_before_save_data', 'set_profile_title', 10,1 );

function set_profile_title( $data ) {

    // Only set for post_type = mecard-profile!
    if ( 'mecard-profile' !== $data['post_type'] ) {
        return;
    }
    if ($_POST['wpcf-first-name'] && $_POST['wpcf-last-name']) {
        $_POST['post_title'] = $_POST['wpcf-first-name'].' '.$_POST['wpcf-last-name'];
    }
}

//auto login after signup

add_action( 'cred_save_data', 'mecard_cred_autologin', 10, 2 );

function mecard_cred_autologin( $post_id, $form_data ){

    if ( CRED_LOGIN_FORM == $form_data['id'] ) { // Edit as required

        if ( !empty( $_POST['user_email'] ) && !empty( $_POST['user_pass'] ) ) {

            // get the user credentials from the $_POST object
            $user = array(
                'user_login'    =>   $_POST['user_email'],
                'user_password' =>   $_POST['user_pass'],
                'remember'      =>   true
            );
            $login = wp_signon( $user, false );

            if ( is_wp_error($login) ) {
                error_log( $login->get_error_message() );
            }

        }
    }
}

add_filter('woocommerce_login_form_end', 'my_show_nextend_social_on_woo_login');
function my_show_nextend_social_on_woo_login() {
    // This shortcode is typically what Nextend uses for login buttons:
    echo do_shortcode('[nextend_social_login]');
}


add_shortcode('request-accept-decline','request_accept_decline');

function request_accept_decline() {
    global $post;
    if ($post->post_type == 'request')
    $accept = '<div id="accept-error"></div><a href="#" id="request-accept" data-request_id="'.$post->ID.'"><button class="add-button">Accept</button></a>';
    return $accept;
}

add_action('wp_ajax_accept_profile_invite','mecard_accept_profile_invite');

function mecard_accept_profile_invite() {
    $nonce = $_POST['_wpnonce'] ?? '';
    if ( ! wp_verify_nonce($nonce, 'myajax-next-nonce') ) {
        wp_send_json_error(['message' => 'Not allowed'], 403);
    }
    $request_id = $_POST['request_id'];
    $request = get_post_meta($request_id);
    if (!$request['wpcf-request-status'][0] == 'accepted') {
        $profile_id = toolset_get_related_post($request_id,'mecard-profile-request');
        $post_args = array(
            'post_title' => $request['wpcf-recipient-email'][0].'-'.$profile_id,
            'post_type' => 'user-role',
            'post_status' => 'publish'
        );

        $user_role_id = wp_insert_post($post_args);
        add_post_meta($user_role_id,'wpcf-role','profile-owner');
        $date = date('Y-m-d');
        add_post_meta($user_role_id,'wpcf-response-date',$date);
        $output = toolset_connect_posts('user-role-mecard-profile',$user_role_id,$profile_id);
        update_post_meta($request_id,'wpcf-request-status','accepted');
    } else {
        $output = array('success' => false,'error_code'=>'1', 'message' => 'This invite has already been accepted.');
    }
    wp_send_json_success(['output' => $output]);
}

function customise_cred_notifications( $headers, $formid, $postid, $notification_name, $notification_number ) {
    if ($formid==CONTACT_FORM_ID && $notification_name=='Contact Us') {
        $myheaders = array( 'Reply-To: '.$_REQUEST["wpcf-email"] );
        return array_merge($headers, $myheaders);
    }
    return $headers;
}
add_filter('cred_mail_header', 'customise_cred_notifications', 10, 5);

// update post slug if type keyring

function update_post_slug( $post_id ) {

$post_type = get_post_type( $post_id );
    if ( $post_type == 't') {
        $tag_type = get_post_meta($post_id,'wpcf-tag-type',true);
        if ($tag_type == 'keyring') {
            remove_action( 'save_post', 'update_post_slug' );
            $updated_data = array(
                'ID' => $post_id,
                'post_name' => sanitize_title(get_the_title( $post_id ))
            );
            wp_update_post( $updated_data );
            add_action( 'save_post', 'update_post_slug' );
        }

    } else {
        return;
    }
}
add_action( 'save_post', 'update_post_slug' );


// remove header from pro profiles
add_action( 'wp' , 'astra_remove_new_header' );

function astra_remove_new_header() {
    if (get_post_type() == 'mecard-profile' || 't' || 'riscura') {
        global $post;
        $postid = $post->ID;
        if (get_post_type() == 't') {
            $postid = toolset_get_related_post($post->ID,'mecard-profile-mecard-tag');
        }
        if (get_post_meta($postid,'wpcf-profile-type',true) == 'professional' || get_post_type() == 'riscura') {
            remove_action( 'astra_primary_header', array( Astra_Builder_Header::get_instance(), 'primary_header' ) );
            remove_action( 'astra_mobile_primary_header', array( Astra_Builder_Header::get_instance(), 'mobile_primary_header' ) );
        }
        if (get_post_type() == 'riscura') {
            remove_action( 'astra_below_footer', array( Astra_Builder_Footer::get_instance(), 'mobile_primary_footer' ) );
        }

    }

}

// automatically trash all tags when order is cancelled
add_action('woocommerce_order_status_on-hold_to_cancelled','delete_tags');
add_action('woocommerce_order_status_processing_to_cancelled','delete_tags');
function delete_tags($order_id) {
    $postids = toolset_get_related_posts($order_id,'order-mecard-tag',array('query_by_role'=> 'parent','return' => 'post_id'));
    foreach ($postids as $id) {
        wp_trash_post($id);
    }
}

add_shortcode('order_data_for_tag','order_data_for_tag');

function order_data_for_tag($atts) {
    global $post;
    global $wpdb;
    if (get_post_type($post) == 't') {

        $cart_item = false;
        if (get_post_meta($post->ID,'wpcf-cart-item-key',true)) {
            // no order yet, items still in cart
            $cart_item = true;
        }
        $order_id = get_tag_order_id($post->ID);
        $frontend = false;
        if (is_array($atts)) {
            if ($atts['data'] == 'has_order') {
                $frontend = true;
            }
        }


        if (!$order_id && $frontend == true && $cart_item == true) {
            $order_status_html = '<div class="order-status"><i class="fas fa-shopping-cart"></i>&nbsp;<div class="mytooltip">Complete order<span class="mytooltiptext"> Click "Checkout" here <br>(or on the top right) <br>to place your card and tag order with us.</span></div>'.
                                  '&nbsp;<a href="' . wc_get_checkout_url() . '">Checkout</a></div>';
        }


        if ($order_id) {


            $order = wc_get_order($order_id);
            $status = $order->get_status();

            if ($frontend == true) {
                $order_status_html = '<div class="order-status"><i class="fas fa-check"></i> Order Placed #'.$order_id.'</div>';
            }


            if ($status == 'on-hold') {
                $icon = '<i class="fas fa-pause me-orange"></i>';

                if ($frontend == true) {
                    $order_status_html .= '<div class="order-status"><i class="fas fa-times"></i> Payment not received </div>';
                }

            }
            if ($status == 'processing') {
                $icon = '<i class="fas fa-play me-green"></i>';
                if ($frontend == true) {
                    $order_status_html .= '<div class="order-status"><i class="fas fa-check"></i> Payment Received </div>';
                }
            }
            if ($status == 'pending') {
                $icon = '<i class="fas fa-hourglass-start me-grey"></i>';
                if ($frontend == true) {
                    $order_status_html .= '<div class="order-status"><i class="fas fa-hourglass-start me-grey"></i> Payment Pending </div>';
                }
            }

            $html = '<a href="' . $order->get_edit_order_url() . '" target="_blank">#' . $order->get_id() . '</a>&nbsp;' . $icon;
        } else {
            $html = '<div class="no-order">No Order <i class="fas fa-exclamation-triangle"></i></div>';
        }
    }
    if (is_array($atts)) {
        if ($atts['data']) {
            if ($atts['data'] == 'fe_order_link') {
                if ($order_id) {
                    return '<a href="' . get_site_url() . '/my-account/view-order/' . $order_id . '/">#' . $order_id . '</a>';
                } else {
                    return;
                }

            }
        }
    }

    if ($frontend == true) {
        return $order_status_html;
    } else {
        return $html;
    }
}

add_shortcode('assigned_to','assigned_to');
function assigned_to() {
    global $post;
    $profile_id = toolset_get_related_post($post,'mecard-profile-mecard-tag');
    $firstname = get_post_meta($profile_id,'wpcf-first-name', true);
    $lastname = get_post_meta($profile_id,'wpcf-last-name', true);
    return $firstname.' '.$lastname;
}
function get_tag_order_id($tag_id) {
    global $wpdb;

        $query = $wpdb->prepare("
                select parent.element_id as parent_id from wp_toolset_connected_elements child
                inner join wp_toolset_associations link on child.group_id = link.child_id
                inner join wp_toolset_connected_elements parent on link.parent_id = parent.group_id
                inner join wp_toolset_relationships rel on link.relationship_id = rel.id
                where child.element_id = %d and rel.slug = 'order-mecard-tag';
    ", $tag_id);

        $result = $wpdb->get_row($query);
        $order_id = $result->parent_id;
        return $order_id;
}


function profile_upgrade_form() {
    global $post;
    $inbasket = false;
    $itemkey = '';
    if (WC()->cart) {
        $cartitems = WC()->cart->get_cart();
        if ($cartitems) {
            foreach ($cartitems as $key => $item) {
                if ($item['product_id'] == $post->ID) {
                    $inbasket = true;
                    $itemkey = $key;
                    break;
                }
            }
        }
    }


    if ($inbasket) {

        $form = '<a href="'.wc_get_cart_remove_url($itemkey).'" id="'.$itemkey.'" class="remove remove_from_cart_button remove-profile-from-cart" aria-label="Remove this item" data-product_id="'.$post->ID.'" data-cart_item_key="'.$itemkey.'" data-product_sku="">
        <button class="add-button"><i class="far fa-check-square"></i> Pro Upgrade selected</button></a>';

    } else {
       $form = '<a class="ajax_add_to_cart add_to_cart_button profile-add-to-cart" data-product_id="'.$post->ID.'" data-cart_item_key="" data-product_sku href="?add-to-cart='.$post->ID.'"><button class="add-button">Upgrade to Pro</button></a>&nbsp;&nbsp;<div class="mytooltip no-dots"><i class="far fa-question-circle"></i><span class="mytooltiptext">Upgrade your online profile to your company\'s branding. Customise your company branding by editing it in the company section above. </span></div>';
    }


    return $form;
}

add_shortcode('profile_upgrade_form','profile_upgrade_form');

add_filter( 'wpv_filter_query', 'process_cards_with_orders', 101, 3 );

function process_cards_with_orders($query_args,$view_settings,$view_id) {
    if ($view_settings['view_slug'] == 'tag-backend-admin') {
        $query_args['orderby'] = 'ID';
        $query_args['order'] = 'DESC';
        $query_args['meta_query'][] = array(
           'relation' => 'OR',
           array(
               'key' => 'wpcf-cart-item-key',
               'compare' => 'NOT EXISTS'
           ),
           array(
               'key' => 'wpcf-cart-item-key',
               'value' => '',
               'compare' => '=',
           )
        );
    }
    return $query_args;

}

function custom_add_to_cart($atts) {

    $slug = $atts['slug'];

    $me_products = array(
        'classic-card' => MECARD_CLASSIC_PRODUCT_ID,
        'custom-card' => MECARD_PRODUCT_ID,
        'classic-bundle' => MECARD_CLASSIC_BUNDLE_PRODUCT_ID,
        'custom-bundle' => MECARD_BUNDLE_PRODUCT_ID,
        'key-ring' => MECARD_KEYRING_PRODUCT_ID,
        'phone-tag' => MECARD_PHONETAG_PRODUCT_ID
    );

    $form = '<form action="?add-to-cart='.$me_products[$slug].'" class="cart wooviews-template-quantity-button" method="post" enctype="multipart/form-data">
                	<div class="quantity wooviews-template-quantity">
		<label class="screen-reader-text" for="quantity_6371091b58a33">The Easy Card quantity</label>
		<input type="number" id="quantity_6371091b58a33" class="input-text qty text" step="1" min="0" max="" name="quantity" value="1" title="Qty" size="4" placeholder="" inputmode="numeric">
	</div>
	<button type="submit" data-product_id="'.$me_products[$slug].'" data-product_sku=""  class="add_to_cart_button button ajax_add_to_cart wooviews-template-add_to_cart_button mecard-management">Add</button></form>';

   return $form;
}

add_shortcode('me_custom_add_to_cart','custom_add_to_cart');

function draw_classic_card($atts) {
    global $post;
    $card_front = get_post_meta($post->ID,'wpcf-card-front',true);
    if (!$card_front) {
        $card_front = plugin_dir_url(__FILE__) . 'images/upload.png';
    }
    $name = get_post_meta($post->ID,'wpcf-name-on-card',true);
    if (!$name) {
        $name = '< Name on Card >';
    }
    $title = get_post_meta($post->ID,'wpcf-job-title-on-card',true);

    if ($card_front) {
        $html = ' <div class="classic-logo"><img id="card-front-'.$post->ID.'" src="'.$card_front.'"></div>
                  <div class="classic-name">'.$name.'</div>
                  <div class="classic-job-title">'.$title.'</div>

';
    } else {
        $html = 'no image';
    }
    return $html;
}

add_shortcode('classic_card','draw_classic_card');

add_action('template_redirect','attach_cards_manually');

function attach_cards_manually() {
    if (isset($_GET['man_o'])) {
        if ($_GET['order_id'] && $_GET['man_o'] && $_GET['key'] && current_user_can('administrator')) {
            $order = wc_get_order($_GET['order_id']);
            $order_id = $_GET['order_id'];
            $key = $_GET['key'];
            if ($order) {

                $args = array(
                    'post_type'  => 't',
                    'posts_per_page' => -1,
                    'meta_query' => array(
                        array(
                            'key'   => 'wpcf-cart-item-key',
                            'value' => $key
                        )
                    )
                );
                $tags = get_tags_by_item_key($key);
                foreach ($tags as $tag) {
                    $output = toolset_connect_posts( 'order-mecard-tag', $order_id, $tag->ID );
                    //$delete_success = delete_post_meta($tag->ID,'wpcf-cart-item-key');
                }



            }
        }
    }

}

function get_tags_by_item_key($key) {
    $args = array(
        'post_type'  => 't',
        'posts_per_page' => -1,
        'orderby'=> 'date',
        'order'   => 'ASC',
        'meta_query' => array(
            array(
                'key'   => 'wpcf-cart-item-key',
                'value' => $key
            )
        )
    );

    return get_posts($args);
}

if( ! function_exists( 'remember_me_checked' ) ) :

    function remember_me_checked() {
        ?>
        <script type="text/javascript">
            function checkit() {
                document.getElementById('rememberme').checked = true;
            }
            window.onload = checkit;
        </script>
        <?php
    }

    add_action( 'woocommerce_after_customer_login_form', 'remember_me_checked' );

endif;

function trash_abandoned_tags ($workflow) {
    $cart = $workflow->data_layer()->get_cart();
    $customer = $workflow->data_layer()->get_customer();
    //write_log($cart);
    $user_id = $cart->data['user_id'];
    if ($cart->data['items']) {
        foreach (maybe_unserialize($cart->data['items']) as $key=>$item) {

            $args = array(
                'post_type'  => 't',
                'posts_per_page' => -1,
                'meta_query' => array(
                    array(
                        'key'   => 'wpcf-cart-item-key',
                        'value' => $key.'-'.$cart->data['user_id'],
                    )
                )
            );

            $tags = get_posts($args);
            if (!empty($tags)) {
                //safeguard: if the first tag has a related order, then all tags already have an order, don't trash any of them
                if (!get_tag_order_id($tags[0]->ID) > 0) {
                    foreach ($tags as $tag) {
                        $result = wp_trash_post($tag->ID);
                    }
                }
            }
        }
        //$handler = new WC_Session_Handler();
        //$handler->get_session($user_id);
        //$handler->delete_session($user_id);

    }
}

if (!function_exists('write_log')) {

    function write_log($log) {
        if (true === WP_DEBUG) {
            if (is_array($log) || is_object($log)) {
                error_log(print_r($log, true));
            } else {
                error_log($log);
            }
        }
    }

}

add_filter('cred_select2_ajax_get_potential_relationship_parents_query_limit', function($limit){
    return 50;
});


# riscura functions

add_action( 'cred_save_data', 'set_riscura_profile', 33, 2 );

function set_riscura_profile($post_id, $form_data): void
{
    if ($form_data['post_type'] == 'riscura' && $form_data['form_type'] == 'edit') {
        $profile_meta = get_post_meta($post_id);
        wp_update_post(array('ID' => $post_id,'post_title' => $profile_meta['wpcf-first-name-r'][0].' '.$profile_meta['wpcf-last-name-r'][0]));
        update_post_meta($post_id,'wpcf-assigned-r',1);
    }
    return;
}

add_shortcode('riscura_buttons','riscura_buttons');

function riscura_buttons($atts)
{

    global $post;
    $mobile = get_post_meta($post->ID,'wpcf-mobile-number-r', true);
    $first_name = get_post_meta($post->ID,'wpcf-first-name-r', true);
    $countryCode = '27';
    $mobile_int =  str_replace(' ','',preg_replace('/^0/', '+'.$countryCode, $mobile));
    $email = get_post_meta($post->ID,'wpcf-email-r', true);
    $html = '<div class="row profile-buttons">
                    <div class="col col-12">
                        <a href="tel:'.$mobile.'">
                            <button class="phone riscura"><i class="fas fa-mobile-alt"></i> Call</button>
                        </a>
                    </div>
               </div>
               <div class="row profile-buttons">      
                        <div class="col col-12">
                            <a href="mailto:'.$email.'">
                                <button class="email riscura"><i class="fas fa-envelope"></i> Email</button>
                                </a>
                        </div>
               </div>
               <div class="row profile-buttons">
                        <div class="col col-12">
                            <a href="https://wa.me/'.$mobile_int.'">
                                <button class="whatsapp riscura"><i class="fab fa-whatsapp"></i> Whatsapp </button>
                            </a>
                        </div>
               </div>
                    
                </div>' ;
    return $html;
}

add_shortcode('riscura_qr','riscura_qr');

function riscura_qr() {
    global $post;
    $html = '
   <a href="#" class="open-qr-modal-riscura" data-profile-url="'.get_permalink($post->ID).'" title="Generate QR code for '.$post->post_title.'" data-profile-name="'.$post->post_title.'" data-toggle="modal" data-target="#QRModal">Download QR code</a>
    <!-- QR Modal -->

<div class="modal fade qr-generator" id="QRModal" data-tag="'.$post->ID.'" data-profile-id="" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
    
      <div class="modal-header">
        <h5>QR Code Generator</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      
      <div class="modal-body">
         <div class="container-fluid">
           <div class="row">
             <div class="col col-sm-12">
             	<div class="qr-container profile-qr" data-tag="'.$post->post_title.'">                            	
                    <div id="profile-qr-code-full" class="profile-qr-code" data-url="'.get_permalink($post->ID).'" data-profile-name="'.$post->post_title.'" data-qr_colour="#000000" data-qr_bg="#FFFFFF" data-ypos="" data-xpos="" data-width="200">
                    </div>
                </div>
             </div>
           </div>
         </div>
         </div>
         
        <div class="modal-footer">
            <div id="qr-download-gif" style="display:none">
                <img class="qr-icon" src="'.plugin_dir_url( __FILE__ ).'images/download.gif">
            </div>
            <button id="download-qr">Download</button>
        </div>  
        
    </div>
  </div>

</div>
  <!-- end modal -->
    ';
    return $html;
}

/**
 * No initial results
 *
 * Don't show View results until a filter has been applied
 *
 * Tests for custom field filters, taxonomy filters, or text searches
 */
function tssupp_no_initial_results( $query_results, $view_settings, $view_id ){

    $target_views = array( RISCURA_ENTER_TAG_VIEW ); // Edit to add IDs of Views to add this to

    if ( in_array( $view_id, $target_views ) ) {

        // if there is a search term set
        if ( !isset( $query_results->query['meta_query'] ) && !isset( $query_results->query['tax_query'] ) && !isset( $query_results->query['s'] ) ) {
            $query_results->posts = array();
            $query_results->post_count = 0;
            $query_results->found_posts = 0;
        }
    }

    return $query_results;
}
add_filter( 'wpv_filter_query_post_process', 'tssupp_no_initial_results', 10, 3 );

function func_search_by_exact_title( $search, $wp_query ){
    global $wpdb;
    global $WP_Views;

    if($WP_Views->current_view == RISCURA_ENTER_TAG_VIEW){
        if ( empty( $search ) )
            return $search; // skip processing - no search term in query

        $q = $wp_query->query_vars;
        $search = '';
        foreach ( (array) $q['search_terms'] as $term ) {
            $term = esc_sql( $wpdb->esc_like( $term ) );
            $search = " AND ($wpdb->posts.post_title REGEXP '[[:<:]]".$term."[[:>:]]')";
           // $search = " AND ($wpdb->posts.post_title = '.$term.'";

        }

    }
    return $search;
}
//add_filter( 'posts_search', 'func_search_by_exact_title', 1000, 2 );



/**
 * Show WooCommerce Store Notice to Logged In Previous Customers Only.
 */
function modify_woocommerce_demo_store_customers_only( $notice_html ) {
    if (is_singular(array('riscura','t','mecard-profile')) || is_page(array('riscura-management','riscura-tag-code')))  {
        return '';
    }


    return $notice_html;
}
add_filter( 'woocommerce_demo_store', 'modify_woocommerce_demo_store_customers_only', 11 );

add_shortcode('management_console_nav', function($atts) {

    $args = array(
        'post_type'  => array('company','mecard-profile'),
        'posts_per_page' => -1,
        'status' => 'publish',
        'author' => get_current_user_id(),

    );
    $co_pro = get_posts($args);
    $counter = array('new_tags' => 0, 'mecard-profile' => 0, 'company' => 0,'live_tags' => 0);
    foreach ($co_pro as $mypost) {
        $counter[$mypost->post_type]++;
    }

    $args = array(
        'post_type'  => 't',
        'posts_per_page' => -1,
        'status' => 'publish',
        'author' => get_current_user_id(),
        'meta_query' => array(

            array(
                'key' => 'wpcf-packaged',
                'value' => '0'
            )
        )
    );

    $new_tags = get_posts($args);
    $counter['new_tags'] = count($new_tags);

    $args = array(
        'post_type'  => 't',
        'status' => 'publish',
        'posts_per_page' => -1,
        'author' => get_current_user_id(),
        'meta_query' => array(

            array(
                'key' => 'wpcf-packaged',
                'value' => '1'
            )
        )
    );

    $live_tags = get_posts($args);
    $counter['live_tags'] = count($live_tags);
    $warning = array('new_tags' => '', 'mecard-profile' => '', 'company' => '','live_tags' => '');
    foreach ($counter as $key => $val) {
        $warning[$key] = ($val > 0) ? 'badge-warning' : '';
    }

    $basket_warning = '';

    if (WC()->cart) {
        $cartitems = WC()->cart->get_cart();
        if ($cartitems) {
            foreach ($cartitems as $key => $item) {
                if (
                        in_array(
                                $item['product_id'],
                                array(MECARD_CLASSIC_PRODUCT_ID,MECARD_CLASSIC_BUNDLE_PRODUCT_ID,MECARD_PRODUCT_ID,MECARD_BUNDLE_PRODUCT_ID,MECARD_KEYRING_PRODUCT_ID,MECARD_PHONETAG_PRODUCT_ID)
                        )
                ) {
                    //,MECARD_PROFILE_PRODUCT_ID
                    $basket_warning = '<div style="margin-block-start: 24px;" class="alert alert-warning"> You have tags in your basket. Please <a href="'.wc_get_checkout_url().'">check out</a> to continue.</div>';
                    break;
                }
            }
        }
    }


    $tab = $atts['tab'];
    $activetab = array();
    $activetab[$tab] = 'active';
    $path = site_url().'/manage-mecard-profiles';

    $nav = '<ul class="nav nav-tabs" id="myTab" role="tablist">
               <li class="nav-item" role="presentation">
                <a class="nav-link '.$activetab['dashboard'].'" href="'.$path.'/dashboard" id="dashboard-tab"  type="button" role="tab" aria-controls="Dashboard" aria-selected="true">Dashboard</a>
              </li>
              <li class="nav-item" role="presentation">
                <a class="nav-link '.$activetab['new'].'" href="'.$path.'/new-cards-and-tags" id="live-tab"  type="button" role="tab" aria-controls="new tags" aria-selected="true">New Cards and Tags <span class="badge '.$warning['new_tags'].'">'.$counter['new_tags'].'</span></a>
              </li>
              <li class="nav-item" role="presentation">
                <a class="nav-link '.$activetab['live'].'" href="'.$path.'/live-cards-and-tags" id="new-tab"  type="button" role="tab" aria-controls="profile" aria-selected="false">Live Cards and Tags <span class="badge">'.$counter['live_tags'].'</span></a>
              </li>
              <li class="nav-item" role="presentation">
                <a class="nav-link '.$activetab['companies'].'" href="'.$path.'/companies/" id="companies_tab"  type="button" role="tab" aria-controls="contact" aria-selected="false">Companies <span class="badge">'.$counter['company'].'</span></a>
              </li>
            <li class="nav-item" role="presentation">
                <a class="nav-link '.$activetab['profiles'].'" href="'.$path.'/profiles" id="profile_tab"  type="button" role="tab" aria-controls="contact" aria-selected="false">Profiles <span class="badge">'.$counter['mecard-profile'].'</span></a>
              </li>
             
              
              
            </ul>
             '.$basket_warning;
    return $nav;
});

add_shortcode('profile_edit_allowed','is_profile_edit_allowed');

function is_profile_edit_allowed($atts) {
    global $post;
    $profile_shared = toolset_get_related_posts($post,'user-role-mecard-profile',array('query_by_role'=>'child','return' => 'post_object'));
    //$profile_shared = toolset_get_related_post($post,'user-role-mecard-profile','parent');
    if (is_array($profile_shared)) {
        if (count($profile_shared) > 0) {
            return $profile_shared[0]->post_author == get_current_user_id();
        }
    }
    return false;
}

add_shortcode('more_links_edit_allowed','is_more_links_edit_allowed');

function is_more_links_edit_allowed($atts) {
    global $post;
    //$morelink_parent = toolset_get_parent_post_by_type($post,'mecard-profile');
    $profile = toolset_get_related_posts($post,'more-links',array('query_by_role'=>'child','return' => 'post_object'));
    //$profile_shared = toolset_get_related_post($post,'user-role-mecard-profile','parent');
    if (is_array($profile)) {
        if (count($profile) > 0) {
            $profile_shared = toolset_get_related_posts($profile[0],'user-role-mecard-profile',array('query_by_role'=>'child','return' => 'post_object'));
            if (is_array($profile_shared)) {
                if (count($profile_shared) > 0) {
                    return $profile_shared[0]->post_author == get_current_user_id();
                }
            }
        }
    }
    return false;
}

add_filter( 'wpv_filter_query', 'filter_tags_with_profiles', 101, 3 );

function filter_tags_with_profiles( $query, $view_settings, $view_id ) {
    if ($view_id == SELECT_CARD_VIEW_ID) {
        global $wpdb;

        $linked_tags_query = $wpdb->prepare("
                select tags.ID as tag_id from wp_toolset_connected_elements child
                inner join wp_toolset_associations link on child.group_id = link.child_id
                inner join wp_toolset_connected_elements parent on link.parent_id = parent.group_id
                inner join wp_toolset_relationships rel on link.relationship_id = rel.id
                inner join wp_posts tags on child.element_id = tags.ID
                where tags.post_author = %d and rel.slug = 'mecard-profile-mecard-tag';
    ", get_current_user_id());

        $results = $wpdb->get_results($linked_tags_query);
        $tag_ids = array_map("get_ids", $results);
        $query["post__not_in"] = $tag_ids;
    }

    return $query;
}

function get_ids($a) {
    return $a->tag_id;
}

add_filter( 'wpv_filter_query_post_process', 'check_output', 102, 3 );

function check_output( $query, $view_settings, $view_id ) {
    if ($view_id == SELECT_CARD_VIEW_ID) {
        $view_id2 = $view_id;
    }
    return $query;
}

add_shortcode('site_url', function($atts) {return site_url($atts['path']);});
if (function_exists('rocket_clean_post')) {
    add_action('save_post_mecard-profile','clear_tag_cache',99,3);
}


function clear_tag_cache($profile_id,$profile,$update) {
    $tag_ids = toolset_get_related_posts($profile_id,'mecard-profile-mecard-tag',array('query_by_role'=>'parent','return' => 'post_id'));
    foreach ($tag_ids as $tag_id) {
        rocket_clean_post($tag_id);
    }
}

// wpo_wcpdf_after_billing_address

add_action( 'wpo_wcpdf_after_billing_address', 'display_vat_number', 10, 2 );
function display_vat_number ($document_type, $order) {
    if ($document_type == 'invoice') {
        $VAT = get_post_meta($order->id,"billing_vat",true);
       if ($VAT) {
           echo ' VAT #: '.$VAT;
       }
    }
}


// === MODAL SHORTCODE ===
add_shortcode('me_company_edit_modal', function(){
    ob_start(); ?>
    <div class="modal fade companyEditModal modal-fullscreen" id="companyEditModal" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit Company</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span>&times;</span></button>
                </div>
                <div class="modal-body p-0">
                    <div id="me-modal-loading" class="p-4 text-center text-muted" style="display:none;">Loading…</div>
                    <div id="me-modal-form-container"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" id="me-visible-submit" class="btn btn-primary">Save changes</button>
                </div>
            </div>
        </div>
    </div>
    <?php return ob_get_clean();
});

// === ENQUEUE FRONT-END ASSETS (editor + media) ===
add_action('wp_enqueue_scripts', function () {
    if (function_exists('wp_enqueue_editor')) wp_enqueue_editor();
    wp_enqueue_media();
});



// === FULLSCREEN MODAL CSS FOR BS4 ===
add_action('wp_head', function(){ ?>
    <style>
        .modal-fullscreen .modal-dialog{max-width:100vw;width:100vw;height:100%;margin:0}
        .modal-fullscreen .modal-content{height:100vh;border:0;border-radius:0}
        .modal-fullscreen .modal-body{overflow:auto;-webkit-overflow-scrolling:touch}
    </style>
<?php });


// ---------- LOAD FORM ----------
add_action('wp_ajax_me_load_company_form_custom', 'me_load_company_form_custom');

function me_load_company_form_custom(){
    global $post_id;
    nocache_headers();
    header('Content-Type: application/json; charset=' . get_option('blog_charset'));

    // TEMP: log the mapped caps WP expects for edit_post
    if ( defined('WP_DEBUG') && WP_DEBUG ) {
        $needed = map_meta_cap( 'edit_post', get_current_user_id(), $post_id, [] );
        error_log( 'edit_post mapped caps for post '.$post_id.': '. implode(', ', $needed) );
    }


    $nonce = $_POST['_wpnonce'] ?? $_POST['nonce'] ?? '';
    if (!wp_verify_nonce($nonce, 'me-company-edit-nonce')) {
        wp_send_json_error(['message'=>'Invalid nonce.'], 403);
    }

    $post_id = isset($_POST['company_id']) ? absint($_POST['company_id']) : 0;
    if (!$post_id || !($post = get_post($post_id))) {
        wp_send_json_error(['message'=>'Company not found.'], 404);
    }
    if ( ! is_user_logged_in() || ! me_is_post_owner( $post_id ) ) {
        wp_send_json_error(['message' => 'You do not have permission to edit this item.'], 403);
    }



    // Fetch values
    $get = function($key){ return get_post_meta(get_the_ID(), $key, true); };
    setup_postdata($post);
    $title = get_the_title($post_id);
    $logo_id = get_post_thumbnail_id($post_id);
    $logo_url = $logo_id ? wp_get_attachment_image_url($logo_id, 'full') : '';

    $meta = [];
    $keys = [
        'wpcf-company-address','wpcf-company-telephone-number','wpcf-company-website','wpcf-support-email',
        'wpcf-heading-font','wpcf-heading-font-colour','wpcf-normal-font','wpcf-normal-font-colour',
        'wpcf-accent-colour','wpcf-button-text-colour','wpcf-download-button-colour','wpcf-download-button-text-colour',
        'wpcf-company-description','wpcf-custom-css'
    ];
    foreach($keys as $k){ $meta[$k] = get_post_meta($post_id, $k, true); }
    wp_reset_postdata();

    if ( function_exists( 'wp_enqueue_editor' ) ) {
        wp_enqueue_editor();
    }

    // ======================
// FORM MARKUP (in modal)
// ======================

    ob_start(); ?>
    <form id="me-company-form" data-post-id="<?php echo esc_attr($post_id); ?>">
        <input type="hidden" name="_wpnonce" value="<?php echo esc_attr(wp_create_nonce('me-company-edit-nonce')); ?>">

        <div class="container-fluid">
            <div class="row">
                <!-- LEFT: Form (tabs) -->
                <div class="col-md-9 pr-md-3">
                    <!-- Tabs -->
                    <ul class="nav nav-tabs" id="me-tabs" role="tablist">
                        <li class="nav-item">
                            <a class="nav-link active" id="tab-info" data-toggle="tab" href="#pane-info" role="tab" aria-controls="pane-info" aria-selected="true">
                                Information
                            </a>
                        </li>

                        <!-- NEW: Pro Information (position 2) -->
                        <li class="nav-item">
                            <a class="nav-link" id="tab-proinfo" data-toggle="tab" href="#pane-proinfo" role="tab" aria-controls="pane-proinfo" aria-selected="false">
                                Pro Information
                            </a>
                        </li>

                        <li class="nav-item">
                            <a class="nav-link" id="tab-design" data-toggle="tab" href="#pane-design" role="tab" aria-controls="pane-design" aria-selected="false">
                                Design settings (Pro Feature)
                            </a>
                        </li>
                    </ul>

                    <!-- Tab panes -->
                    <div class="tab-content border border-top-0 p-3">
                        <!-- ========== Information (unchanged except Description moved out) ========== -->
                        <div class="tab-pane fade show active" id="pane-info" role="tabpanel" aria-labelledby="tab-info">
                            <div class="form-row">
                                <div class="form-group col-sm-6">
                                    <label>Company Name</label>
                                    <input type="text" class="form-control" name="post_title" value="<?php echo esc_attr($title); ?>">
                                </div>
                                <div class="form-group col-sm-6">
                                    <label>Website</label>
                                    <input type="url" class="form-control" name="wpcf-company-website" value="<?php echo esc_attr($meta['wpcf-company-website']); ?>">
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group col-sm-6">
                                    <label>Company Telephone Number</label>
                                    <input type="text" class="form-control" name="wpcf-company-telephone-number" value="<?php echo esc_attr($meta['wpcf-company-telephone-number']); ?>">
                                </div>
                                <div class="form-group col-sm-6">
                                    <label>Support Email</label>
                                    <input type="email" class="form-control" name="wpcf-support-email" value="<?php echo esc_attr($meta['wpcf-support-email']); ?>">
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group col-sm-12">
                                    <label>Company Address</label>
                                    <input type="text" class="form-control" name="wpcf-company-address" value="<?php echo esc_attr($meta['wpcf-company-address']); ?>">
                                </div>
                            </div>
                        </div><!-- /#pane-info -->

                        <!-- ========== NEW: Pro Information (Description + Extra Buttons) ========== -->
                        <div class="tab-pane fade" id="pane-proinfo" role="tabpanel" aria-labelledby="tab-proinfo">
                            <!-- Description (moved here) -->
                            <div class="form-row">
                                <div class="form-group col-sm-12">
                                    <label>Description (Pro)</label>
                                    <textarea
                                            class="form-control wp-editor-area"
                                            id="me-company-description"
                                            name="wpcf-company-description"
                                            rows="8"
                                    ><?php echo esc_textarea($meta['wpcf-company-description']); ?></textarea>
                                </div>
                            </div>

                            <!-- Extra Buttons (Toolset RFG: more-links-company) -->
                            <hr>
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="mb-0">Extra Buttons (Pro)</h6>
                                <button type="button" class="btn btn-sm btn-outline-primary" id="me-add-extra-button">
                                    + Add Button
                                </button>
                            </div>

                            <div id="me-extra-buttons" class="me-rfg-list" data-rfg-slug="more-links-company">
                                <?php
                                // --- PREFILL from Toolset RFG children ---
                                $child_posts = [];
                                if (function_exists('toolset_get_related_posts')) {
                                    // Fetch children in current order
                                    $child_posts = toolset_get_related_posts(
                                        $post_id,
                                        ME_RFG_REL_SLUG,
                                        [
                                            'query_by_role' => 'parent', // make it explicit
                                            'role'          => 'child',
                                            'limit'         => -1,
                                            'orderby'       => 'relationship', // respects RFG order
                                            'return'        => 'post_object',
                                        ]
                                    );
                                } else {
                                    $child_posts = []; // Toolset not active? Will render none.
                                }

                                $idx = 0;
                                foreach ($child_posts as $child) :
                                    $cid  = $child->ID;
                                    $btxt = get_post_meta($cid, ME_RFG_META_TEXT, true);
                                    $burl = get_post_meta($cid, ME_RFG_META_URL , true);
                                    $bico = get_post_meta($cid, ME_RFG_META_ICON, true);
                                    ?>
                                    <div class="me-rfg-row card mb-2" data-key="<?php echo esc_attr($idx); ?>">
                                        <div class="card-body py-2">
                                            <div class="d-flex align-items-center gap-2">
                                                <span class="me-rfg-drag pr-2" title="Drag to reorder">&#x2630;</span>

                                                <input type="hidden"
                                                       name="me_more_links[<?php echo esc_attr($idx); ?>][child_id]"
                                                       value="<?php echo esc_attr($cid); ?>">

                                                <div class="form-group mb-1 mr-2 flex-grow-1">
                                                    <label class="mb-1">Button Text</label>
                                                    <input type="text" class="form-control form-control-sm"
                                                           name="me_more_links[<?php echo esc_attr($idx); ?>][button-text]"
                                                           value="<?php echo esc_attr($btxt); ?>">
                                                </div>

                                                <div class="form-group mb-1 mr-2 flex-grow-1">
                                                    <label class="mb-1">Button URL</label>
                                                    <input type="url" class="form-control form-control-sm"
                                                           name="me_more_links[<?php echo esc_attr($idx); ?>][button-url]"
                                                           value="<?php echo esc_attr($burl); ?>">
                                                </div>

                                                <div class="form-group mb-1 mr-2">
                                                    <label class="mb-1">Icon</label>
                                                    <div class="input-group input-group-sm me-icon-picker">
                                                        <div class="input-group-prepend">
                                                            <span class="input-group-text me-icon-preview"><i class="<?php echo esc_attr($bico ?: 'fa-solid fa-circle'); ?>"></i></span>
                                                        </div>
                                                        <input type="text" class="form-control form-control-sm me-icon-input"
                                                               name="me_more_links[<?php echo esc_attr($idx); ?>][button-icon]"
                                                               value="<?php echo esc_attr($bico); ?>" placeholder="fa-solid fa-globe">
                                                        <div class="input-group-append">
                                                            <button class="btn btn-outline-secondary me-pick-icon" type="button">Pick</button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button type="button" class="btn btn-sm btn-outline-danger me-remove-row" title="Remove">&times;</button>
                                            </div>
                                        </div>
                                    </div>
                                    <?php
                                    $idx++;
                                endforeach;
                                ?>

                            </div><!-- /#me-extra-buttons -->

                            <!-- Template (cloned by JS) -->
                            <template id="me-extra-button-template">
                                <div class="me-rfg-row card mb-2" data-key="__i__">
                                    <div class="card-body py-2">
                                        <div class="d-flex align-items-center gap-2">
                                            <span class="me-rfg-drag pr-2" title="Drag to reorder">&#x2630;</span>

                                            <div class="form-group mb-1 mr-2 flex-grow-1">
                                                <label class="mb-1">Button Text</label>
                                                <input type="text" class="form-control form-control-sm"
                                                       name="me_more_links[__i__][button-text]" value="">
                                            </div>

                                            <div class="form-group mb-1 mr-2 flex-grow-1">
                                                <label class="mb-1">Button URL</label>
                                                <input type="url" class="form-control form-control-sm"
                                                       name="me_more_links[__i__][button-url]" value="">
                                            </div>

                                            <div class="form-group mb-1 mr-2">
                                                <label class="mb-1">Icon</label>
                                                <div class="input-group input-group-sm me-icon-picker">
                                                    <div class="input-group-prepend">
                                                        <span class="input-group-text me-icon-preview"><i class="fa-solid fa-circle"></i></span>
                                                    </div>
                                                    <input type="text" class="form-control form-control-sm me-icon-input"
                                                           name="me_more_links[__i__][button-icon]" value="" placeholder="fa-solid fa-globe">
                                                    <div class="input-group-append">
                                                        <button class="btn btn-outline-secondary me-pick-icon" type="button">Pick</button>
                                                    </div>
                                                </div>
                                            </div>

                                            <button type="button" class="btn btn-sm btn-outline-danger me-remove-row" title="Remove">&times;</button>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div><!-- /#pane-proinfo -->

                        <!-- ========== Design (unchanged) ========== -->
                        <div class="tab-pane fade" id="pane-design" role="tabpanel" aria-labelledby="tab-design">
                            <div class="form-row">
                                <div class="form-group mb-0">
                                    <label>Company Logo</label><br>
                                    <button type="button" class="btn btn-outline-secondary btn-sm" id="me-select-logo">Select / Upload</button>
                                    <input type="hidden" name="_featured_image_id" id="me-logo-id" value="<?php echo esc_attr($logo_id); ?>">
                                    <div class="mt-2" id="me-logo-preview">
                                        <?php if(!empty($logo_url)) : ?>
                                            <img src="<?php echo esc_url($logo_url); ?>" style="max-height:60px" alt="Company logo preview">
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </div>

                            <hr>
                            <div class="form-row">
                                <div class="form-group col-sm-6">
                                    <label>Heading Font</label>
                                    <select class="form-control" name="wpcf-heading-font">
                                        <?php foreach(['opensans'=>'Open Sans, sans serif','Montserrat'=>'Montserrat','Roboto'=>'Roboto','playfairdisplay'=>'Playfair Display','Merriweather'=>'Merriweather','Helvetica'=>'Helvetica'] as $val=>$label){
                                            printf('<option value="%s"%s>%s</option>', esc_attr($val), selected($meta['wpcf-heading-font'],$val,false), esc_html($label));
                                        } ?>
                                    </select>
                                </div>
                                <div class="form-group col-sm-3">
                                    <label>Heading Font Colour</label>
                                    <input type="text" class="form-control me-color" name="wpcf-heading-font-colour" value="<?php echo esc_attr($meta['wpcf-heading-font-colour'] ?: '#000'); ?>" placeholder="#000000" pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$">
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group col-sm-6">
                                    <label>Normal Font</label>
                                    <select class="form-control" name="wpcf-normal-font">
                                        <?php foreach(['opensans'=>'"Open Sans", "Sans Serif"','Montserrat'=>'Montserrat','Roboto'=>'Roboto','playfairdisplay'=>'Playfair Display','Merriweather'=>'Merriweather','Helvetica'=>'Helvetica'] as $val=>$label){
                                            printf('<option value="%s"%s>%s</option>', esc_attr($val), selected($meta['wpcf-normal-font'],$val,false), esc_html($label));
                                        } ?>
                                    </select>
                                </div>
                                <div class="form-group col-sm-3">
                                    <label>Normal Font Colour</label>
                                    <input type="text" class="form-control me-color" name="wpcf-normal-font-colour" value="<?php echo esc_attr($meta['wpcf-normal-font-colour'] ?: '#000'); ?>" placeholder="#000000" pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$">
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group col-sm-3">
                                    <label>Accent colour (buttons &amp; links)</label>
                                    <input type="text" class="form-control me-color" name="wpcf-accent-colour" value="<?php echo esc_attr($meta['wpcf-accent-colour'] ?: '#d3d3d3'); ?>" placeholder="#0170b9" pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$">
                                </div>
                                <div class="form-group col-sm-3">
                                    <label>Button text colour</label>
                                    <input type="text" class="form-control me-color" name="wpcf-button-text-colour" value="<?php echo esc_attr($meta['wpcf-button-text-colour'] ?: '#000'); ?>" placeholder="#ffffff" pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$">
                                </div>
                                <div class="form-group col-sm-3">
                                    <label>Download button colour</label>
                                    <input type="text" class="form-control me-color" name="wpcf-download-button-colour" value="<?php echo esc_attr($meta['wpcf-download-button-colour'] ?: '#30b030'); ?>" placeholder="#30b030" pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$">
                                </div>
                                <div class="form-group col-sm-3">
                                    <label>Download button text colour</label>
                                    <input type="text" class="form-control me-color" name="wpcf-download-button-text-colour" value="<?php echo esc_attr($meta['wpcf-download-button-text-colour'] ?: '#000000'); ?>" placeholder="#000000" pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$">
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group col-sm-6">
                                    <label>Custom CSS (Pro)</label>
                                    <textarea class="form-control" name="wpcf-custom-css" rows="4"><?php echo esc_textarea($meta['wpcf-custom-css']); ?></textarea>
                                </div>
                            </div>
                        </div><!-- /#pane-design -->
                    </div><!-- /.tab-content -->
                </div>

                <!-- RIGHT: Live phone preview -->
                <div class="col-md-3 pl-md-3 mt-3 mt-md-0 border-left">
                    <ul class="nav nav-tabs" id="profilePreviewTabs" role="tablist">
                        <li class="nav-item">
                            <a class="nav-link active" id="standard-tab" data-toggle="tab" href="#standardPreview" role="tab" aria-controls="standardPreview" aria-selected="true">Standard Preview</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" id="pro-tab" data-toggle="tab" href="#proPreview" role="tab" aria-controls="proPreview" aria-selected="false">Pro Preview</a>
                        </li>
                    </ul>

                    <div class="tab-content pt-3" id="profilePreviewContent">
                        <!-- ===== STANDARD PREVIEW (FREE) — with MeCard brand strip at top ===== -->
                        <div class="tab-pane fade show active" id="standardPreview" role="tabpanel" aria-labelledby="standard-tab">
                            <div id="profile-preview" class="preview-scope">
                                <div class="phone-outline">
                                    <div class="pro-profile-container post-00000">

                                        <!-- MeCard brand strip (standard profile) -->
                                        <div class="ast-primary-header-bar ast-primary-header main-header-bar site-primary-header-wrap site-header-focus-item ast-builder-grid-row-layout-default ast-builder-grid-row-tablet-layout-default ast-builder-grid-row-mobile-layout-default" data-section="section-primary-header-builder">
                                            <div class="ast-builder-grid-row ast-builder-grid-row-has-sides ast-builder-grid-row-no-center">
                                                <div class="site-header-primary-section-left site-header-section ast-flex site-header-section-left">
                                                    <div class="ast-builder-layout-element ast-flex site-header-focus-item" data-section="title_tagline">
                                                        <div class="site-branding ast-site-identity" itemtype="https://schema.org/Organization" itemscope="itemscope">
                                                            <span class="site-logo-img"><a class="custom-logo-link" rel="home"><img style="width: 60%; margin-left: 20px;" width="748" height="267" src="https://mecard.co.za/wp-content/uploads/2023/02/cropped-cropped-mecard-logo-1.png" class="custom-logo" alt="MeCard" decoding="async"></a></span><div class="ast-site-title-wrap">


                                                            </div>				</div>
                                                        <!-- .site-branding -->
                                                    </div>
                                                </div>
                                                <div class="site-header-primary-section-right site-header-section ast-flex ast-grid-right-section">
                                                    <div class="ast-builder-layout-element ast-flex site-header-focus-item" data-section="section-header-mobile-trigger">
                                                        <div class="ast-button-wrap">
                                                            <button type="button" class="menu-toggle main-header-menu-toggle ast-mobile-menu-trigger-minimal" aria-expanded="false" aria-label="Main menu toggle" data-index="0">
                                                                <span class="screen-reader-text">Main Menu</span>
                                                                <span class="mobile-menu-toggle-icon">
						<span aria-hidden="true" class="ahfb-svg-iconset ast-inline-flex svg-baseline"><svg class="ast-mobile-svg ast-menu-svg" fill="currentColor" version="1.1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M3 13h18c0.552 0 1-0.448 1-1s-0.448-1-1-1h-18c-0.552 0-1 0.448-1 1s0.448 1 1 1zM3 7h18c0.552 0 1-0.448 1-1s-0.448-1-1-1h-18c-0.552 0-1 0.448-1 1s0.448 1 1 1zM3 19h18c0.552 0 1-0.448 1-1s-0.448-1-1-1h-18c-0.552 0-1 0.448-1 1s0.448 1 1 1z"></path></svg></span><span aria-hidden="true" class="ahfb-svg-iconset ast-inline-flex svg-baseline"><svg class="ast-mobile-svg ast-close-svg" fill="currentColor" version="1.1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M5.293 6.707l5.293 5.293-5.293 5.293c-0.391 0.391-0.391 1.024 0 1.414s1.024 0.391 1.414 0l5.293-5.293 5.293 5.293c0.391 0.391 1.024 0.391 1.414 0s0.391-1.024 0-1.414l-5.293-5.293 5.293-5.293c0.391-0.391 0.391-1.024 0-1.414s-1.024-0.391-1.414 0l-5.293 5.293-5.293-5.293c-0.391-0.391-1.024-0.391-1.414 0s-0.391 1.024 0 1.414z"></path></svg></span>					</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- NO company logo block in Standard -->
                                        <div class="primary" style="margin-top: 1.5rem"> <h1 class="has-text-align-center">Your Name</h1>
                                            <div style="height:20px" aria-hidden="true"></div>
                                            <div class="profile-image">
                                                <img width="150" height="150"
                                                     src="https://mecard.co.za/wp-content/uploads/2023/11/alessio-profile-cropped-grey-bg-150x150.jpg"
                                                     alt="Alessio Martinez">
                                            </div>

                                            <div style="height:20px" aria-hidden="true"></div>


                                            <div class="job-title">Your Job Title</div>

                                            <!-- Social -->
                                            <div class="container-md">
                                                <div class="row">
                                                    <div class="col-12 mecard-centered mecard-social">
                                                        <div class="mecard-social-item"><a href="#"><i class="fab fa-facebook-square"></i></a></div>
                                                        <div class="mecard-social-item"><a href="#"><i class="fab fa-twitter-square"></i></a></div>
                                                        <div class="mecard-social-item"><a href="#"><i class="fab fa-linkedin"></i></a></div>
                                                    </div>
                                                </div>

                                                <!-- Quick contact buttons -->
                                                <div class="row profile-buttons">
                                                    <div class="col-4"><a href="tel:0839999999"><button class="phone"><i class="fas fa-mobile-alt"></i></button></a></div>
                                                    <div class="col-4"><a href="mailto:alessio@amm.co.za"><button class="email"><i class="fas fa-envelope"></i></button></a></div>
                                                    <div class="col-4"><a href="https://wa.me/27839999999" target="_blank" rel="noopener"><button class="whatsapp"><i class="fab fa-whatsapp"></i></button></a></div>
                                                </div>
                                            </div>

                                            <div class="container-fluid">
                                                <div style="height:30px" aria-hidden="true"></div>

                                                <!-- Personal Details -->
                                                <div class="row">
                                                    <div class="col-12 mecard-section">Personal Details</div>
                                                </div>

                                                <div class="row">
                                                    <div class="col-4">Email:</div>
                                                    <div class="col-8">
                                                        <a href="mailto:alessio@amm.co.za" title="you@mail.com">you@mail.com</a>
                                                    </div>
                                                </div>

                                                <div class="row">
                                                    <div class="col-4">Mobile:</div>
                                                    <div class="col-8">083 9999999</div>
                                                </div>

                                                <!-- Work -->
                                                <div class="row">
                                                    <div class="col-12 mecard-section">Work</div>
                                                </div>

                                                <div class="row">
                                                    <div class="col-12">
                                                        <h3 class="company-name">Your Company Name</h3>
                                                        <p></p>
                                                    </div>
                                                </div>
                                                <div class="row">
                                                    <div class="col-4">Address:</div>
                                                    <div class="col-8">
                                                        <a href="https://www.google.com/maps/search/?api=1&query=123 Main Road, My Town, 1234"
                                                           target="_blank" rel="noopener"
                                                           class="company-address" style="text-decoration:none">
                                                            123 Main Road, My Town, 1234
                                                        </a>
                                                    </div>
                                                </div>

                                                <div style="height:30px" aria-hidden="true"></div>

                                                <div class="row">
                                                    <div class="col-sm-12">
                                                        <a href="https://taggable.co.za" target="_blank" rel="noopener">
                                                            <button class="company website"><i class="fas fa-globe"></i>&nbsp;Visit Website</button>
                                                        </a>
                                                        <a href="tel:0129999999">
                                                            <button class="company phone"><i class="fas fa-phone-alt"></i>&nbsp;Call the Office</button>
                                                        </a>
                                                        <a href="https://www.google.com/maps/search/?api=1&query=123%20Main%20Road,%20My%20Town,%201234" target="_blank" rel="noopener">
                                                            <button class="company directions"><i class="fas fa-map-marker"></i>&nbsp;Directions</button>
                                                        </a>
                                                    </div>
                                                </div>
                                                <div style="height:50px" aria-hidden="true"></div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Download bar (static; no JS) -->
                                    <div class="vcard-download">
                                        <div class="vcard-button"><a href="#" role="button">Download Contact Card</a></div>
                                    </div>
                                </div>
                            </div>
                        </div>


                        <!-- ===== PRO PREVIEW (PAID) ===== -->
                        <div class="tab-pane fade" id="proPreview" role="tabpanel" aria-labelledby="pro-tab">
                            <div id="profile-preview" class="preview-scope">
                                <div class="phone-outline">
                                    <div class="pro-profile-container post-00000">
                                        <!-- PRO HAS top company logo -->
                                        <div class="pro-logo">
                                            <img src="<?php echo plugin_dir_url(__FILE__) . 'images/image-placeholder.jpg'; ?>" width="600" alt="Company Logo">
                                        </div>

                                        <div class="profile-image pro">
                                            <img width="150" height="150"
                                                 src="https://mecard.co.za/wp-content/uploads/2023/11/alessio-profile-cropped-grey-bg-150x150.jpg"
                                                 alt="Alessio Martinez">
                                        </div>

                                        <div style="height:20px" aria-hidden="true"></div>
                                        <h1 class="has-text-align-center">Your Name</h1>
                                        <div class="job-title">Your Job title</div>

                                        <!-- Social -->
                                        <div class="container-md">
                                            <div class="row">
                                                <div class="col-12 mecard-centered mecard-social">
                                                    <div class="mecard-social-item"><a href="#"><i class="fab fa-facebook-square"></i></a></div>
                                                    <div class="mecard-social-item"><a href="#"><i class="fab fa-twitter-square"></i></a></div>
                                                    <div class="mecard-social-item"><a href="#"><i class="fab fa-linkedin"></i></a></div>
                                                    <div class="mecard-social-item"><a href="#"><i class="fab fa-instagram"></i></a></div>
                                                </div>
                                            </div>

                                            <div class="row profile-buttons">
                                                <div class="col-4"><a href="tel:0839999999"><button class="phone"><i class="fas fa-mobile-alt"></i></button></a></div>
                                                <div class="col-4"><a href="mailto:alessio@amm.co.za"><button class="email"><i class="fas fa-envelope"></i></button></a></div>
                                                <div class="col-4"><a href="https://wa.me/27839999999"><button class="whatsapp"><i class="fab fa-whatsapp"></i></button></a></div>
                                            </div>

                                        </div>

                                        <div class="container-fluid">
                                            <div style="height:30px" aria-hidden="true"></div>

                                            <div class="row">
                                                <div class="col-sm-12">
                                                    <h2 class="company-name">Your Company Name</h2>

                                                </div>
                                            </div>

                                            <div class="row">
                                                <div class="col-sm-12">
                                                    <a class="company-address" style="text-decoration:none"
                                                       href="https://www.google.com/maps/search/?api=1&query=123%20Main%20Road,%20My%20Town,%201234" target="_blank" rel="noopener">
                                                        123 Main Road, My Town, 1234
                                                    </a>
                                                    <div style="height:20px" aria-hidden="true"></div>
                                                </div>
                                            </div>

                                            <!-- PRO HAS long description -->
                                            <div class="row">
                                                <div class="col-sm-12">
                                                    <div id="pro-desc"></div>
                                                </div>
                                            </div>


                                            <div style="height:30px" aria-hidden="true"></div>

                                            <div class="row">
                                                <div class="col-sm-12">
                                                    <a href="https://taggable.co.za" target="_blank" rel="noopener">
                                                        <button class="company website"><i class="fas fa-globe"></i>&nbsp;Visit Website</button>
                                                    </a>
                                                    <a href="tel:0129999999">
                                                        <button class="company phone"><i class="fas fa-phone-alt"></i>&nbsp;Call the Office</button>
                                                    </a>
                                                    <a href="https://www.google.com/maps/search/?api=1&query=123%20Main%20Road,%20My%20Town,%201234" target="_blank" rel="noopener">
                                                        <button class="company directions"><i class="fas fa-map-marker"></i>&nbsp;Directions</button>
                                                    </a>


                                                </div>
                                            </div>
                                            <div class="row">
                                                <div class="col-sm-12" id="pro-extra-buttons"></div>
                                            </div>
                                            <div style="height:50px" aria-hidden="true"></div>
                                        </div>
                                    </div>
                                    <!-- Download bar (static; no JS) -->
                                    <div class="vcard-download">
                                        <div class="vcard-button"><a href="#" role="button">Download Contact Card</a></div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div><!-- /.col -->
            </div><!-- /.row -->
        </div><!-- /.container-fluid -->
    </form>
    <?php
    $html = ob_get_clean();

    wp_send_json_success(['title'=>$title, 'html'=>$html]);

}

// ---------- SAVE FORM ----------
add_action('wp_ajax_me_save_company_form_custom', 'me_save_company_form_custom');
add_action('wp_ajax_nopriv_me_save_company_form_custom', 'me_save_company_form_custom'); // drop if not needed

function me_save_company_form_custom(){
    nocache_headers();
    header('Content-Type: application/json; charset=' . get_option('blog_charset'));

    if (!isset($_POST['_wpnonce']) || !wp_verify_nonce($_POST['_wpnonce'], 'me-company-edit-nonce')) {
        wp_send_json_error(['message'=>'Invalid nonce.'], 403);
    }

    $post_id = isset($_POST['company_id']) ? absint($_POST['company_id']) : 0;
    if (!$post_id || !get_post($post_id)) wp_send_json_error(['message'=>'Company not found.'], 404);
   // if (!current_user_can('edit_post', $post_id)) wp_send_json_error(['message'=>'No permission.'], 403);
    if ( ! is_user_logged_in() || ! me_is_post_owner( $post_id ) ) {
        wp_send_json_error(['message'=>'No permission.'], 403);
    }

    // ----------------- helper: detect the real RFG child post type -----------------
    $detect_rfg_post_type = function() {
        // Try common Toolset RFG patterns in order
        $candidates = [
            'wpcf-rfg-' . ME_RFG_REL_SLUG,
            'wpcf-'    . ME_RFG_REL_SLUG,
            ME_RFG_REL_SLUG,
        ];
        foreach ($candidates as $pt) {
            if (post_type_exists($pt)) return $pt;
        }
        return ''; // not found → creation will be skipped with a clear error
    };
    $rfg_pt = $detect_rfg_post_type();
    // ------------------------------------------------------------------------------

    // Sanitize core fields
    $title = isset($_POST['post_title']) ? sanitize_text_field(wp_unslash($_POST['post_title'])) : '';
    if ($title !== '') {
        wp_update_post(['ID'=>$post_id, 'post_title'=>$title]);
    }

    // Featured image by attachment ID
    $logo_id = isset($_POST['_featured_image_id']) ? absint($_POST['_featured_image_id']) : 0;
    if ($logo_id) {
        set_post_thumbnail($post_id, $logo_id);
    } else {
        delete_post_thumbnail($post_id);
    }

    // Sanitize meta
    $text  = function($k){ return isset($_POST[$k]) ? sanitize_text_field(wp_unslash($_POST[$k])) : ''; };
    $urlv  = function($k){ return isset($_POST[$k]) ? esc_url_raw(wp_unslash($_POST[$k])) : ''; };
    $email = function($k){ return isset($_POST[$k]) ? sanitize_email(wp_unslash($_POST[$k])) : ''; };
    $hex   = function($k){
        $v = isset($_POST[$k]) ? preg_replace('/[^#a-fA-F0-9]/','',wp_unslash($_POST[$k])) : '';
        return (preg_match('/^#?[0-9a-fA-F]{3,6}$/',$v) ? (strpos($v,'#')===0?$v:"#$v") : '');
    };

    $meta_updates = [
        'wpcf-company-address'            => $text('wpcf-company-address'),
        'wpcf-company-telephone-number'   => $text('wpcf-company-telephone-number'),
        'wpcf-company-website'            => $urlv('wpcf-company-website'),
        'wpcf-support-email'              => $email('wpcf-support-email'),
        'wpcf-heading-font'               => $text('wpcf-heading-font'),
        'wpcf-heading-font-colour'        => $hex('wpcf-heading-font-colour'),
        'wpcf-normal-font'                => $text('wpcf-normal-font'),
        'wpcf-normal-font-colour'         => $hex('wpcf-normal-font-colour'),
        'wpcf-accent-colour'              => $hex('wpcf-accent-colour'),
        'wpcf-button-text-colour'         => $hex('wpcf-button-text-colour'),
        'wpcf-download-button-colour'     => $hex('wpcf-download-button-colour'),
        'wpcf-download-button-text-colour'=> $hex('wpcf-download-button-text-colour'),
        'wpcf-custom-css'                 => isset($_POST['wpcf-custom-css']) ? wp_kses_post(wp_unslash($_POST['wpcf-custom-css'])) : '',
    ];

    foreach($meta_updates as $key=>$val){
        if ($val !== '') update_post_meta($post_id, $key, $val); else delete_post_meta($post_id, $key);
    }

    // WYSIWYG content
    if (isset($_POST['wpcf-company-description'])) {
        $desc = wp_kses_post(wp_unslash($_POST['wpcf-company-description']));
        update_post_meta($post_id, 'wpcf-company-description', $desc);
    }

    // ----------------- RFG rows -----------------
    $rows = $_POST['me_more_links'] ?? [];
    if (!is_array($rows)) $rows = [];

    // 1) Existing children
    $existing_ids = [];
    if (function_exists('toolset_get_related_posts')) {
        $existing_children = toolset_get_related_posts(
            $post_id,
            ME_RFG_REL_SLUG,
            [
                'query_by_role' => 'parent',
                'role'          => 'child',
                'limit'         => -1,
                'return'        => 'post_id',
            ]
        );
        $existing_ids = array_map('intval', (array)$existing_children);
    }

    $seen_ids   = [];
    $order_idx  = 0;
    $to_connect = [];

    foreach ($rows as $row) {
        $child_id = isset($row['child_id']) ? absint($row['child_id']) : 0;

        // Sanitize fields
        $txt = isset($row['button-text']) ? sanitize_text_field(wp_unslash($row['button-text'])) : '';
        $url = isset($row['button-url'])  ? esc_url_raw(trim(wp_unslash($row['button-url'])))    : '';
        $ico = isset($row['button-icon']) ? sanitize_text_field(wp_unslash($row['button-icon'])) : '';

        // Skip truly-empty rows (prevents accidental blank children)
        if (!$child_id && $txt === '' && $url === '' && $ico === '') {
            continue;
        }

        if ($child_id) {
            // UPDATE existing child (only if the post type matches the detected RFG type, if we have one)
            if ($rfg_pt && get_post_type($child_id) !== $rfg_pt) {
                // foreign ID — ignore safely
                continue;
            }

            update_post_meta($child_id, ME_RFG_META_TEXT, $txt);
            update_post_meta($child_id, ME_RFG_META_URL , $url);
            update_post_meta($child_id, ME_RFG_META_ICON, $ico);

            wp_update_post([
                'ID'         => $child_id,
                'post_title' => $txt ?: 'Extra Button',
                'menu_order' => $order_idx,
            ]);

            $seen_ids[] = $child_id;
        } else {
            // CREATE new child
            if (!$rfg_pt) {
                // fail fast with a helpful error — your post type isn’t registered
                wp_send_json_error([
                    'message' => 'RFG child post type not found for slug: ' . ME_RFG_REL_SLUG,
                    'candidates' => ['wpcf-rfg-' . ME_RFG_REL_SLUG, 'wpcf-' . ME_RFG_REL_SLUG, ME_RFG_REL_SLUG],
                ], 500);
            }

            $new_id = wp_insert_post([
                'post_type'   => $rfg_pt,
                'post_status' => 'publish',
                'post_title'  => $txt ?: 'Extra Button',
                'menu_order'  => $order_idx,
            ]);

            if ($new_id && !is_wp_error($new_id)) {
                update_post_meta($new_id, ME_RFG_META_TEXT, $txt);
                update_post_meta($new_id, ME_RFG_META_URL , $url);
                update_post_meta($new_id, ME_RFG_META_ICON, $ico);

                $seen_ids[]   = $new_id;
                $to_connect[] = $new_id;
            }
        }
        $order_idx++;
    }

    // 2) Connect newly-created children
    if (!empty($to_connect) && function_exists('toolset_connect_posts')) {
        foreach ($to_connect as $cid) {
            toolset_connect_posts(ME_RFG_REL_SLUG, $post_id, $cid);
        }
    }

    // 3) Reorder by disconnecting and reconnecting in desired order
    if (function_exists('toolset_disconnect_posts') && function_exists('toolset_connect_posts')) {
        foreach ((array)$existing_ids as $cid) {
            toolset_disconnect_posts(ME_RFG_REL_SLUG, $post_id, $cid);
        }
        foreach ($seen_ids as $cid) {
            toolset_connect_posts(ME_RFG_REL_SLUG, $post_id, $cid);
        }
    }

    // 4) Delete removed children
    $to_delete = array_diff($existing_ids, $seen_ids);
    if (!empty($to_delete)) {
        foreach ($to_delete as $cid) {
            if (function_exists('toolset_disconnect_posts')) {
                toolset_disconnect_posts(ME_RFG_REL_SLUG, $post_id, $cid);
            }
            wp_trash_post($cid);
        }
    }

    wp_send_json_success([
        'message'         => 'Saved.',
        'rfg_post_type'   => $rfg_pt,                // <-- helpful debug
        'received_rows'   => count($rows),           // <-- helpful debug
        'created_childs'  => array_values($to_connect),
        'updated_childs'  => array_values(array_diff($seen_ids, $to_connect)),
        'deleted_childs'  => array_values($to_delete),
    ]);
}

// === Shortcode: Fullscreen right-side share panel + floating FAB ===
add_shortcode('mecard_share_panel', function ($atts) {
    $atts = shortcode_atts([], $atts, 'mecard_share_panel');

    ob_start(); ?>
    <!-- Floating Share FAB (icon only) -->
    <button class="mecard-share-fab" type="button" aria-controls="mecard-share-panel" aria-expanded="false" aria-label="Open share panel">
        <i class="fas fa-share-alt" aria-hidden="true"></i>
    </button>

    <!-- Optional scrim -->
    <div class="mecard-share-scrim" aria-hidden="true"></div>

    <!-- Off-canvas panel (slides in from right; full screen on mobile) -->
    <div id="mecard-share-panel" class="mecard-share-panel" data-visible="false" role="dialog" aria-label="Share options" aria-modal="true">
        <div class="container-fluid py-3">

            <!-- QR Code (top) -->
            <div class="row">
                <div class="col-12">
                    <div class="card mb-3">
                        <div class="card-body text-center">
                            <h5 class="card-title mb-2"><i class="fas fa-qrcode"></i> QR code</h5>
                            <div id="mecard-qr-canvas" class="mx-auto"></div>
                            <button class="btn btn-outline-secondary btn-sm mt-2" data-action="download-qr">
                                <i class="fas fa-download"></i> Download PNG
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- WhatsApp to a typed number (second) -->
            <div class="row">
                <div class="col-12">
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title mb-3"><i class="fab fa-whatsapp"></i> WhatsApp a number</h5>
                            <div class="form-group">
                                <label for="mecard-wa-msisdn" class="mb-1">Mobile number (international format)</label>
                                <input id="mecard-wa-msisdn" type="tel" inputmode="tel" class="form-control" placeholder="e.g. 2772xxxxxxx">
                            </div>
                            <button class="btn btn-success" data-action="whatsapp-number">
                                <i class="fab fa-whatsapp"></i> Open WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- The rest -->
            <div class="row">
                <div class="col-12">
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title mb-3"><i class="fas fa-share-square"></i> Share</h5>
                            <button class="btn btn-primary mr-2 mb-2" data-action="native-share">
                                <i class="fas fa-share-alt"></i> Share link
                            </button>
                            <button class="btn btn-outline-secondary mb-2" data-action="copy-link">
                                <i class="fas fa-link"></i> Copy link
                            </button>
                        </div>
                    </div>
                </div>

                <div class="col-12">
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title mb-3"><i class="fas fa-envelope"></i> Email</h5>
                            <button class="btn btn-primary" data-action="email">
                                <i class="fas fa-paper-plane"></i> Compose
                            </button>
                        </div>
                    </div>
                </div>

                <div class="col-12">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title mb-2"><i class="fas fa-sms"></i> SMS / Text</h5>
                            <button class="btn btn-primary" data-action="sms">
                                <i class="fas fa-comment-alt"></i> Text link
                            </button>
                            <small class="text-muted d-block mt-2">Your device may handle SMS links differently.</small>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Add to Home Screen (A2HS) -->
            <div class="row">
                <div class="col-12">
                    <div class="card mb-3" id="mecard-a2hs-card" style="display:none;">
                        <div class="card-body">
                            <h5 class="card-title mb-3"><i class="fas fa-home"></i> Add to Home Screen</h5>

                            <!-- ANDROID: real install button appears when eligible -->
                            <div id="mecard-a2hs-android" style="display:none;">
                                <p class="mb-2">Install this profile to your home screen to launch and share with people you meet.</p>
                                <button class="btn btn-primary" id="mecard-a2hs-install-btn">
                                    <i class="fas fa-download"></i> Install
                                </button>
                            </div>

                            <!-- iOS: instructional steps (Apple blocks programmatic install) -->
                            <div id="mecard-a2hs-ios" style="display:none;">
                                <p class="mb-2">On iPhone/iPad:</p>
                                <ol class="mb-2">
                                    <li>Tap <strong>Share</strong> <i class="fas fa-share-square"></i> in Safari.</li>
                                    <li>Choose <strong>Add to Home Screen</strong>.</li>
                                </ol>
                                <small class="text-muted">You’ll get an icon on your home screen that opens this profile for easy sharing.</small>
                            </div>

                            <!-- Already installed -->
                            <div id="mecard-a2hs-installed" class="text-success" style="display:none;">
                                <i class="fas fa-check-circle"></i> Already added to your home screen.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>



    <?php
    return ob_get_clean();
});


// 1) REST manifest that points start_url to the current profile

add_action('rest_api_init', function () {
    register_rest_route('mecard/v1', '/manifest', [
        'methods'  => 'GET',
        'callback' => function (WP_REST_Request $req) {
            $pid = (int) $req->get_param('pid');
            if (!$pid) return new WP_Error('bad_request', 'Missing pid', ['status' => 400]);

            $profile_id = mecard_resolve_profile_id($pid) ?: $pid;

            // App label: from mecard-profile (optional override via custom field)
            $label = trim( (string) get_post_meta($profile_id, 'wpcf-app-label', true) );
            if ($label === '') $label = get_the_title($profile_id) ?: 'MeCard';

            // Short label helper (≤12 chars is a good target for Android)
            if (!function_exists('mecard_make_short_label')) {
                function mecard_make_short_label(string $s, int $limit=12): string {
                    $s = trim(preg_replace('/\s+/', ' ', $s));
                    if (mb_strlen($s) <= $limit) return $s;
                    $parts = preg_split('/\s+/', $s);
                    if (count($parts) >= 2) {
                        $cand = $parts[0] . ' ' . mb_substr($parts[1], 0, 1) . '.';
                        if (mb_strlen($cand) <= $limit) return $cand;
                    }
                    return rtrim(mb_substr($s, 0, max(1, $limit - 1))) . '…';
                }
            }
            $short = mecard_make_short_label($label, 12);

            // Always open the profile itself
            $start = add_query_arg(['from' => 'a2hs'], get_permalink($profile_id));

            $manifest = [
                'id'               => $start,       // helps dedupe installs
                'name'             => $label,
                'short_name'       => $short,
                'start_url'        => $start,
                'scope'            => '/',
                'display'          => 'standalone',
                'background_color' => '#ffffff',
                'theme_color'      => '#ffffff',
                'icons' => [
                    ['src' => '/me192w.png', 'sizes' => '192x192', 'type' => 'image/png', "purpose"=> "any maskable"],
                    ['src' => '/me512w.png', 'sizes' => '512x512', 'type' => 'image/png', "purpose"=> "any maskable"],
                ],
            ];

            $resp = new WP_REST_Response($manifest, 200);
            $resp->header('Content-Type', 'application/manifest+json; charset=utf-8');
            $resp->header('Cache-Control', 'no-store, max-age=0, must-revalidate');
            return $resp;
        },
        'permission_callback' => '__return_true',
    ]);
});




/**
 * Given any context post (either a tag `t` or a profile `mecard-profile`),
 * return the canonical mecard-profile post ID.
 */
if ( ! function_exists('mecard_resolve_profile_id') ) {
    /**
     * Given a context post (tag `t` or profile `mecard-profile`), return the mecard-profile ID.
     */
    function mecard_resolve_profile_id( int $context_id ) : int {
        $post = get_post( $context_id );
        if ( ! $post ) return 0;

        // Already a profile
        if ( $post->post_type === 'mecard-profile' ) {
            return (int) $post->ID;
        }

        // From tag (`t`) → parent profile via Toolset relationship
        if ( $post->post_type === 't' && function_exists('toolset_get_related_posts') ) {
            $parents = toolset_get_related_posts(
                $context_id,
                'mecard-profile-mecard-tag',
                [
                    'query_by_role' => 'child',   // we pass the CHILD id (the tag)
                    'role'          => 'parent',  // we want the PARENT (the profile)
                    'limit'         => 1,
                    'return'        => 'post_id', // ✅ valid values: 'post_id' or 'post_object'
                ]
            );
            if ( is_array($parents) && ! empty($parents[0]) ) {
                return (int) $parents[0];
            }
        }

        return 0;
    }
}


add_action('wp_head', function () {
    if ( ! is_singular(['t','mecard-profile']) ) return;

    $context_id = get_queried_object_id();
    $profile_id = mecard_resolve_profile_id( $context_id ) ?: $context_id;

    // Version param so launcher names update if the profile changes
    $version = rawurlencode( get_post_field('post_modified_gmt', $profile_id) ?: time() );

    $manifest_url = add_query_arg(
        ['pid' => $profile_id, 'v' => $version],
        rest_url('mecard/v1/manifest')
    );

    echo '<link rel="manifest" href="' . esc_url($manifest_url) . '">' . "\n";
    echo '<meta name="theme-color" content="#ffffff">' . "\n";
});



wp_localize_script('mecard-management', 'MECARD_SHARE', [
    // ...
    'swUrl' => site_url('/mecard-sw.js'),
]);

function me_is_post_owner( $post_id, $user_id = 0, $resolve_revision = true ) : bool {
    $post = get_post( $post_id );
    if ( ! $post ) return false;

    // If a revision was passed, optionally resolve to its parent
    if ( $resolve_revision && $post->post_type === 'revision' && ! empty( $post->post_parent ) ) {
        $post = get_post( (int) $post->post_parent );
        if ( ! $post ) return false;
    }

    $user_id = $user_id ? (int) $user_id : (int) get_current_user_id();
    if ( ! $user_id ) return false;

    return ( (int) $post->post_author === $user_id );
}

add_action('wp_enqueue_scripts', function () {
    if ( ! ( is_singular('mecard-profile') || is_singular('t') ) ) return;

    wp_register_script('mecard-ga4', plugins_url('/js/mecard-ga4.js', __FILE__), [], '1.2.0', true);
    wp_enqueue_script('mecard-ga4');

    $context_id   = get_queried_object_id();
    $context_type = is_singular('t') ? 'tag' : 'profile';

    // Resolve connected profile if this is a tag page
    $profile_id = null;
    if ($context_type === 'profile') {
        $profile_id = $context_id;
    } else {
        if (function_exists('mecard_resolve_profile_id')) {
            $profile_id = (int) mecard_resolve_profile_id($context_id);
        }
        if (empty($profile_id)) {
            foreach (['wpcf-linked-profile','connected_profile_id','profile_id'] as $key) {
                $maybe = (int) get_post_meta($context_id, $key, true);
                if ($maybe) { $profile_id = $maybe; break; }
            }
        }
    }

    $tag_type     = ($context_type === 'tag') ? get_post_meta($context_id, 'wpcf-tag-type', true) : null;
    $profile_slug = $profile_id ? get_post_field('post_name', $profile_id) : null;
    $account_id   = $profile_id ? get_post_meta($profile_id, 'account_id', true) : null;
    $profile_type = $profile_id ? get_post_meta($profile_id, 'wpcf-profile-type', true) : null; // 'standard'|'professional'

    $ctx = [
        // What is being viewed
        'id'           => $context_id,     // profile ID if type=profile, tag ID if type=tag
        'type'         => $context_type,   // 'profile' | 'tag'
        'tagType'      => $tag_type ?: null,

        // Profile context (for roll-ups)
        'profileId'    => $profile_id ?: null,
        'profileSlug'  => $profile_slug,
        'accountId'    => $account_id,
        'profileType'  => $profile_type,   // 'standard' | 'professional'

        'userLoggedIn' => is_user_logged_in(),
    ];

    wp_add_inline_script(
        'mecard-ga4',
        'window.MECARD_TRACKING = ' . wp_json_encode($ctx) . ';',
        'before'
    );
});

