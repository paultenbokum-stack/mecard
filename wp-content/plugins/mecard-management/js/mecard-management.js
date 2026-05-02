
var current_form;

function me_setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function me_getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(";");
    for(let i = 0; i <ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == " ") {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

jQuery(document).ready(function($) {

    window.MECARD_BIP = null;


    function checkCardDesignDims(image) {
        let width = $(image).prop('naturalWidth');
        let height = $(image).prop('naturalHeight');
        let adjusted_width = Math.round(width/height * 540);
        let error_box = $('#error-image-front-' + $(image).data('tag_id'));
        $(error_box).hide();
        let msg = '';
        if (adjusted_width > 858) {
            msg = 'Your image is too wide for its height, it should be 856 x 540 but it\'s ' + adjusted_width + ' x 540';
            $(error_box).show();
        } else if (adjusted_width < 854) {
            msg = 'Your image is too narrow for its height, it should be 856 x 540 but it\'s ' + adjusted_width + ' x 540';
            $(error_box).show();
        } else {
            msg = '';
        }
        $(error_box).html(msg);
    }
    function setFrame(tag_id) {
        let frame = wp.media.frame;
        if (frame) {
            frame.on('select', function() {
                let selectionCollection = frame.state().get('selection');
                var attachment_urls = selectionCollection.map( function( attachment ) {
                    attachment = attachment.toJSON();
                    return attachment.url;
                });


                if (frame.options.library.toolset_media_management_unique_query_arg == 'wpcf-card-front' && attachment_urls.length) {
                    let myinput = $('#tag-in-progress-'+ tag_id +' input[name="wpcf-card-front"]');
                    $(myinput).val(attachment_urls[0]);

                    let mypreview = $('img#card-front-'+ tag_id + ', #card-front-'+ tag_id + ' img');
                    $(mypreview).attr('src',attachment_urls[0]);
                    $(mypreview).addClass('changed-preview');
                    $(mypreview).trigger('load');
                    //window.setTimeout(checkCardDesignDims(mypreview),2000);
                }

                if (frame.options.library.toolset_media_management_unique_query_arg == 'wpcf-card-back' && attachment_urls.length) {
                    let myinput = $('#tag-in-progress-'+ tag_id +' input[name="wpcf-card-back"]');
                    $(myinput).val(attachment_urls[0]);

                    let mypreview = $('img#card-back-'+ tag_id + ', #card-back-'+ tag_id + ' img');
                    $(mypreview).attr('src',attachment_urls[0]);
                    $(mypreview).addClass('changed-preview');

                }

                if (frame.options.library.toolset_media_management_unique_query_arg == '_featured_image' && attachment_urls.length) {
                    let myinput = $('.profile-card[data-profile-id="'+ tag_id +'"] input[name="_featured_image"]');
                    $(myinput).val(attachment_urls[0]);

                    let mypreview = $('.profile-card[data-profile-id="'+ tag_id +'"] .js-toolset-media-field-preview-item img');

                    $(mypreview).attr('src',attachment_urls[0]);
                    $(mypreview).addClass('changed-preview');

                }

            });
        }
    }




    function makeQR(qr) {
        let elQR = $(qr);
        let tag_id = elQR.data('tag');
        let payload = elQR.data('url');
        let qr_colour = elQR.data('qr_colour');
        let qr_bg = elQR.data('qr_bg');
        let width = elQR.parent('.qr-container').width();
        let height = width;

        width = (width) ? width : 256;
        height = (height) ? height : 256;



        if (!qr_colour) {
            qr_colour = '#000000'
        }

        if (!qr_bg) {
            qr_bg = '#fff0'
        }

        if (tag_id) {
            elQR.empty();
            var qrcode = new QRCode("qr-code-" + tag_id, {
                text: payload,
                /*width: width,
                height: height,*/
                width: 256,
                height: 256,
                colorDark: qr_colour,
                colorLight: qr_bg,
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }

    function makeQRprofile(qr) {
        let elQR = $(qr);
        let tag_id = elQR.data('profile_id');
        let payload = elQR.data('url');
        let qr_colour = elQR.data('qr_colour');
        let qr_bg = elQR.data('qr_bg');
        let width = elQR.data('width');
        let height = width;

        width = (width) ? width : 500;
        height = (height) ? height : 500;



        if (!qr_colour) {
            qr_colour = '#000000'
        }
        ;
        if (!qr_bg) {
            qr_bg = '#fff0'
        }
        ;
        if (payload) {
            elQR.empty();
            let qrcode = new QRCode("profile-qr-code-full", {
                text: payload,
                width: width,
                height: height,
               /* width: 500,
                height: 500,*/
                colorDark: qr_colour,
                colorLight: qr_bg,
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }

    function qr_position() {

        $( ".tag-form .qr-container.editable" ).draggable({
            containment: 'parent',
            stop: function( event, ui ) {
                $(this).parents('.tag-form').find('input[name=wpcf-qr-y]').val(ui.position.top);
                $(this).parents('.tag-form').find('input[name=wpcf-qr-x]').val(ui.position.left);
            }
        });

        $(".tag-form .qr-container.editable").resizable({
            containment: 'parent',
            aspectRatio: 1/1,
            stop: function( event, ui ) {
                $(this).parents('.tag-form').find('input[name=wpcf-qr-width]').val(ui.size.width);
            }
        });
    }

    function showCompanyModal(company_id) {
        window.setTimeout(function() {$('#companyEditModal'+ company_id).modal({'show': true})},5000);

    }

    $(document).ajaxSuccess(function(event, xhr, settings) {
        var requestData = new URLSearchParams(settings.data);

        // Iterate over all keys in the requestData


        // Specific action example
        if (requestData.get('action') === 'cred_submit_form') {
            let form_id = requestData.get('_cred_cred_prefix_form_id');
            if (form_id == MECARD_MGMT.cred_edit_company_form_id) {
                //$('#companyEditModal'+ requestData.get('_cred_cred_prefix_post_id')).modal();
                $('#companyEditModal'+ requestData.get('_cred_cred_prefix_post_id')).modal('hide');
                $('#companyEditModal'+ requestData.get('_cred_cred_prefix_post_id')).modal('show');
            }

        }
    });



    $(document).on('click','#assign-card',function() {
        $('#assignCardModal .modal-body .modal-error').remove();
        $(this).html('Assigning Card...');
        var that = this;

        $.post(MECARD_MGMT.ajaxurl,
            {
                // wp ajax action
                action: 'assign_card',
                card_id: $('a.card-selected').attr('data-card-id'),
                profile_id: $('#assignCardModal').attr('data-profile-id'),
                // send the nonce along with the request
                _wpnonce: MECARD_MGMT.nonce
            },
            function(response) {
                    if (!!JSON.parse(response).success) {
                    $('.assign-card-refresh').trigger('click');
                    reload_profile_admin();
                    $(that).html('Assign Card');
                    $('#assignCardModal').modal("hide");

                } else {
                    const html = '<div class="modal-error">Oops, something went wrong! <br> Please try again</div';
                    $('#assignCardModal .modal-body').append(html);
                        $(that).html('Assign Card');
                }


            });


    });

    $(document).on('click','.delete-more-link',function() {
        var post_id = $(this).data('postid');
        //console.log(post_id);
        $('#more-link-' + post_id).delay(500).remove();
    });

    $(document).on('click','.assign-card',function() {

        $('#assignCardModal').attr('data-profile-id',$(this).data('profile-id'));
    });

    $(document).on('click','.select-card-a',function(e) {

        e.preventDefault();
        $('.select-card-a').toggleClass('card-selected',false);
        $(this).toggleClass('card-selected',true);
        $('.select-card-a').children('div').toggleClass('card-selected',false);
        $(this).children('div').toggleClass('card-selected',true);
        $('#assign-card').removeAttr('disabled');
    });

   $(document).on('click','.remove-tag', function(e) {
       $(this).html('Removing...');
       window.setTimeout(reload_profile_admin(), 1500);
   });

    // accept profile invite
    $(document).on('click','#request-accept',function() {
        $('#request-accept button').html('Processing...');
        $.post(MECARD_MGMT.ajaxurl,
            {
                // wp ajax action
                action: 'accept_profile_invite',
                request_id: $(this).attr('data-request_id'),
                // send the nonce along with the request
                _wpnonce: MECARD_MGMT.nonce
            },
            function(response) {
                const resp = JSON.parse(response);
            if (!!resp.success) {
                    //$('#assignCardModal').modal("hide");
                    location.href = '../../manage-mecard-profiles';

                } else {
                    if (resp.error_code == 1) {
                        const errormsg = 'Error: ' + resp.message;
                        $('#accept-error').html(errormsg);
                        $('#request-accept ').remove();
                    } else {
                        $('#request-accept button').html('Try again');
                        //console.log(resp);
                    }
                }


            });


    });

    function exportTableToCSV($table, filename, filters) {
        let selectors = ['tr.headings'];
        if (filters.length) {
            filters.forEach(function(filter) {
                selectors.push('tr.' + filter);
            });
        } else {
            selectors.push('tr');
        }

        var $rows = $table.find(selectors.join(','));

        var csvData = "";

        for(var i=0;i<$rows.length;i++){
            var $cells = $($rows[i]).children('th,td'); //header or content cells

            for(var y=0;y<$cells.length;y++){
                if(y>0){
                    csvData += ",";
                }
                var txt = ($($cells[y]).text()).toString().trim();
                if(txt.indexOf(',')>=0 || txt.indexOf('\"')>=0 || txt.indexOf('\n')>=0){
                    txt = "\"" + txt.replace(/\"/g, "\"\"") + "\"";
                }
                if (txt.indexOf('https://') >= 0 && (txt.indexOf('.png') >= 0|| txt.indexOf('.jpg') >= 0)) {
                    txt = txt.split('/').pop();
                }
                csvData += txt;
            }
            csvData += '\n';
        }


        // Data URI
        csvData = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csvData);

        $(this)
            .attr({
                'download': filename,
                'href': csvData,
                'target': '_blank'
            });
    }

    // This must be a hyperlink
    $(".exportEncode").on('click', function (event) {
        // CSV
        exportTableToCSV.apply(this, [$('#exportData>table'), 'encoding.csv',['encode']]);


    });

    $(".exportPrint").on('click', function (event) {

        exportTableToCSV.apply(this, [$('#exportData>table'), 'print.csv',['print']]);


    });




    function download(source, fileName){

        const ext = source.split('.').pop();
        if (!fileName) {
            fileName = source.split('/').pop();
        } else {
           fileName += '.' + ext;
        }
        var unoptimised = source.replace('uploads/','uploads/backup/'); //non-optimised version of the image
        var el = document.createElement("a");
        el.setAttribute("href", unoptimised);
        el.setAttribute("download", fileName);
        document.body.appendChild(el);
        el.click();
        el.remove();
    }

    $(document).on('click','#imgdwnld', function(e) {
        e.preventDefault();
        //console.log('Downloading ' + $('a.dwnld').length + ' images...');
        var count = 0;
        $('a.dwnld').each(function(index) {
            let uri = $(this).attr('href');
            let filename = $(this).data('name');
            var delay = ~~ (index/10)*2000;
            //console.log(index + ':' + $(this).attr('href') + ':delay' + delay);
            $(this).addClass('downloaded').delay(delay).queue(function(next) {
                download(uri);
            })


        });
     });

    $(document).on('change','div.tag-edit input.checkbox',function () {
        $(this).closest('form').submit();
    });

    $( ".profile-card" ).hover(
        function() {
            $( this ).addClass( "hover" );
        }, function() {
            $( this ).removeClass( "hover" );
        }
    );

    function mecardShouldConfirmCartRemoval($link) {
        const href = String($link.attr('href') || '');
        if (href.indexOf('me_bundle_action=remove') !== -1) {
            return true;
        }

        const productIds = Array.isArray(MECARD_MGMT.mecardProductIds) ? MECARD_MGMT.mecardProductIds.map(function(id) {
            return parseInt(id, 10);
        }).filter(function(id) {
            return !Number.isNaN(id) && id > 0;
        }) : [];

        const productId = parseInt(
            $link.attr('data-product_id')
            || $link.data('product_id')
            || $link.data('product-id')
            || 0,
            10
        );

        return !Number.isNaN(productId) && productIds.indexOf(productId) !== -1;
    }

    $( document.body ).on( 'click', 'a.remove.remove_from_cart_button, td.product-remove a.remove, a[href*="me_bundle_action=remove"]', function(event) {
        const $link = $(this);
        if (!mecardShouldConfirmCartRemoval($link)) {
            return;
        }

        if( ! confirm( MECARD_MGMT.removeConfirmText || 'Are you sure you want to remove this item?' ) ) {
            event.preventDefault();
            event.stopPropagation();
        }
    });

    $(document).on('change','input[name="wpcf-card-front"]',function() {

        var tag_id = $(this).parents('div.tag-form[data-tag_id]').data('tag_id');
        $('#card-front-' + tag_id + ' source').attr('srcset',$(this).val());
        $('#card-front-' + tag_id + ' img, img#card-front-' + tag_id).attr('src',$(this).val());
        $('#card-front-' + tag_id + ' img, img#card-front-' + tag_id).trigger('load');
        setFrame(tag_id);
        $('#card-front-' + tag_id + ' img, img#card-front-' + tag_id).load(function() { checkCardDesignDims($('#card-front-' + tag_id + ' img, img#card-front-' + tag_id));});
        //window.setTimeout(checkCardDesignDims($('#card-front-' + tag_id + ' img, img#card-front-' + tag_id)),2000);
    });

    $(document).on('change','input[name="wpcf-card-back"]',function() {

        var tag_id = $(this).parents('div.tag-form[data-tag_id]').data('tag_id');
        $('#card-back-' + tag_id + ' source').attr('srcset',$(this).val());
        $('#card-back-' + tag_id + ' img, img#card-back-' + tag_id).attr('src',$(this).val());
        setFrame(tag_id);
    });

    $(document).on('change','input[name="_featured_image"]',function() {

        var tag_id = $(this).parents('.profile-card').data('profile-id');
        //$(this).parents('div[data-item_name="credimage-_featured_image"]').find('').attr('src',$(this).val());
        setFrame(tag_id);
    });

    $('input[name="wpcf-name-on-card"]').keyup(function() {

        var tag_id = $(this).parents('div.tag-form[data-tag_id]').data('tag_id');

        $('div[data-tag='+ tag_id + ']'+ ' .card-preview.front .classic-name').html($(this).val());
    });

    $(document).on('keyup','input[name="wpcf-name-on-card"]',function() {

        var tag_id = $(this).parents('div.tag-form[data-tag_id]').data('tag_id');

        $('div[data-tag='+ tag_id + ']'+ ' .card-preview.front .classic-name').html($(this).val());
    });

    $('input[name="wpcf-job-title-on-card"]').keyup(function() {

        var tag_id = $(this).parents('div.tag-form[data-tag_id]').data('tag_id');

        $('div[data-tag='+ tag_id + ']'+ ' .card-preview.front .classic-job-title').html($(this).val());
    });

    $(document).on('keyup','input[name="wpcf-job-title-on-card"]',function() {

        var tag_id = $(this).parents('div.tag-form[data-tag_id]').data('tag_id');

        $('div[data-tag='+ tag_id + ']'+ ' .card-preview.front .classic-job-title').html($(this).val());
    });



    $(document).on('change, focusout','input[name="wpcf-qr-code-colour"]', function(e) {
        let qr = $(this).parents('.tag-form').first().find('.qr-code');
        qr.data('qr_colour',$(this).val());
        makeQR(qr);
    });

    $(document).on('change, focusout','input[name="wpcf-qr-fill-colour"]', function(e) {
        let qr = $(this).parents('.tag-form').first().find('.qr-code');
        qr.data('qr_bg',$(this).val());
        makeQR(qr);
    });



    $(document).on('dragstop','.iris-square-value',function() {
        let qr = $(this).parents('.tag-form').first().find('.qr-code');
        let colorval = $(this).parents('div[data-item_name="colorpicker-wpcf-qr-code-colour"]').first().find('input[name="wpcf-qr-code-colour"]').val();
        let bgval = $(this).parents('div[data-item_name="colorpicker-wpcf-qr-fill-colour"]').first().find('input[name="wpcf-qr-fill-colour"]').val();
        qr.data('qr_colour',colorval);
        qr.data('qr_bg',bgval);
        //console.log('val',colorval);
        makeQR(qr);
    });

    $( function() {
        qr_position();
    } );




        $(document).on('shown.bs.modal', '.modal.card',function () {
            let qr = $(this).find('.qr-code');
            makeQR(qr);


        });

    $(document).on('click','a.open-qr-modal,a.open-qr-modal-dd',function(e) {
        e.preventDefault();
        let qr = $('#profile-qr-code-full');
        $(qr).data('url',$(this).data('profile-url'));
        $(qr).data('profile-name',$(this).data('profile-name'));
        makeQRprofile(qr);
    });


    $( document ).on( 'js_event_wpv_pagination_completed', function( event, data ) {
        /**
         * data.view_unique_id (string) The View unique ID hash
         * data.effect (string) The View AJAX pagination effect
         * data.speed (integer) The View AJAX pagination speed in miliseconds
         * data.layout (object) The jQuery object for the View layout wrapper
         */
        qr_position();
    });

    //$('div.no-order').parents('div.row.tag-edit').hide();

    $(document).on('added_to_cart', function(event,fragments, hash, button) {
        if (button.hasClass('mecard-management')) {
            location.reload();
        }
        let target_link = $(this).find('.profile-added-to-cart');
        let source_link = $(this).find('.woocommerce-mini-cart-item.mini_cart_item a[data-product_id="' + button.data('product_id') + '"]');
        target_link.data('cart_item_key',source_link.data('cart_item_key'));
        target_link.html('<button class="add-button"><i class="far fa-check-square"></i> Pro Upgrade selected </button>');
        target_link.attr('href',source_link.attr('href'));
        target_link.removeClass().addClass('remove remove_from_cart_button remove-profile-from-cart');
    });

    $(document).on('adding_to_cart', function(event,thisbutton, element) {
        if ($(thisbutton).hasClass('profile-add-to-cart')) {
            $(thisbutton).addClass('profile-added-to-cart');
            $(thisbutton).html('Adding to basket...');
            //console.log('is profile: ', $(thisbutton).data());
        }
        if (thisbutton.hasClass('mecard-management')) {
            $(thisbutton).attr('disabled', 'disabled');
            $(thisbutton).html('<i class="fas fa-hourglass-start"></i>');
        }
        });

    $(document).on('removed_from_cart', function(event,fragments, hash, button) {
        const target_link = $('body').find('a.remove-profile-from-cart[data-product_id="'+ button.data('product_id') +'"]');
        target_link.html('<button class="add-button">Upgrade to Pro</button>');
        target_link.attr('href','?add-to-cart=' + $(target_link).data('product_id'));
        target_link.removeClass().addClass('ajax_add_to_cart add_to_cart_button profile-add-to-cart');
        $(target_link).parent().find('.added_to_cart.wc-forward').remove();
    });

    $(document).on('click','.save_submit',function(event) {
        let form = $(this).parents('form');
        let sibling = $(this).siblings('.form-submit').first();
        let modal = $(this).parents('.modal');
        let chkDesign  = form.find('input[name="wpcf-design-submitted"]');
        chkDesign.prop('checked', true);
        form.submit();
    });

    $('form').submit(function() {
        current_form = $(this).first();
    });




    $('.profile-submit').click(function(e) {
        //window.setTimeout(function() {$('.profile-search').trigger('click')},1000);
        //$('.profile-search').addClass('searching').delay(1000).trigger('click');
    });

    $('#profileAddModal').on('hidden.bs.modal', function (e) {
        reload_profile_admin();
    });

    function reload_profile_admin() {
        $('.profile-search').trigger('click');
        $('.profile-admin-view').empty();
        $('.profile-admin-loading').show();
    }

    // get rid of class that removes scrolling on body after ajax submit from a modal form
    $(document).ajaxComplete(function(event, request, settings) {
        //console.log(event, request, settings);
        if (!$('#profileAddModal.show').length > 0) {
            //$('.modal-backdrop').hide();
            //$('body').removeClass('modal-open');
        }

    });

    $(document).on('click','#download-qr',function() {
        $('#qr-download-gif').show().delay(2000).fadeOut();
        $(this).attr('disabled', 'disabled').delay(2000).attr('disabled',false);
        downloadImage($('#profile-qr-code-full img').attr('src'),$('#profile-qr-code-full').data('profile-name'),this);
    });

// sharing
//    ************************  //

    if (window.MECARD_SHARE) {

            const cfg = window.MECARD_SHARE;
            const panel = document.getElementById('mecard-share-panel');
            const fab   = document.querySelector('.mecard-share-fab');
            const scrim = document.querySelector('.mecard-share-scrim');
            if (!panel || !fab) return;

            // Theming
            document.documentElement.style.setProperty('--mecard-accent', cfg.accent);
            document.documentElement.style.setProperty('--mecard-btn-text', cfg.buttonText);

            // ===== QR =====
            const qrContainer = document.getElementById('mecard-qr-canvas');
            function makeQR() {
                if (!qrContainer) return;
                qrContainer.innerHTML = '';
                new QRCode(qrContainer, {
                    text: cfg.url, width: 256, height: 256,
                    colorDark: '#000000', colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
            makeQR();

            // ===== Panel open/close =====
            function openPanel(){
                panel.classList.add('is-open');
                panel.setAttribute('data-visible','true');
                panel.setAttribute('aria-hidden','false');
                document.body.classList.add('mecard-share-open');
                fab.setAttribute('aria-expanded','true');
                fab.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
                scrim?.classList.add('is-visible');
            }
            function closePanel(){ clearWhatsappInput(); panel.classList.remove('is-open'); panel.setAttribute('data-visible','false'); panel.setAttribute('aria-hidden','true'); document.body.classList.remove('mecard-share-open'); fab.setAttribute('aria-expanded','false'); fab.innerHTML = '<i class="fas fa-share-alt" aria-hidden="true"></i>'; scrim?.classList.remove('is-visible'); }
            function togglePanel(){ panel.classList.contains('is-open') ? closePanel() : openPanel(); }
            fab.addEventListener('click', togglePanel);
            scrim?.addEventListener('click', closePanel);

            function maybeOpenGuidedShareInstall() {
                try {
                    const url = new URL(window.location.href);
                    const shouldOpenShare = url.searchParams.get('me_share') === '1';
                    const target = url.searchParams.get('me_share_target');
                    if (!shouldOpenShare) return;

                    window.setTimeout(function () {
                        openPanel();

                        if (target) {
                            const targetEl = panel.querySelector(`[data-share-target="${target}"]`) || document.getElementById(target);
                            if (targetEl) {
                                window.setTimeout(function () {
                                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    targetEl.classList.add('is-guided-target');
                                    window.setTimeout(function () {
                                        targetEl.classList.remove('is-guided-target');
                                    }, 2400);
                                }, 180);
                            }
                        }
                    }, 150);

                    url.searchParams.delete('me_share');
                    url.searchParams.delete('me_share_target');
                    if (window.history && window.history.replaceState) {
                        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
                    }
                } catch (err) {
                    // no-op
                }
            }

            // Swipe: open with left-swipe on profile; close with right-swipe on panel
            function isMobile(){ return window.matchMedia('(max-width: 767.98px)').matches; }
            let xStart=null, yStart=null;
            function touchStart(e){ const t=e.touches[0]; xStart=t.clientX; yStart=t.clientY; }
            function touchMoveOpen(e){ if (xStart===null) return; const t=e.touches[0]; const xDiff=xStart - t.clientX, yDiff=yStart - t.clientY; if (Math.abs(xDiff)>Math.abs(yDiff) && xDiff>40){ openPanel(); xStart=yStart=null; } }
            function touchMoveClose(e){ if (xStart===null) return; const t=e.touches[0]; const xDiff=xStart - t.clientX, yDiff=yStart - t.clientY; if (Math.abs(xDiff)>Math.abs(yDiff) && xDiff<-40){ closePanel(); xStart=yStart=null; } }
            if (isMobile()){
                const profile = document.querySelector(`.pro-profile-container.post-${cfg.postId}`) || document.querySelector('.pro-profile-container');
                profile?.addEventListener('touchstart', touchStart, {passive:true});
                profile?.addEventListener('touchmove',  touchMoveOpen, {passive:true});
                panel.addEventListener('touchstart', touchStart, {passive:true});
                panel.addEventListener('touchmove',  touchMoveClose, {passive:true});
            }

            // ===== Actions (copy/share/etc.) =====
            function enc(s){ return encodeURIComponent(s); }
            const waInput = document.getElementById('mecard-wa-msisdn');
            const waFeedback = document.getElementById('mecard-wa-feedback');
            const waButton = panel.querySelector('button[data-action="whatsapp-number"]');
            const waStorageCountryKey = 'mecard.share.whatsapp.country';
            const defaultCountry = (cfg.defaultCountry || 'za').toLowerCase();
            let waIti = null;
            let waLastOpenAt = 0;

            function getBrowserCountryHint() {
                const lang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
                const localeMatch = String(lang).match(/-([A-Za-z]{2})$/);
                if (localeMatch) return localeMatch[1].toLowerCase();

                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
                const tzMap = {
                    'Africa/Johannesburg': 'za',
                    'Europe/London': 'gb',
                    'America/New_York': 'us',
                    'America/Chicago': 'us',
                    'America/Denver': 'us',
                    'America/Los_Angeles': 'us',
                    'Australia/Sydney': 'au',
                    'Pacific/Auckland': 'nz'
                };
                return tzMap[tz] || '';
            }

            function setWaFeedback(message, isError) {
                if (!waFeedback) return;
                waFeedback.hidden = !message;
                waFeedback.textContent = message || '';
                waFeedback.classList.toggle('text-success', !!message && !isError);
                waFeedback.classList.toggle('text-danger', !!message && !!isError);
                if (waInput) {
                    waInput.classList.toggle('is-invalid', !!message && !!isError);
                    waInput.classList.toggle('is-valid', !!message && !isError);
                }
            }

            function clearWhatsappInput() {
                if (!waInput) return;
                waInput.value = '';
                setWaFeedback('', false);
            }

            function sanitizeInternationalValue(raw) {
                return String(raw || '').trim().replace(/[^\d+]/g, '').replace(/^00/, '+');
            }

            function sanitizeNationalValue(raw) {
                return String(raw || '').replace(/[^\d]/g, '');
            }

            function syncInputCountryFromValue() {
                if (!waInput || !waIti) return;
                const raw = sanitizeInternationalValue(waInput.value);
                if (!raw) return;
                if (raw.charAt(0) === '+') {
                    waIti.setNumber(raw);
                }
            }

            function fallbackWaNumber() {
                if (!waInput || !waIti) return '';
                const country = waIti.getSelectedCountryData() || {};
                const national = sanitizeNationalValue(waInput.value);
                if (!national || !country.dialCode) return '';

                let local = national;
                if (local.charAt(0) === '0') {
                    local = local.slice(1);
                }

                const digits = `${country.dialCode}${local}`.replace(/[^\d]/g, '');
                return digits.length >= 8 ? digits : '';
            }

            function getWhatsappDigits() {
                if (!waInput || !waIti) return '';
                syncInputCountryFromValue();

                if (window.intlTelInputUtils && typeof waIti.getNumber === 'function') {
                    const e164 = waIti.getNumber(window.intlTelInputUtils.numberFormat.E164) || '';
                    return e164.replace(/[^\d]/g, '');
                }

                return fallbackWaNumber();
            }

            function validateWhatsappNumber(showValidState) {
                if (!waInput || !waIti) return false;

                if (!sanitizeNationalValue(waInput.value)) {
                    setWaFeedback('', false);
                    return false;
                }

                syncInputCountryFromValue();

                if (window.intlTelInputUtils && typeof waIti.isValidNumber === 'function') {
                    const isValid = waIti.isValidNumber();
                    setWaFeedback(isValid ? (showValidState ? cfg.i18n.waValid : '') : cfg.i18n.invalidMsisdn, !isValid);
                    return isValid;
                }

                const fallbackDigits = fallbackWaNumber();
                const isFallbackValid = fallbackDigits.length >= 8;
                setWaFeedback(isFallbackValid ? (showValidState ? cfg.i18n.waValid : '') : cfg.i18n.invalidMsisdn, !isFallbackValid);
                return isFallbackValid;
            }

            function openWhatsappFromPanel(e) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }

                if (!waInput || !waIti) {
                    alert(cfg.i18n.invalidMsisdn);
                    return;
                }

                const isValid = validateWhatsappNumber(true);
                const waDigits = isValid ? getWhatsappDigits() : '';
                if (!waDigits) {
                    alert(cfg.i18n.invalidMsisdn);
                    return;
                }

                if (window.localStorage) {
                    const selected = waIti.getSelectedCountryData();
                    if (selected && selected.iso2) {
                        localStorage.setItem(waStorageCountryKey, selected.iso2);
                    }
                }

                waLastOpenAt = Date.now();
                clearWhatsappInput();
                window.open(`https://wa.me/${waDigits}?text=${enc(`Hi, here is my contact card: ${cfg.url}`)}`,'_blank','noopener');
            }

            if (waInput && window.intlTelInput) {
                const lastCountry = (window.localStorage && localStorage.getItem(waStorageCountryKey)) || '';
                waIti = window.intlTelInput(waInput, {
                    initialCountry: lastCountry || 'auto',
                    preferredCountries: ['za', 'gb', 'us'],
                    autoPlaceholder: 'polite',
                    countrySearch: true,
                    dropdownContainer: document.body,
                    nationalMode: true,
                    separateDialCode: true,
                    utilsScript: cfg.intlTelInputUtilsUrl,
                    geoIpLookup: function (success, failure) {
                        const hintedCountry = getBrowserCountryHint();
                        fetch('https://ipapi.co/json/')
                            .then(function (response) {
                                return response.ok ? response.json() : Promise.reject(new Error('geo lookup failed'));
                            })
                            .then(function (data) {
                                success((data && data.country_code ? data.country_code : hintedCountry || defaultCountry).toLowerCase());
                            })
                            .catch(function () {
                                if (hintedCountry) {
                                    success(hintedCountry);
                                    return;
                                }
                                success(defaultCountry);
                                if (typeof failure === 'function') failure();
                            });
                    }
                });

                waInput.addEventListener('blur', function () {
                    validateWhatsappNumber(true);
                });
                waInput.addEventListener('input', function () {
                    setWaFeedback('', false);
                });
                waInput.addEventListener('change', function () {
                    validateWhatsappNumber(false);
                });
                waInput.addEventListener('paste', function () {
                    window.setTimeout(function () {
                        syncInputCountryFromValue();
                        validateWhatsappNumber(false);
                    }, 0);
                });
                waInput.addEventListener('countrychange', function () {
                    const selected = waIti.getSelectedCountryData();
                    if (window.localStorage && selected && selected.iso2) {
                        localStorage.setItem(waStorageCountryKey, selected.iso2);
                    }
                    validateWhatsappNumber(false);
                });
            }

            waButton?.addEventListener('pointerdown', function (e) {
                openWhatsappFromPanel(e);
            });
            waButton?.addEventListener('click', function (e) {
                if ((Date.now() - waLastOpenAt) < 500) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                e.preventDefault();
                e.stopPropagation();

                if (!waInput || !waIti) {
                    alert(cfg.i18n.invalidMsisdn);
                    return;
                }

                const isValid = validateWhatsappNumber(true);
                const waDigits = isValid ? getWhatsappDigits() : '';
                if (!waDigits) {
                    alert(cfg.i18n.invalidMsisdn);
                    return;
                }

                if (window.localStorage) {
                    const selected = waIti.getSelectedCountryData();
                    if (selected && selected.iso2) {
                        localStorage.setItem(waStorageCountryKey, selected.iso2);
                    }
                }

                window.open(`https://wa.me/${waDigits}?text=${enc(`Hi, hereâ€™s my profile: ${cfg.url}`)}`,'_blank','noopener');
            });

            panel.addEventListener('click', function(e){
                const btn = e.target.closest('button[data-action]'); if (!btn) return;
                const action = btn.getAttribute('data-action');
                if (action === 'whatsapp-number') return;

                if (action === 'download-qr') {
                    const img = qrContainer.querySelector('img');
                    const canvas = qrContainer.querySelector('canvas');
                    const dl = (uri,name)=>{ const a=document.createElement('a'); a.href=uri; a.download=name; document.body.appendChild(a); a.click(); a.remove(); };
                    if (canvas) dl(canvas.toDataURL('image/png'),'mecard-qr.png');
                    else if (img?.src) dl(img.src,'mecard-qr.png');
                }
                if (action === 'whatsapp-number') {
                    const input = document.getElementById('mecard-wa-msisdn');
                    const raw = (input?.value||'').replace(/[^\d]/g,'');
                    if (!raw || raw.length<8) { alert(cfg.i18n.invalidMsisdn); return; }
                    window.open(`https://wa.me/${raw}?text=${enc(`Hi, here’s my profile: ${cfg.url}`)}`,'_blank','noopener');
                }
                if (action === 'native-share') {
                    const data = { title: document.title||'My profile', text: 'Here’s my smart business card:', url: cfg.url };
                    if (navigator.share) navigator.share(data).catch(()=>{});
                    else navigator.clipboard?.writeText(cfg.url).then(()=>{ btn.innerHTML='<i class="fas fa-check"></i> Copied'; setTimeout(()=>btn.innerHTML='<i class="fas fa-share-alt"></i> Share link',1200); }).catch(()=>alert(cfg.i18n.copyFail));
                }
                if (action === 'copy-link') {
                    if (!navigator.clipboard) return alert(cfg.i18n.copyFail);
                    navigator.clipboard.writeText(cfg.url).then(()=>{ btn.innerHTML='<i class="fas fa-check"></i> Copied'; setTimeout(()=>btn.innerHTML='<i class="fas fa-link"></i> Copy link',1200); }).catch(()=>alert(cfg.i18n.copyFail));
                }
                if (action === 'email') {
                    const subject = 'My smart business card';
                    const body = `Hi,%0D%0A%0D%0AHere’s my profile:%0D%0A${enc(cfg.url)}`;
                    window.location.href = `mailto:?subject=${enc(subject)}&body=${body}`;
                }
                if (action === 'sms') {
                    const body = enc(`My profile: ${cfg.url}`);
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    window.location.href = isIOS ? `sms:&body=${body}` : `sms:?body=${body}`;
                }
            });

            // ===== Add to Home Screen (PWA) =====
            const card        = document.getElementById('mecard-a2hs-card');
            const andrWrap    = document.getElementById('mecard-a2hs-android');
            const iosWrap     = document.getElementById('mecard-a2hs-ios');
            const installedEl = document.getElementById('mecard-a2hs-installed');
            const installBtn  = document.getElementById('mecard-a2hs-install-btn');

            // show/hide helpers
            const show = el => el && (el.style.display = '');
            const hide = el => el && (el.style.display = 'none');

            // iOS detect (Safari standalone support)
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

            // Register SW if provided (must be at site root for full scope)
        // after: navigator.serviceWorker.register(cfg.swUrl)
        if ('serviceWorker' in navigator && cfg.swUrl) {
            navigator.serviceWorker.register(cfg.swUrl).then(() => {
                return navigator.serviceWorker.ready;
            }).then(() => {
                const controlled = !!navigator.serviceWorker.controller;
                if (!controlled) {
                    // First load after registration; A2HS won’t be eligible yet.
                    // Show a lightweight toast asking to reload.
                    const toast = document.createElement('div');
                    toast.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:80px;z-index:10050;background:#333;color:#fff;padding:8px 12px;border-radius:8px;font-size:14px';
                    toast.textContent = 'Almost ready—please reload once to enable “Add to Home screen”.';
                    document.body.appendChild(toast);
                    setTimeout(()=>toast.remove(), 4500);
                }
            }).catch(()=>{ /* ignore */ });
        }


        // Android path: use beforeinstallprompt
        //     let deferredPrompt = null;
        //     window.addEventListener('beforeinstallprompt', (e) => {
        //         // Page is installable (manifest + SW in scope). Intercept and show our UI.
        //         e.preventDefault();
        //         deferredPrompt = e;
        //         show(card); hide(iosWrap); hide(installedEl); show(andrWrap);
        //     });

        let deferredPrompt = null;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();                 // stop auto-banner
            window.MECARD_BIP = e;              // save for later use
            // reveal your Android install card/button
            document.getElementById('mecard-a2hs-card')?.style.removeProperty('display');
            document.getElementById('mecard-a2hs-android')?.style.removeProperty('display');
            document.getElementById('mecard-a2hs-ios')?.style.setProperty('display','none');
        }, { once: true });                    // avoid overwriting after use


        document.getElementById('mecard-a2hs-install-btn')?.addEventListener('click', async () => {
            const e = window.MECARD_BIP;
            if (!e) {
                // Fallback if the event isn’t available (Samsung/Chrome sometimes won’t fire it)
                alert('If you don’t see an install prompt, open Chrome menu (⋮) → “Install app”.');
                return;
            }
            e.prompt();                          // <-- THIS shows the install prompt
            const { outcome } = await e.userChoice;
            // Optional: analytics/UI
            if (outcome === 'accepted') {
                document.getElementById('mecard-a2hs-android')?.style.setProperty('display','none');
                document.getElementById('mecard-a2hs-installed')?.style.removeProperty('display');
            }
            window.MECARD_BIP = null;            // can only be used once
        });


        // When already installed
            window.addEventListener('appinstalled', () => {
                show(card); hide(iosWrap); hide(andrWrap); show(installedEl);
            });

            const isDesktopReview = !isIOS && !window.matchMedia('(max-width: 767.98px)').matches;
            let guidedInstallRequest = false;
            try {
                const parsedUrl = new URL(window.location.href);
                guidedInstallRequest = parsedUrl.searchParams.get('me_share') === '1' && parsedUrl.searchParams.get('me_share_target') === 'install';
            } catch (err) {
                guidedInstallRequest = false;
            }

            // iOS: show instructions if not installed
            if (isIOS && !isStandalone) { show(card); show(iosWrap); hide(andrWrap); }
            if (isDesktopReview) { show(card); show(iosWrap); show(andrWrap); }
            if (guidedInstallRequest && !isIOS && !isDesktopReview) { show(card); show(andrWrap); }

            // Install button (Android)
            installBtn?.addEventListener('click', async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
                if (outcome === 'accepted') {
                    hide(andrWrap); show(installedEl);
                }
            });

            maybeOpenGuidedShareInstall();


    }

});

async function downloadImage(imageSrc, filename,button) {
    const image = await fetch(imageSrc)
    const imageBlog = await image.blob()
    const imageURL = URL.createObjectURL(imageBlog)

    const link = document.createElement('a')
    link.href = imageURL
    link.download = 'qr-' + filename.replace(/\s+/g, '-').toLowerCase()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

/**
 * mecard-homepage.js
 * Homepage interactions for mecard.co.za
 * Enqueue in child theme: wp_enqueue_script('mc-homepage', ..., [], '1.0', true)
 * Dependencies: none (vanilla JS)
 */

(function () {
    'use strict';

    /* ── Scroll-reveal animation ── */
    function initReveal() {
        var els = document.querySelectorAll('.mc-reveal');
        if (!els.length) return;

        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
        );

        els.forEach(function (el, i) {
            /* Stagger sibling reveals slightly */
            el.style.transitionDelay = (i % 3) * 80 + 'ms';
            observer.observe(el);
        });
    }

    /* ── Smooth scroll for on-page anchor links ── */
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                var hash = this.getAttribute('href');
                if (hash.length < 2) return; /* ignore bare "#" */

                var target = document.querySelector(hash);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

                    /* Update URL hash without jumping */
                    if (history.pushState) {
                        history.pushState(null, null, hash);
                    }
                }
            });
        });
    }

    /* ── Init on DOM ready ── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initReveal();
            initSmoothScroll();
        });
    } else {
        initReveal();
        initSmoothScroll();
    }
})();
