(function () {
  const root = document.querySelector("[data-me-onboarding]");
  if (!root || typeof MECARD_ONBOARDING === "undefined") {
    return;
  }

  const panel = root.querySelector("[data-me-panel]");
  const progressTracker = root.querySelector("[data-me-progress-tracker]");

  const state = {
    steps: MECARD_ONBOARDING.steps || ["basics", "contact", "preview", "install", "ready", "card", "pro"],
    index: 0,
    profileId: 0,
    profile: {},
    shareUrl: "",
    classicCardCart: {
      inCart: false,
      quantity: 0,
      cartItemKey: "",
      productId: Number(MECARD_ONBOARDING.classicCardProductId || 0),
    },
  };

  let deferredInstallPrompt = null;

  function isDesktop() {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  const stepMeta = {
    basics: {
      title: "Create your free profile",
      text: "Start with the personal details people need first.",
    },
    contact: {
      title: "Your work",
      text: "Add the professional details that make your profile and classic card feel complete.",
    },
    preview: {
      title: "Preview your profile",
      text: "Check how your free profile looks before you publish it.",
    },
    install: {
      title: "Add launch button to your home screen",
      text: "",
    },
    ready: {
      title: "You're ready to share!",
      text: "Your free profile is live and ready whenever you need it.",
    },
    card: {
      title: "Add cards and configure more features",
      text: "Use the details you already entered to order cards and unlock richer options.",
    },
    pro: {
      title: "Supercharge your Profile",
      text: "Preview the richer profile experience, then upgrade when you're ready.",
    },
  };

  function ajax(action, payload) {
    const body = new URLSearchParams();
    body.set("action", action);
    body.set("nonce", MECARD_ONBOARDING.nonce);
    Object.keys(payload || {}).forEach((key) => {
      if (payload[key] !== undefined && payload[key] !== null) {
        body.set(key, payload[key]);
      }
    });

    return fetch(MECARD_ONBOARDING.ajaxurl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: body.toString(),
      credentials: "same-origin",
    }).then((res) => res.json());
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function currentStep() {
    return state.steps[state.index] || "basics";
  }

  function groupForStep(step) {
    if (step === "install") return "install";
    if (step === "ready" || step === "card" || step === "pro") return "ready";
    return "profile";
  }

  function completedGroups(group) {
    const installDone = Number(state.profile.installDone || 0) === 1;
    if (group === "profile") return ["signup"];
    if (group === "install") return ["signup", "profile"];
    if (group === "ready") return installDone ? ["signup", "profile", "install", "ready"] : ["signup", "profile", "ready"];
    return [];
  }

  function renderProgressTracker() {
    if (!progressTracker) {
      return;
    }

    const group = groupForStep(currentStep());
    const completed = completedGroups(group);
    const steps = [
      { key: "signup", label: "Sign up" },
      { key: "profile", label: "Create your free profile" },
      { key: "install", label: "Add launch button" },
      { key: "ready", label: "You're ready to share!" },
    ];

    const items = steps
      .map((item) => {
        const classes = ["me-progress__step"];
        if (completed.includes(item.key)) classes.push("is-complete");
        if (group === item.key) classes.push("is-current");
        if (
          item.key === "install" &&
          group === "ready" &&
          Number(state.profile.installSkipped || 0) === 1 &&
          Number(state.profile.installDone || 0) !== 1
        ) {
          classes.push("is-skipped");
        }

        let icon = "";
        if (completed.includes(item.key)) {
          icon = "&#10003;";
        } else if (classes.includes("is-skipped")) {
          icon = "&#8987;";
        }
        return `<li class="${classes.join(" ")}"><span class="me-progress__dot">${icon}</span><span class="me-progress__label">${escapeHtml(item.label)}</span></li>`;
      })
      .join("");

    const bundleImg = MECARD_ONBOARDING.customBundleImageUrl || '';
    progressTracker.innerHTML = `
      <ol class="me-progress__list">${items}</ol>
      <div class="me-progress__extra">Then: Add Cards and configure more features</div>
      <div class="me-progress-upsell">
        <div class="me-progress-upsell__section">
          <p class="me-progress-upsell__heading">Profile enhancements</p>
          <ul class="me-progress-upsell__list">
            <li>Custom branding &amp; colours</li>
            <li>Pro layouts &amp; themes</li>
            <li>Rich company information</li>
          </ul>
        </div>
        <div class="me-progress-upsell__section">
          <p class="me-progress-upsell__heading">Cards &amp; bundles</p>
          <img class="me-progress-upsell__bundle-img" src="${bundleImg}" alt="MeCard custom card bundle">
        </div>
      </div>`;
  }

  function mediaMarkup(type, imageUrl, buttonLabel) {
    const image = imageUrl
      ? `<img class="me-media-picker__image" src="${escapeHtml(imageUrl)}" alt="" />`
      : `<div class="me-media-picker__placeholder">${type === "photo" ? "Photo" : "Logo"}</div>`;

    return `
      <div class="me-media-picker" data-media-picker="${type}">
        <div class="me-media-picker__preview">${image}</div>
        <input type="hidden" name="${type === "photo" ? "me_profile_photo_id" : "me_profile_company_logo_id"}" value="${escapeHtml(type === "photo" ? state.profile.photoId || "" : state.profile.companyLogoId || "")}" />
        <button class="me-btn me-btn--secondary me-btn--small" type="button" data-media-button="${type}">${buttonLabel}</button>
      </div>
    `;
  }

  function renderBasics() {
    return `
      <div class="me-step">
        <div class="me-step__header">
          <h3 class="me-step__title">${stepMeta.basics.title}</h3>
          <p class="me-step__text">${stepMeta.basics.text}</p>
        </div>
        <div class="me-step__grid">
          <div class="me-step__field">
            <label for="me-first-name">First name</label>
            <input id="me-first-name" name="wpcf-first-name" value="${escapeHtml(state.profile.first)}" />
          </div>
          <div class="me-step__field">
            <label for="me-last-name">Last name</label>
            <input id="me-last-name" name="wpcf-last-name" value="${escapeHtml(state.profile.last)}" />
          </div>
          <div class="me-step__field">
            <label for="me-mobile">Mobile number</label>
            <input id="me-mobile" name="wpcf-mobile-number" value="${escapeHtml(state.profile.mobile)}" placeholder="+27 82 123 4567" />
          </div>
          <div class="me-step__field">
            <label for="me-email">Email address</label>
            <input id="me-email" name="wpcf-email-address" value="${escapeHtml(state.profile.email)}" />
          </div>
          <div class="me-step__field">
            <label>Profile photo <span class="me-step__optional">optional</span></label>
            ${mediaMarkup("photo", state.profile.photoUrl, state.profile.photoUrl ? "Change photo" : "Choose photo")}
          </div>
        </div>
        <div class="me-step__actions">
          <button class="me-btn me-btn--primary" data-next-save="basics">Continue</button>
        </div>
      </div>
    `;
  }

  function renderContact() {
    return `
      <div class="me-step">
        <div class="me-step__header">
          <h3 class="me-step__title">${stepMeta.contact.title}</h3>
          <p class="me-step__text">${stepMeta.contact.text}</p>
        </div>
        <div class="me-step__grid">
          <div class="me-step__field">
            <label for="me-job-title">Job title</label>
            <input id="me-job-title" name="wpcf-job-title" value="${escapeHtml(state.profile.job)}" placeholder="e.g. Sales Manager" />
          </div>
          <div class="me-step__field">
            <label for="me-company-name">Company</label>
            <input id="me-company-name" name="wpcf-company-r" value="${escapeHtml(state.profile.companyName)}" placeholder="e.g. Acme Corp" />
            <input type="hidden" name="wpcf-company_name" value="${escapeHtml(state.profile.companyName)}" />
          </div>
          <div class="me-step__field">
            <label>Company logo</label>
            ${mediaMarkup("logo", state.profile.companyLogoUrl, state.profile.companyLogoUrl ? "Change logo" : "Choose logo")}
          </div>
          <div class="me-step__field">
            <label for="me-linkedin">LinkedIn URL</label>
            <input id="me-linkedin" name="wpcf-linkedin-url" value="${escapeHtml(state.profile.linkedin)}" placeholder="Optional" />
            <p class="me-step__hint">You can add more social links later by editing your profile.</p>
          </div>
        </div>
        <div class="me-step__actions">
          <button class="me-btn me-btn--secondary" data-back>Back</button>
          <button class="me-btn me-btn--primary" data-next-save="contact">Next</button>
        </div>
      </div>
    `;
  }

  function renderPreview() {
    const previewUrl = (() => {
      try {
        const url = new URL(state.shareUrl || "", window.location.origin);
        url.searchParams.set("me_preview", "1");
        return url.toString();
      } catch (e) {
        return state.shareUrl || "";
      }
    })();
    return `
      <div class="me-step">
        <div class="me-step__header">
          <h3 class="me-step__title">${stepMeta.preview.title}</h3>
          <p class="me-step__text">${stepMeta.preview.text}</p>
        </div>
        <div class="me-profile-frame me-profile-frame--wide">
          <div class="me-profile-frame__phone">
            <div class="me-profile-frame__bar"></div>
            <iframe class="me-profile-frame__view" src="${escapeHtml(previewUrl)}" title="Profile preview" loading="lazy"></iframe>
          </div>
        </div>
        <div class="me-step__actions">
          <button class="me-btn me-btn--secondary" data-jump="basics">Edit profile</button>
          <button class="me-btn me-btn--primary" data-next-save="preview">Publish profile</button>
        </div>
      </div>
    `;
  }

  function renderInstall() {
    const guidedShareUrl = (() => {
      try {
        const url = new URL(state.shareUrl || "", window.location.origin);
        url.searchParams.set("me_share", "1");
        url.searchParams.set("me_share_target", "install");
        return url.toString();
      } catch (error) {
        return state.shareUrl || "#";
      }
    })();

    const desktop = isDesktop();
    const userEmail = escapeHtml(MECARD_ONBOARDING.currentUserEmail || "");
    const hintText = desktop
      ? `We\u2019ll send your profile link to ${userEmail}. Open it on your phone, then tap Share \u2192 Add to Home Screen to add your launch button.`
      : "This opens your profile share tools in a new tab. Come back here after you\u2019ve added the launch button.";
    const primaryAction = desktop
      ? `<button class="me-btn me-btn--primary" data-send-profile-link>Send my profile link to my email</button>`
      : `<a class="me-btn me-btn--primary" href="${escapeHtml(guidedShareUrl)}" target="_blank" rel="noopener">Add launch button</a>`;

    return `
      <div class="me-step">
        <div class="me-step__header">
          <h3 class="me-step__title">${stepMeta.install.title}</h3>
          ${stepMeta.install.text ? `<p class="me-step__text">${stepMeta.install.text}</p>` : ""}
        </div>
        <div class="me-install-demo">
          <img class="me-install-demo__image" src="${escapeHtml(MECARD_ONBOARDING.launchDemoUrl || MECARD_ONBOARDING.installGifUrl || "")}" alt="Move the MeCard launch button into your favourites tray" />
        </div>
        <p class="me-step__hint">${hintText}</p>
        <div class="me-step__actions">
          <button class="me-btn me-btn--secondary" data-back>Back</button>
          ${primaryAction}
          <button class="me-btn me-btn--ghost" data-install-skip>Skip for now</button>
          <button class="me-btn me-btn--secondary" data-next-save="install">I\u2019m done</button>
        </div>
      </div>
    `;
  }

  function renderCardOffer() {
    const fullName = [state.profile.first, state.profile.last].filter(Boolean).join(" ").trim() || "Your Name";
    const jobTitle = state.profile.job || "Your title";
    const initials = [state.profile.first, state.profile.last]
      .filter(Boolean)
      .map((part) => String(part).charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "MC";
    const classicProductId = Number(MECARD_ONBOARDING.classicCardProductId || 0);
    const customCardUrl = (() => {
      try {
        const url = new URL(MECARD_ONBOARDING.manageCardsUrl || "/manage/cards/", window.location.origin);
        url.searchParams.set("flow", "custom");
        return url.toString();
      } catch (error) {
        return MECARD_ONBOARDING.manageCardsUrl || "#";
      }
    })();
    const inCart = !!(state.classicCardCart && state.classicCardCart.inCart);
    const quantity = Number((state.classicCardCart && state.classicCardCart.quantity) || 0);
    const logoMarkup = state.profile.companyLogoUrl
      ? `<img src="${escapeHtml(state.profile.companyLogoUrl)}" alt="${escapeHtml(state.profile.companyName || "Company logo")}" />`
      : `<div class="me-classic-card__logo-placeholder">${escapeHtml(state.profile.companyName || initials)}</div>`;
    const basketStateMarkup = inCart
      ? `
        <div class="me-card-basket-state">
          <strong>Your classic card is in the basket.</strong>
          <p>${quantity > 1 ? `${quantity} classic cards are currently in your basket.` : "You can keep going, open the basket, or cancel this selection."}</p>
          <div class="me-card-basket-state__actions">
            <a class="me-btn me-btn--secondary" href="${escapeHtml(MECARD_ONBOARDING.basketUrl || "#")}">View basket</a>
            <button type="button" class="me-btn me-btn--ghost" data-card-cart="remove">Cancel</button>
          </div>
        </div>
      `
      : "";

    return `
      <div class="me-offer-card">
        <div class="me-offer-card__header">
          <h4 class="me-offer-card__title">${stepMeta.card.title}</h4>
          <p class="me-step__text">${stepMeta.card.text}</p>
        </div>
        <div class="me-card-stage">
          <p class="me-card-stage__label">Classic card front</p>
          <div class="me-classic-card">
            <div class="me-classic-card__surface card-front classic">
              <div class="me-classic-card__logo classic-logo">${logoMarkup}</div>
              <div class="me-classic-card__identity">
                <p class="me-classic-card__name classic-name">${escapeHtml(fullName)}</p>
                <p class="me-classic-card__title classic-job-title">${escapeHtml(jobTitle)}</p>
              </div>
            </div>
          </div>
        </div>
        ${basketStateMarkup}
        <div class="me-step__actions">
          <button type="button" class="me-btn me-btn--primary" data-card-cart="add"${classicProductId && !inCart ? "" : " disabled"}>${inCart ? "Classic card already in basket" : "Add classic card to basket"}</button>
        </div>
        <div class="me-step__subactions">
          <a class="me-step__quiet-link" href="${escapeHtml(customCardUrl)}">Add custom design</a>
        </div>
      </div>
    `;
  }

  function renderProOffer() {
    const proEditUrl = (() => {
      try {
        const url = new URL(MECARD_ONBOARDING.editProfileUrl || "/manage/profile/", window.location.origin);
        url.searchParams.set("mode", "pro");
        return url.toString();
      } catch (error) {
        return MECARD_ONBOARDING.editProfileUrl || "#";
      }
    })();

    return `
      <div class="me-offer-card">
        <div class="me-offer-card__header">
          <h4 class="me-offer-card__title">${stepMeta.pro.title}</h4>
          <p class="me-step__text">${stepMeta.pro.text}</p>
        </div>
        <div class="me-profile-upgrade-compare">
          <div class="me-profile-upgrade-compare__image">
            <img src="${escapeHtml(MECARD_ONBOARDING.standardProfileImageUrl || "")}" alt="Standard MeCard profile example" />
            <span class="me-profile-upgrade-compare__label">A</span>
          </div>
          <div class="me-profile-upgrade-compare__arrow" aria-hidden="true"><span>&rarr;</span></div>
          <div class="me-profile-upgrade-compare__image">
            <img src="${escapeHtml(MECARD_ONBOARDING.proProfileImageUrl || "")}" alt="Pro MeCard profile example" />
            <span class="me-profile-upgrade-compare__label">B</span>
          </div>
        </div>
        <div class="me-feature-list me-feature-list--compact">
          <div class="me-feature-list__item"><strong>Customise look and feel</strong><span>Match your profile to your company branding.</span></div>
          <div class="me-feature-list__item"><strong>Add company info</strong><span>Address, telephone number, support email, rich description, and extra buttons and links.</span></div>
          <div class="me-feature-list__item"><strong>Grow your sharing setup</strong><span>Team contact sharing and sharing analytics.</span></div>
        </div>
        <div class="me-offer-card__price">R199 per year</div>
        <div class="me-step__actions">
          <a class="me-btn me-btn--primary" href="${escapeHtml(proEditUrl)}">Design Pro Profile</a>
        </div>
      </div>
    `;
  }

  function renderReady() {
    return `
      <div class="me-step">
        <div class="me-step__header">
          <h3 class="me-step__title">${stepMeta.ready.title}</h3>
          <p class="me-step__text">${stepMeta.ready.text}</p>
        </div>
        <div class="me-note me-note--success">
          <strong>Your free shareable profile is live.</strong>
          <p>You can now open it, copy the link, or carry on adding cards and richer features.</p>
        </div>
        <div class="me-step__actions">
          <a class="me-btn me-btn--success" href="${escapeHtml(state.shareUrl || "#")}" target="_blank" rel="noopener">Open profile</a>
          <button type="button" class="me-btn me-btn--secondary" data-copy-share-url>Copy share link</button>
        </div>
        <section class="me-secondary-flow">
          ${renderCardOffer()}
          ${renderProOffer()}
        </section>
      </div>
    `;
  }

  function setIndexForStage(stage) {
    const idx = state.steps.indexOf(stage);
    state.index = idx >= 0 ? idx : 0;
  }

  function renderCurrentStep() {
    const step = currentStep();
    if (step === "basics") panel.innerHTML = renderBasics();
    if (step === "contact") panel.innerHTML = renderContact();
    if (step === "preview") panel.innerHTML = renderPreview();
    if (step === "install") panel.innerHTML = renderInstall();
    if (step === "ready" || step === "card" || step === "pro") panel.innerHTML = renderReady();
    renderProgressTracker();
  }

  function syncMirroredFields() {
    const companyInput = panel.querySelector('input[name="wpcf-company-r"]');
    const legacyInput = panel.querySelector('input[name="wpcf-company_name"]');
    if (companyInput && legacyInput) {
      legacyInput.value = companyInput.value;
    }
  }

  function formPayload(step) {
    syncMirroredFields();
    const payload = { profile_id: state.profileId, step };
    panel.querySelectorAll("input[name]").forEach((input) => {
      payload[input.name] = input.value;
    });
    return payload;
  }

  function saveStep(step, extraPayload) {
    const payload = Object.assign({}, formPayload(step), extraPayload || {});
    return ajax("me_onboarding_save_step", payload).then((response) => {
      if (!response.success) {
        throw new Error((response.data && response.data.message) || "Could not save the step.");
      }
      state.profile = response.data.profile || state.profile;
      state.shareUrl = response.data.shareUrl || state.shareUrl;
      state.classicCardCart = response.data.classicCardCart || state.classicCardCart;
      if (response.data && response.data.redirectUrl) {
        window.location.assign(response.data.redirectUrl);
        return response;
      }
      setIndexForStage(state.profile.onboardingStage || step);
      return response;
    });
  }

  function updateClassicCardCart(operation) {
    return ajax("me_onboarding_classic_card_cart", { operation }).then((response) => {
      if (!response.success) {
        throw new Error((response.data && response.data.message) || "Could not update the basket.");
      }
      state.classicCardCart = response.data.classicCardCart || state.classicCardCart;
      renderCurrentStep();
    });
  }

  function openMediaPicker(type) {
    if (typeof wp === "undefined" || !wp.media) {
      window.alert("The media library is not available on this page.");
      return;
    }

    const frame = wp.media({
      title: type === "photo" ? "Select profile photo" : "Select company logo",
      button: {
        text: type === "photo" ? "Use this photo" : "Use this logo",
      },
      library: {
        type: "image",
        author: Number(MECARD_ONBOARDING.currentUserId || 0),
      },
      multiple: false,
    });


    frame.on("select", function () {
      const attachment = frame.state().get("selection").first().toJSON();
      const input = panel.querySelector(`input[name="${type === "photo" ? "me_profile_photo_id" : "me_profile_company_logo_id"}"]`);
      if (!input) {
        return;
      }

      input.value = attachment.id || "";
      const url =
        (attachment.sizes && attachment.sizes.medium && attachment.sizes.medium.url) ||
        (attachment.sizes && attachment.sizes.thumbnail && attachment.sizes.thumbnail.url) ||
        attachment.url ||
        "";

      // Snapshot any typed-but-unsaved field values before re-rendering.
      var fieldMap = {
        "wpcf-first-name":    "first",
        "wpcf-last-name":     "last",
        "wpcf-job-title":     "job",
        "wpcf-email-address": "email",
        "wpcf-mobile-number": "mobile",
        "wpcf-linkedin-url":  "linkedin",
        "wpcf-company-r":     "companyName",
      };
      panel.querySelectorAll("input[name]").forEach(function (el) {
        if (fieldMap[el.name] !== undefined) {
          state.profile[fieldMap[el.name]] = el.value;
        }
      });

      if (type === "photo") {
        state.profile.photoId = attachment.id || 0;
        state.profile.photoUrl = url;
      } else {
        state.profile.companyLogoId = attachment.id || 0;
        state.profile.companyLogoUrl = url;
      }

      renderCurrentStep();
    });

    frame.open();
  }

  function copyShareLink() {
    const url = state.shareUrl || "";
    if (!url) {
      return Promise.reject(new Error("There is no share link to copy yet."));
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url);
    }

    const input = document.createElement("input");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    return Promise.resolve();
  }

  panel.addEventListener("input", function (event) {
    if (event.target.name === "wpcf-company-r") {
      syncMirroredFields();
    }
  });

  panel.addEventListener("click", function (event) {
    const back = event.target.closest("[data-back]");
    const save = event.target.closest("[data-next-save]");
    const mediaButton = event.target.closest("[data-media-button]");
    const jump = event.target.closest("[data-jump]");
    const install = event.target.closest("[data-install-pwa]");
    const sendProfileLink = event.target.closest("[data-send-profile-link]");
    const installSkip = event.target.closest("[data-install-skip]");
    const cardCart = event.target.closest("[data-card-cart]");
    const copyShare = event.target.closest("[data-copy-share-url]");

    if (cardCart) {
      const operation = cardCart.getAttribute("data-card-cart");
      cardCart.disabled = true;
      updateClassicCardCart(operation).catch((error) => {
        window.alert(error.message);
        renderCurrentStep();
      });
      return;
    }

    if (copyShare) {
      copyShare.disabled = true;
      copyShareLink()
        .then(() => {
          copyShare.textContent = "Link copied";
        })
        .catch((error) => {
          window.alert(error.message);
          copyShare.disabled = false;
        });
      return;
    }

    if (mediaButton) {
      openMediaPicker(mediaButton.getAttribute("data-media-button"));
      return;
    }

    if (jump) {
      setIndexForStage(jump.getAttribute("data-jump"));
      renderCurrentStep();
      return;
    }

    if (install) {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(function () {
          deferredInstallPrompt = null;
          renderCurrentStep();
        });
      }
      return;
    }

    if (sendProfileLink) {
      sendProfileLink.disabled = true;
      const originalText = sendProfileLink.textContent;
      sendProfileLink.textContent = "Sending\u2026";
      fetch(MECARD_ONBOARDING.ajaxurl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "me_send_profile_link",
          nonce: MECARD_ONBOARDING.nonce,
          share_url: state.shareUrl || "",
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.success) throw new Error((data.data) || "Could not send email.");
          sendProfileLink.textContent = "Sent!";
          const hint = sendProfileLink.closest(".me-step").querySelector(".me-step__hint");
          if (hint) hint.textContent = "Check your inbox \u2014 open the link on your phone to add your launch button.";
        })
        .catch(function (error) {
          sendProfileLink.disabled = false;
          sendProfileLink.textContent = originalText;
          window.alert(error.message);
        });
      return;
    }

    if (installSkip) {
      installSkip.disabled = true;
      saveStep("install", { install_status: "skipped" })
        .then(() => {
          renderCurrentStep();
        })
        .catch((error) => {
          window.alert(error.message);
          installSkip.disabled = false;
        });
      return;
    }

    if (back) {
      state.index = Math.max(0, state.index - 1);
      renderCurrentStep();
      return;
    }

    if (save) {
      const step = save.getAttribute("data-next-save");
      save.disabled = true;
      save.textContent = "Saving...";
      const extraPayload = step === "install" ? { install_status: "done" } : {};
      saveStep(step, extraPayload)
        .then(() => {
          renderCurrentStep();
        })
        .catch((error) => {
          window.alert(error.message);
          save.disabled = false;
          save.textContent = "Try again";
        });
    }
  });

  panel.innerHTML = '<div class="me-loading">Loading onboarding...</div>';
  renderProgressTracker();

  ajax("me_onboarding_bootstrap", {})
    .then((response) => {
      if (!response.success) {
        throw new Error((response.data && response.data.message) || "Could not load onboarding.");
      }
      state.profileId = response.data.profileId;
      state.profile = response.data.profile || {};
      state.shareUrl = response.data.shareUrl || "";
      state.steps = response.data.steps || state.steps;
      state.classicCardCart = response.data.classicCardCart || state.classicCardCart;
      setIndexForStage(state.profile.onboardingStage || "basics");
      renderCurrentStep();
    })
    .catch((error) => {
      panel.innerHTML = `<div class="me-note"><strong>Could not load onboarding.</strong><p>${escapeHtml(error.message)}</p></div>`;
    });
})();
