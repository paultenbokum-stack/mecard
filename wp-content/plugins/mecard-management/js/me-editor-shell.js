(function($){
    'use strict';

    const S = window.ME || {};
    if (!S.ajaxurl) {
        console.error('[MeCard] ajaxurl missing');
    }

    let current = { kind: 'profile', post_id: null };
    let meProfileFrame = null;

    // ---------- UI state ----------
    function setSaveUI(state){
        const $m = $('#meProfileEditorModal');
        const $save  = $m.find('.js-me-save');
        const $close = $m.find('.js-me-close');

        if (state === 'saving') {
            $save.prop('disabled', true).text('Saving…');
            $close.text('Close without saving');
        } else if (state === 'saved') {
            $save.prop('disabled', false).text('Saved ✓');
            $close.text('Close');
        } else if (state === 'dirty') {
            $save.prop('disabled', false).text('Save');
            $close.text('Close without saving');
        } else { // idle
            $save.prop('disabled', false).text('Save');
            $close.text('Close');
        }
    }

    // ---------- Preview toggle (Standard / Pro) ----------
function setPreviewMode(mode){
    const $wrap = $('#mePreviewSwitcher');
    if (!$wrap.length) return;

    $wrap.attr('data-mode', mode);

    // tabs
    $wrap.find('.me-preview-tab').removeClass('is-active').attr('aria-selected','false');
    $wrap.find('.me-preview-tab[data-me-preview-tab="'+mode+'"]').addClass('is-active').attr('aria-selected','true');

    // panes
    $wrap.find('.me-preview-pane').removeClass('is-active');
    $wrap.find('.me-preview-pane[data-me-preview-pane="'+mode+'"]').addClass('is-active');
}

function applyProfileTypeToPreview(typeVal){
    const type = (typeVal || '').toString().toLowerCase();
    const isPro = (type === 'pro' || type === 'professional');

    const $wrap = $('#mePreviewSwitcher');
    if (!$wrap.length) return;

    const $stdTab   = $wrap.find('.me-preview-tab[data-me-preview-tab="standard"]');
    const $proTab   = $wrap.find('.me-preview-tab[data-me-preview-tab="pro"]');
    const $toggle   = $wrap.find('.me-preview-toggle');
    const $upsell   = $wrap.find('[data-me-preview-upsell]');
    const $stdPane  = $wrap.find('.me-preview-pane[data-me-preview-pane="standard"]');

    if (isPro) {
        // Pro profiles: remove the Standard option (upsell not needed)
        $stdTab.hide();
        $stdPane.hide();
        $upsell.hide();
        // keep toggle visible only if you still want the Pro label row;
        // otherwise hide the whole toggle bar
        $toggle.hide();
        setPreviewMode('pro');
    } else {
        // Standard profiles: show toggle + default to Standard
        $toggle.show();
        $stdTab.show();
        $stdPane.show();
        $upsell.show();
        // Default to Standard unless user already chose otherwise in this session
        setPreviewMode('standard');
    }
}

// Click handling (event delegation: works even if modal HTML is injected)
$(document).on('click', '.me-preview-tab', function(){
    const mode = $(this).data('me-preview-tab');
    if (!mode) return;
    setPreviewMode(mode);
});

// ---------- Load profile into form + preview ----------
    function loadProfile(post_id){
        current.post_id = post_id;
        setSaveUI('idle');

        const data = {
            action: 'me_profile_load',
            post_id: post_id
        };
        data[S.nonceField || '_wpnonce'] = S.nonceProfile;

        return $.post(S.ajaxurl, data).done(function(res){
            if (!res || !res.success) {
                console.error('Profile load failed', res);
                alert('Sorry, there was a problem loading this profile.');
                return;
            }
            const profile = res.data.profile || {};
            const company = res.data.company || {};

            populateProfileForm(profile);
            applyProfileTypeToPreview(profile.type);
            updatePreviewSocialsFromForm();
            applyCompanyDesignToPreview(company);
            updateCompanyBlock(company);
            populatePreview(profile, company);
            updatePreviewSocialsFromForm();
            updatePreviewPrimaryButtonsFromForm();
        applyProfileTypeToPreview($('#wpcf-profile-type').val());


        }).fail(function(xhr){
            console.error('Profile load AJAX error', xhr && xhr.responseText);
            alert('Sorry, there was a problem loading this profile.');
        });

    }

    function populateProfileForm(p){
        $('#me_profile_post_id').val(current.post_id);

        $('#wpcf-first-name').val(p.first || '');
        $('#wpcf-last-name').val(p.last || '');
        $('#wpcf-job-title').val(p.job || '');
        $('#wpcf-email-address').val(p.email || '');
        $('#wpcf-mobile-number').val(p.mobile || '');
        $('#wpcf-whatsapp-number').val(p.wa || '');
        $('#wpcf-work-phone-number').val(p.direct_line || '');
        $('#wpcf-profile-type').val(p.type || 'standard');
        $('#company_parent').val(p.company_parent || 0);

        const soc = p.soc || {};
        $('#wpcf-facebook-url').val(soc.facebook || '');
        $('#wpcf-twitter-url').val(soc.twitter || '');
        $('#wpcf-linkedin-url').val(soc.linkedin || '');
        const igUrl = soc.instagram || '';
        const igUser = igUrl
            ? igUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').replace(/^@/, '')
            : '';
        $('#wpcf-instagram-user').val(igUser);
        $('#wpcf-youtube-url').val(soc.youtube || '');
        $('#wpcf-tiktok-url').val(soc.tiktok || '');

        if (p.photo_url) {
            $('#meProfilePhotoPreview').attr('src', p.photo_url).show();
            $('#me_profile_photo_id').val(p.photo_id || '');
        } else {
            $('#meProfilePhotoPreview').hide();
        }
    }

    function formatWhatsappInt(raw) {
        if (!raw) return '';
        let v = String(raw).trim();

        // remove spaces
        v = v.replace(/\s+/g, '');

        // if starts with 0, convert to +27...
        if (v.startsWith('0')) v = '+27' + v.slice(1);

        // wa.me wants digits only (no +)
        v = v.replace(/^\+/, '');
        return v;
    }

    function updatePreviewPrimaryButtonsFromForm() {
        const email  = jQuery('#wpcf-email-address').val() || '';
        const mobile = jQuery('#wpcf-mobile-number').val() || '';
        const waRaw  = jQuery('#wpcf-whatsapp-number').val() || mobile;

        jQuery('#pv-email').attr('href', email ? ('mailto:' + email) : '#');
        jQuery('#pv-call').attr('href', mobile ? ('tel:' + mobile) : '#');

        const waInt = formatWhatsappInt(waRaw);
        jQuery('#pv-wa').attr('href', waInt ? ('https://wa.me/' + waInt) : '#');

        // Standard preview text rows
        jQuery('#std-email-text').text(email);
        jQuery('#std-mobile-text').text(mobile);
    }
    function applyCompanyDesignToPreview(company) {
        const root = document.getElementById('proPreview');
        if (!root) return;

        const d = (company && company.design) ? company.design : {};

        root.style.setProperty('--me-heading-font',  d.heading_font  || '"Montserrat", sans-serif');
        root.style.setProperty('--me-heading-color', d.heading_color || '#000000');
        root.style.setProperty('--me-body-font',     d.body_font     || '"Montserrat", sans-serif');
        root.style.setProperty('--me-body-color',    d.body_color    || '#333333');
        root.style.setProperty('--me-accent',        d.accent        || '#0170b9');
        root.style.setProperty('--me-button-text',   d.button_text   || '#ffffff');
        root.style.setProperty('--me-download',      d.download      || '#30b030');
        root.style.setProperty('--me-download-text', d.download_text || '#000000');

        // Optional: company custom CSS (Toolset appends it inline)
        // Keep it scoped and safe: inject into a style tag inside #proPreview.
        let styleEl = root.querySelector('style[data-me-custom-css="1"]');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.setAttribute('data-me-custom-css', '1');
            root.appendChild(styleEl);
        }
        styleEl.textContent = company && company.custom_css ? company.custom_css : '';
    }

    function setSocialLink(key, url) {
        const item = document.getElementById('soc-' + key);
        const a = document.getElementById('pv-' + key);
        if (!item || !a) return;

        if (!url) {
            item.style.display = 'none';
            a.setAttribute('href', '#');
            return;
        }
        item.style.display = '';
        a.setAttribute('href', url);
    }

    function updatePreviewSocialsFromForm() {
        const fb = jQuery('#wpcf-facebook-url').val() || '';
        const tw = jQuery('#wpcf-twitter-url').val() || '';
        const li = jQuery('#wpcf-linkedin-url').val() || '';
        const yt = jQuery('#wpcf-youtube-url').val() || '';
        const tk = jQuery('#wpcf-tiktok-url').val() || '';

        const igUserRaw = jQuery('#wpcf-instagram-user').val() || '';
        const igUser = igUserRaw.replace(/^@/, '').trim();
        const ig = igUser ? ('https://instagram.com/' + igUser) : '';

        setSocialLink('facebook', fb);
        setSocialLink('twitter', tw);
        setSocialLink('linkedin', li);
        setSocialLink('youtube', yt);
        setSocialLink('tiktok', tk);
        setSocialLink('instagram', ig);
    }

    function setCompanyLink(id, href, show) {
        const el = document.getElementById(id);
        if (!el) return;
        if (!show || !href) {
            el.style.display = 'none';
            el.setAttribute('href', '#');
            return;
        }
        el.style.display = '';
        el.setAttribute('href', href);
    }

    function updateCompanyBlock(company) {
        // name + logo + desc
        jQuery('#pv-company-name').text(company && company.title ? company.title : '');
        jQuery('#pv-company-logo').attr('src', company && company.logo_url ? company.logo_url : '');

        jQuery('#pv-company-description').html(company && company.desc_html ? company.desc_html : '');

        // address + directions
        const addr = company && company.address ? company.address : '';
        if (addr) {
            const q = encodeURIComponent(addr);
            const maps = 'https://www.google.com/maps/search/?api=1&query=' + q;
            jQuery('#pv-company-address-text').text(addr);
            jQuery('#pv-company-address').attr('href', maps);
            jQuery('#pv-company-address-row').show();
            setCompanyLink('pv-company-directions', maps, true);
        } else {
            jQuery('#pv-company-address-row').hide();
            setCompanyLink('pv-company-directions', '', false);
        }

        // website
        setCompanyLink('pv-company-website', company && company.website ? company.website : '', !!(company && company.website));

        // office phone
        setCompanyLink('pv-company-phone', company && company.tel ? ('tel:' + company.tel) : '', !!(company && company.tel));

        // direct line is profile-specific; leave to profile updater (or hide by default)
    
// Standard preview company buttons (additive)
if (company && company.website) {
    $('#std-company-website').attr('href', company.website);
    $('#std-btn-website').show();
} else {
    $('#std-btn-website').hide();
}

const phone = (company && company.tel) ? company.tel : '';
if (phone) {
    $('#std-company-phone').attr('href', 'tel:' + phone);
    $('#std-btn-phone').show();
} else {
    $('#std-btn-phone').hide();
}

if (company && company.address) {
    $('#std-company-address').text(company.address);
    $('#std-company-address-row').show();
    $('#std-company-directions').attr('href', 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(company.address));
    $('#std-btn-directions').show();
} else {
    $('#std-company-address-row').hide();
    $('#std-btn-directions').hide();
}
}
    function populatePreview(p, c){
        const first = p.first || '';
        const last  = p.last || '';
        const full  = (first + ' ' + last).trim();

        $('#pv-first').text(first || 'First');
        $('#pv-last').text(last || 'Last');
        $('#pv-job').text(p.job || 'Job title');
        $('#pv-company-name').text(c.title || 'Company name');

        // Standard preview basic fields
        $('#std-first').text(first || 'First');
        $('#std-last').text(last || 'Last');
        $('#std-job').text(p.job || 'Job title');
        $('#std-company-name').text(c.title || 'Company name');


        // Company logo
        if (c.logo_url) {
            $('#pv-company-logo').attr('src', c.logo_url).show();
        } else {
            $('#pv-company-logo').hide();
        }

        // Picture
        if (p.photo_url) {
            $('#mePreviewPic').attr('src', p.photo_url).show();
            $('#stdPreviewPic').attr('src', p.photo_url).show();
        } else {
            $('#mePreviewPic').hide();
            $('#stdPreviewPic').hide();
        }

        // Contact links
        const email = p.email || '';
        const mobile = p.mobile || '';
        const wa = p.wa || '';

        $('#pv-email-text').text(email);
        $('#pv-mobile-text').text(mobile);
        $('#pv-wa-text').text(wa);
        $('#pv-wa-row').toggle(!!wa);

        $('#std-email-text').text(email);
        $('#std-mobile-text').text(mobile);

        $('#pv-email').attr('href', email ? ('mailto:' + email) : '#');
        $('#pv-call').attr('href', mobile ? ('tel:' + mobile.replace(/\s+/g,'')) : '#');
        $('#pv-wa').attr('href', wa ? ('https://wa.me/' + wa.replace(/\D/g,'')) : '#');

        // Socials
        const soc = p.soc || {};
        toggleSocial('facebook', soc.facebook);
        toggleSocial('twitter', soc.twitter);
        toggleSocial('linkedin', soc.linkedin);
        toggleSocial('instagram', soc.instagram);
        toggleSocial('youtube', soc.youtube);
        toggleSocial('tiktok', soc.tiktok);

        // Standard socials
        setStdSocial('facebook', soc.facebook);
        setStdSocial('twitter', soc.twitter);
        setStdSocial('linkedin', soc.linkedin);
        setStdSocial('instagram', soc.instagram);
        setStdSocial('youtube', soc.youtube);
        setStdSocial('tiktok', soc.tiktok);

        // Description (HTML from TinyMCE)
        $('#pv-company-description').html(c.desc_html || '');

        // Design (CSS vars)
        const design = (c.design || {});
        const $scope = $('#proPreview');
        if (design.heading_font)  $scope.css('--me-heading-font',  design.heading_font);
        if (design.heading_color) $scope.css('--me-heading-color', design.heading_color);
        if (design.body_font)     $scope.css('--me-body-font',     design.body_font);
        if (design.body_color)    $scope.css('--me-body-color',    design.body_color);
        if (design.accent)        $scope.css('--me-accent',        design.accent);
        if (design.button_text)   $scope.css('--me-button-text',   design.button_text);
        if (design.download)      $scope.css('--me-download',      design.download);
        if (design.download_text) $scope.css('--me-download-text', design.download_text);

        // vCard (if you have a URL in your Renderer::get_profile_data)
        if (p.vcard_url) {
            $('#pv-vcard-link').attr('href', p.vcard_url);
        }
    }


    
function setStdSocial(key, url){
    const item = document.getElementById('std-soc-' + key);
    const a = document.getElementById('std-' + key);
    if (!item || !a) return;

    if (!url) {
        item.style.display = 'none';
        a.setAttribute('href', '#');
        return;
    }
    item.style.display = '';
    a.setAttribute('href', url);
}

function toggleSocial(key, url){
        const $item = $('#soc-' + key);
        if (url) {
            $item.show().find('a').attr('href', url);
        } else {
            $item.hide();
        }
    }

    function setLoading(isLoading){
        if (isLoading) {
            $('#meProfileLoading').show();
            $('#newMeEditor').hide();
        } else {
            $('#meProfileLoading').hide();
            $('#newMeEditor').show();
        }
    }

    function refreshUnderlyingToolsetViews() {
        console.log('finding view');
        // <div class="js-wpv-view-layout ..." data-viewnumber="...">
        const $views = jQuery('.js-wpv-view-layout');
        if (!$views.length) return;
        console.log('view found');
        // Fetch the current page HTML silently
        jQuery.get(window.location.href, function (html) {
            const doc = new DOMParser().parseFromString(html, 'text/html');

            $views.each(function () {
                const $current = jQuery(this);
                const viewNumber = $current.attr('data-viewnumber');
                if (!viewNumber) return;

                const selector = '.js-wpv-view-layout[data-viewnumber="' + viewNumber + '"]';
                const fresh = doc.querySelector(selector);
                if (!fresh) return;

                // Replace only the view's inner HTML to keep any event bindings outside intact
                $current.html(fresh.innerHTML);

                // Optional: if Toolset attaches behavior on load, give it a nudge
                // (safe no-op if not present)
                jQuery(document).trigger('js_event_wpv_pagination_completed');
                jQuery(document).trigger('js_event_wpv_post_pagination_completed');
            });
        });
    }

    // ---------- Live preview as user edits ----------
    $('#newMeProfileForm').on('input change', function(){
        setSaveUI('dirty');

        // Build a minimal profile object from the form
        const p = {
            first: $('#wpcf-first-name').val(),
            last:  $('#wpcf-last-name').val(),
            job:   $('#wpcf-job-title').val(),
            email: $('#wpcf-email-address').val(),
            mobile:$('#wpcf-mobile-number').val(),
            wa:    $('#wpcf-whatsapp-number').val(),
            type:  $('#wpcf-profile-type').val(),
            company_parent: parseInt($('#company_parent').val(), 10) || 0,
            photo_url: $('#meProfilePhotoPreview').is(':visible') ? $('#meProfilePhotoPreview').attr('src') : '',
            soc: {
                facebook:  $('#wpcf-facebook-url').val(),
                twitter:   $('#wpcf-twitter-url').val(),
                linkedin:  $('#wpcf-linkedin-url').val(),
                instagram: $('#wpcf-instagram-user').val(),
                youtube:   $('#wpcf-youtube-url').val(),
                tiktok:    $('#wpcf-tiktok-url').val()
            }
        };

        // Company part doesn't change live (design/description), so keep last loaded values by reading from DOM
        const c = {
            title: $('#pv-company-name').text(),
            logo_url: $('#pv-company-logo').attr('src'),
            desc_html: $('#pv-company-description').html(),
            design: {} // CSS vars already applied
        };

        populatePreview(p, c);
        updatePreviewSocialsFromForm();
        updatePreviewPrimaryButtonsFromForm();
        applyProfileTypeToPreview($('#wpcf-profile-type').val());
    });

    // ---------- Save ----------
    $(document).on('click', '#meProfileEditorModal .js-me-save', function(){
        const $f  = $('#newMeProfileForm');
        const fd  = new FormData($f[0]);

        fd.append('action', 'me_save_profile_form');
        fd.append(S.nonceField || '_wpnonce', S.nonceProfile);

        setSaveUI('saving');

        $.ajax({
            url: S.ajaxurl,
            method: 'POST',
            data: fd,
            processData: false,
            contentType: false
        }).done(function(res){
            if (res && res.success) {
                setSaveUI('saved');
                // Refresh underlying Toolset View
                refreshUnderlyingToolsetViews();
            } else {
                console.error('Save failed', res);
                setSaveUI('dirty');
            }
        }).fail(function(xhr){
            console.error('AJAX error', xhr && xhr.responseText);
            setSaveUI('dirty');
        });
    });

    // ---------- Open modal helper (matches your existing button calls) ----------
    window.NewMeOpenProfileEditor = function(post_id){
        $('#meProfileEditorModal').modal('show');
        setLoading(true);

        loadProfile(post_id)
            .always(function(){
                // Whether success or error, stop showing the loader
                setLoading(false);
            });
    };


    // ---------- Media frame for profile photo ----------
    $(document).on('click', '#meProfilePhotoButton', function(e){
        e.preventDefault();

        if (meProfileFrame) {
            meProfileFrame.open();
            return;
        }

        meProfileFrame = wp.media({
            title: 'Select Profile Picture',
            button: { text: 'Use this picture' },
            multiple: false
        });

        meProfileFrame.on('select', function(){
            const attachment = meProfileFrame.state().get('selection').first().toJSON();
            $('#me_profile_photo_id').val(attachment.id);

            const url = (attachment.sizes && attachment.sizes.thumbnail)
                ? attachment.sizes.thumbnail.url
                : attachment.url;

            // Update both form and preview
            $('#meProfilePhotoPreview, #mePreviewPic, #stdPreviewPic')
                .attr('src', url)
                .show();

            $('#newMeProfileForm').trigger('change');
        });

        meProfileFrame.open();
    });

})(jQuery);
