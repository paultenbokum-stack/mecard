(function($){
    'use strict';

    const CFG = window.ME_SINGLE_CARDS || {};
    const uploadPlaceholder = (CFG.assets && CFG.assets.uploadPlaceholder) || '';

    function normalizeHex(value, fallback) {
        const color = String(value || '').trim();
        if (/^#[0-9a-fA-F]{6}$/.test(color)) {
            return color;
        }
        if (/^#[0-9a-fA-F]{3}$/.test(color)) {
            return color;
        }
        return fallback;
    }

    // Returns an array of warning strings for a wp.media file object.
    // Checks aspect ratio (856×540) and file size (2 MB max).
    function validateCardArtwork(file) {
        const warnings = [];
        const maxBytes = 2 * 1024 * 1024;
        if (file.filesizeInBytes && file.filesizeInBytes > maxBytes) {
            warnings.push('This image is ' + (file.filesizeHumanReadable || 'too large') + '. Please use an image under 2 MB.');
        }
        if (file.width && file.height) {
            const expected = 856 / 540;
            const actual   = file.width / file.height;
            if (Math.abs(actual - expected) / expected > 0.02) {
                warnings.push('This image is ' + file.width + '×' + file.height + 'px. For best results use 856×540px (or the same aspect ratio).');
            }
        }
        return warnings;
    }

    function showArtworkWarnings($form, warnings) {
        var $notice = $form.find('.me-bundle-custom__artwork-notice');
        if (!$notice.length) {
            $notice = $('<p class="me-bundle-custom__artwork-notice" role="alert"></p>').prependTo($form);
        }
        if (warnings.length) {
            $notice.html(warnings.map(function(w) { return '<span>' + w + '</span>'; }).join('<br>')).show();
        } else {
            $notice.hide();
        }
    }

    function updateBundleCustomThumb($form, side, url) {
        const selector = side === 'front' ? '[data-bundle-custom-front-artwork]' : '[data-bundle-custom-back-artwork-card]';
        const $thumb = $form.closest('.me-bundle-card').find(selector).first();
        if (!$thumb.length) {
            return;
        }

        const src = url || uploadPlaceholder;
        const alt = side === 'front' ? 'Custom card front artwork' : 'Custom card back artwork';
        $thumb.html('<div class="me-bundle-custom__preview-shell"><img src="' + src + '" alt="' + alt + '"></div>');
    }

    function updateBundleCustomFrontPreview($form, url) {
        const $shell = $form.closest('.me-bundle-card').find('[data-bundle-custom-front-artwork]').first();
        if (!$shell.length) {
            return;
        }

        updateBundleCustomThumb($form, 'front', url);
    }

    function updateBundleCustomBackPreview($form, url) {
        updateBundleCustomThumb($form, 'back', url);
        const $shell = $form.closest('.me-bundle-card').find('[data-bundle-custom-back-artwork]').first();
        if ($shell.length) {
            $shell.html(url ? '<div class="me-bundle-custom__preview-shell"><img src="' + url + '" alt="Custom card back artwork"></div>' : '');
        }
    }

    function renderBundleCustomQr($form, card) {
        const $qr = $form.closest('.me-bundle-card').find('[data-bundle-custom-qr]').first();
        const $qrCode = $qr.find('.qr-code').first();
        if (!$qr.length || !$qrCode.length) {
            return;
        }

        const currentDark = normalizeHex($qrCode.attr('data-qr_colour'), '#000000');
        const currentLight = normalizeHex($qrCode.attr('data-qr_bg'), '#ffffff');
        const qrColour = normalizeHex((card && card.qr_code_colour) || $form.find('input[name="wpcf-qr-code-colour"]').val(), currentDark);
        const qrFill = normalizeHex((card && card.qr_fill_colour) || $form.find('input[name="wpcf-qr-fill-colour"]').val(), currentLight);
        const payload = String($qrCode.data('url') || '');

        if (typeof window.QRCode === 'function' && payload) {
            $qrCode.attr('data-qr_colour', qrColour);
            $qrCode.attr('data-qr_bg', qrFill);
            $qrCode.empty();
            new window.QRCode($qrCode[0], {
                text: payload,
                width: 256,
                height: 256,
                colorDark: qrColour,
                colorLight: qrFill,
                correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.H : undefined
            });
        }
    }

    function syncBundleCustomQrPreview($form, card) {
        const data = card || {
            qr_width: parseInt($form.find('input[name="wpcf-qr-width"]').val() || '140', 10),
            qr_x: parseInt($form.find('input[name="wpcf-qr-x"]').val() || '32', 10),
            qr_y: parseInt($form.find('input[name="wpcf-qr-y"]').val() || '32', 10),
            qr_code_colour: normalizeHex($form.find('input[name="wpcf-qr-code-colour"]').val(), '#000000'),
            qr_fill_colour: normalizeHex($form.find('input[name="wpcf-qr-fill-colour"]').val(), '#ffffff')
        };

        const $qr = $form.closest('.me-bundle-card').find('[data-bundle-custom-qr]').first();
        if (!$qr.length) {
            return;
        }

        $qr.css({
            width: (parseInt(data.qr_width || 140, 10) || 140) + 'px',
            height: (parseInt(data.qr_width || 140, 10) || 140) + 'px',
            left: (parseInt(data.qr_x || 32, 10) || 32) + 'px',
            top: (parseInt(data.qr_y || 32, 10) || 32) + 'px',
            backgroundColor: data.qr_fill_colour || '#ffffff'
        });

        renderBundleCustomQr($form, data);
    }

    function initBundleCustomInteractive($card) {
        if (!$card.length || $card.data('bundleCustomReady')) {
            return;
        }

        const $form = $card.find('[data-bundle-custom-form]').first();
        const $qr = $card.find('[data-bundle-custom-qr]').first();
        const $preview = $card.find('[data-bundle-custom-back-preview]').first();

        if (!$form.length || !$qr.length || !$preview.length) {
            return;
        }

        const hasDraggable = typeof $.fn.draggable === 'function';
        const hasResizable = typeof $.fn.resizable === 'function';

        if (hasDraggable) {
            $qr.draggable({
                containment: $preview,
                cursor: 'move',
                stop: function(event, ui) {
                    $form.find('input[name="wpcf-qr-x"]').val(Math.round(ui.position.left));
                    $form.find('input[name="wpcf-qr-y"]').val(Math.round(ui.position.top));
                }
            });
        }

        if (hasResizable) {
            $qr.resizable({
                containment: $preview,
                aspectRatio: 1,
                handles: 'se',
                stop: function(event, ui) {
                    const size = Math.round(ui.size.width);
                    $form.find('input[name="wpcf-qr-width"]').val(size);
                    $qr.css({ height: size + 'px' });
                }
            });
        }

        // Touch drag and resize — handled manually so page scroll is never affected.
        var touchState = null;

        $qr[0].addEventListener('touchstart', function(e) {
            if (e.touches.length !== 1) { return; }
            e.preventDefault();
            var t = e.touches[0];
            var isHandle = $(e.target).hasClass('ui-resizable-se') || $(e.target).closest('.ui-resizable-se').length;
            touchState = {
                mode:      isHandle ? 'resize' : 'drag',
                startX:    t.clientX,
                startY:    t.clientY,
                startLeft: parseInt($qr.css('left'), 10)  || 0,
                startTop:  parseInt($qr.css('top'), 10)   || 0,
                startSize: parseInt($qr.css('width'), 10) || 140
            };
        }, { passive: false });

        $qr[0].addEventListener('touchmove', function(e) {
            if (!touchState || e.touches.length !== 1) { return; }
            e.preventDefault();
            var t = e.touches[0];
            var dx = t.clientX - touchState.startX;
            var dy = t.clientY - touchState.startY;
            var pW = $preview.width();
            var pH = $preview.height();

            if (touchState.mode === 'drag') {
                var newLeft = Math.max(0, Math.min(pW - $qr.width(),  touchState.startLeft + dx));
                var newTop  = Math.max(0, Math.min(pH - $qr.height(), touchState.startTop  + dy));
                $qr.css({ left: newLeft, top: newTop });
            } else {
                var delta   = (dx + dy) / 2;
                var newSize = Math.max(40, Math.min(Math.min(pW, pH), touchState.startSize + delta));
                $qr.css({ width: newSize, height: newSize });
            }
        }, { passive: false });

        $qr[0].addEventListener('touchend', function() {
            if (!touchState) { return; }
            if (touchState.mode === 'drag') {
                $form.find('input[name="wpcf-qr-x"]').val(Math.round(parseInt($qr.css('left'), 10)));
                $form.find('input[name="wpcf-qr-y"]').val(Math.round(parseInt($qr.css('top'), 10)));
            } else {
                var size = Math.round(parseInt($qr.css('width'), 10));
                $form.find('input[name="wpcf-qr-width"]').val(size);
            }
            touchState = null;
        });

        syncBundleCustomQrPreview($form);
        $card.data('bundleCustomReady', hasDraggable && hasResizable);
    }

    function openBundleCustomMediaPicker($card, side) {
        const userId = Number(ME_SINGLE_CARDS.currentUserId || 0);
        const frame = wp.media({
            title: side === 'front' ? 'Select front artwork' : 'Select back artwork',
            button: { text: 'Use this artwork' },
            multiple: false,
            library: { type: 'image', author: userId, mecard_owned_only: true }
        });

        frame.on('open', function() {
            // Default to the library/browse tab, not the upload tab.
            if (typeof frame.content.mode === 'function' && frame.content.mode() !== 'browse') {
                frame.content.mode('browse');
            }
            const props = frame.state().get('library').props;
            props.set({ author: userId, mecard_owned_only: true, type: 'image' });
        });

        frame.on('select', function() {
            const file  = frame.state().get('selection').first().toJSON();
            const $form = $card.find('[data-bundle-custom-form]').first();
            $form.find('input[name="wpcf-card-' + side + '"]').val(file.url || '');
            updateBundleCustomThumb($form, side, file.url || '');
            if (side === 'front') {
                updateBundleCustomFrontPreview($form, file.url || '');
            } else {
                updateBundleCustomBackPreview($form, file.url || '');
            }
            syncBundleCustomQrPreview($form);
            showArtworkWarnings($form, validateCardArtwork(file));
        });

        frame.open();
    }

    $(document).on('click', 'a[data-me-basket-action="1"]', function(event) {
        const $button = $(event.currentTarget);
        if ($button.attr('aria-disabled') === 'true') {
            event.preventDefault();
            return;
        }

        const addingLabel = String($button.data('adding-label') || 'Adding...');
        $button.data('original-label', $button.text());
        $button.text(addingLabel);
        $button.addClass('is-disabled');
        $button.attr('aria-disabled', 'true');
    });

    $(document).on('click', '[data-me-offer-toggle]', function() {
        const $button = $(this);
        const variant = String($button.data('me-offer-toggle') || '');
        const $switcher = $button.closest('[data-me-offer-switcher]');

        if (!variant || !$switcher.length) {
            return;
        }

        $switcher.attr('data-offer-variant', variant);
        $switcher.find('[data-me-offer-panel]').prop('hidden', true);
        $switcher.find('[data-me-offer-panel="' + variant + '"]').prop('hidden', false);
        $switcher.find('[data-me-offer-toggle]').removeClass('is-active');
        $switcher.find('[data-me-offer-toggle="' + variant + '"]').addClass('is-active');
    });

    $(document).on('click', '.me-bundle-card__toggle-btn', function() {
        const $btn = $(this);
        const side = $btn.data('card-side');
        const $card = $btn.closest('.me-bundle-card');
        $card.find('.me-bundle-card__toggle-btn').removeClass('is-active');
        $btn.addClass('is-active');
        $card.find('.me-bundle-card__pane').removeClass('is-active');
        $card.find('.me-bundle-card__pane[data-card-pane="' + side + '"]').addClass('is-active');
    });

    $(document).on('click', '[data-bundle-edit-toggle]', function() {
        const $card = $(this).closest('.me-bundle-card');
        const $form = $card.find('[data-bundle-card-form]');
        $form.prop('hidden', !$form.prop('hidden'));
    });

    $(document).on('click', '[data-bundle-card-pick-logo]', function() {
        const $card = $(this).closest('.me-bundle-card');
        const userId = Number(ME_SINGLE_CARDS.currentUserId || 0);
        const frame = wp.media({
            title: 'Select logo',
            button: { text: 'Use this logo' },
            multiple: false,
            library: { type: 'image', author: userId, mecard_owned_only: true }
        });

        frame.on('open', function() {
            if (typeof frame.content.mode === 'function' && frame.content.mode() !== 'browse') {
                frame.content.mode('browse');
            }
            const props = frame.state().get('library').props;
            props.set({ author: userId, mecard_owned_only: true, type: 'image' });
        });

        frame.on('select', function() {
            const file = frame.state().get('selection').first().toJSON();
            $card.find('input[name="logo_id"]').val(file.id || '');
            $card.find('input[name="logo_url"]').val(file.url || '');
            $card.find('.me-bundle-card__logo-preview').attr('src', file.url || '');
        });

        frame.open();
    });

    $(document).on('submit', '[data-bundle-card-form]', function(event) {
        event.preventDefault();
        const $form = $(this);
        const $status = $form.find('[data-bundle-card-status]');
        const fd = new FormData(this);
        fd.append('action', 'me_single_cards_save_bundle_classic');
        fd.append('_wpnonce', CFG.nonce || '');

        const $submit = $form.find('button[type="submit"]');
        $submit.prop('disabled', true).text('Saving...');
        $status.text('');

        $.ajax({
            url: CFG.ajaxurl,
            method: 'POST',
            data: fd,
            processData: false,
            contentType: false
        }).done(function(res) {
            if (!res || !res.success || !res.data || !res.data.card) {
                $status.text((res && res.data && res.data.message) || 'Could not save card details.');
                return;
            }

            const card = res.data.card;
            const $preview = $form.closest('.me-bundle-card');
            $preview.find('.me-card-preview__name').text(card.name || '');
            $preview.find('.me-card-preview__title').text(card.job_title || '');
            if (card.front_url) {
                const $logo = $preview.find('.me-card-preview__logo');
                if ($logo.length) {
                    $logo.attr('src', card.front_url);
                } else {
                    $preview.find('.me-card-preview__logo-shell').html('<img class="me-card-preview__logo" src="' + card.front_url + '" alt="">');
                }
                $preview.find('.me-bundle-card__logo-preview').attr('src', card.front_url);
                $form.find('input[name="logo_url"]').val(card.front_url);
            }
            $status.text('Saved.');
        }).fail(function() {
            $status.text('Could not save card details.');
        }).always(function() {
            $submit.prop('disabled', false).text('Save card details');
        });
    });

    $(document).on('click', '[data-bundle-custom-pick]', function() {
        const $button = $(this);
        const side = String($button.data('bundle-custom-pick') || '');
        const $card = $button.closest('.me-bundle-card');

        if (!side || !$card.length) {
            return;
        }

        openBundleCustomMediaPicker($card, side);
    });

    $(document).on('input change', '[data-bundle-custom-form] input[name="wpcf-qr-width"], [data-bundle-custom-form] input[name="wpcf-qr-code-colour"], [data-bundle-custom-form] input[name="wpcf-qr-fill-colour"]', function() {
        syncBundleCustomQrPreview($(this).closest('[data-bundle-custom-form]'));
    });

    // Colour field — helpers.
    function colourFieldApply($field, hex) {
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) { return; }
        const $hidden  = $field.find('input[type="hidden"]').first();
        const $native  = $field.find('.me-colour-field__native').first();
        const $text    = $field.find('.me-colour-field__text').first();
        const $preview = $field.find('.me-colour-field__preview').first();
        const $hexSpan = $field.find('.me-colour-field__hex').first();
        $hidden.val(hex).trigger('change');
        $native.val(hex);
        $text.val(hex);
        $preview.css('background', hex);
        $hexSpan.text(hex);
    }

    function colourFieldClose($field) {
        $field.find('.me-colour-field__panel').prop('hidden', true);
        $field.find('[data-colour-trigger]').attr('aria-expanded', 'false');
    }

    // Hide eyedropper button in browsers that don't support the API.
    if (!('EyeDropper' in window)) {
        $(document).find('[data-eyedropper]').prop('hidden', true);
        $(document).on('DOMNodeInserted', '[data-eyedropper]', function() {
            $(this).prop('hidden', true);
        });
    }

    // Trigger: open / close panel.
    $(document).on('click', '[data-colour-trigger]', function() {
        const $field = $(this).closest('[data-colour-field]');
        const $panel = $field.find('.me-colour-field__panel').first();
        const open   = !$panel.prop('hidden');
        $panel.prop('hidden', open);
        $(this).attr('aria-expanded', String(!open));
        if (!open) {
            // Hide eyedropper if not supported (covers dynamically rendered fields).
            if (!('EyeDropper' in window)) {
                $field.find('[data-eyedropper]').prop('hidden', true);
            }
        }
    });

    // Native colour input: live preview on input, close panel on change (user confirmed).
    $(document).on('input', '.me-colour-field__native', function() {
        colourFieldApply($(this).closest('[data-colour-field]'), $(this).val());
    });
    $(document).on('change', '.me-colour-field__native', function() {
        const $field = $(this).closest('[data-colour-field]');
        colourFieldApply($field, $(this).val());
        colourFieldClose($field);
    });

    // Hex text input: live update as user types valid hex; close on blur.
    $(document).on('input', '.me-colour-field__text', function() {
        const val = $(this).val().trim();
        const hex = val.startsWith('#') ? val : '#' + val;
        if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
            colourFieldApply($(this).closest('[data-colour-field]'), hex);
        }
    });
    $(document).on('blur', '.me-colour-field__text', function() {
        colourFieldClose($(this).closest('[data-colour-field]'));
    });
    $(document).on('keydown', '.me-colour-field__text', function(e) {
        if (e.key === 'Enter') {
            colourFieldClose($(this).closest('[data-colour-field]'));
        }
    });

    // Eyedropper button.
    $(document).on('click', '[data-eyedropper]', function() {
        if (!('EyeDropper' in window)) { return; }
        const $field = $(this).closest('[data-colour-field]');
        // eslint-disable-next-line no-undef
        new EyeDropper().open().then(function(result) {
            colourFieldApply($field, result.sRGBHex);
            colourFieldClose($field);
        }).catch(function() {});
    });

    // Close when clicking outside.
    $(document).on('click', function(e) {
        if (!$(e.target).closest('[data-colour-field]').length) {
            $('[data-colour-field]').each(function() { colourFieldClose($(this)); });
        }
    });

    $(document).on('submit', '[data-bundle-custom-form]', function(event) {
        event.preventDefault();
        const $form = $(this);
        const $status = $form.find('[data-bundle-custom-status]');
        const fd = new FormData(this);
        fd.append('action', 'me_single_cards_save_bundle_custom');
        fd.append('_wpnonce', CFG.nonce || '');

        const $submit = $form.find('button[type="submit"]');
        $submit.prop('disabled', true).text('Saving...');
        $status.text('');

        $.ajax({
            url: CFG.ajaxurl,
            method: 'POST',
            data: fd,
            processData: false,
            contentType: false
        }).done(function(res) {
            if (!res || !res.success || !res.data || !res.data.card) {
                $status.text((res && res.data && res.data.message) || 'Could not save custom card details.');
                return;
            }

            const card = res.data.card;
            $form.find('input[name="wpcf-card-front"]').val(card.front_url || '');
            $form.find('input[name="wpcf-card-back"]').val(card.back_url || '');
            $form.find('input[name="wpcf-qr-width"]').val(card.qr_width || 140);
            $form.find('input[name="wpcf-qr-x"]').val(card.qr_x || 32);
            $form.find('input[name="wpcf-qr-y"]').val(card.qr_y || 32);
            var dotColour  = normalizeHex(card.qr_code_colour, '#000000');
            var fillColour = normalizeHex(card.qr_fill_colour, '#ffffff');
            // Sync colour fields after save.
            $form.find('[data-colour-field]').each(function() {
                var name   = $(this).find('input[type="hidden"]').attr('name');
                var colour = name === 'wpcf-qr-code-colour' ? dotColour : fillColour;
                colourFieldApply($(this), colour);
            });
            updateBundleCustomThumb($form, 'front', card.front_url || '');
            updateBundleCustomThumb($form, 'back', card.back_url || '');
            updateBundleCustomFrontPreview($form, card.front_url || '');
            updateBundleCustomBackPreview($form, card.back_url || '');
            syncBundleCustomQrPreview($form, card);
            $status.text('Saved.');
        }).fail(function() {
            $status.text('Could not save custom card details.');
        }).always(function() {
            $submit.prop('disabled', false).text('Save custom card details');
        });
    });

    $(function() {
        $('.me-bundle-card--custom').each(function() {
            initBundleCustomInteractive($(this));
        });
    });

    $(window).on('load', function() {
        $('.me-bundle-card--custom').each(function() {
            initBundleCustomInteractive($(this));
        });
    });
})(jQuery);
