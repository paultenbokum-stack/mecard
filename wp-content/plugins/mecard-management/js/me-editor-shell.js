(function($){
    'use strict';

    const S = window.ME || {};
    if (!S.ajaxurl) {
        console.error('[MeCard] ajaxurl missing');
    }

    let current = { kind: 'profile', post_id: null };
    let meProfileFrame = null;

    // Pane scope references — elements are rendered in wp_footer at priority 10, before this script
    var $proPane = $('#mePreviewProPane');
    var $stdPane = $('#mePreviewStandardPane');

    function field($pane, name) {
        return $pane.find('[data-me-field="' + name + '"]');
    }

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
        $wrap.find('.me-preview-tab[data-me-preview-tab="' + mode + '"]').addClass('is-active').attr('aria-selected','true');

        // panes — clear any jQuery-injected inline display before class toggle
        $wrap.find('.me-preview-pane').css('display', '').removeClass('is-active');
        $wrap.find('.me-preview-pane[data-me-preview-pane="' + mode + '"]').addClass('is-active');
    }

    function syncPreviewVisibilityFromType(typeVal){
        const type = (typeVal || '').toString().toLowerCase();
        const isPro = (type === 'pro' || type === 'professional');

        const $wrap = $('#mePreviewSwitcher');
        if (!$wrap.length) return;

        const $stdTab  = $wrap.find('.me-preview-tab[data-me-preview-tab="standard"]');
        const $toggle  = $wrap.find('.me-preview-toggle');
        const $upsell  = $wrap.find('[data-me-preview-upsell]');
        const $stdPane = $wrap.find('.me-preview-pane[data-me-preview-pane="standard"]');

        if (isPro) {
            $stdTab.hide();
            $stdPane.hide();
            $upsell.hide();
            $toggle.hide();
            setPreviewMode('pro');
        } else {
            $toggle.show();
            $stdTab.show();
            $stdPane.show();
            $upsell.show();
            setPreviewMode('standard');
        }
    }

    // Click handling (event delegation: works even if modal HTML is injected)
    $(document).on('click', '.me-preview-tab', function(){
        const mode = $(this).data('me-preview-tab');
        if (!mode) return;
        setPreviewMode(mode);
    });

    // ---------- Mobile preview overlay ----------
    var $mobilePreviewBody = $('#meMobilePreviewBody');
    var $switcherOriginalParent = null;

    $(document).on('click', '#meMobilePreviewBtn', function(){
        var $sw = $('#mePreviewSwitcher');
        if (!$sw.length) return;
        $switcherOriginalParent = $sw.parent();
        $sw.detach().appendTo($mobilePreviewBody);
        $('#meMobilePreviewOverlay').addClass('is-open');
        // Default to standard on open unless profile is already pro
        if ($sw.attr('data-mode') !== 'pro') {
            setPreviewMode('standard');
        }
    });

    $(document).on('click', '#meMobilePreviewClose', function(){
        var $sw = $('#mePreviewSwitcher');
        if ($switcherOriginalParent) {
            $sw.detach().appendTo($switcherOriginalParent);
            $switcherOriginalParent = null;
        }
        $('#meMobilePreviewOverlay').removeClass('is-open');
    });

    // ---------- Social helpers ----------
    function toggleSocialInPane($pane, key, url) {
        var $item = $pane.find('[data-me-field="soc-' + key + '"]');
        if (url) { $item.show().find('a').attr('href', url); }
        else      { $item.hide(); }
    }

    // ---------- Company design (CSS custom properties) ----------
    function applyCompanyDesignToPreview(company) {
        var root = document.querySelector('#mePreviewProPane .pro-profile-container');
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

        let styleEl = root.querySelector('style[data-me-custom-css="1"]');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.setAttribute('data-me-custom-css', '1');
            root.appendChild(styleEl);
        }
        styleEl.textContent = company && company.custom_css ? company.custom_css : '';
    }

    // ---------- Update socials from form fields ----------
    function updatePreviewSocialsFromForm() {
        const fb = $('#wpcf-facebook-url').val() || '';
        const tw = $('#wpcf-twitter-url').val() || '';
        const li = $('#wpcf-linkedin-url').val() || '';
        const yt = $('#wpcf-youtube-url').val() || '';
        const tk = $('#wpcf-tiktok-url').val() || '';

        const igUserRaw = $('#wpcf-instagram-user').val() || '';
        const igUser = igUserRaw.replace(/^@/, '').trim();
        const ig = igUser ? ('https://instagram.com/' + igUser) : '';

        var socials = { facebook: fb, twitter: tw, linkedin: li, instagram: ig, youtube: yt, tiktok: tk };
        var keys = Object.keys(socials);
        for (var i = 0; i < keys.length; i++) {
            toggleSocialInPane($proPane, keys[i], socials[keys[i]]);
            toggleSocialInPane($stdPane, keys[i], socials[keys[i]]);
        }
    }

    function formatWhatsappInt(raw) {
        if (!raw) return '';
        let v = String(raw).trim();
        v = v.replace(/\s+/g, '');
        if (v.startsWith('0')) v = '+27' + v.slice(1);
        v = v.replace(/^\+/, '');
        return v;
    }

    // ---------- Update primary action buttons from form ----------
    function updatePreviewPrimaryButtonsFromForm() {
        const email  = $('#wpcf-email-address').val() || '';
        const mobile = $('#wpcf-mobile-number').val() || '';
        const waRaw  = $('#wpcf-whatsapp-number').val() || mobile;
        const waInt  = formatWhatsappInt(waRaw);

        field($proPane, 'email').attr('href', email ? ('mailto:' + email) : '#');
        field($proPane, 'call').attr('href', mobile ? ('tel:' + mobile) : '#');
        field($proPane, 'wa').attr('href', waInt ? ('https://wa.me/' + waInt) : '#');

        field($stdPane, 'email-text').text(email);
        field($stdPane, 'mobile-text').text(mobile);
    }

    // ---------- Update company block in both panes ----------
    function updateCompanyBlock(company) {
        // -- Pro pane --
        field($proPane, 'company-name').text(company && company.title ? company.title : '');

        if (company && company.logo_url) {
            field($proPane, 'company-logo').attr('src', company.logo_url).show();
        } else {
            field($proPane, 'company-logo').hide();
        }

        field($proPane, 'company-description').html(company && company.desc_html ? company.desc_html : '');

        const addr = company && company.address ? company.address : '';
        if (addr) {
            const maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);
            field($proPane, 'company-address-text').text(addr);
            field($proPane, 'company-address').attr('href', maps);
            field($proPane, 'company-address-row').show();
            field($proPane, 'company-directions').show().attr('href', maps);
        } else {
            field($proPane, 'company-address-row').hide();
            field($proPane, 'company-directions').hide().attr('href', '#');
        }

        if (company && company.website) {
            field($proPane, 'company-website').show().attr('href', company.website);
        } else {
            field($proPane, 'company-website').hide().attr('href', '#');
        }

        if (company && company.tel) {
            field($proPane, 'company-phone').show().attr('href', 'tel:' + company.tel);
        } else {
            field($proPane, 'company-phone').hide().attr('href', '#');
        }

        // -- Standard pane --
        field($stdPane, 'company-name').text(company && company.title ? company.title : '');

        if (addr) {
            const mapsStd = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);
            field($stdPane, 'company-address').text(addr);
            field($stdPane, 'company-address-row').show();
            field($stdPane, 'btn-directions').show();
            field($stdPane, 'company-directions').attr('href', mapsStd);
        } else {
            field($stdPane, 'company-address-row').hide();
            field($stdPane, 'btn-directions').hide();
        }

        if (company && company.website) {
            field($stdPane, 'btn-website').show();
            field($stdPane, 'company-website').attr('href', company.website);
        } else {
            field($stdPane, 'btn-website').hide();
        }

        if (company && company.tel) {
            field($stdPane, 'btn-phone').show();
            field($stdPane, 'company-phone').attr('href', 'tel:' + company.tel);
        } else {
            field($stdPane, 'btn-phone').hide();
        }
    }

    // ---------- Populate both preview panes from data objects ----------
    function populatePreview(p, c){
        field($proPane, 'first').text(p.first || 'First');
        field($proPane, 'last').text(p.last || 'Last');
        field($proPane, 'job').text(p.job || 'Job title');

        field($stdPane, 'first').text(p.first || 'First');
        field($stdPane, 'last').text(p.last || 'Last');
        field($stdPane, 'job').text(p.job || 'Job title');

        // Photo
        if (p.photo_url) {
            field($proPane, 'photo').attr('src', p.photo_url).show();
            field($stdPane, 'photo').attr('src', p.photo_url).show();
        } else {
            field($proPane, 'photo').hide();
            field($stdPane, 'photo').hide();
        }

        // Contact action buttons (pro pane)
        const email  = p.email || '';
        const mobile = p.mobile || '';
        const waInt  = formatWhatsappInt(p.wa || mobile);

        field($proPane, 'email').attr('href', email ? ('mailto:' + email) : '#');
        field($proPane, 'call').attr('href', mobile ? ('tel:' + mobile) : '#');
        field($proPane, 'wa').attr('href', waInt ? ('https://wa.me/' + waInt) : '#');

        // Contact text (standard pane)
        field($stdPane, 'email-text').text(email);
        field($stdPane, 'mobile-text').text(mobile);

        // Socials — both panes
        const soc  = p.soc || {};
        const nets = ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'tiktok'];
        for (var i = 0; i < nets.length; i++) {
            toggleSocialInPane($proPane, nets[i], soc[nets[i]] || '');
            toggleSocialInPane($stdPane, nets[i], soc[nets[i]] || '');
        }

        // vCard link
        if (p.vcard_url) {
            field($proPane, 'vcard-link').attr('href', p.vcard_url);
            field($stdPane, 'vcard-link').attr('href', p.vcard_url);
        }
    }

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
            syncPreviewVisibilityFromType(profile.type);
            applyCompanyDesignToPreview(company);
            updateCompanyBlock(company);
            populatePreview(profile, company);
            updatePreviewSocialsFromForm();
            updatePreviewPrimaryButtonsFromForm();

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
        const $views = jQuery('.js-wpv-view-layout');
        if (!$views.length) return;
        console.log('view found');
        jQuery.get(window.location.href, function (html) {
            const doc = new DOMParser().parseFromString(html, 'text/html');

            $views.each(function () {
                const $current = jQuery(this);
                const viewNumber = $current.attr('data-viewnumber');
                if (!viewNumber) return;

                const selector = '.js-wpv-view-layout[data-viewnumber="' + viewNumber + '"]';
                const fresh = doc.querySelector(selector);
                if (!fresh) return;

                $current.html(fresh.innerHTML);
                jQuery(document).trigger('js_event_wpv_pagination_completed');
                jQuery(document).trigger('js_event_wpv_post_pagination_completed');
            });
        });
    }

    // ---------- Live preview as user edits ----------
    $('#newMeProfileForm').on('input change', function(){
        setSaveUI('dirty');

        const p = {
            first:  $('#wpcf-first-name').val(),
            last:   $('#wpcf-last-name').val(),
            job:    $('#wpcf-job-title').val(),
            email:  $('#wpcf-email-address').val(),
            mobile: $('#wpcf-mobile-number').val(),
            wa:     $('#wpcf-whatsapp-number').val(),
            type:   $('#wpcf-profile-type').val(),
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

        // Company data doesn't change live; read from rendered pane
        const c = {
            title:     field($proPane, 'company-name').text(),
            logo_url:  field($proPane, 'company-logo').attr('src'),
            desc_html: field($proPane, 'company-description').html(),
            design: {} // CSS vars already applied via applyCompanyDesignToPreview
        };

        syncPreviewVisibilityFromType(p.type);
        populatePreview(p, c);
        updatePreviewSocialsFromForm();
        updatePreviewPrimaryButtonsFromForm();
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

    // ---------- Open modal helper (matches existing button calls) ----------
    window.NewMeOpenProfileEditor = function(post_id){
        $('#meProfileEditorModal').modal('show');
        setLoading(true);

        loadProfile(post_id)
            .always(function(){
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

            $('#meProfilePhotoPreview').attr('src', url).show();
            field($proPane, 'photo').attr('src', url).show();
            field($stdPane, 'photo').attr('src', url).show();

            $('#newMeProfileForm').trigger('change');
        });

        meProfileFrame.open();
    });

})(jQuery);
