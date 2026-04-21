(function ($) {
    var state = {
        profileId: 0,
        flow: "classic",
        editMode: "",
        editCardId: 0,
        newCardExpanded: false,
        payload: null,
        currentCustomCardId: 0,
        mediaFrame: null,
        dragging: null
    };

    var ui = {};

    function cacheDom() {
        ui.page = $(".me-single-cards-page");
        if (!ui.page.length) {
            return false;
        }

        state.profileId = parseInt(ui.page.data("profile-id"), 10) || 0;
        ui.status = $("#me_single_cards_status");
        ui.modePanel = $("#me_single_cards_mode_panel");
        ui.modeToggle = $("#me_single_cards_mode_toggle");
        ui.expandNewButton = $("#me_single_cards_expand_new");
        ui.listWrap = $("#me_single_cards_list");
        ui.listToggle = $("#me_single_cards_list_toggle");
        ui.showListButton = $("#me_single_cards_show_list");
        ui.switchButtons = $(".me-single-cards__switch-btn");
        ui.classicPanel = $("#me_single_cards_classic");
        ui.customPanel = $("#me_single_cards_custom");
        ui.classicLogo = $("#me_single_cards_classic_logo");
        ui.classicName = $("#me_single_cards_classic_name");
        ui.classicJob = $("#me_single_cards_classic_job");
        ui.classicTitle = $("#me_single_cards_classic_title");
        ui.classicCopy = $("#me_single_cards_classic_copy");
        ui.classicCta = $("#me_single_cards_classic_cta");
        ui.classicNotice = $("#me_single_cards_classic_notice");
        ui.classicForm = $("#meSingleCardsClassicForm");
        ui.classicCardIdInput = $("#me_single_cards_classic_card_id");
        ui.classicFrontInput = $("#me_single_cards_classic_front");
        ui.classicLogoPreview = $("#me_single_cards_classic_logo_preview");
        ui.classicNameInput = $("#me_single_cards_classic_name_input");
        ui.classicJobInput = $("#me_single_cards_classic_job_input");
        ui.classicSaveButton = $("#me_single_cards_classic_save");
        ui.classicDoneButton = $("#me_single_cards_done_editing_classic");
        ui.customNotice = $("#me_single_cards_custom_notice");
        ui.customTitle = $("#me_single_cards_custom_title");
        ui.customCopy = $("#me_single_cards_custom_copy");
        ui.openList = $("#me_single_cards_open_list");
        ui.form = $("#meSingleCardsCustomForm");
        ui.cardIdInput = $("#me_single_cards_card_id");
        ui.frontInput = $("#me_single_cards_front");
        ui.backInput = $("#me_single_cards_back");
        ui.labelInput = $("#me_single_cards_label");
        ui.frontPreview = $("#me_single_cards_front_preview");
        ui.backPreview = $("#me_single_cards_back_preview");
        ui.frontError = $("#me_single_cards_front_error");
        ui.backError = $("#me_single_cards_back_error");
        ui.validationSummary = $("#me_single_cards_validation_summary");
        ui.customBackImage = $("#me_single_cards_custom_back_image");
        ui.customPreview = $("#me_single_cards_custom_preview");
        ui.qrShell = $("#me_single_cards_qr_shell");
        ui.qrCode = $("#me_single_cards_qr_code");
        ui.qrResize = $("#me_single_cards_qr_resize");
        ui.widthInput = $("#me_single_cards_qr_width");
        ui.xInput = $("#me_single_cards_qr_x");
        ui.yInput = $("#me_single_cards_qr_y");
        ui.qrColourInput = $("#me_single_cards_qr_colour");
        ui.qrFillInput = $("#me_single_cards_qr_fill");
        ui.saveButton = $("#me_single_cards_save");
        ui.submitButton = $("#me_single_cards_submit");
        ui.customDoneButton = $("#me_single_cards_done_editing_custom");
        ui.list = $("#me_single_cards_list_body");
        return true;
    }

    function getRequestedFlow() {
        var params = new URLSearchParams(window.location.search);
        var flow = params.get("flow") || params.get("card-flow") || "";
        if (flow === "custom-design") {
            return "custom";
        }
        return flow === "custom" ? "custom" : "classic";
    }

    function readEditState() {
        var params = new URLSearchParams(window.location.search);
        var edit = params.get("edit") || "";
        var cardId = parseInt(params.get("card_id"), 10) || 0;

        if (edit !== "classic" && edit !== "custom") {
            edit = "";
            cardId = 0;
        }

        state.editMode = edit;
        state.editCardId = cardId;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function updateQuery(params) {
        var url = new URL(window.location.href);

        url.searchParams.delete("edit");
        url.searchParams.delete("card_id");
        url.searchParams.delete("flow");

        Object.keys(params || {}).forEach(function (key) {
            if (params[key] !== null && typeof params[key] !== "undefined" && params[key] !== "") {
                url.searchParams.set(key, params[key]);
            }
        });

        window.history.replaceState({}, "", url.toString());
    }

    function enterEditMode(mode, cardId) {
        state.editMode = mode === "custom" ? "custom" : "classic";
        state.editCardId = parseInt(cardId, 10) || 0;
        state.newCardExpanded = true;

        if (state.editMode === "classic") {
            fillClassicCard(state.editCardId);
        } else {
            fillCustomCard(state.editCardId);
        }

        updateQuery({
            edit: state.editMode,
            card_id: state.editCardId,
            profile_id: state.profileId
        });

        applyFlow(state.editMode === "custom" ? "custom" : "classic");
        window.requestAnimationFrame(function () {
            document.getElementById(state.editMode === "custom" ? "me_single_cards_custom" : "me_single_cards_classic").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    }

    function exitEditMode() {
        state.editMode = "";
        state.editCardId = 0;
        state.newCardExpanded = listCurrentCards().length ? false : true;
        updateQuery({
            profile_id: state.profileId,
            flow: state.flow
        });
        applyFlow(state.flow || "classic");
    }

    function setStatus(message, type) {
        if (!ui.status.length) {
            return;
        }

        ui.status
            .removeClass("is-error is-success is-loading")
            .text(message || "");

        if (type) {
            ui.status.addClass("is-" + type);
        }
    }

    function setValidationSummary(message) {
        if (!ui.validationSummary || !ui.validationSummary.length) {
            return;
        }
        ui.validationSummary.text(message || "").prop("hidden", !message);
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getUploadErrorNode(target) {
        return target === "front" ? ui.frontError : ui.backError;
    }

    function clearUploadError(target) {
        var $error = getUploadErrorNode(target);
        $error.text("").prop("hidden", true);
    }

    function setUploadError(target, message) {
        var $error = getUploadErrorNode(target);
        $error.text(message || "").prop("hidden", !message);
    }

    function attachmentSizeInBytes(image) {
        return Number(image.filesizeInBytes || image.filesize || 0) || 0;
    }

    function validateAttachment(target, image) {
        var mime = String(image.mime || image.subtype || "").toLowerCase();
        var bytes = attachmentSizeInBytes(image);

        clearUploadError(target);

        if (mime !== "image/png" && mime !== "image/jpeg" && mime !== "image/jpg") {
            setUploadError(target, "Please upload a PNG or JPG image.");
            return false;
        }

        if (bytes && bytes > 2 * 1024 * 1024) {
            setUploadError(target, "Please keep the file size under 2MB.");
            return false;
        }

        return true;
    }

    function validateArtworkDimensions(target, image) {
        var width = Number(image.width || 0);
        var height = Number(image.height || 0);
        var adjustedWidth;

        if (!width || !height) {
            clearUploadError(target);
            return true;
        }

        adjustedWidth = Math.round((width / height) * 540);
        if (adjustedWidth > 858) {
            setUploadError(target, "Your image is too wide for its height. It should be 856 x 540 but it behaves more like " + adjustedWidth + " x 540.");
            return false;
        }

        if (adjustedWidth < 854) {
            setUploadError(target, "Your image is too narrow for its height. It should be 856 x 540 but it behaves more like " + adjustedWidth + " x 540.");
            return false;
        }

        clearUploadError(target);
        return true;
    }

    function validateDimensionsFromElement(target, imageEl) {
        validateArtworkDimensions(target, {
            width: imageEl.naturalWidth || 0,
            height: imageEl.naturalHeight || 0
        });
    }

    function loadPayload(message) {
        setStatus(message || "Loading your cards...", "loading");
        setValidationSummary("");

        $.post(ME_SINGLE_CARDS.ajaxurl, {
            action: "me_single_cards_load",
            _wpnonce: ME_SINGLE_CARDS.nonce,
            post_id: state.profileId
        }).done(function (response) {
            if (!response || !response.success) {
                setStatus((response && response.data && response.data.message) || "We could not load your cards.", "error");
                return;
            }

            state.payload = response.data;
            hydrate();
            setStatus("", null);
            setValidationSummary("");
        }).fail(function () {
            setStatus("We could not load your cards right now. Please try again.", "error");
        });
    }

    function listCards() {
        return (state.payload && state.payload.cards) || [];
    }

    function listCustomCards() {
        return listCards().filter(function (card) {
            return card.type === "contactcard";
        });
    }

    function listCurrentCards() {
        return listCards().filter(function (card) {
            return !!card.showInCurrent;
        });
    }

    function findCardById(cardId) {
        return listCards().find(function (card) {
            return parseInt(card.id, 10) === parseInt(cardId, 10);
        }) || null;
    }

    function hydrate() {
        if (!listCurrentCards().length) {
            state.newCardExpanded = true;
        }
        renderClassic();
        renderCardsList();
        fillClassicCard();
        fillCustomCard();
        applyFlow(state.flow);
        applyEditMode();
    }

    function renderClassic() {
        var profile = state.payload.profile || {};
        var logo = profile.companyLogoRaw || profile.companyLogoUrl || ME_SINGLE_CARDS.images.companyPlaceholder;
        var currentClassicCount = listCurrentCards().filter(function (card) {
            return card.type === "classiccard";
        }).length;

        ui.classicLogo.attr("src", logo);
        ui.classicName.text(profile.name || "Your name");
        ui.classicJob.text(profile.job || "Job title");
        ui.classicNotice
            .text(currentClassicCount ? "You already have a classic card on the go. Open it above to avoid duplicates." : "")
            .prop("hidden", !currentClassicCount);
        ui.classicCta
            .text("Add to basket")
            .attr("href", state.payload.classicCardUrl || "#");
    }

    function fillClassicCard(cardId) {
        var cards = listCards().filter(function (card) {
            return card.type === "classiccard";
        });
        var profile = state.payload.profile || {};
        var selected = null;

        if (cardId) {
            selected = cards.find(function (card) {
                return parseInt(card.id, 10) === parseInt(cardId, 10);
            }) || null;
        }

        if (!selected && cards.length) {
            selected = cards.find(function (card) {
                return !!card.editable;
            }) || cards[0];
        }

        ui.classicCardIdInput.val(selected ? selected.id : "");
        ui.classicFrontInput.val((selected && selected.front) || profile.companyLogoRaw || profile.companyLogoUrl || "");
        ui.classicNameInput.val((selected && selected.nameOnCard) || profile.name || "");
        ui.classicJobInput.val((selected && selected.jobTitleOnCard) || profile.job || "");
        updateImagePreview(ui.classicLogoPreview, ui.classicFrontInput.val(), ME_SINGLE_CARDS.images.companyPlaceholder);
    }

    function applyEditMode() {
        var targetCard = state.editCardId ? findCardById(state.editCardId) : null;
        var isEditing = !!state.editMode;
        var isClassicEdit = state.editMode === "classic";
        var isCustomEdit = state.editMode === "custom";
        var hasCards = listCurrentCards().length > 0;

        if (isEditing && (!targetCard || !targetCard.editable)) {
            isEditing = false;
            isClassicEdit = false;
            isCustomEdit = false;
            state.editMode = "";
            state.editCardId = 0;
            updateQuery({
                profile_id: state.profileId,
                flow: state.flow
            });
        }

        ui.page.toggleClass("is-editing", isEditing);
        ui.modePanel.toggleClass("is-editing-mode", isEditing);
        ui.modePanel.toggleClass("is-collapsed", hasCards && !state.newCardExpanded && !isEditing);
        ui.modeToggle.prop("hidden", !(hasCards && !state.newCardExpanded && !isEditing));
        ui.listWrap.toggleClass("is-collapsed", hasCards && (state.newCardExpanded || isEditing));
        ui.listToggle.prop("hidden", !(hasCards && (state.newCardExpanded || isEditing)));
        ui.list.prop("hidden", hasCards && (state.newCardExpanded || isEditing));

        ui.classicForm.prop("hidden", !isClassicEdit);
        ui.classicCta.closest(".me-single-cards__panel-actions").prop("hidden", isClassicEdit);
        ui.classicTitle.text(isClassicEdit ? "Edit this classic card" : "Fastest option");
        ui.classicCopy.text(isClassicEdit ? "Update the logo, name, and job title on this classic card." : "We’ll use the details already on your profile: logo, name, and job title.");

        ui.customDoneButton.prop("hidden", !isCustomEdit);
        ui.submitButton.prop("hidden", false);
        ui.customTitle.text(isCustomEdit ? "Edit this custom design" : "Upload and configure your design");
    }

    function fillCustomCard(cardId) {
        var customCards = listCustomCards();
        var profile = state.payload.profile || {};
        var selected = null;

        if (cardId) {
            selected = customCards.find(function (card) {
                return parseInt(card.id, 10) === parseInt(cardId, 10);
            }) || null;
        }

        if (!selected && state.currentCustomCardId) {
            selected = customCards.find(function (card) {
                return parseInt(card.id, 10) === parseInt(state.currentCustomCardId, 10);
            }) || null;
        }

        if (!selected && customCards.length) {
            selected = customCards.find(function (card) {
                return !!card.editable;
            }) || customCards[0];
        }

        state.currentCustomCardId = selected ? parseInt(selected.id, 10) : 0;
        ui.customNotice
            .text(listCurrentCards().filter(function (card) { return card.type === "contactcard"; }).length ? "You already have a custom card in progress. Continue that design above unless you want to start another one." : "")
            .prop("hidden", !listCurrentCards().filter(function (card) { return card.type === "contactcard"; }).length);

        ui.cardIdInput.val(selected ? selected.id : "");
        ui.labelInput.val((selected && selected.label) || profile.cardLabel || "");
        ui.frontInput.val((selected && selected.front) || "");
        ui.backInput.val((selected && selected.back) || "");
        ui.widthInput.val((selected && selected.qrWidth) || 96);
        ui.xInput.val((selected && typeof selected.qrX !== "undefined") ? selected.qrX : 40);
        ui.yInput.val((selected && typeof selected.qrY !== "undefined") ? selected.qrY : 40);
        ui.qrColourInput.val((selected && selected.qrColour) || "#000000");
        ui.qrFillInput.val((selected && selected.qrFill) || "#ffffff");

        updateImagePreview(ui.frontPreview, ui.frontInput.val());
        updateImagePreview(ui.backPreview, ui.backInput.val());
        clearUploadError("front");
        clearUploadError("back");
        setValidationSummary("");
        updateBackPreview();
        updateQrPreview();
    }

    function updateImagePreview($img, value, placeholderSrc) {
        var isPlaceholder = !value;
        var $frame = $img.closest(".me-single-cards__upload-frame");
        var fallback = placeholderSrc || ME_SINGLE_CARDS.images.cardPlaceholder;

        $frame.toggleClass("is-placeholder", isPlaceholder);
        $img.attr("src", isPlaceholder ? fallback : value);
        $img.off("load.meSingleCards").on("load.meSingleCards", function () {
            if (isPlaceholder) {
                clearUploadError($img.is(ui.frontPreview) ? "front" : "back");
                return;
            }
            validateDimensionsFromElement($img.is(ui.frontPreview) ? "front" : "back", this);
        });
    }

    function updateBackPreview() {
        var value = ui.backInput.val() || "";
        ui.customPreview.toggleClass("is-empty", !value);
        ui.customBackImage.attr("src", value);
    }

    function renderQrCode() {
        if (!ui.qrCode.length || typeof QRCode === "undefined") {
            return;
        }

        ui.qrCode.empty();

        new QRCode(ui.qrCode.get(0), {
            text: ((state.payload && state.payload.profile && state.payload.profile.profileUrl) || window.location.href),
            width: 256,
            height: 256,
            colorDark: ui.qrColourInput.val() || "#000000",
            colorLight: ui.qrFillInput.val() || "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    function updateQrPreview() {
        var width = parseInt(ui.widthInput.val(), 10) || 96;
        var x = parseInt(ui.xInput.val(), 10) || 0;
        var y = parseInt(ui.yInput.val(), 10) || 0;
        var previewWidth = ui.customPreview.innerWidth() || 320;
        var previewHeight = ui.customPreview.innerHeight() || 202;

        width = clamp(width, 64, Math.min(previewWidth, previewHeight) || width);
        x = clamp(x, 0, Math.max(0, previewWidth - width));
        y = clamp(y, 0, Math.max(0, previewHeight - width));

        ui.widthInput.val(width);
        ui.xInput.val(x);
        ui.yInput.val(y);

        ui.qrShell.css({
            width: width + "px",
            height: width + "px",
            left: x + "px",
            top: y + "px"
        });

        renderQrCode();
    }

    function applyFlow(flow) {
        state.flow = flow === "custom" ? "custom" : "classic";

        ui.switchButtons.removeClass("is-active").attr("aria-selected", "false");
        ui.switchButtons.filter('[data-flow="' + state.flow + '"]').addClass("is-active").attr("aria-selected", "true");

        ui.classicPanel.prop("hidden", state.flow !== "classic").toggleClass("is-active", state.flow === "classic");
        ui.customPanel.prop("hidden", state.flow !== "custom").toggleClass("is-active", state.flow === "custom");

        if (state.flow === "custom") {
            window.requestAnimationFrame(updateQrPreview);
        }
    }

    function renderCardsList() {
        var cards = listCurrentCards();
        var basket = state.payload.basket || {};
        var $listPanel = $("#me_single_cards_list");
        var currentClassicCount = cards.filter(function (card) {
            return card.type === "classiccard";
        }).length;
        var currentCustomCount = cards.filter(function (card) {
            return card.type === "contactcard";
        }).length;

        if (!cards.length) {
            $listPanel.prop("hidden", true);
            ui.openList.prop("hidden", true);
            ui.classicNotice.prop("hidden", true).text("");
            ui.customNotice.prop("hidden", true).text("");
            return;
        }

        $listPanel.prop("hidden", false);
        ui.openList.prop("hidden", false);
        var groups = [
            {
                key: "basket",
                title: "In your basket",
                description: "These cards are ready to check out or keep editing before you pay.",
                cards: cards.filter(function (card) { return !!card.isInBasket; })
            },
            {
                key: "progress",
                title: "In progress",
                description: "These cards are saved, submitted, or moving through production.",
                cards: cards.filter(function (card) { return !card.isInBasket && !card.shipped; })
            },
            {
                key: "live",
                title: "Live",
                description: "These cards have already shipped.",
                cards: cards.filter(function (card) { return !!card.shipped; })
            }
        ].filter(function (group) {
            return group.cards.length > 0;
        });

        ui.list.html(groups.map(function (group) {
            var groupActions = "";
            if (group.key === "basket" && basket.basketUrl) {
                groupActions = '<a class="me-single-cards__button me-single-cards__button--primary" href="' + escapeHtml(basket.basketUrl) + '">View basket</a>';
            }

            return '' +
                '<section class="me-single-cards__status-group me-single-cards__panel">' +
                    '<div class="me-single-cards__status-group-head">' +
                        '<div class="me-single-cards__panel-head">' +
                            '<p class="me-single-cards__panel-kicker">Current cards</p>' +
                            '<h2>' + escapeHtml(group.title) + '</h2>' +
                            '<p>' + escapeHtml(group.description) + '</p>' +
                        '</div>' +
                    '</div>' +
                    '<div class="me-single-cards__status-group-list">' +
                        group.cards.map(function (card) {
            var typeLabel = card.type === "contactcard" ? "Custom design" : "Classic card";
            var actions = [];
            var previewMarkup = "";

            if (card.type === "contactcard") {
                if (card.editable) {
                    actions.push('<button type="button" class="me-single-cards__button me-single-cards__button--secondary" data-action="edit-custom" data-card-id="' + card.id + '">Continue editing</button>');
                }
                previewMarkup =
                    '<div class="me-single-cards__list-preview me-single-cards__list-preview--custom">' +
                        '<div class="me-single-cards__custom-card-preview-frame' + (card.front ? '' : ' is-placeholder') + '">' +
                            '<img src="' + escapeHtml(card.front || ME_SINGLE_CARDS.images.cardPlaceholder) + '" alt="' + escapeHtml(card.label || typeLabel) + '">' +
                        '</div>' +
                    '</div>';
            } else {
                if (card.editable) {
                    actions.push('<button type="button" class="me-single-cards__button me-single-cards__button--secondary" data-action="edit-classic" data-card-id="' + card.id + '">Edit card</button>');
                }
                previewMarkup =
                    '<div class="me-single-cards__list-preview me-single-cards__list-preview--classic">' +
                        '<div class="me-single-cards__classic-preview me-single-cards__classic-preview--list card-front classic">' +
                            '<div class="classic-logo">' +
                                '<img src="' + escapeHtml(card.front || ME_SINGLE_CARDS.images.companyPlaceholder || ME_SINGLE_CARDS.images.cardPlaceholder) + '" alt="' + escapeHtml(card.label || typeLabel) + '">' +
                            '</div>' +
                            '<div class="classic-name">' + escapeHtml(card.nameOnCard || card.label || "Your Name") + '</div>' +
                            '<div class="classic-job-title">' + escapeHtml(card.jobTitleOnCard || "Your title") + '</div>' +
                        '</div>' +
                    '</div>';
            }

            return '' +
                '<article class="me-single-cards__list-item">' +
                    previewMarkup +
                    '<div class="me-single-cards__list-body">' +
                        '<strong>' + escapeHtml(card.label || typeLabel) + '</strong>' +
                        '<p>' + escapeHtml(typeLabel) + ' - ' + escapeHtml(card.statusLabel || "Draft") + '</p>' +
                        '<div class="me-single-cards__list-actions">' + actions.join("") + '</div>' +
                    '</div>' +
                '</article>';
                        }).join("") +
                    '</div>' +
                    (groupActions ? '<div class="me-single-cards__status-group-actions me-single-cards__status-group-actions--footer">' + groupActions + '</div>' : '') +
                '</section>';
        }).join(""));
        ui.classicNotice
            .text(currentClassicCount ? "You already have a classic card on the go. Open it above to avoid duplicates." : "")
            .prop("hidden", !currentClassicCount);
        ui.customNotice
            .text(currentCustomCount ? "You already have a custom card in progress. Continue that design above unless you want to start another one." : "")
            .prop("hidden", !currentCustomCount);
    }

    function openMedia(target) {
        var frameTitle = target === "front" ? "Choose card front artwork" : (target === "back" ? "Choose card back artwork" : "Choose logo");
        var buttonText = target === "front" ? "Use front image" : (target === "back" ? "Use back image" : "Use logo");

        state.mediaFrame = wp.media({
            title: frameTitle,
            multiple: false,
            library: {
                type: "image",
                author: ME_SINGLE_CARDS.currentUserId,
                mecard_owned_only: true
            },
            button: {
                text: buttonText
            }
        });

        state.mediaFrame.on("open", function () {
            var library = state.mediaFrame.state().get("library");
            if (library && library.props) {
                library.props.set({
                    type: "image",
                    author: ME_SINGLE_CARDS.currentUserId,
                    mecard_owned_only: true
                });
            }
        });

        state.mediaFrame.on("select", function () {
            var attachment = state.mediaFrame.state().get("selection").first();
            if (!attachment) {
                return;
            }

            var image = attachment.toJSON();
            if (!validateAttachment(target, image)) {
                setValidationSummary("Please choose a PNG or JPG under 2MB.");
                return;
            }

            validateArtworkDimensions(target, image);

            if (target === "front") {
                ui.frontInput.val(image.url || "");
                updateImagePreview(ui.frontPreview, image.url || "");
            } else if (target === "classic-logo") {
                ui.classicFrontInput.val(image.url || "");
                updateImagePreview(ui.classicLogoPreview, image.url || "", ME_SINGLE_CARDS.images.companyPlaceholder);
                ui.classicLogo.attr("src", image.url || "");
            } else {
                ui.backInput.val(image.url || "");
                updateImagePreview(ui.backPreview, image.url || "");
                updateBackPreview();
            }
        });

        state.mediaFrame.open();
    }

    function saveCustom(submitDesign) {
        var submitText = submitDesign ? "Submitting..." : "Saving...";

        if (!ui.frontInput.val() || !ui.backInput.val()) {
            setValidationSummary("Please upload both the front and back artwork before saving.");
            return;
        }

        setValidationSummary("");
        ui.saveButton.prop("disabled", true).text("Saving...");
        ui.submitButton.prop("disabled", true).text(submitText);

        $.post(ME_SINGLE_CARDS.ajaxurl, {
            action: "me_single_cards_save_custom",
            _wpnonce: ME_SINGLE_CARDS.nonce,
            post_id: state.profileId,
            card_id: ui.cardIdInput.val(),
            "wpcf-card-front": ui.frontInput.val(),
            "wpcf-card-back": ui.backInput.val(),
            "wpcf-card-label": ui.labelInput.val(),
            "wpcf-qr-width": ui.widthInput.val(),
            "wpcf-qr-x": ui.xInput.val(),
            "wpcf-qr-y": ui.yInput.val(),
            "wpcf-qr-code-colour": ui.qrColourInput.val(),
            "wpcf-qr-fill-colour": ui.qrFillInput.val(),
            submit_design: submitDesign ? 1 : 0
        }).done(function (response) {
            if (!response || !response.success) {
                setStatus((response && response.data && response.data.message) || "We could not save this design.", "error");
                return;
            }

            state.payload = response.data;
            state.currentCustomCardId = parseInt(response.data.savedCardId, 10) || state.currentCustomCardId;
            hydrate();
            applyFlow("custom");
            setValidationSummary("");
            setStatus(response.data.message || (submitDesign ? "Design submitted." : "Design saved."), "success");
            if (submitDesign && response.data && response.data.redirectUrl) {
                window.location.assign(response.data.redirectUrl);
            }
        }).fail(function () {
            setStatus("We could not save this design right now. Please try again.", "error");
        }).always(function () {
            ui.saveButton.prop("disabled", false).text("Save design");
            ui.submitButton.prop("disabled", false).text("Submit design");
        });
    }

    function saveClassic() {
        ui.classicSaveButton.prop("disabled", true).text("Saving...");

        $.post(ME_SINGLE_CARDS.ajaxurl, {
            action: "me_single_cards_save_classic",
            _wpnonce: ME_SINGLE_CARDS.nonce,
            post_id: state.profileId,
            card_id: ui.classicCardIdInput.val(),
            "wpcf-card-front": ui.classicFrontInput.val(),
            "wpcf-name-on-card": ui.classicNameInput.val(),
            "wpcf-job-title-on-card": ui.classicJobInput.val()
        }).done(function (response) {
            if (!response || !response.success) {
                setStatus((response && response.data && response.data.message) || "We could not save this card.", "error");
                return;
            }

            state.payload = response.data;
            hydrate();
            setStatus(response.data.message || "Classic card updated.", "success");
            exitEditMode();
        }).fail(function () {
            setStatus("We could not save this card right now. Please try again.", "error");
        }).always(function () {
            ui.classicSaveButton.prop("disabled", false).text("Save changes");
        });
    }

    function startQrDrag(event) {
        if (!ui.qrShell.length || !ui.customPreview.length) {
            return;
        }

        event.preventDefault();

        var shellRect = ui.qrShell.get(0).getBoundingClientRect();
        state.dragging = {
            pointerId: event.pointerId,
            mode: "move",
            captureEl: ui.qrShell.get(0),
            offsetX: event.clientX - shellRect.left,
            offsetY: event.clientY - shellRect.top
        };

        ui.qrShell.addClass("is-dragging");
        ui.qrShell.get(0).setPointerCapture(event.pointerId);
    }

    function moveQrDrag(event) {
        if (!state.dragging || state.dragging.pointerId !== event.pointerId) {
            return;
        }

        var previewRect = ui.customPreview.get(0).getBoundingClientRect();
        var previewWidth = ui.customPreview.innerWidth();
        var previewHeight = ui.customPreview.innerHeight();
        var width = parseInt(ui.widthInput.val(), 10) || ui.qrShell.outerWidth();

        if (state.dragging.mode === "resize") {
            var nextWidth = Math.max(
                event.clientX - previewRect.left - state.dragging.originX,
                event.clientY - previewRect.top - state.dragging.originY
            );

            nextWidth = clamp(Math.round(nextWidth), 40, Math.min(previewWidth - state.dragging.originX, previewHeight - state.dragging.originY));
            ui.widthInput.val(nextWidth);
        } else {
            var x = event.clientX - previewRect.left - state.dragging.offsetX;
            var y = event.clientY - previewRect.top - state.dragging.offsetY;

            x = clamp(Math.round(x), 0, Math.max(0, previewWidth - width));
            y = clamp(Math.round(y), 0, Math.max(0, previewHeight - width));

            ui.xInput.val(x);
            ui.yInput.val(y);
        }

        updateQrPreview();
    }

    function stopQrDrag(event) {
        if (!state.dragging || state.dragging.pointerId !== event.pointerId) {
            return;
        }

        var captureEl = state.dragging.captureEl;
        state.dragging = null;
        ui.qrShell.removeClass("is-dragging");
        if (captureEl && captureEl.releasePointerCapture) {
            try {
                captureEl.releasePointerCapture(event.pointerId);
            } catch (error) {
                // Ignore stale pointer capture cleanup.
            }
        }
    }

    function startQrResize(event) {
        if (!ui.qrShell.length || !ui.customPreview.length) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        state.dragging = {
            pointerId: event.pointerId,
            mode: "resize",
            captureEl: ui.qrResize.get(0),
            originX: parseInt(ui.xInput.val(), 10) || 0,
            originY: parseInt(ui.yInput.val(), 10) || 0
        };

        ui.qrShell.addClass("is-dragging");
        ui.qrResize.get(0).setPointerCapture(event.pointerId);
    }

    function bindEvents() {
        ui.switchButtons.on("click", function () {
            applyFlow($(this).data("flow"));
        });

        ui.openList.on("click", function (event) {
            event.preventDefault();
            state.newCardExpanded = false;
            applyEditMode();
            document.getElementById("me_single_cards_list").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });

        ui.expandNewButton.on("click", function () {
            state.newCardExpanded = true;
            applyEditMode();
            document.getElementById("me_single_cards_mode_panel").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });

        ui.showListButton.on("click", function () {
            if (state.editMode) {
                exitEditMode();
            } else {
                state.newCardExpanded = false;
                applyEditMode();
            }
            document.getElementById("me_single_cards_list").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });

        ui.classicCta.on("click", function () {
            var $button = $(this);
            if ($button.attr("href") && $button.attr("href") !== "#") {
                $button.text("Adding...").addClass("is-disabled").attr("aria-disabled", "true");
            }
        });

        ui.page.on("click", "[data-media-target]", function () {
            openMedia($(this).data("media-target"));
        });

        ui.page.on("click", "[data-action='edit-custom']", function () {
            enterEditMode("custom", $(this).data("card-id"));
        });

        ui.page.on("click", "[data-action='edit-classic']", function () {
            enterEditMode("classic", $(this).data("card-id"));
        });

        ui.classicForm.on("submit", function (event) {
            event.preventDefault();
            saveClassic();
        });

        ui.classicNameInput.on("input", function () {
            ui.classicName.text($(this).val() || "Your name");
        });

        ui.classicJobInput.on("input", function () {
            ui.classicJob.text($(this).val() || "Job title");
        });

        ui.form.on("submit", function (event) {
            event.preventDefault();
            saveCustom(false);
        });

        ui.submitButton.on("click", function () {
            saveCustom(true);
        });

        ui.classicDoneButton.on("click", exitEditMode);
        ui.customDoneButton.on("click", exitEditMode);

        ui.widthInput.add(ui.xInput).add(ui.yInput).on("input change", updateQrPreview);
        ui.qrColourInput.add(ui.qrFillInput).on("input change", updateQrPreview);
        ui.qrShell.on("pointerdown", startQrDrag);
        ui.qrResize.on("pointerdown", startQrResize);
        $(document).on("pointermove", moveQrDrag);
        $(document).on("pointerup pointercancel", stopQrDrag);
        $(window).on("resize", updateQrPreview);
    }

    $(function () {
        if (!cacheDom()) {
            return;
        }

        state.flow = getRequestedFlow();
        readEditState();
        bindEvents();
        loadPayload();
    });
})(jQuery);
