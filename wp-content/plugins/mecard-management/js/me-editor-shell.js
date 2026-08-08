(function($){
    'use strict';

    const S = window.ME || {};
    if (!S.ajaxurl) {
        console.error('[MeCard] ajaxurl missing');
    }

    let current = {
        kind: 'profile',
        post_id: null,
        company_id: 0,
        mode: 'edit',
        // A standard profile that already has a company linked keeps the picker,
        // otherwise the link would become invisible and unmanageable.
        legacyCompanyLink: false,
        entitlements: {}
    };
    let meProfileFrame = null;

    // ---------- Profile type (Standard / Pro radio) ----------
    function profileTypeValue(){
        return $('input[name="wpcf-profile-type"]:checked').val() || 'standard';
    }

    function setProfileTypeValue(val){
        const type = (val || 'standard').toString().toLowerCase();
        const isPro = (type === 'pro' || type === 'professional');
        $('#me-profile-type-' + (isPro ? 'pro' : 'standard')).prop('checked', true);
    }

    function isProType(val){
        const t = (val || '').toString().toLowerCase();
        return t === 'pro' || t === 'professional';
    }

    // Pane scope references — elements are rendered in wp_footer at priority 10, before this script
    var $proPane = $('#mePreviewProPane');
    var $stdPane = $('#mePreviewStandardPane');

    function field($pane, name) {
        return $pane.find('[data-me-field="' + name + '"]');
    }

    // ---------- UI state ----------
    function saveButtonLabel(){
        return current.mode === 'add' ? 'Create profile' : 'Save';
    }

    function setSaveUI(state){
        const $m = $('#meProfileEditorModal');
        const $save  = $m.find('.js-me-save');
        const $close = $m.find('.js-me-close');

        if (state === 'saving') {
            $save.prop('disabled', true).text(current.mode === 'add' ? 'Creating…' : 'Saving…');
            $close.hide();
        } else if (state === 'saved') {
            $save.prop('disabled', false).text('Saved ✓');
            $close.show().text('Close');
        } else if (state === 'dirty') {
            $save.prop('disabled', false).text(saveButtonLabel());
            $close.show().text('Close without saving');
        } else { // idle
            $save.prop('disabled', false).text(saveButtonLabel());
            $close.show().text('Close');
        }
    }

    // Switch the modal between "add a new profile" and "edit an existing one".
    function setEditorMode(mode){
        current.mode = mode;
        const isAdd = (mode === 'add');

        $('#meProfileEditorTitle').text(isAdd ? 'Add a MeCard profile' : 'Edit profile');
        $('#meProfileEditorSubtitle').text(isAdd ? 'Fill in the details, then click Create profile.' : '');
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
        const $stdPane = $wrap.find('.me-preview-pane[data-me-preview-pane="standard"]');

        // Already-paid Pro profiles have no Standard version to compare against.
        // A profile that is only *asking* for Pro keeps both tabs, but lands on Pro.
        if (isPro && current.entitlements && current.entitlements.isPro) {
            $stdTab.hide();
            $stdPane.hide();
            $toggle.hide();
        } else {
            $toggle.show();
            $stdTab.show();
            $stdPane.show();
        }

        setPreviewMode(isPro ? 'pro' : 'standard');
    }

    // Click handling (event delegation: works even if modal HTML is injected)
    $(document).on('click', '.me-preview-tab', function(){
        const mode = $(this).data('me-preview-tab');
        if (!mode) return;
        setPreviewMode(mode);
    });

    // ---------- Edit company design ----------
    $(document).on('click', '#meEditCompanyDesignBtn', function(){
        $('#meEditCompanyDesignWarning').show();
    });

    $(document).on('click', '#meEditCompanyDesignCancel', function(){
        $('#meEditCompanyDesignWarning').hide();
    });

    $(document).on('click', '#meEditCompanyDesignConfirm', function(){
        if (!current.company_id) return;
        $('#meEditCompanyDesignWarning').hide();

        var companyId = current.company_id;
        var $profileModal = $('#meProfileEditorModal');

        // Wait for profile modal to fully close before opening company modal
        $profileModal.one('hidden.bs.modal', function(){
            if (typeof window.MeOpenCompanyEditor === 'function') {
                window.MeOpenCompanyEditor(companyId);
            }
        });

        $profileModal.modal('hide');
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

    // Prefix every selector in a CSS string with a scope selector so the rules
    // don't bleed outside the pro preview pane.
    function scopeCustomCss(css, scope) {
        if (!css) return '';
        return css.replace(/([^{}]+)\{/g, function(match, selectors) {
            var prefixed = selectors.trim().split(',').map(function(s) {
                s = s.trim();
                return s ? scope + ' ' + s : '';
            }).filter(Boolean).join(', ');
            return prefixed + ' {';
        });
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
        root.style.setProperty('--me-accent',        d.accent        || '#d3d3d3');
        root.style.setProperty('--me-button-text',   d.button_text   || '#000000');
        root.style.setProperty('--me-download',      d.download      || '#30b030');
        root.style.setProperty('--me-download-text', d.download_text || '#000000');


        let styleEl = root.querySelector('style[data-me-custom-css="1"]');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.setAttribute('data-me-custom-css', '1');
            root.appendChild(styleEl);
        }
        styleEl.textContent = company && company.custom_css
            ? scopeCustomCss(company.custom_css, '#mePreviewProPane .pro-profile-container')
            : '';
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
    // proOverride, when given, is used for the Pro pane only. It carries the
    // sample branding, which must never leak into the Standard preview.
    function updateCompanyBlock(company, profile, proOverride) {
        const proCompany = proOverride || company;

        // -- Pro pane --
        field($proPane, 'company-name').text((proCompany && proCompany.title) ? proCompany.title : ((profile && profile.company_name) || ''));

        if (proCompany && proCompany.logo_url) {
            field($proPane, 'company-logo').attr('src', proCompany.logo_url).show();
        } else {
            field($proPane, 'company-logo').hide();
        }

        field($proPane, 'company-description').html(proCompany && proCompany.desc_html ? proCompany.desc_html : '');

        const addr = proCompany && proCompany.address ? proCompany.address : '';
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

        if (proCompany && proCompany.website) {
            field($proPane, 'company-website').show().attr('href', proCompany.website);
        } else {
            field($proPane, 'company-website').hide().attr('href', '#');
        }

        if (proCompany && proCompany.tel) {
            field($proPane, 'company-phone').show().attr('href', 'tel:' + proCompany.tel);
        } else {
            field($proPane, 'company-phone').hide().attr('href', '#');
        }

        // -- Standard pane -- always the real company, never the sample.
        var stdCompanyText = (company && company.title) ? company.title : ((profile && profile.company_name) || '');
        field($stdPane, 'company-name').text(stdCompanyText);
        var $stdRoleCompany = field($stdPane, 'role-company');
        if (stdCompanyText) {
            $stdRoleCompany.show().find('strong').text(stdCompanyText);
        } else {
            $stdRoleCompany.hide();
        }

        const stdAddr = company && company.address ? company.address : '';
        if (stdAddr) {
            const mapsStd = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(stdAddr);
            field($stdPane, 'company-address').text(stdAddr);
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
            $proPane.find('.me-photo-placeholder').hide();
            $stdPane.find('.me-photo-placeholder').hide();
        } else {
            field($proPane, 'photo').hide();
            field($stdPane, 'photo').hide();
            $proPane.find('.me-photo-placeholder').show();
            $stdPane.find('.me-photo-placeholder').show();
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

    // Does this user own any company worth picking from?
    function hasSelectableCompanies(){
        return $('#company_parent option').filter(function(){
            return parseInt(this.value, 10) > 0;
        }).length > 0;
    }

    // Are we collecting a name for a company that doesn't exist yet?
    function isCreatingCompany(){
        return $('#company_parent').val() === 'new'
            || (isProType(profileTypeValue()) && !current.legacyCompanyLink && !hasSelectableCompanies());
    }

    /**
     * One of three controls, never more:
     *   'picker' — the dropdown (Pro, and the user owns companies)
     *   'new'    — a name box for a company we'll create on save
     *   'text'   — the plain company-name string kept on Standard profiles
     */
    function applyCompanyFieldState(mode){
        const $select = $('#company_parent');
        const $text   = $('#wpcf-company-r');
        const $newName = $('#me_new_company_name');
        const $newHint = $('#meNewCompanyHint');
        const $label  = $('#company_parent_label');

        $select.toggle(mode === 'picker' || mode === 'new')
               .prop('disabled', mode === 'text')
               .closest('.form-group').toggleClass('me-company-group--locked', mode === 'text');

        if (mode === 'new') {
            // The select still posts, and when we entered this mode automatically
            // (Pro with no companies) it is hidden and nobody has touched it — so
            // pin it to "new" or the save would read its default of 0.
            $select.val('new');

            // With nothing to pick from there is no point showing an empty dropdown.
            if (!hasSelectableCompanies()) {
                $select.hide();
            }
        }

        $text.toggle(mode === 'text');
        // Only needs a gap when it sits under a visible dropdown; with no
        // companies it follows the label directly.
        $newName.toggle(mode === 'new')
                .prop('disabled', mode !== 'new')
                .toggleClass('has-picker-above', mode === 'new' && hasSelectableCompanies());
        $newHint.toggle(mode === 'new');

        $label.text(mode === 'picker' ? 'Company' : 'Company name');
    }

    // Make sure the picker lists this company and has it selected.
    function adoptCompanyOption(id, title){
        const $select = $('#company_parent');

        if (!$select.find('option[value="' + id + '"]').length) {
            $('<option>').attr('value', id).text(title || ('Company #' + id))
                .insertBefore($select.find('option[value="new"]'));
        }

        $select.val(String(id));
        $('#me_new_company_name').val('');
    }

    function companyFieldMode(){
        if (!isProType(profileTypeValue()) && !current.legacyCompanyLink) {
            return 'text';
        }
        return isCreatingCompany() ? 'new' : 'picker';
    }

    /**
     * Pro with no company yet would render a card with the whole company half
     * blank — logo, name, address, description and all three company buttons
     * missing. That reads as broken at exactly the moment we're asking someone
     * to pay, so fill it with clearly-labelled sample content instead.
     */
    function isShowingSampleCompany(){
        return isProType(profileTypeValue()) && !current.company_id;
    }

    function sampleCompany(){
        const typed = $.trim($('#me_new_company_name').val() || $('#wpcf-company-r').val() || '');

        return {
            title:     typed || 'Your Company',
            logo_url:  S.companyPlaceholder || '',
            desc_html: 'Add a short description of what your company does — it appears here on your Pro card.',
            address:   '123 Main Road, Cape Town',
            website:   '#',
            tel:       '#',
            design:    { accent: '#0170b9' }
        };
    }

    // Re-render the company half of the preview from whatever state we're in.
    function refreshCompanyPreview(){
        const sample = isShowingSampleCompany();
        const company = sample ? sampleCompany() : (current.company || {});

        applyCompanyDesignToPreview(company);
        updateCompanyBlock(current.company || {}, readProfileFromForm(), sample ? company : null);
        $('#meProSampleNote').toggle(sample);
    }

    function setCompanyPreviewLoading(isLoading){
        $('#mePreviewLoading')
            .toggleClass('is-loading', !!isLoading)
            .attr('aria-hidden', isLoading ? 'false' : 'true');
    }

    // Pull the picked company's branding so the Pro preview re-skins immediately,
    // without having to save first.
    function reloadCompanyPreview(company_id){
        const id = parseInt(company_id, 10) || 0;

        if (!id) {
            current.company_id = 0;
            current.company    = {};
            syncCompanyFieldToType();
            refreshCompanyPreview();
            return $.Deferred().resolve().promise();
        }

        const data = {
            action: 'me_profile_company_preview',
            company_id: id
        };
        data[S.nonceField || '_wpnonce'] = S.nonceProfile;

        setCompanyPreviewLoading(true);

        // .done() before .always() so the new branding is painted before the
        // overlay lifts — otherwise the old design flashes back for a frame.
        return $.post(S.ajaxurl, data).done(function(res){
            if (!res || !res.success) {
                console.error('Company preview load failed', res);
                return;
            }
            const company = res.data.company || {};

            current.company_id = company.id || 0;
            current.company    = company;

            syncCompanyFieldToType();
            refreshCompanyPreview();
        }).fail(function(xhr){
            console.error('Company preview AJAX error', xhr && xhr.responseText);
        }).always(function(){
            setCompanyPreviewLoading(false);
        });
    }

    $(document).on('change', '#company_parent', function(){
        const val = $(this).val();

        if (val === 'new') {
            // Nothing to fetch yet — fall back to sample branding and let them
            // name the company.
            current.company_id = 0;
            current.company    = {};
            syncCompanyFieldToType();
            refreshCompanyPreview();
            $('#me_new_company_name').focus();
            return;
        }

        reloadCompanyPreview(val);
    });

    // The name they're typing is the company name, so keep the preview in step.
    $(document).on('input', '#me_new_company_name', function(){
        refreshCompanyPreview();
    });

    function syncCompanyFieldToType(){
        const mode = companyFieldMode();
        applyCompanyFieldState(mode);

        // "Edit company design" needs a company that actually exists.
        $('#meEditCompanyDesignBtn').toggle(mode === 'picker' && !!current.company_id);
    }

    // ---------- Pro upgrade entitlements ----------
    /**
     * @param {object}  ent            entitlement state from the server
     * @param {boolean} keepSelection  true after a save — the radio must show what
     *                                 the user chose, not what the basket managed
     *                                 to do. A Pro profile stays Standard until
     *                                 checkout, so re-deriving here would snap the
     *                                 radio back and look like the choice was lost.
     */
    function applyEntitlementState(ent, keepSelection){
        if (!ent) return; // no payload — leave the radio as it is
        current.entitlements = ent;

        const available = parseInt(ent.available, 10) || 0;
        const price     = ent.upgradePrice || 'R199';
        const $std  = $('#me-profile-type-standard');
        const $pro  = $('#me-profile-type-pro');
        const $note = $('#meProfileTypeProNote');

        // Only force a selection when we're establishing the initial state.
        const select = function($input){
            if (!keepSelection) $input.prop('checked', true);
        };

        if (ent.isPro) {
            // Already paid for. Releasing a consumed upgrade is a refund
            // decision, not an edit, so there is no way back to Standard here.
            $pro.prop('checked', true).prop('disabled', false);
            $std.prop('disabled', true);
            $note.text('Active on this profile.');
        } else {
            $std.prop('disabled', false);
            $pro.prop('disabled', false);

            if (available > 0) {
                select($pro);
                $note.text(available === 1
                    ? '1 upgrade left on your account — this profile will use it.'
                    : available + ' upgrades left on your account — this profile will use one.');
            } else if (ent.upgradeInCart) {
                select($pro);
                $note.text('Upgrade is in your basket — check out to activate Pro.');
            } else {
                select($std);
                $note.text(price + ' — added to your basket when you save.');
            }
        }

        renderUpgradeMessage();
    }

    // Tells the user what saving with Pro selected will actually do — or, after a
    // save, what it did.
    function renderUpgradeMessage(){
        const ent  = current.entitlements || {};
        const $msg = $('#meProfileTypeUpgradeMsg');

        $msg.removeClass('text-success text-danger');

        // The basket refused the upgrade. Say so — the profile is still Standard
        // and the user needs to know why, not just watch the radio move.
        if (ent.proOutcome === 'unavailable') {
            $msg.text('We could not add the Pro upgrade to your basket. '
                + (ent.proError || '')
                + ' Your profile has been saved as Standard.')
                .addClass('text-danger').show();
            return;
        }

        if (ent.isPro || !isProType(profileTypeValue())) {
            $msg.hide().text('');
            return;
        }

        if ((parseInt(ent.available, 10) || 0) > 0) {
            $msg.hide().text('');
            return;
        }

        $msg.text(ent.upgradeInCart
            ? 'The Pro upgrade is in your basket. Check out to activate it.'
            : 'Saving will add the Pro upgrade to your basket. It activates once you check out.'
        ).addClass('text-success').show();
    }

    $(document).on('change', 'input[name="wpcf-profile-type"]', function(){
        syncCompanyFieldToType();
        syncPreviewVisibilityFromType(profileTypeValue());
        renderUpgradeMessage();
    });

    function resetProfileForm(){
        const $f = $('#newMeProfileForm');
        if ($f.length && $f[0].reset) {
            $f[0].reset();
        }

        $('#me_profile_post_id').val('');
        $('#me_profile_photo_id').val('');
        $('#meProfilePhotoPreview').attr('src', '').hide();
        $('input[name="wpcf-profile-type"]').prop('disabled', false);
        setProfileTypeValue('standard');
        $('#meProfileTypeUpgradeMsg').hide().text('');
        $('#company_parent').val('0');
        $('#wpcf-company-r').val('');

        if ($.fn.tab) {
            $('#profile-main-tab').tab('show');
        }
    }

    function loadProfile(post_id){
        current.post_id = post_id;
        setSaveUI('idle');
        setLoading(true);

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

            current.company_id       = company.id || 0;
            current.company          = company;
            current.legacyCompanyLink = (parseInt(profile.company_parent, 10) || 0) > 0;

            populateProfileForm(profile);
            // Entitlements have the final say on the radio: Pro is preselected
            // when there are upgrades to spend, and locked when already paid for.
            applyEntitlementState(res.data.entitlements);

            syncPreviewVisibilityFromType(profileTypeValue());
            populatePreview(profile, company);
            updatePreviewSocialsFromForm();
            updatePreviewPrimaryButtonsFromForm();

            syncCompanyFieldToType();
            refreshCompanyPreview();
            renderUpgradeMessage();
            $('#meEditCompanyDesignWarning').hide();
            setLoading(false);

        }).fail(function(xhr){
            console.error('Profile load AJAX error', xhr && xhr.responseText);
            alert('Sorry, there was a problem loading this profile.');
        });
    }

    function populateProfileForm(p){
        $('#me_profile_post_id').val(current.post_id || '');

        $('#wpcf-first-name').val(p.first || '');
        $('#wpcf-last-name').val(p.last || '');
        $('#wpcf-job-title').val(p.job || '');
        $('#wpcf-email-address').val(p.email || '');
        $('#wpcf-mobile-number').val(p.mobile || '');
        $('#wpcf-whatsapp-number').val(p.wa || '');
        $('#wpcf-work-phone-number').val(p.direct_line || '');
        setProfileTypeValue(p.type || 'standard');
        $('#company_parent').val(p.company_parent || 0);
        $('#wpcf-company-r').val(p.company_name || '');

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
    function readProfileFromForm(){
        return {
            first:  $('#wpcf-first-name').val(),
            last:   $('#wpcf-last-name').val(),
            job:    $('#wpcf-job-title').val(),
            email:  $('#wpcf-email-address').val(),
            mobile: $('#wpcf-mobile-number').val(),
            wa:     $('#wpcf-whatsapp-number').val(),
            type:   profileTypeValue(),
            company_parent: parseInt($('#company_parent').val(), 10) || 0,
            company_name:   $('#wpcf-company-r').val(),
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
    }

    $('#newMeProfileForm').on('input change', function(){
        setSaveUI('dirty');

        const p = readProfileFromForm();
        // The picked company is kept in `current`, refreshed by reloadCompanyPreview().
        const c = current.company || {};

        syncPreviewVisibilityFromType(p.type);
        refreshCompanyPreview();
        populatePreview(p, c);
        updatePreviewSocialsFromForm();
        updatePreviewPrimaryButtonsFromForm();
    });

    // ---------- Save ----------
    $(document).on('click', '#meProfileEditorModal .js-me-save', function(){
        const isAdd = (current.mode === 'add');
        const $f    = $('#newMeProfileForm');

        if (isAdd && !$.trim($('#wpcf-first-name').val() || '')) {
            alert('Please enter a first name before creating the profile.');
            $('#profile-main-tab').tab && $('#profile-main-tab').tab('show');
            $('#wpcf-first-name').focus();
            return;
        }

        const fd = new FormData($f[0]);

        fd.append('action', isAdd ? 'me_profile_create' : 'me_save_profile_form');
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
                const saved = res.data || {};

                if (isAdd) {
                    // The profile now exists — flip the modal into edit mode so a
                    // second Save updates it instead of creating a duplicate.
                    current.post_id = parseInt(saved.post_id, 10) || 0;

                    $('#me_profile_post_id').val(current.post_id);
                    setEditorMode('edit');
                }

                current.company_id = (saved.company && saved.company.id) || 0;
                current.company    = saved.company || {};

                // A company just created inline now exists — put it in the picker
                // and select it, so we drop out of "create" mode and sample branding.
                if (current.company_id) {
                    adoptCompanyOption(current.company_id, current.company.title || '');
                }

                // An upgrade may have just been spent or basketed, so re-read the
                // counts — but keep the user's Standard/Pro choice on screen. A
                // Pro profile stays "standard" until checkout consumes the
                // upgrade, so deriving the radio from that would snap it back.
                applyEntitlementState(saved.entitlements, true);

                if (saved.profile) {
                    current.legacyCompanyLink = (parseInt(saved.profile.company_parent, 10) || 0) > 0;
                    if (saved.entitlements && saved.entitlements.isPro) {
                        setProfileTypeValue(saved.profile.type);
                    }
                    syncPreviewVisibilityFromType(profileTypeValue());
                    populatePreview(saved.profile, current.company);
                    updatePreviewSocialsFromForm();
                    updatePreviewPrimaryButtonsFromForm();
                }

                syncCompanyFieldToType();
                refreshCompanyPreview();
                renderUpgradeMessage();

                setSaveUI('saved');
                refreshUnderlyingToolsetViews();
            } else {
                console.error('Save failed', res);
                const msg = res && res.data && res.data.message;
                if (msg) alert(msg);
                setSaveUI('dirty');
            }
        }).fail(function(xhr){
            console.error('AJAX error', xhr && xhr.responseText);
            const msg = xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message;
            if (msg) alert(msg);
            setSaveUI('dirty');
        });
    });

    // ---------- Refresh underlying views when modal closes ----------
    $('#meProfileEditorModal').on('hidden.bs.modal', function(){
        refreshUnderlyingToolsetViews();
    });

    // ---------- Open modal helper (matches existing button calls) ----------
    window.NewMeOpenProfileEditor = function(post_id){
        setEditorMode('edit');
        $('#meProfileEditorModal').modal('show');
        setLoading(true);

        loadProfile(post_id)
            .always(function(){
                setLoading(false);
            });
    };

    // ---------- Open the same modal to create a new profile ----------
    // post_id 0 makes the loader hand back a blank profile plus the current
    // entitlement state, so add and edit run through one path.
    window.NewMeOpenProfileAdd = function(){
        current.company_id        = 0;
        current.company           = {};
        current.legacyCompanyLink = false;

        setEditorMode('add');
        resetProfileForm();

        $('#meProfileEditorModal').modal('show');
        setLoading(true);

        loadProfile(0)
            .always(function(){
                setLoading(false);
            });
    };

    // The management console's "Add Profile" button still carries the Toolset
    // modal markup (data-target="#profileAddModal"). Take the button over so it
    // opens this editor instead of the CRED form.
    $(function(){
        $('[data-target="#profileAddModal"]')
            .removeAttr('data-toggle')
            .removeAttr('data-target')
            .addClass('js-me-add-profile');
    });

    $(document).on('click', '.js-me-add-profile', function(e){
        e.preventDefault();
        window.NewMeOpenProfileAdd();
    });

    // ---------- Console list: Pro upgrade in/out of the basket ----------
    // The href on these links is a working no-JS fallback; with JS we swap the
    // button in place rather than reloading the whole page.
    function swapUpgradeButton($link, state, data){
        const profileId = $link.data('profile-id');

        if (state === 'in-cart') {
            $link.removeClass('mecard-add-upgrade').addClass('mecard-remove-upgrade')
                 .attr('href', data.removeUrl || '#')
                 .attr('aria-label', 'Remove this item')
                 .attr('data-cart_item_key', data.cartItemKey || '')
                 .html('<button class="add-button"><i class="far fa-check-square"></i> Pro Upgrade selected</button>');
        } else {
            $link.removeClass('mecard-remove-upgrade').addClass('mecard-add-upgrade')
                 .attr('href', data.addUrl || '#')
                 .removeAttr('aria-label')
                 .removeAttr('data-cart_item_key')
                 .html('<button class="add-button">Upgrade to Pro</button>');
        }

        $link.data('profile-id', profileId).attr('data-profile-id', profileId);
    }

    function upgradeButtonRequest($link, action, state){
        const profileId = parseInt($link.data('profile-id'), 10) || 0;
        if (!profileId) return;

        const $btn = $link.find('button');
        const busy = state === 'in-cart' ? 'Adding…' : 'Removing…';
        $btn.text(busy);
        $link.css('pointer-events', 'none');

        const data = { action: action, post_id: profileId };
        data[S.nonceField || '_wpnonce'] = S.nonceProfile;

        $.post(S.ajaxurl, data).done(function(res){
            if (res && res.success) {
                swapUpgradeButton($link, state, res.data || {});
            } else {
                const msg = (res && res.data && res.data.message) || 'Sorry, that did not work.';
                alert(msg);
                // Put the label back the way it was.
                swapUpgradeButton($link, state === 'in-cart' ? 'not-in-cart' : 'in-cart', {
                    addUrl: $link.attr('href'), removeUrl: $link.attr('href')
                });
            }
        }).fail(function(xhr){
            console.error('Upgrade button failed', xhr && xhr.responseText);
            const msg = (xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message)
                || 'Sorry, that did not work.';
            alert(msg);
            swapUpgradeButton($link, state === 'in-cart' ? 'not-in-cart' : 'in-cart', {
                addUrl: $link.attr('href'), removeUrl: $link.attr('href')
            });
        }).always(function(){
            $link.css('pointer-events', '');
        });
    }

    $(document).on('click', '.mecard-add-upgrade', function(e){
        e.preventDefault();
        upgradeButtonRequest($(this), 'me_profile_add_upgrade', 'in-cart');
    });

    $(document).on('click', '.mecard-remove-upgrade', function(e){
        e.preventDefault();
        upgradeButtonRequest($(this), 'me_profile_remove_upgrade', 'not-in-cart');
    });

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
            $proPane.find('.me-photo-placeholder').hide();
            $stdPane.find('.me-photo-placeholder').hide();

            $('#newMeProfileForm').trigger('change');
        });

        meProfileFrame.open();
    });

})(jQuery);
