(function($){
    'use strict';

    const CFG = window.ME_SINGLE_EDITOR || {};
    const $page = $('.me-single-editor-page');
    if (!$page.length) return;

    const profileId = parseInt($page.data('profile-id'), 10) || 0;
    const $stdPane = $('#meSinglePreviewStandard');
    const $proPane = $('#meSinglePreviewPro');
    const $sheet = $('#me_single_sheet');
    const $sheetBackdrop = $('#me_single_sheet_backdrop');
    const $sheetForm = $('#me_single_sheet_form');
    const placeholderImages = CFG.images || {};
    const forcePro = String($page.data('force-pro') || '0') === '1';
    const serverInitialMode = String($page.data('initial-mode') || '');
    const DESCRIPTION_EDITOR_ID = 'me_single_company_description_editor';
    const SOCIAL_ORDER = ['linkedin', 'instagram', 'facebook', 'twitter', 'youtube', 'tiktok'];
    const SOCIAL_META = {
        linkedin:  { label: 'LinkedIn', valueLabel: 'Profile URL', placeholder: 'https://linkedin.com/in/yourname', kind: 'url' },
        instagram: { label: 'Instagram', valueLabel: 'Handle', placeholder: 'yourhandle', kind: 'handle' },
        facebook:  { label: 'Facebook', valueLabel: 'Page URL', placeholder: 'https://facebook.com/yourpage', kind: 'url' },
        twitter:   { label: 'X / Twitter', valueLabel: 'Profile URL', placeholder: 'https://x.com/yourname', kind: 'url' },
        youtube:   { label: 'YouTube', valueLabel: 'Channel URL', placeholder: 'https://youtube.com/@yourchannel', kind: 'url' },
        tiktok:    { label: 'TikTok', valueLabel: 'Profile URL', placeholder: 'https://tiktok.com/@yourname', kind: 'url' }
    };
    let currentMode = 'standard';
    let activeSheet = null;
    let activeRegion = null;
    let profileUrl = '';
    let state = {
        profile: {},
        company: {},
        profileLinks: [],
        companyLinks: [],
        cards: [],
        availableCards: [],
        basket: {}
    };

    function field($pane, name) {
        return $pane.find('[data-me-field="' + name + '"]');
    }

    function esc(value) {
        return $('<div>').text(value == null ? '' : String(value)).html();
    }

    function setStatus(text, isError) {
        $('#me_single_status').text(text || '').toggleClass('is-error', !!isError);
    }

    function buildEditorUrl(mode) {
        const fallbackBase = (window.location.origin || '') + '/manage/profile/';
        const url = new URL(CFG.editProfileUrl || fallbackBase, window.location.origin);
        if (mode === 'pro') {
            url.searchParams.set('mode', 'pro');
        } else {
            url.searchParams.delete('mode');
        }
        return url.toString();
    }

    function buildAddToCartUrl(productId, mode) {
        const id = parseInt(productId, 10) || 0;
        if (!id) return '#';
        const url = new URL(buildEditorUrl(mode), window.location.origin);
        url.searchParams.set('add-to-cart', id);
        return url.toString();
    }

    function renderUpgradePanel() {
        if (forcePro) {
            return;
        }
        const basket = state.basket || {};
        const isProfessional = String((state.profile && state.profile.type) || '').toLowerCase() === 'professional';
        const showUpgrade = currentMode === 'pro' && !isProfessional;
        const $panel = $('#me_single_upgrade_cta');
        const $benefits = $('#me_single_upgrade_benefits');
        const $body = $('#me_single_upgrade_panel_body');

        if (!showUpgrade) {
            $panel.prop('hidden', true);
            $benefits.prop('hidden', true);
            return;
        }

        $panel.prop('hidden', false);
        $benefits.prop('hidden', false);

        if (basket.upgradeInCart) {
            $body.html(
                '<div class="me-single-editor__basket-state">' +
                    '<strong>Pro profile is in your basket.</strong>' +
                    '<p>You can keep editing, view your basket, or go straight to checkout.</p>' +
                    '<div class="me-single-editor__panel-actions">' +
                        '<a class="me-single-editor__panel-button me-single-editor__panel-button--secondary" href="' + esc(basket.basketUrl || '#') + '">View basket</a>' +
                        '<a class="me-single-editor__panel-button me-single-editor__panel-button--primary" href="' + esc(basket.checkoutUrl || basket.basketUrl || '#') + '">Checkout and pay</a>' +
                    '</div>' +
                '</div>'
            );
        } else {
            $body.html(
                '<div class="me-single-editor__panel-actions">' +
                    '<a class="me-single-editor__panel-button me-single-editor__panel-button--primary" id="me_single_upgrade_now" href="' + esc(buildAddToCartUrl(profileId, 'pro')) + '">Add to basket</a>' +
                '</div>'
            );
        }
    }

    function setMode(mode) {
        if (forcePro) {
            mode = 'pro';
        }
        currentMode = mode === 'pro' ? 'pro' : 'standard';
        $('.me-single-editor__mode-btn').removeClass('is-active');
        $('.me-single-editor__mode-btn[data-mode="' + currentMode + '"]').addClass('is-active');
        $('.me-single-editor__pane').removeClass('is-active');
        $('#meSinglePreview' + (currentMode === 'pro' ? 'Pro' : 'Standard')).addClass('is-active');
        renderUpgradePanel();
    }

    function waitForWpEditor(cb) {
        let tries = 0;
        (function tick() {
            if (window.wp && (wp.oldEditor || wp.editor) && window.tinymce) {
                cb();
                return;
            }
            if (++tries > 50) return;
            window.setTimeout(tick, 100);
        })();
    }

    function removeDescriptionEditor() {
        if (!(window.wp && (wp.oldEditor || wp.editor))) return;
        const api = wp.oldEditor || wp.editor;
        if (window.tinymce && tinymce.get(DESCRIPTION_EDITOR_ID)) {
            try {
                api.remove(DESCRIPTION_EDITOR_ID);
            } catch (error) {
                // Keep going; stale editor cleanup should not break the sheet.
            }
        }
    }

    function getDescriptionHtml() {
        const editor = window.tinymce && tinymce.get(DESCRIPTION_EDITOR_ID);
        if (editor) {
            return editor.getContent({ format: 'raw' }) || '';
        }
        return $sheetForm.find('#' + DESCRIPTION_EDITOR_ID).val() || '';
    }

    function pushDescriptionPreview() {
        const html = getDescriptionHtml();
        setInput('#me_single_company_description', html);
        state.company = state.company || {};
        state.company.desc_raw = html;
        state.company.desc_html = html;
        hydrateAll();
    }

    function initDescriptionEditor(initialHtml) {
        waitForWpEditor(function() {
            const api = wp.oldEditor || wp.editor;
            const $textarea = $sheetForm.find('#' + DESCRIPTION_EDITOR_ID);
            if (!$textarea.length) return;
            removeDescriptionEditor();
            $textarea.val(initialHtml || '');
            api.initialize(DESCRIPTION_EDITOR_ID, {
                tinymce: {
                    wpautop: true,
                    branding: false,
                    height: 220,
                    toolbar1: 'formatselect bold italic underline | bullist numlist blockquote | alignleft aligncenter alignright | link unlink | undo redo',
                    toolbar2: '',
                    toolbar3: ''
                },
                quicktags: true,
                mediaButtons: false
            });
            window.setTimeout(function() {
                const editor = window.tinymce && tinymce.get(DESCRIPTION_EDITOR_ID);
                if (editor) {
                    editor.on('keyup change input NodeChange', pushDescriptionPreview);
                }
                $textarea.off('input.meSingleDesc').on('input.meSingleDesc', pushDescriptionPreview);
                pushDescriptionPreview();
            }, 100);
        });
    }

    function initAddressAutocomplete() {
        if (!CFG.googlePlacesEnabled || !(window.google && google.maps && google.maps.places)) return;
        const input = $sheetForm.find('input[name="address"]')[0];
        if (!input) return;
        const autocomplete = new google.maps.places.Autocomplete(input, {
            fields: ['formatted_address', 'name'],
            types: ['geocode']
        });
        autocomplete.addListener('place_changed', function() {
            const place = autocomplete.getPlace();
            if (place && place.formatted_address) {
                input.value = place.formatted_address;
            } else if (place && place.name && !input.value) {
                input.value = place.name;
            }
            $(input).trigger('input').trigger('change');
        });
    }

    function normalizeHex(value, fallback) {
        const raw = String(value || '').trim();
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
            return raw.toLowerCase();
        }
        return fallback || '#000000';
    }

    function nextAvailableSocial() {
        const socialMap = (state.profile && state.profile.soc) || {};
        for (let i = 0; i < SOCIAL_ORDER.length; i += 1) {
            const key = SOCIAL_ORDER[i];
            if (!socialMap[key]) {
                return key;
            }
        }
        return SOCIAL_ORDER[0];
    }

    function socialMeta(network) {
        return SOCIAL_META[network] || SOCIAL_META.linkedin;
    }

    function toggleSocialInPane($pane, key, url) {
        const $item = $pane.find('[data-me-field="soc-' + key + '"]');
        if (!$item.length) return;
        if (url) {
            $item.show().find('a').attr('href', url);
        } else {
            $item.hide().find('a').attr('href', '#');
        }
    }

    function formatWhatsappInt(raw) {
        if (!raw) return '';
        let val = String(raw).replace(/\s+/g, '');
        if (val.charAt(0) === '0') {
            val = '+27' + val.slice(1);
        }
        return val.replace(/[^\d]/g, '');
    }

    function normalizeInstagram(url) {
        return (url || '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').replace(/^@/, '');
    }

    function buildInstagramUrl(handle) {
        const clean = normalizeInstagram(handle);
        return clean ? 'https://instagram.com/' + clean : '';
    }

    function setInput(id, value) {
        $(id).val(value || '');
    }

    function syncForm() {
        const p = state.profile || {};
        const c = state.company || {};
        const d = c.design || {};

        setInput('#me_single_company_id', c.id || p.company_parent || 0);
        setInput('#me_single_profile_photo_id', p.photo_id || '');
        setInput('#me_single_company_logo_id', c.logo_id || p.company_logo_id || '');
        setInput('#me_single_first_name', p.first);
        setInput('#me_single_last_name', p.last);
        setInput('#me_single_job', p.job);
        setInput('#me_single_email', p.email);
        setInput('#me_single_mobile', p.mobile);
        setInput('#me_single_whatsapp', p.wa);
        setInput('#me_single_work_phone', p.direct_line);
        setInput('#me_single_profile_type', p.type || 'standard');
        setInput('#me_single_linkedin', (p.soc || {}).linkedin);
        setInput('#me_single_facebook', (p.soc || {}).facebook);
        setInput('#me_single_twitter', (p.soc || {}).twitter);
        setInput('#me_single_instagram', normalizeInstagram((p.soc || {}).instagram));
        setInput('#me_single_youtube', (p.soc || {}).youtube);
        setInput('#me_single_tiktok', (p.soc || {}).tiktok);
        setInput('#me_single_company_name', c.title || p.company_name);
        setInput('#me_single_company_website', c.website);
        setInput('#me_single_company_tel', c.tel);
        setInput('#me_single_company_email', c.email);
        setInput('#me_single_company_address', c.address);
        setInput('#me_single_company_description', c.desc_raw || '');
        setInput('#me_single_heading_font', d.heading_font_raw || c.heading_font_raw || '');
        setInput('#me_single_heading_colour', d.heading_color || '');
        setInput('#me_single_body_font', d.body_font_raw || c.body_font_raw || '');
        setInput('#me_single_body_colour', d.body_color || '');
        setInput('#me_single_accent', d.accent || '');
        setInput('#me_single_button_text', d.button_text || '');
        setInput('#me_single_download', d.download || '');
        setInput('#me_single_download_text', d.download_text || '');
        setInput('#me_single_custom_css', c.custom_css || '');
    }

    function syncStateFromForm() {
        state.profile.first = $('#me_single_first_name').val();
        state.profile.last = $('#me_single_last_name').val();
        state.profile.job = $('#me_single_job').val();
        state.profile.email = $('#me_single_email').val();
        state.profile.mobile = $('#me_single_mobile').val();
        state.profile.wa = $('#me_single_whatsapp').val();
        state.profile.direct_line = $('#me_single_work_phone').val();
        state.profile.type = $('#me_single_profile_type').val() || 'standard';
        state.profile.company_name = $('#me_single_company_name').val();
        state.profile.soc = state.profile.soc || {};
        state.profile.soc.linkedin = $('#me_single_linkedin').val();
        state.profile.soc.facebook = $('#me_single_facebook').val();
        state.profile.soc.twitter = $('#me_single_twitter').val();
        state.profile.soc.instagram = buildInstagramUrl($('#me_single_instagram').val());
        state.profile.soc.youtube = $('#me_single_youtube').val();
        state.profile.soc.tiktok = $('#me_single_tiktok').val();
        state.company = state.company || {};
        state.company.id = parseInt($('#me_single_company_id').val(), 10) || 0;
        state.company.title = $('#me_single_company_name').val();
        state.company.website = $('#me_single_company_website').val();
        state.company.tel = $('#me_single_company_tel').val();
        state.company.email = $('#me_single_company_email').val();
        state.company.address = $('#me_single_company_address').val();
        state.company.desc_raw = $('#me_single_company_description').val();
        state.company.desc_html = $('<div>').text(state.company.desc_raw || '').html().replace(/\n/g, '<br>');
        state.company.design = state.company.design || {};
        state.company.design.heading_font_raw = $('#me_single_heading_font').val();
        state.company.design.heading_color = $('#me_single_heading_colour').val();
        state.company.design.body_font_raw = $('#me_single_body_font').val();
        state.company.design.body_color = $('#me_single_body_colour').val();
        state.company.design.accent = $('#me_single_accent').val();
        state.company.design.button_text = $('#me_single_button_text').val();
        state.company.design.download = $('#me_single_download').val();
        state.company.design.download_text = $('#me_single_download_text').val();
        state.company.custom_css = $('#me_single_custom_css').val();
    }

    function applyCompanyDesignToPane($pane) {
        const design = (state.company && state.company.design) || {};
        const root = $pane.find('.pro-profile-container')[0];
        if (!root) return;
        const heading = design.heading_color || '#000000';
        const body = design.body_color || '#333333';
        const accent = design.accent || '#1e73be';
        const buttonText = design.button_text || '#ffffff';
        const download = design.download || '#30b030';
        const downloadText = design.download_text || '#000000';
        root.style.setProperty('--me-heading-color', heading);
        root.style.setProperty('--me-body-color', body);
        root.style.setProperty('--me-accent', accent);
        root.style.setProperty('--me-button-text', buttonText);
        root.style.setProperty('--me-download', download);
        root.style.setProperty('--me-download-text', downloadText);

        $pane.find('.pro-profile-container button.company, .pro-profile-container .profile-buttons button')
            .css({
                backgroundColor: accent,
                color: buttonText
            });
        $pane.find('[data-me-field="vcard-button"] .vcard-download, [data-me-field="vcard-button"] .vcard-button')
            .css('backgroundColor', download);
        $pane.find('[data-me-field="vcard-button"] a')
            .css('color', downloadText);
    }
    function hydratePane($pane, mode) {
        const p = state.profile || {};
        const c = state.company || {};
        const soc = p.soc || {};
        const profilePlaceholder = placeholderImages.profilePlaceholder || '';
        const companyPlaceholder = placeholderImages.companyPlaceholder || '';

        field($pane, 'first').text(p.first || '');
        field($pane, 'last').text(p.last || '');
        field($pane, 'job').text(p.job || '+ add job title');

        const $photo = field($pane, 'photo');
        $photo.attr('src', p.photo_url || profilePlaceholder).show();
        $pane.find('.me-photo-placeholder').hide();

        if (mode === 'standard') {
            field($pane, 'email-text').text(p.email || '');
            field($pane, 'mobile-text').text(p.mobile || '');
            field($pane, 'company-name').text(c.title || p.company_name || '');
            field($pane, 'email').attr('href', p.email ? 'mailto:' + p.email : '#');
            field($pane, 'call').attr('href', p.mobile ? 'tel:' + p.mobile : '#');
            const stdWaInt = formatWhatsappInt(p.wa || p.mobile || '');
            field($pane, 'wa').attr('href', stdWaInt ? 'https://wa.me/' + stdWaInt : '#');
            ['facebook','twitter','linkedin','instagram','youtube','tiktok'].forEach(function(key){
                toggleSocialInPane($pane, key, soc[key] || '');
            });
            field($pane, 'website-row').hide();
        } else {
            field($pane, 'company-name').text(c.title || p.company_name || '');
            const $logo = field($pane, 'company-logo');
            $logo.attr('src', c.logo_url || p.company_logo_url || companyPlaceholder).show();
            $pane.find('.me-single-editor__logo-placeholder').remove();
            if (c.desc_html) {
                field($pane, 'company-description').html(c.desc_html);
                field($pane, 'company-description').closest('.row').show();
            } else {
                field($pane, 'company-description').html('<span class="me-single-editor__empty-text">+ add company description</span>');
                field($pane, 'company-description').closest('.row').show();
            }
            const addr = c.address || '';
            if (addr) {
                const maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);
                field($pane, 'company-address-text').text(addr);
                field($pane, 'company-address').attr('href', maps);
                field($pane, 'company-address-row').show();
                field($pane, 'company-directions').show().attr('href', maps);
            } else {
                field($pane, 'company-address-row').hide();
                field($pane, 'company-directions').hide().attr('href', '#');
            }
            field($pane, 'company-website')[c.website ? 'show' : 'hide']().attr('href', c.website || '#');
            field($pane, 'company-phone')[c.tel ? 'show' : 'hide']().attr('href', c.tel ? 'tel:' + c.tel : '#');
            field($pane, 'direct-line')[p.direct_line ? 'show' : 'hide']().attr('href', p.direct_line ? 'tel:' + p.direct_line : '#');
            field($pane, 'email').attr('href', p.email ? 'mailto:' + p.email : '#');
            field($pane, 'call').attr('href', p.mobile ? 'tel:' + p.mobile : '#');
            const waInt = formatWhatsappInt(p.wa || p.mobile || '');
            field($pane, 'wa').attr('href', waInt ? 'https://wa.me/' + waInt : '#');
            ['facebook','twitter','linkedin','instagram','youtube','tiktok'].forEach(function(key){
                toggleSocialInPane($pane, key, soc[key] || '');
            });
            applyCompanyDesignToPane($pane);
        }
    }

    function renderLinks($target, rows, kind) {
        $target.empty();
        (rows || []).forEach(function(row, index) {
            const cls = kind === 'company' ? 'company-btn' : 'link-pill';
            const button = $('<button type="button" class="' + cls + ' me-single-link-chip"></button>')
                .text(row['button-text'] || 'Button')
                .attr('data-edit-sheet', kind === 'company' ? 'company-link' : 'profile-link')
                .attr('data-link-index', index)
                .attr('data-field-hint', 'text');
            $target.append(button);
        });
        const addButton = $('<button type="button" class="company-btn secondary me-single-add-chip"></button>')
            .text(kind === 'company' ? '+ Add Company link' : '+ Add Profile link')
            .attr('data-edit-sheet', kind === 'company' ? 'company-link' : 'profile-link')
            .attr('data-link-index', '')
            .attr('data-field-hint', 'text');
        $target.append(addButton);
    }

    function ensureEditorSlots() {
        if (!$stdPane.find('.me-single-editor__profile-links').length) {
            $stdPane.find('.standard-profile-container .container-fluid').append('<div class="me-single-editor__editor-slot me-single-editor__profile-links"></div>');
        }
        if (!$proPane.find('.me-single-editor__company-links').length) {
            $proPane.find('.pro-profile-container .container-fluid .row').last().after('<div class="me-single-editor__editor-slot me-single-editor__company-links"></div><div class="me-single-editor__editor-slot me-single-editor__profile-links"></div>');
        }
        if (!$proPane.find('.me-single-editor__company-prompts').length) {
            $proPane.find('[data-me-field="company-description"]').closest('.row').after('<div class="me-single-editor__editor-slot me-single-editor__company-prompts" style="display:none;"></div>');
        }
        if (!$stdPane.find('.me-single-editor__social-add-item').length) {
            $stdPane.find('.mecard-social').append('<div class="mecard-social-item me-single-editor__social-add-item"><button type="button" class="me-single-editor__social-add" data-edit-sheet="social-standard" data-field-hint="network">+</button></div>');
        }
        if (!$proPane.find('.me-single-editor__social-add-item').length) {
            $proPane.find('.mecard-social').append('<div class="mecard-social-item me-single-editor__social-add-item"><button type="button" class="me-single-editor__social-add" data-edit-sheet="social-pro" data-field-hint="network">+</button></div>');
        }
    }

    function renderDynamicCollections() {
        ensureEditorSlots();
        renderLinks($stdPane.find('.me-single-editor__profile-links'), state.profileLinks, 'profile');
        renderLinks($proPane.find('.me-single-editor__profile-links'), state.profileLinks, 'profile');
        renderLinks($proPane.find('.me-single-editor__company-links'), state.companyLinks, 'company');
        renderCompanyPrompts();
    }

    function renderCompanyPrompts() {
        const $slot = $proPane.find('.me-single-editor__company-prompts');
        if (!$slot.length) return;
        const c = state.company || {};
        const prompts = [];
        if (!c.address) {
            prompts.push('<button type="button" class="company-btn secondary me-single-editor__prompt-button" data-edit-sheet="company-pro" data-field-hint="address">+ add company address</button>');
        }
        if (!c.website) {
            prompts.push('<button type="button" class="company-btn secondary me-single-editor__prompt-button" data-edit-sheet="company-pro" data-field-hint="website">+ add company website</button>');
        }
        if (!c.email) {
            prompts.push('<button type="button" class="company-btn secondary me-single-editor__prompt-button" data-edit-sheet="company-pro" data-field-hint="email">+ add support email</button>');
        }
        if (!c.tel) {
            prompts.push('<button type="button" class="company-btn secondary me-single-editor__prompt-button" data-edit-sheet="company-pro" data-field-hint="tel">+ add office phone</button>');
        }
        if (prompts.length) {
            $slot.html(prompts.join('')).show();
        } else {
            $slot.empty().hide();
        }
    }

    function addEditPen($el, key, fieldHint, linkIndex) {
        if (!$el.length) return;
        $el.addClass('me-single-editor__editable').attr('data-edit-sheet', key);
        if (fieldHint) {
            $el.attr('data-field-hint', fieldHint);
        }
        if (linkIndex !== undefined && linkIndex !== null && linkIndex !== '') {
            $el.attr('data-link-index', linkIndex);
        }
    }

    function markRegion($elements, key, fieldHint) {
        $elements.each(function() {
            const $el = $(this);
            if (!$el.length) return;
            addEditPen($el, key, fieldHint);
        });
    }

    function attachEditableRegions() {
        clearFieldTargets();
        $('.me-single-editor__editable').removeClass('me-single-editor__editable').removeAttr('data-edit-sheet data-field-hint data-link-index');

        markRegion($stdPane.find('h1'), 'about-standard', 'first');
        markRegion($stdPane.find('[data-me-field="first"]'), 'about-standard', 'first');
        markRegion($stdPane.find('[data-me-field="last"]'), 'about-standard', 'last');
        markRegion($stdPane.find('.profile-image'), 'media-profile', 'media_profile');
        markRegion($stdPane.find('.profile-image img, .profile-image .me-photo-placeholder'), 'media-profile', 'media_profile');
        markRegion($stdPane.find('[data-me-field="job"]'), 'about-standard', 'job');
        markRegion($stdPane.find('[data-me-field="email-text"]').closest('.row'), 'contact-standard', 'email');
        markRegion($stdPane.find('[data-me-field="mobile-text"]').closest('.row'), 'contact-standard', 'mobile');
        markRegion($stdPane.find('[data-me-field="company-name"]').closest('.row'), 'company-standard', 'company');
        markRegion($stdPane.find('.mecard-social'), 'social-standard', 'network');

        markRegion($proPane.find('h1'), 'about-pro', 'first');
        markRegion($proPane.find('[data-me-field="first"]'), 'about-pro', 'first');
        markRegion($proPane.find('[data-me-field="last"]'), 'about-pro', 'last');
        markRegion($proPane.find('.profile-image.pro'), 'media-profile', 'media_profile');
        markRegion($proPane.find('.profile-image.pro img, .profile-image.pro .me-photo-placeholder'), 'media-profile', 'media_profile');
        markRegion($proPane.find('.pro-logo'), 'media-company-pro', 'media_company');
        markRegion($proPane.find('[data-me-field="company-logo"]'), 'media-company-pro', 'media_company');
        markRegion($proPane.find('.me-single-editor__logo-placeholder'), 'media-company-pro', 'media_company');
        markRegion($proPane.find('[data-me-field="job"]'), 'about-pro', 'job');
        markRegion($proPane.find('.profile-buttons').closest('.container-md'), 'contact-pro', 'mobile');
        markRegion($proPane.find('[data-me-field="company-name"]').closest('.row'), 'company-pro', 'company');
        markRegion($proPane.find('[data-me-field="company-name"]'), 'company-pro', 'company');
        markRegion($proPane.find('[data-me-field="company-address-row"]'), 'company-pro', 'address');
        markRegion($proPane.find('[data-me-field="company-description"]'), 'description-pro', 'description');
        markRegion($proPane.find('[data-me-field="company-website"]').closest('.row'), 'branding-pro', 'accent');
        markRegion($proPane.find('[data-me-field="vcard-button"]'), 'branding-pro', 'download');
        markRegion($proPane.find('.mecard-social'), 'social-pro', 'network');

        $stdPane.find('.mecard-social-item[data-me-field]').each(function() {
            const $item = $(this);
            const match = (($item.attr('data-me-field') || '').match(/^soc-(.+)$/) || [])[1];
            addEditPen($item, 'social-standard', 'value', match);
        });
        $proPane.find('.mecard-social-item[data-me-field]').each(function() {
            const $item = $(this);
            const match = (($item.attr('data-me-field') || '').match(/^soc-(.+)$/) || [])[1];
            addEditPen($item, 'social-pro', 'value', match);
        });
    }

    function hydrateAll() {
        hydratePane($stdPane, 'standard');
        hydratePane($proPane, 'pro');
        renderDynamicCollections();
        attachEditableRegions();
    }

    function renderCards(cards, available) {
        const $summary = $('#me_single_card_summary').empty();
        const $assign = $('#me_single_card_assign');
        const $select = $('#me_single_available_card').empty();
        $('#me_single_card_empty').text('');
        (cards || []).forEach(function(card) {
            $summary.append(
                $('<div class="me-single-editor__card-item"></div>').append(
                    $('<strong></strong>').text(card.title || 'Card'),
                    $('<span></span>').text(card.type ? 'Type: ' + card.type : 'Assigned'),
                    $('<span></span>').text(card.status || '')
                )
            );
        });
        if (!(cards || []).length) {
            $summary.html('<div class="me-single-editor__card-item"><strong>No card assigned yet</strong><span>You can assign an available card below.</span></div>');
        }
        if ((available || []).length) {
            available.forEach(function(card) {
                $select.append($('<option></option>').val(card.id).text(card.title + (card.type ? ' (' + card.type + ')' : '')));
            });
            $assign.show();
        } else {
            $assign.hide();
            $('#me_single_card_empty').text('No unassigned cards or tags are available on this account yet.');
        }
    }

    function loadEditor() {
        $.post(CFG.ajaxurl, {
            action: 'me_single_editor_load',
            post_id: profileId,
            _wpnonce: CFG.nonce
        }).done(function(res) {
            if (!res || !res.success) {
                setStatus((res && res.data && res.data.message) || 'Could not load this editor.', true);
                return;
            }
            const data = res.data || {};
            state.profile = data.profile || {};
            state.company = data.company || {};
            state.profileLinks = data.profileLinks || [];
            state.companyLinks = data.companyLinks || [];
            state.cards = data.cards || [];
            state.availableCards = data.availableCards || [];
            state.basket = data.basket || {};
            profileUrl = data.profileUrl || '';
            $('#me_single_done').attr('href', data.doneUrl || profileUrl || '#');
            const requestedMode = new URLSearchParams(window.location.search).get('mode');
            const initialMode = forcePro
                ? 'pro'
                : (requestedMode === 'pro'
                    ? 'pro'
                    : (serverInitialMode === 'pro' ? 'pro' : ((state.profile.type || 'standard').toLowerCase() === 'professional' ? 'pro' : 'standard')));
            setMode(initialMode);
            syncForm();
            hydrateAll();
            renderUpgradePanel();
        }).fail(function() {
            setStatus('Could not load this editor.', true);
        });
    }
    function collectLinks(kind) {
        return (kind === 'company' ? state.companyLinks : state.profileLinks).map(function(row) {
            return {
                child_id: row.child_id || '',
                'button-text': row['button-text'] || '',
                'button-url': row['button-url'] || '',
                'button-icon': row['button-icon'] || ''
            };
        });
    }

    function saveEditor(onSuccess) {
        syncStateFromForm();
        const fd = new FormData(document.getElementById('meSingleEditorForm'));
        fd.append('action', 'me_single_editor_save');
        fd.append('_wpnonce', CFG.nonce);
        fd.append('profile_links', JSON.stringify(collectLinks('profile')));
        fd.append('company_links', JSON.stringify(collectLinks('company')));
        setStatus('Saving...');
        setSheetSaving(true);
        $.ajax({
            url: CFG.ajaxurl,
            method: 'POST',
            data: fd,
            processData: false,
            contentType: false
        }).done(function(res) {
            if (!res || !res.success) {
                setSheetSaving(false);
                setStatus((res && res.data && res.data.message) || 'Save failed.', true);
                return;
            }
            const data = res.data || {};
            state.profile = data.profile || state.profile;
            state.company = data.company || state.company;
            state.profileLinks = data.profileLinks || state.profileLinks;
            state.companyLinks = data.companyLinks || state.companyLinks;
            state.cards = data.cards || state.cards;
            state.availableCards = data.availableCards || state.availableCards;
            state.basket = data.basket || state.basket;
            profileUrl = data.profileUrl || profileUrl;
            $('#me_single_done').attr('href', data.doneUrl || profileUrl || '#');
            syncForm();
            hydrateAll();
            renderUpgradePanel();
            setStatus(data.message || 'Saved.');
            if (typeof onSuccess === 'function') {
                onSuccess(data);
            }
        }).fail(function() {
            setSheetSaving(false);
            setStatus('Save failed.', true);
        });
    }

    function pickMedia(target) {
        const currentPreview = target === 'profile'
            ? (state.profile && state.profile.photo_url) || (placeholderImages.profilePlaceholder || '')
            : ((state.company && state.company.logo_url) || (state.profile && state.profile.company_logo_url) || (placeholderImages.companyPlaceholder || ''));
        const frame = wp.media({
            title: 'Select image',
            button: { text: 'Use this image' },
            multiple: false,
            library: { type: ['image'], author: CFG.currentUserId || 0, mecard_owned_only: true }
        });
        frame.on('open', function() {
            const selection = frame.state().get('selection');
            const currentId = target === 'profile'
                ? parseInt($('#me_single_profile_photo_id').val(), 10) || 0
                : parseInt($('#me_single_company_logo_id').val(), 10) || 0;
            if (currentId) {
                const attachment = wp.media.attachment(currentId);
                attachment.fetch();
                selection.reset([attachment]);
            }
            const props = frame.state().props || null;
            if (props) {
                props.set('author', CFG.currentUserId || 0);
                props.set('mecard_owned_only', true);
                props.set('type', 'image');
            }
        });
        frame.on('select', function() {
            const file = frame.state().get('selection').first().toJSON();
            if (target === 'profile') {
                state.profile.photo_id = file.id;
                state.profile.photo_url = file.url;
                $('#me_single_profile_photo_id').val(file.id);
            } else {
                state.company.logo_id = file.id;
                state.company.logo_url = file.url;
                $('#me_single_company_logo_id').val(file.id);
            }
            $sheetForm.find('.me-single-editor__media-preview').attr('src', file.url);
            hydrateAll();
        });
        frame.open();
    }

    function clearFieldTargets() {
        $('.me-single-editor__editable').removeClass('is-field-target');
    }

    function focusSheetField(name) {
        if (!name) return;
        window.setTimeout(function() {
            const $input = $sheetForm.find('[name="' + name + '"]').first();
            if (!$input.length) return;
            const $label = $input.closest('label');
            $label.addClass('is-focused');
            if ($input[0] && typeof $input[0].scrollIntoView === 'function') {
                $input[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
            $input.trigger('focus');
            window.setTimeout(function() {
                $label.removeClass('is-focused');
            }, 1800);
        }, 30);
    }

    function setSheetSaving(isSaving) {
        const $submit = $sheetForm.find('button[type="submit"]');
        if (!$submit.length) return;
        $submit.prop('disabled', !!isSaving).text(isSaving ? 'Saving...' : 'Save');
    }

    function showSheet(title, hint, fields, onSubmit, focusField) {
        activeSheet = onSubmit;
        $('#me_single_sheet_title').text(title);
        $('#me_single_sheet_hint').text(hint || '');
        $sheetForm.html(fields + '<div class="me-single-editor__sheet-actions"><button type="button" class="button button-secondary" id="me_single_sheet_cancel">Cancel</button><button type="submit" class="button button-primary" id="me_single_sheet_submit">Save</button></div>');
        $sheet.prop('hidden', false);
        $sheetBackdrop.prop('hidden', false);
        focusSheetField(focusField);
    }

    function closeSheet() {
        removeDescriptionEditor();
        activeSheet = null;
        activeRegion = null;
        $sheet.prop('hidden', true);
        $sheetBackdrop.prop('hidden', true);
        $sheetForm.empty();
        clearFieldTargets();
    }

    function colorInput(id, label, value, fallback) {
        const hex = normalizeHex(value, fallback || '#000000');
        return '<label><span>' + label + '</span><div class="me-single-editor__color-field"><input type="text" name="' + id + '" class="me-single-editor__color-text" value="' + esc(hex) + '" placeholder="#1E73BE" spellcheck="false" autocomplete="off"><input type="color" class="me-single-editor__color-picker" data-sync-target="' + id + '" value="' + esc(hex) + '"></div></label>';
    }

    function openRegionSheet(key, index, fieldHint, $region) {
        const p = state.profile || {};
        const c = state.company || {};
        const d = c.design || {};
        const profilePreview = p.photo_url || placeholderImages.profilePlaceholder || '';
        const companyPreview = c.logo_url || p.company_logo_url || placeholderImages.companyPlaceholder || '';
        const companyName = c.title || p.company_name || '';
        activeRegion = $region || null;
        clearFieldTargets();
        if (activeRegion && activeRegion.length) {
            activeRegion.addClass('is-field-target');
        }
        if (key === 'media-company-pro') {
            showSheet('Edit company logo', 'Upload or replace the company logo shown at the top of the Pro profile.', '<img class="me-single-editor__media-preview" src="' + esc(companyPreview) + '" alt="Company logo preview"><div class="me-single-editor__sheet-grid"><button type="button" class="button button-secondary me-single-editor__media-button" data-pick-media="company">Choose logo</button></div>', function() {}, null);
            return;
        }
        if (key === 'media-profile') {
            showSheet('Edit profile photo', 'Upload or replace the profile photo.', '<img class="me-single-editor__media-preview" src="' + esc(profilePreview) + '" alt="Profile photo preview"><div class="me-single-editor__sheet-grid"><button type="button" class="button button-secondary me-single-editor__media-button" data-pick-media="profile">Choose photo</button></div>', function() {}, null);
            return;
        }
        if (key === 'about-standard' || key === 'about-pro') {
            showSheet('Edit about', 'Update the main identity area.', '<label><span>First name</span><input type="text" name="first" value="' + esc(p.first) + '"></label><label><span>Last name</span><input type="text" name="last" value="' + esc(p.last) + '"></label><label><span>Job title</span><input type="text" name="job" value="' + esc(p.job) + '" placeholder="e.g. Founder"></label>', function(fd) {
                setInput('#me_single_first_name', fd.get('first'));
                setInput('#me_single_last_name', fd.get('last'));
                setInput('#me_single_job', fd.get('job'));
            }, fieldHint || 'first');
            return;
        }
        if (key === 'contact-standard') {
            showSheet('Edit contact', 'Update the Standard contact details.', '<label><span>Email address</span><input type="email" name="email" value="' + esc(p.email) + '"></label><label><span>Mobile number</span><input type="text" name="mobile" value="' + esc(p.mobile) + '"></label>', function(fd) {
                setInput('#me_single_email', fd.get('email'));
                setInput('#me_single_mobile', fd.get('mobile'));
            }, fieldHint || 'email');
            return;
        }
        if (key === 'contact-pro') {
            showSheet('Edit primary contact', 'These power the richer Pro actions.', '<label><span>Email address</span><input type="email" name="email" value="' + esc(p.email) + '"></label><label><span>Mobile number</span><input type="text" name="mobile" value="' + esc(p.mobile) + '"></label><label><span>WhatsApp number</span><input type="text" name="wa" value="' + esc(p.wa) + '"></label><label><span>Direct line</span><input type="text" name="direct" value="' + esc(p.direct_line) + '"></label>', function(fd) {
                setInput('#me_single_email', fd.get('email'));
                setInput('#me_single_mobile', fd.get('mobile'));
                setInput('#me_single_whatsapp', fd.get('wa'));
                setInput('#me_single_work_phone', fd.get('direct'));
            }, fieldHint || 'mobile');
            return;
        }
        if (key === 'company-standard') {
            showSheet('Edit company', 'Standard keeps this lightweight: company name only.', '<label><span>Company name</span><input type="text" name="company" value="' + esc(c.title || p.company_name) + '"></label>', function(fd) {
                setInput('#me_single_company_name', fd.get('company'));
            }, 'company');
            return;
        }
        if (key === 'company-pro') {
            showSheet('Edit company info', 'Update the linked company details.', '<label><span>Company name</span><input type="text" name="company" value="' + esc(companyName) + '"></label><label><span>Website</span><input type="url" name="website" value="' + esc(c.website) + '" placeholder="https://mysite.com"></label><label><span>Office phone</span><input type="text" name="tel" value="' + esc(c.tel) + '" placeholder="+27 11 555 1234"></label><label><span>Support email</span><input type="email" name="email" value="' + esc(c.email) + '" placeholder="support@mysite.com"></label><label><span>Address</span><input type="text" name="address" value="' + esc(c.address) + '" autocomplete="street-address" placeholder="Search for a company address"></label>', function(fd) {
                setInput('#me_single_company_name', fd.get('company'));
                setInput('#me_single_company_website', fd.get('website'));
                setInput('#me_single_company_tel', fd.get('tel'));
                setInput('#me_single_company_email', fd.get('email'));
                setInput('#me_single_company_address', fd.get('address'));
            }, fieldHint || 'company');
            initAddressAutocomplete();
            return;
        }
        if (key === 'description-pro') {
            showSheet('Edit company description', 'This is the richer company text block.', '<label><span>Description</span><textarea name="description" id="' + DESCRIPTION_EDITOR_ID + '" rows="8">' + esc(c.desc_raw || '') + '</textarea></label>', function() {
                const html = getDescriptionHtml();
                setInput('#me_single_company_description', html);
            }, 'description');
            initDescriptionEditor(c.desc_raw || '');
            return;
        }
        if (key === 'branding-pro') {
            showSheet('Edit branding', 'These colors update the live Pro preview.', '<div class="me-single-editor__sheet-grid">' + colorInput('accent', 'Button color', d.accent || '#1e73be', '#1e73be') + colorInput('button_text', 'Button text', d.button_text || '#ffffff', '#ffffff') + colorInput('download', 'Download button', d.download || '#30b030', '#30b030') + colorInput('download_text', 'Download text', d.download_text || '#000000', '#000000') + '</div>', function(fd) {
                setInput('#me_single_accent', fd.get('accent'));
                setInput('#me_single_button_text', fd.get('button_text'));
                setInput('#me_single_download', fd.get('download'));
                setInput('#me_single_download_text', fd.get('download_text'));
            }, fieldHint || 'accent');
            $sheetForm.find('.me-single-editor__color-picker').on('input', function() {
                const target = $(this).data('sync-target');
                const value = normalizeHex(this.value, '#000000');
                $sheetForm.find('input[name="' + target + '"]').val(value);
                if (target === 'accent') setInput('#me_single_accent', value);
                if (target === 'button_text') setInput('#me_single_button_text', value);
                if (target === 'download') setInput('#me_single_download', value);
                if (target === 'download_text') setInput('#me_single_download_text', value);
                syncStateFromForm();
                hydrateAll();
            });
            $sheetForm.find('.me-single-editor__color-text').on('input', function() {
                const value = normalizeHex(this.value, $(this).attr('placeholder') || '#000000');
                const target = this.name;
                $sheetForm.find('.me-single-editor__color-picker[data-sync-target="' + target + '"]').val(value);
                if (target === 'accent') setInput('#me_single_accent', value);
                if (target === 'button_text') setInput('#me_single_button_text', value);
                if (target === 'download') setInput('#me_single_download', value);
                if (target === 'download_text') setInput('#me_single_download_text', value);
                syncStateFromForm();
                hydrateAll();
            });
            return;
        }
        if (key === 'social-standard' || key === 'social-pro') {
            const socialMap = state.profile.soc || {};
            const network = index || nextAvailableSocial();
            const value = network ? (socialMap[network] || '') : '';
            const meta = socialMeta(network);
            showSheet(index ? 'Edit social link' : 'Add social link', 'Existing icons appear where they render on the profile.', '<label><span>Network</span><select name="network"><option value="linkedin"' + (network === 'linkedin' ? ' selected' : '') + '>LinkedIn</option><option value="facebook"' + (network === 'facebook' ? ' selected' : '') + '>Facebook</option><option value="twitter"' + (network === 'twitter' ? ' selected' : '') + '>X / Twitter</option><option value="instagram"' + (network === 'instagram' ? ' selected' : '') + '>Instagram</option><option value="youtube"' + (network === 'youtube' ? ' selected' : '') + '>YouTube</option><option value="tiktok"' + (network === 'tiktok' ? ' selected' : '') + '>TikTok</option></select></label><label><span class="me-single-editor__social-value-label">' + esc(meta.valueLabel) + '</span><input type="text" name="value" value="' + esc(value) + '" placeholder="' + esc(meta.placeholder) + '"></label>', function(fd) {
                const net = fd.get('network');
                const val = fd.get('value');
                if (net === 'instagram') {
                    setInput('#me_single_instagram', normalizeInstagram(val));
                } else {
                    const inputMap = { linkedin: '#me_single_linkedin', facebook: '#me_single_facebook', twitter: '#me_single_twitter', youtube: '#me_single_youtube', tiktok: '#me_single_tiktok' };
                    if (inputMap[net]) setInput(inputMap[net], val);
                }
            }, fieldHint || (network ? 'value' : 'network'));
            $sheetForm.find('select[name="network"]').on('change', function() {
                const selectedMeta = socialMeta(this.value);
                $sheetForm.find('.me-single-editor__social-value-label').text(selectedMeta.valueLabel);
                $sheetForm.find('input[name="value"]').attr('placeholder', selectedMeta.placeholder);
            });
            return;
        }
        if (key === 'profile-link' || key === 'company-link') {
            const arr = key === 'company-link' ? state.companyLinks : state.profileLinks;
            const row = index !== '' && index != null ? (arr[parseInt(index, 10)] || {}) : {};
            const noun = key === 'company-link' ? 'Company link' : 'Profile link';
            showSheet(index !== '' && index != null ? 'Edit ' + noun : 'Add ' + noun, 'Buttons are rendered directly into the profile preview.', '<label><span>Button text</span><input type="text" name="text" value="' + esc(row['button-text'] || '') + '" placeholder="e.g. Book a meeting"></label><label><span>Button URL</span><input type="url" name="url" value="' + esc(row['button-url'] || '') + '" placeholder="https://mysite.com"></label><label><span>Icon class</span><input type="text" name="icon" value="' + esc(row['button-icon'] || '') + '" placeholder="fa-solid fa-globe"></label>', function(fd) {
                const target = key === 'company-link' ? state.companyLinks : state.profileLinks;
                const obj = { child_id: row.child_id || '', 'button-text': fd.get('text'), 'button-url': fd.get('url'), 'button-icon': fd.get('icon') };
                if (index !== '' && index != null) {
                    target[parseInt(index, 10)] = obj;
                } else {
                    target.push(obj);
                }
            }, fieldHint || 'text');
        }
    }

    function assignCard() {
        const cardId = parseInt($('#me_single_available_card').val(), 10) || 0;
        if (!cardId) return;
        setStatus('Assigning card...');
        $.post(CFG.ajaxurl, {
            action: 'assign_card',
            card_id: cardId,
            profile_id: profileId,
            _wpnonce: (window.MECARD_MGMT && window.MECARD_MGMT.nonce) || ''
        }).done(function() {
            setStatus('Card assigned.');
            loadEditor();
        }).fail(function() {
            setStatus('Could not assign the card.', true);
        });
    }

    $(document).on('click', '.me-single-editor__mode-btn', function() {
        setMode($(this).data('mode'));
    });

    $(document).on('click', '[data-edit-sheet]', function(event) {
        event.preventDefault();
        event.stopPropagation();
        const $target = $(event.currentTarget);
        const $region = $target;
        const sheet = $region.attr('data-edit-sheet') || '';
        const linkIndex = $region.attr('data-link-index') || '';
        const fieldHint = $region.attr('data-field-hint') || '';
        if ($region.hasClass('mecard-social-item') && !$region.hasClass('me-single-editor__social-add-item')) {
            const match = (($region.attr('data-me-field') || '').match(/^soc-(.+)$/) || [])[1];
            openRegionSheet(sheet, match, fieldHint, $region);
            return;
        }
        openRegionSheet(sheet, linkIndex, fieldHint, $region);
    });
    $(document).on('click', '#me_single_sheet_close, #me_single_sheet_cancel', function(event) {
        event.preventDefault();
        closeSheet();
    });

    $sheetBackdrop.on('click', closeSheet);

    $sheetForm.on('submit', function(event) {
        event.preventDefault();
        if (typeof activeSheet === 'function') {
            if (window.tinymce && tinymce.get(DESCRIPTION_EDITOR_ID)) {
                tinymce.get(DESCRIPTION_EDITOR_ID).save();
            }
            activeSheet(new FormData(this));
            syncStateFromForm();
            hydrateAll();
            saveEditor(closeSheet);
            return;
        }
        closeSheet();
    });

    $(document).on('click', '[data-pick-media]', function(event) {
        event.preventDefault();
        pickMedia($(this).data('pick-media'));
    });

    $('#me_single_assign_card').on('click', assignCard);

    loadEditor();
})(jQuery);
