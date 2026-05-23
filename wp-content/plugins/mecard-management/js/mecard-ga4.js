(function () {
    const cfg = (window.MECARD_TRACKING || {});

    function push(eventName, params = {}) {
        if (typeof window.gtag !== 'function') return;

        window.gtag('event', eventName, {
            event_source: 'mecard',
            page_location: location.href,
            referrer: document.referrer || null,

            entity_type: cfg.type || null,
            entity_id: cfg.id || null,
            tag_type: cfg.tagType || null,

            profile_id: cfg.profileId || null,
            profile_slug: cfg.profileSlug || null,
            account_id: cfg.accountId || null,
            profile_type: cfg.profileType || null,
            logged_in: !!cfg.userLoggedIn,

            ...params
        });
    }


    function on(type, selector, handler) {
        document.addEventListener(type, function (e) {
            const el = e.target.closest(selector);
            if (el) handler(e, el);
        });
    }

    (function trackShareMenu() {
        const sel = '.mecard-share-fab';
        const ready = () => {
            const btn = document.querySelector(sel);
            if (!btn) return console.warn('share FAB not found:', sel);

            const getOpen = () => btn.getAttribute('aria-expanded') === 'true';
            let isOpen = getOpen();

            const fireOpen = () => {
                if (isOpen) return; // already open → no duplicate
                isOpen = true;
                push('share_menu_view', {
                    control: 'mecard-share-fab',
                    aria_controls: btn.getAttribute('aria-controls') || null
                });
                //console.log('share_menu_view fired');
            };

            const fireClose = () => {
                if (!isOpen) return;
                isOpen = false;
                // Optional: track close too
                // push('share_menu_close', { control: 'mecard-share-fab' });
            };

            // 1) Observe the authoritative state: aria-expanded
            const obs = new MutationObserver((muts) => {
                for (const m of muts) {
                    if (m.attributeName === 'aria-expanded') {
                        getOpen() ? fireOpen() : fireClose();
                    }
                }
            });
            obs.observe(btn, { attributes: true, attributeFilter: ['aria-expanded'] });

            // 2) Also listen early (capture) to pointer/click/keyboard and
            //    re-check state on the next microtask (after UI toggles).
            const recheck = () => queueMicrotask(() => (getOpen() ? fireOpen() : fireClose()));
            ['pointerdown', 'click', 'keydown'].forEach((t) => {
                btn.addEventListener(
                    t,
                    (e) => {
                        if (t === 'keydown' && !['Enter', ' ', 'Spacebar'].includes(e.key)) return;
                        recheck();
                    },
                    { capture: true, passive: true }
                );
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', ready);
        } else {
            ready();
        }
    })();

    // View — skip when the logged-in owner is previewing their own profile
    if (!cfg.isOwner) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => push('profile_view'));
        } else {
            push('profile_view');
        }
    }

    // vCard
    on('click', 'div.vcard-button', (e, el) => {
        push('download-contact', {
            file_type: 'vcard',
            file_url: el.getAttribute('href') || null
        });
    });

    // Share menu viewed
    on('click', 'button.mecard-share-fab', () => {
        push('share_menu_view');
        //console.log('share menu viewed');
    });

    on('click', 'button[data-action="whatsapp-number"]', () => {
        push('whatsapp_share');
    });

    on('click', 'button[data-action="copy-link"]', () => {
        push('copy_link');
    });

    on('click', 'button[data-action="sms"]', () => {
        push('sms_share');
    });

    on('click', 'button[data-action="email"]', () => {
        push('email_share');
    });

    // Share actions
    on('click', 'button[data-action="native-share"]', (e, el) => {
        push('share_action', {
            method: el.dataset.share || 'unknown',
            target: el.dataset.target || null,
            content_type: el.dataset.contentType || 'profile'
        });
    });

    // QR download
    on('click', 'button[data-action="download-qr"]', (e, el) => {
        push('qr_download', {
            format: el.dataset.format || 'png',
            size: el.dataset.size || null,
            file_url: el.getAttribute('href') || null
        });
    });

    // Add to Home Screen / PWA
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        push('a2hs_prompt_shown');

        const btn = document.querySelector('[data-track="a2hs_prompt"]');
        if (btn) {
            btn.hidden = false;
            btn.addEventListener('click', async () => {
                push('a2hs_prompt_clicked');
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                push('a2hs_prompt_result', { outcome });
                deferredPrompt = null;
            }, { once: true });
        }
    });

    window.addEventListener('appinstalled', () => push('a2hs_installed'));
})();

// Fire share_menu_view exactly when the FAB transitions to expanded=true.
// Also (optional) fire share_menu_close on collapse.


