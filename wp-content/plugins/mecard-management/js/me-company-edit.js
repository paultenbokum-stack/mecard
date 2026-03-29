/* me-company-edit.js */
/* global jQuery, tinymce, wp, mecard_ajax */
(function($){
    'use strict';

    /* ========================== *
     * Utilities
     * ========================== */

// --- PRO logo helpers ---
    function currentLogoUrlFromForm($form){
        // Prefer the server-rendered preview <img> if present
        var $img = $form.find('#me-logo-preview img');
        if ($img.length && $img.attr('src')) return $img.attr('src');
        // fallback: nothing known
        return '';
    }

    function setProLogo(url){
        var $pro = jQuery('#proPreview');
        var $wrap = $pro.find('.pro-logo');
        var $img = $wrap.find('img');
        if (url){
            if ($img.length){ $img.attr('src', url); }
            $wrap.show();
        } else {
            // keep visible (your design), or hide if you prefer:
            // $wrap.hide();
        }
    }

    /**
     * Bind WP media picker to the "Select / Upload" logo button.
     * - Updates hidden input #me-logo-id
     * - Updates small preview #me-logo-preview
     * - Mirrors to Pro preview .pro-logo img
     */
    function bindLogoPicker($form){
        var $btn = $form.find('#me-select-logo');
        if (!$btn.length) return;

        // Avoid double-binding
        $btn.off('click.me-logo');

        var mediaFrame = null;
        var restoreEnforceFocus = null;

        function disableBootstrapFocusTrap(){
            if (jQuery.fn.modal && jQuery.fn.modal.Constructor) {
                restoreEnforceFocus = jQuery.fn.modal.Constructor.prototype.enforceFocus;
                jQuery.fn.modal.Constructor.prototype.enforceFocus = function(){};
            }
            jQuery(document).off('focusin.modal');
        }
        function restoreBootstrapFocus(){
            if (restoreEnforceFocus) {
                jQuery.fn.modal.Constructor.prototype.enforceFocus = restoreEnforceFocus;
                restoreEnforceFocus = null;
            }
            // ensure the main modal keeps scroll lock
            jQuery('body').addClass('modal-open');
        }
        function hardCloseWpMedia(){
            var $mm = jQuery('.media-modal');
            var $mb = jQuery('.media-modal-backdrop');
            if ($mm.length || $mb.length){
                $mm.remove();
                $mb.remove();
                jQuery('body,html').removeAttr('style');
            }
        }

        $btn.on('click.me-logo', function(e){
            e.preventDefault();

            if (mediaFrame){
                mediaFrame.open();
                return;
            }

            mediaFrame = wp.media({
                title: 'Select Company Logo',
                button: { text: 'Use this logo' },
                library: { type: ['image'] },
                multiple: false
            });

            mediaFrame.on('open', function(){
                disableBootstrapFocusTrap();
                // lift above Bootstrap modal
                jQuery('.media-modal-backdrop').css('z-index', 1060);
                jQuery('.media-modal').css('z-index', 1061);
            });

            mediaFrame.on('close', function(){
                restoreBootstrapFocus();
                setTimeout(hardCloseWpMedia, 10);
            });

            mediaFrame.on('select', function(){
                var file = mediaFrame.state().get('selection').first().toJSON();

                // write hidden input
                $form.find('#me-logo-id').val(file.id).trigger('change');

                // update the small preview near the button
                $form.find('#me-logo-preview')
                    .html('<img src="'+ file.url +'" style="max-height:100px" alt="">');

                // mirror into Pro preview header
                setProLogo(file.url);

                mediaFrame.close();
                setTimeout(hardCloseWpMedia, 50);
            });

            mediaFrame.open();
        });
    }

    /** run once to sync existing state into the Pro preview */
    function syncProLogoFromForm($form){
        setProLogo(currentLogoUrlFromForm($form));
    }



    /* ==========================
 * PRO PREVIEW: Extra Buttons (single source of truth)
 * ========================== */

// Build a model from the current RFG rows under THIS form
    function collectExtraButtonsFromForm($form){
        var items = [];
        $form.find('#me-extra-buttons .me-rfg-row').each(function(){
            var $row = jQuery(this);
            var txt  = ($row.find('input[name*="[button-text]"]').val() || '').trim();
            var url  = ($row.find('input[name*="[button-url]"]').val()  || '').trim();
            var ico  = ($row.find('input[name*="[button-icon]"]').val() || '').trim();

            if (!txt && !url && !ico) return; // skip totally empty rows

            // normalize url slightly
            if (url && !/^https?:\/\//i.test(url) && !/^mailto:|^tel:/i.test(url)){
                url = 'https://' + url;
            }

            items.push({
                text: txt || 'Button',
                url:  url  || '#',
                icon: ico  || ''     // e.g. "fa-solid fa-globe"
            });
        });
        return items;
    }

// Render to the Pro preview slot only
    function renderProExtraButtons(items){
        var $slot = jQuery('#proPreview #pro-extra-buttons');
        if (!$slot.length) return;

        if (!items || !items.length){
            $slot.html('<div class="text-muted small" style="opacity:.7">Extra buttons will appear here</div>');
            return;
        }

        var html = items.map(function(it){
            var iconHtml = it.icon ? '<i class="' + it.icon.replace(/"/g, '&quot;') + '"></i>&nbsp;' : '';
            return (
                '<a href="' + it.url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' +
                '<button type="button" class="company extra">' +
                '<span class="me-extra-icon">' + iconHtml + '</span>' +
                '<span class="me-extra-text">' + it.text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</span>' +
                '</button>' +
                '</a>'
            );
        }).join('');

        $slot.html(html);
    }

// One call to read from the form and paint the Pro preview
    function updateProButtonsFromForm($form){
        renderProExtraButtons( collectExtraButtonsFromForm($form) );
    }

// Wiring (add/remove/typing/sort) — scoped to the form
    function bindExtraButtons($form){
        var $list = $form.find('#me-extra-buttons');
        var $tpl  = $form.find('#me-extra-button-template');

        // Counter for new rows
        var counter = (function(){
            var i = $list.find('.me-rfg-row').length;
            return function(){ i += 1; return i; };
        })();

        // Add
        $form.off('click.me-add-extra', '#me-add-extra-button').on('click.me-add-extra', '#me-add-extra-button', function(e){
            e.preventDefault();
            if (!$tpl.length) return;
            var html = $tpl.html().replace(/__i__/g, counter());
            $list.append(jQuery(html));
            updateProButtonsFromForm($form);
        });

        // Remove
        $list.off('click.me-remove', '.me-remove-row').on('click.me-remove', '.me-remove-row', function(){
            jQuery(this).closest('.me-rfg-row').remove();
            updateProButtonsFromForm($form);
        });

        // Pick icon → open modal and write back
        $list.off('click.me-pick', '.me-pick-icon').on('click.me-pick', '.me-pick-icon', function(e){
            e.preventDefault();
            var $row   = jQuery(this).closest('.me-rfg-row');
            var $input = $row.find('.me-icon-input');
            var $chip  = $row.find('.me-icon-preview i');

            openIconPicker(function(cls){
                $input.val(cls).trigger('input');   // re-render preview and keep model in sync
                $chip.attr('class', cls);
                updateProButtonsFromForm($form);    // repaint Pro preview buttons
            });
        });


        // Typing / change in any field (also update icon chip live)
        $list.off('input.me change.me', 'input').on('input.me change.me', 'input', function(){
            var $ipt = jQuery(this);
            if ($ipt.hasClass('me-icon-input')) {
                var cls = $ipt.val() || 'fa-solid fa-circle';
                $ipt.closest('.me-icon-picker').find('.me-icon-preview i').attr('class', cls);
            }
            updateProButtonsFromForm($form);
        });

        // Sortable (if present)
        if (jQuery.fn.sortable && !$list.data('me-sortable')) {
            $list.sortable({
                handle: '.me-rfg-drag',
                items: '.me-rfg-row',
                update: function(){ updateProButtonsFromForm($form); }
            });
            $list.data('me-sortable', true);
        }

        // Initial render
        updateProButtonsFromForm($form);
    }


    function esc(s){ return (s||'').toString(); }
    function trimOrEmpty(s){ return esc(s).trim(); }
    function telHref(s){ return 'tel:' + esc(s).replace(/\s+/g,''); }
    function mailHref(s){ return 'mailto:' + trimOrEmpty(s); }
    function mapHref(addr){ return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(trimOrEmpty(addr)); }
    function urlOrHttp(s){ s = trimOrEmpty(s); if(!s) return '#'; return /^https?:\/\//i.test(s) ? s : ('http://' + s); }

    function normHex(hex){
        hex = (hex||'').trim();
        if (!hex) return '';
        if (hex[0] !== '#') hex = '#'+hex;
        if (/^#([0-9a-f]{3})$/i.test(hex)) return '#'+hex.substring(1).split('').map(c=>c+c).join('');
        if (/^#([0-9a-f]{6})$/i.test(hex)) return hex;
        return '';
    }

    // Update the little color chip Spectrum shows next to the input
    function updateColorUI($inp){
        var hex = normHex($inp.val()) || '';
        var $rep = $inp.siblings('.sp-replacer');

        if ($rep.length) {
            // Classic Spectrum markup
            var $chipClassic = $rep.find('.sp-preview-inner');
            if ($chipClassic.length) {
                $chipClassic.css('background-color', hex || 'transparent');
            }

            // Toolset / alternate markup (sometimes uses different class names)
            var $chipAlt = $rep.find('.sp-colorize, .sp-preview'); // be liberal
            if ($chipAlt.length) {
                $chipAlt.css('background-color', hex || 'transparent');
            }

            // Optional: add a class when we have a value (for CSS)
            $rep.toggleClass('me-has-color', !!hex);
        } else {
            // No replacer (fallback) — paint the input itself if it’s visible
            $inp.css('background-color', hex || '');
        }
    }


    /* Apply CSS variables to the Pro preview scope
       We set vars on #proPreview so siblings (like the download bar) inherit. */
    function applyProVars(vars){
        var scope = document.querySelector('#proPreview');
        if (!scope) return;
        Object.keys(vars).forEach(k => scope.style.setProperty(k, vars[k]));
    }

    /* ====== NEW: Custom CSS → Pro preview (scoped) ====== */

// Lightweight scoper: prefixes selectors with the given scope.
// Handles plain rules and @media blocks; leaves @keyframes/@font-face alone.
    function mePrefixCss(css, scopeSel) {
        if (!css) return '';
        var keyframeOrFont = /@(?:keyframes|font-face)\b/i;

        function prefixSelectors(block, scope) {
            return block.replace(/(^|})(\s*[^@}][^{]+)\{/g, function (_m, brace, selectorList) {
                var scopedList = selectorList.split(',').map(function (s) {
                    s = (s || '').trim();
                    if (!s) return '';
                    if (s.indexOf(scope) === 0) return s;              // already scoped
                    if (/^:root\b|^html\b/i.test(s)) return scope;     // normalize :root/html to scope
                    return scope + ' ' + s;
                }).filter(Boolean).join(', ');
                return brace + ' ' + scopedList + ' {';
            });
        }

        // Prefix @media inner blocks
        var prefixed = css.replace(/@media[^{]+\{([\s\S]*?)\}\s*/gi, function (m, inner) {
            return m.replace(inner, prefixSelectors(inner, scopeSel));
        });

        // Prefix remaining plain rules (ignore keyframes/font-face)
        return prefixed.replace(/([^@][\s\S]*?)$/g, function (m) {
            return keyframeOrFont.test(m) ? m : prefixSelectors(m, scopeSel);
        });
    }

// Inject/replace a <style> tag INSIDE #proPreview so it only affects Pro.
    function meApplyProCustomCss(rawCss) {
        var $scope = jQuery('#proPreview');
        if (!$scope.length) return;

        var id = 'me-pro-custom-css';
        var $style = $scope.find('#' + id);
        if (!$style.length) $style = jQuery('<style id="' + id + '"></style>').appendTo($scope);

        $style.text(mePrefixCss((rawCss || '').toString(), '#proPreview'));
    }

    /* ====== /NEW ====== */


    /* ========================== *
     * TinyMCE (WP editor) helpers
     * ========================== */
    function whenEditorReady(cb){
        var tries = 0, max = 50; // up to ~5s
        (function tick(){
            if (window.wp && (wp.oldEditor || wp.editor) && window.tinymce) return cb();
            if (++tries > max) { console.warn('[MeCard] Editor scripts not ready'); return; }
            setTimeout(tick, 100);
        })();
    }

    function getDescHtml(){
        var ed = window.tinymce && tinymce.get('me-company-description');
        if (ed) return ed.getContent({ format:'raw' }) || '';
        var raw = $('#me-company-description').val() || '';
        var div = document.createElement('div');
        div.innerHTML = raw; // decode esc_textarea
        return (div.textContent || div.innerText || '');
    }

    function pushDescToPreview(){
        $('#proPreview #pro-desc').html((getDescHtml() || '').trim());
    }

    function initRichEditor(){
        whenEditorReady(function(){
            var id  = 'me-company-description';
            var api = (wp && (wp.oldEditor || wp.editor)) ? (wp.oldEditor || wp.editor) : null;
            if (!api) return;

            // Remove stale instance first
            if (window.tinymce && tinymce.get(id)) {
                try { api.remove(id); } catch(e) {}
            }

            // Initialize
            api.initialize(id, {
                tinymce: {
                    wpautop:  true,
                    branding: false,
                    height:   220,
                    toolbar1: 'formatselect bold italic underline strikethrough | bullist numlist blockquote | alignleft aligncenter alignright alignjustify | link unlink | forecolor | pastetext removeformat | undo redo',
                    toolbar2: 'outdent indent | hr | table | charmap | superscript subscript | code',
                    toolbar3: ''
                },
                quicktags:     true,
                mediaButtons:  false // set true if you want "Add Media"
            });


            // Bind live preview
            var ed = tinymce.get(id);
            if (ed) {
                ed.off('keyup change input NodeChange', pushDescToPreview)
                    .on('keyup change input NodeChange', pushDescToPreview);
            }
            $('#'+id).off('input.me').on('input.me', pushDescToPreview);

            setTimeout(pushDescToPreview, 60);
        });
    }

    /* ========================== *
     * Design: Colors (Spectrum)
     * ========================== */
    function initColorPickers($form){
        var $colors = $form.find('.me-color');
        if (!$colors.length) return;

        if (typeof jQuery.fn.spectrum === 'function') {
            $colors.spectrum({
                preferredFormat: 'hex',
                showInput: true,
                allowEmpty: true,
                showPalette: true,
                appendTo: '#companyEditModal',
                replacerClassName: 'me-spectrum',
                containerClassName: 'sp-in-modal',
                palette: [
                    ['#000000','#ffffff','#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3'],
                    ['#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107']
                ],
                move: function(color){
                    var hex = color ? color.toHexString() : '';
                    jQuery(this).val(hex).trigger('input');
                },
                change: function(color){
                    var hex = color ? color.toHexString() : '';
                    jQuery(this).val(hex).trigger('change');
                },
                clear: function(){
                    jQuery(this).val('').trigger('change');
                }
            });

            // Style Spectrum replacer like a full-width input & hide the raw input
            $colors.each(function(){
                var $inp = jQuery(this);

                // Spectrum builds the replacer asynchronously; give the DOM a tick
                setTimeout(function(){
                    var $rep = $inp.siblings('.sp-replacer');
                    if ($rep.length){
                        // Hide the raw input; style the replacer like a full-width input
                        $inp.addClass('d-none');
                        $rep.addClass('form-control w-100 me-spectrum-in');

                        // First paint (works for both classic & toolset skins)
                        updateColorUI($inp);
                    } else {
                        // Fallback: at least color the input itself
                        updateColorUI($inp);
                    }
                }, 0);
            });

        }
    }


    function bindDesignColors($form){
        function pushColors(){
            // read from THIS form (important when modal is injected)
            applyProVars({
                '--me-heading-color':  normHex($form.find('input[name="wpcf-heading-font-colour"]').val()) || '#000000',
                '--me-body-color':     normHex($form.find('input[name="wpcf-normal-font-colour"]').val())  || '#333333',
                '--me-accent':         normHex($form.find('input[name="wpcf-accent-colour"]').val())       || '#0170b9',
                '--me-button-text':    normHex($form.find('input[name="wpcf-button-text-colour"]').val())  || '#ffffff',
                '--me-download':       normHex($form.find('input[name="wpcf-download-button-colour"]').val()) || '#30b030',
                '--me-download-text':  normHex($form.find('input[name="wpcf-download-button-text-colour"]').val()) || '#000000'
            });

            // keep the Spectrum chips visually in sync
            $form.find('.me-color').each(function(){ updateColorUI(jQuery(this)); });
        }

        var $colors = $form.find('.me-color');
        if ($colors.length){
            $colors.on('input change spectrum.change spectrum.move', function(){
                updateColorUI(jQuery(this));
                pushColors();
            });
        }
        // Initial paint
        pushColors();
    }

    /* ====== NEW: bindCustomCss() – wires wpcf-custom-css → preview ====== */
    function bindCustomCss($form){
        // Accept either a named textarea or an element with id #wpcf-custom-css
        var $field = $form.find('textarea[name="wpcf-custom-css"], #wpcf-custom-css');
        if (!$field.length) return;

        function push(){ meApplyProCustomCss($field.val() || ''); }

        // Live updates while typing and on change
        $field.on('input.me-custom-css change.me-custom-css', push);

        // Initial paint from existing value
        push();
    }
    /* ====== /NEW ====== */


    /* ========================== *
     * Design: Fonts (selects)
     * ========================== */
    function bindDesignFonts($form){
        function mapFont(val){
            const m = {
                'opensans': '"Open Sans", sans-serif',
                'Montserrat': 'Montserrat, sans-serif',
                'Roboto': 'Roboto, sans-serif',
                'playfairdisplay': '"Playfair Display", serif',
                'Merriweather': 'Merriweather, serif',
                'Helvetica': 'Helvetica, Arial, sans-serif'
            };
            return m[val] || 'Montserrat, sans-serif';
        }

        $form.on('change input', 'select[name="wpcf-heading-font"]', function(){
            applyProVars({'--me-heading-font': mapFont($(this).val())});
        });
        $form.on('change input', 'select[name="wpcf-normal-font"]', function(){
            applyProVars({'--me-body-font': mapFont($(this).val())});
        });

        // Initial paint from current values
        (function initFromVals(){
            const hf = $form.find('select[name="wpcf-heading-font"]').val();
            const bf = $form.find('select[name="wpcf-normal-font"]').val();
            applyProVars({'--me-heading-font': mapFont(hf), '--me-body-font': mapFont(bf)});
        })();
    }



    /* ========================== *
     * Info bindings (both previews)
     * ========================== */
    function bindInfo($form){
        var $std = $('#standardPreview');
        var $pro = $('#proPreview');

        // Company Name
        $form.on('input', 'input[name="post_title"]', function(){
            var v = trimOrEmpty(this.value) || 'Company Name';
            $std.find('.company-name').text(v);
            $pro.find('.company-name').text(v);
        });

        // Company Telephone Number
        $form.on('input', 'input[name="wpcf-company-telephone-number"]', function(){
            var href = telHref(this.value || '');
            $std.find('a:has(> button.company.phone)').attr('href', href);
            $pro.find('a:has(> button.company.phone)').attr('href', href);
        });

        // Support Email
        $form.on('input', 'input[name="wpcf-support-email"]', function(){
            var v = trimOrEmpty(this.value);
            var href = mailHref(v);
            // “Personal Details” email link (Standard)
            $std.find('.company-address').closest('.container-fluid')
                .find('a[href^="mailto:"], a[title*="@"]').first()
                .attr('href', href).attr('title', v).text(v || 'name@company.com');
            // Quick email buttons
            $std.find('.profile-buttons a[href^="mailto:"]').attr('href', href);
            $pro.find('.profile-buttons a[href^="mailto:"]').attr('href', href);
        });

        // Company Address
        $form.on('input', 'input[name="wpcf-company-address"]', function(){
            var v = trimOrEmpty(this.value) || 'Company address';
            var href = mapHref(v);
            $std.find('.company-address').attr('href', href).text(v);
            $pro.find('.company-address').attr('href', href).text(v);
            // Directions buttons
            $std.find('a:has(> button.company.directions)').attr('href', href);
            $pro.find('a:has(> button.company.directions)').attr('href', href);
        });

        // Website
        $form.on('input', 'input[name="wpcf-company-website"]', function(){
            var href = urlOrHttp(this.value || '');
            $std.find('a:has(> button.company.website)').attr('href', href);
            $pro.find('a:has(> button.company.website)').attr('href', href);
        });

        // Description (Pro slot)
        $form.on('input', '#me-company-description, textarea[name="wpcf-company-description"]', pushDescToPreview);

        // First paints from existing values
        $form.find('input[name="post_title"]').triggerHandler('input');
        $form.find('input[name="wpcf-company-telephone-number"]').triggerHandler('input');
        $form.find('input[name="wpcf-support-email"]').triggerHandler('input');
        $form.find('input[name="wpcf-company-address"]').triggerHandler('input');
        $form.find('input[name="wpcf-company-website"]').triggerHandler('input');
        $form.find('#me-company-description, textarea[name="wpcf-company-description"]').triggerHandler('input');
    }

    /* ========================== *
     * Extra Buttons (RFG UI + Preview)
     * ========================== */


    // Icon picker modal (FA v6 allow-list from mecard_ajax.faIcons)
    function buildIconPicker(){
        if ($('#me-fa-modal').length) return;
        const list = (MECARD_COMPANY && Array.isArray(MECARD_COMPANY.faIcons)) ? MECARD_COMPANY.faIcons : [];
        const items = list.map(item => {
            const ic = esc(item.class || '');
            const label = esc(item.label || ic);
            return `<button type="button" class="me-fa-item" data-class="${ic}" title="${label}">
                <i class="${ic}"></i><span>${label}</span>
              </button>`;
        }).join('');

        const modal = `
      <div class="me-fa-backdrop" id="me-fa-modal" style="display:none;">
        <div class="me-fa-panel">
          <div class="me-fa-head">
            <strong>Select an icon</strong>
            <input type="text" class="me-fa-filter" placeholder="Filter icons...">
            <button type="button" class="me-fa-close" aria-label="Close">&times;</button>
          </div>
          <div class="me-fa-grid">${items}</div>
        </div>
      </div>`;
        $('body').append(modal);

        $('#me-fa-modal').on('click', '.me-fa-close', function(){ $('#me-fa-modal').hide(); });
        $('#me-fa-modal').on('click', function(e){
            if (e.target.id === 'me-fa-modal') $('#me-fa-modal').hide();
        });

        // client-side filter
        $('#me-fa-modal').on('input', '.me-fa-filter', function(){
            const q = $(this).val().toLowerCase();
            $('#me-fa-modal .me-fa-item').each(function(){
                const cls = ($(this).attr('data-class')||'').toLowerCase();
                const txt = ($(this).text()||'').toLowerCase();
                $(this).toggle(cls.includes(q) || txt.includes(q));
            });
        });
    }

    let _iconPickCb = null;
    function openIconPicker(cb){
        _iconPickCb = cb;
        buildIconPicker();
        $('#me-fa-modal').show().off('click.item').on('click.item', '.me-fa-item', function(){
            const cls = $(this).attr('data-class') || '';
            if (typeof _iconPickCb === 'function') _iconPickCb(cls);
            $('#me-fa-modal').hide();
        });
    }



    /* ========================== *
     * INIT (robust against AJAX-injected modal)
     * ========================== */
    function initMeCompanyForm() {
        const $modal = $('#companyEditModal');
        const $form  = $modal.find('#me-company-form');

        if (!$form.length) return;                // not yet injected
        if ($form.data('meInitialized')) return;  // already initialized
        $form.data('meInitialized', true);

        // Wire everything
        initColorPickers($form);
        bindInfo($form);
        bindDesignFonts($form);
        bindDesignColors($form);
        bindExtraButtons($form);
        updateProButtonsFromForm($form); // <-- safe extra first paint
        bindLogoPicker($form);
        syncProLogoFromForm($form);
        bindCustomCss($form);

        // When the logo hidden input changes, repaint the Pro logo from the preview img
        $form.off('change.me-logo', '#me-logo-id').on('change.me-logo', '#me-logo-id', function(){
            // read whatever the small preview shows right now
            var url = $form.find('#me-logo-preview img').attr('src') || '';
            setProLogo(url);
        });




// Render into Pro preview slot


        // Editor when modal is visible or when Pro Info tab is shown
        $modal.on('shown.bs.modal', initRichEditor);
        $(document).on('shown.bs.tab', '#companyEditModal a#tab-proinfo[data-toggle="tab"]', initRichEditor);

        // First paints
        initRichEditor();
        pushDescToPreview();

        // Auto-switch preview to Pro when opening Design tab (delegated)
        $(document).on('shown.bs.tab', '#companyEditModal #tab-design', function () {
            $('#companyEditModal #pro-tab').tab('show');
        });
    }

    // Expose for manual call after you inject HTML (optional)
    window.initMeCompanyForm = initMeCompanyForm;

    // A) When the modal is shown (in case HTML was already present)
    $(document).on('shown.bs.modal', '#companyEditModal', initMeCompanyForm);

    // B) After the AJAX that injects the form completes
    $(document).ajaxComplete(function(_evt, _xhr, settings){
        const data = settings && settings.data ? settings.data.toString() : '';
        if (data.includes('action=me_load_company_form_custom')) {
            initMeCompanyForm();
        }
    });

    // C) Fallback if server-rendered
    $(function(){
        initMeCompanyForm();
    });

})(jQuery);

/* --- Company Edit: load form into existing modal shell --- */
/* global jQuery, mecard_ajax, initMeCompanyForm */
(function($){
    'use strict';

    function loadCompanyForm(companyId){
        const $modal     = $('#companyEditModal');
        const $container = $('#me-modal-form-container');
        const $loading   = $('#me-modal-loading');

        $container.empty();
        if ($loading.length) $loading.show();

        $.post(MECARD_COMPANY.ajaxurl, {
            action:    'me_load_company_form_custom',
            company_id: companyId,
            _wpnonce:  MECARD_COMPANY.nonce
        })
            .done(function(resp){
                if (!resp || !resp.success || !resp.data || !resp.data.html) {
                    const msg = (resp && resp.data && resp.data.message) ? resp.data.message : 'Failed to load form.';
                    $container.html('<div class="p-3 text-danger">'+ msg +'</div>');
                    return;
                }
                $container.html(resp.data.html);

                // 🔑 bind previews/editors AFTER HTML is in the DOM
                if (typeof window.initMeCompanyForm === 'function') {
                    window.initMeCompanyForm();
                } else {
                    // fallback if you kept the event-based initializer
                    $modal.trigger('shown.bs.modal');
                }
            })
            .fail(function(xhr){
                const msg = (xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message)
                    ? xhr.responseJSON.data.message : 'AJAX error loading form.';
                $container.html('<div class="p-3 text-danger">'+ msg +'</div>');
            })
            .always(function(){
                if ($loading.length) $loading.hide();
            });
    }

    // A) Primary launcher: user clicks an Edit button/link
    $(document).on('click', '.me-edit-company', function(e){
        e.preventDefault();
        const companyId = $(this).data('company-id') || $(this).attr('data-company-id');
        if (!companyId) {
            console.error('[MeCard] Missing data-company-id on .me-edit-company');
            return;
        }
        // Ensure modal is visible (you said it already exists on the page)
        $('#companyEditModal').modal('show');
        loadCompanyForm(companyId);
    });

    // // B) Optional: lazy-load when modal opens (uses the trigger element’s data-company-id)
    // $(document).on('show.bs.modal', '#companyEditModal', function (evt) {
    //     // If you open via data-toggle / data-target, Bootstrap passes the trigger element:
    //     const $btn = $(evt.relatedTarget);
    //     const companyId = $btn && ($btn.data('company-id') || $btn.attr('data-company-id'));
    //     if (companyId) {
    //         loadCompanyForm(companyId);
    //     }
    // });

    function meBindSaveHandler() {
        var $modal = $('#companyEditModal');

        // Unbind any previous to avoid dup calls after reloads
        $modal.off('click.me', '#me-visible-submit');

        $modal.on('click.me', '#me-visible-submit', function (e) {
            e.preventDefault();

            var $btn  = $(this);
            var $form = $modal.find('#me-company-form');

            if (!$form.length) {
                console.warn('[me] Save: form not found');
                return;
            }

            // If TinyMCE present, push its content back into textarea first
            if (window.tinymce && tinymce.get('me-company-description')) {
                tinymce.get('me-company-description').save(); // writes content into textarea
            }

            // Build FormData from the form DOM
            var fd = new FormData($form[0]);

            // Ensure required fields are present
            fd.append('action', 'me_save_company_form_custom');

            // company_id from form data attribute
            var companyId = $form.data('post-id');
            if (companyId) {
                fd.append('company_id', companyId);
            }

            // Fallback nonce if needed (prefer the hidden input already in the form)
            if (!fd.has('_wpnonce') && window.MECARD_COMPANY && MECARD_COMPANY.nonce) {
                fd.append('_wpnonce', MECARD_COMPANY.nonce);
            }

            // UI: disable during save
            $btn.prop('disabled', true).addClass('disabled').text('Saving…');

            $.ajax({
                url: (window.MECARD_COMPANY && MECARD_COMPANY.ajaxurl) ? MECARD_COMPANY.ajaxurl : '/wp-admin/admin-ajax.php',
                method: 'POST',
                data: fd,
                processData: false,
                contentType: false,
            })
                .done(function (resp) {
                    if (resp && resp.success) {
                        // Optional: show a toast/notice
                        console.log('[me] Saved:', resp.data);
                        // You can flash a success message in your modal footer:
                        $('<span class="text-success ml-2 me-save-okay">Saved ✓</span>')
                            .appendTo($btn.parent())
                            .delay(1500)
                            .fadeOut(400, function(){ $(this).remove(); });
                    } else {
                        var msg = (resp && resp.data && resp.data.message) ? resp.data.message : 'Save failed.';
                        alert(msg);
                        console.warn('[me] Save error payload:', resp);
                    }
                })
                .fail(function (xhr) {
                    console.error('[me] AJAX error:', xhr.status, xhr.responseText);
                    alert('Could not save (network or permissions).');
                })
                .always(function () {
                    $btn.prop('disabled', false).removeClass('disabled').text('Save changes');
                });
        });
    }

    // Bind once DOM is ready and modal exists
    $(document).on('ready ajaxComplete', function () {
        if ($('#companyEditModal').length) {
            meBindSaveHandler();
        }
    });


})(jQuery);

