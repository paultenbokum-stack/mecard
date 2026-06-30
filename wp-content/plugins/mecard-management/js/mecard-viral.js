(function () {
    'use strict';

    var cfg = window.MECARD_VIRAL || {};
    if (!cfg.profileId) return;

    // ─── Helpers ─────────────────────────────────────────────

    function track(eventName, params) {
        if (typeof window.mecardTrack === 'function') {
            window.mecardTrack(eventName, params || {});
        }
    }

    // ─── Surface 1: Watermark strip IntersectionObserver ─────

    var strip = document.getElementById('mecard-watermark-strip');
    if (strip) {
        var stripTracked = false;
        var observer = new IntersectionObserver(function (entries) {
            if (stripTracked) return;
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    track('recipient_ad_viewed', {
                        meta: { surface: 'profile_strip' }
                    });
                    stripTracked = true;
                    observer.disconnect();
                    break;
                }
            }
        }, { threshold: 0.5 });
        observer.observe(strip);

        // Track clicks on the strip
        strip.addEventListener('click', function () {
            track('recipient_ad_clicked', {
                meta: { surface: 'profile_strip' }
            });
        });
    }

    // ─── Surface 2: Share message footer (free profiles) ─────
    // Intercept share text composition in mecard-management.js
    // We patch the share config URL and text to append the watermark footer

    // For non-owner views on free profiles, add UTM tracking to the share URL
    if (cfg.isFree && !cfg.isOwner) {
        var shareCfg = window.MECARD_SHARE;
        if (shareCfg && shareCfg.url) {
            var sep = shareCfg.url.indexOf('?') === -1 ? '?' : '&';
            shareCfg.url = shareCfg.url + sep + 'utm_source=watermark&utm_medium=share&utm_campaign=free_viral';
        }
    }
    // Share text footer is handled directly in mecard-management.js via MECARD_SHARE.shareFooter

    // ─── Surface 4: Share panel upsell click tracking ────────

    var upsell = document.getElementById('mecard-share-upsell');
    if (upsell) {
        upsell.addEventListener('click', function () {
            track('pro_upsell_clicked', {
                meta: { context: 'share_panel' }
            });
        });
    }

    // ─── Surface 5: Post-save CTA ────────────────────────────
    // Show after vCard download on free profiles for non-owners

    if (cfg.isFree && !cfg.isOwner) {
        var isAndroid = /android/i.test(navigator.userAgent);
        var ctaInjected = false;

        function showPostSaveCTA() {
            if (isAndroid) {
                // Inject CTA into the download-message slot (below the save instruction)
                var slot = document.getElementById('mecard-download-cta-slot');
                var tpl = document.getElementById('mecard-post-save-cta-tpl');
                if (slot && tpl && !ctaInjected) {
                    slot.innerHTML = '';
                    slot.appendChild(tpl.content.cloneNode(true));
                    ctaInjected = true;
                }
            } else {
                // Non-Android: show the floating card after a short delay
                var cta = document.getElementById('mecard-post-save-cta');
                if (!cta) return;
                setTimeout(function () {
                    cta.style.display = '';
                    requestAnimationFrame(function () {
                        cta.classList.add('is-visible');
                    });
                }, 2000);
            }
            track('post_save_cta_viewed', {
                meta: { surface: 'post_save' }
            });
        }

        // Listen for vCard button clicks
        document.addEventListener('click', function (e) {
            var vcardBtn = e.target.closest('div.vcard-button, .mc-savebar__btn, [data-me-field="vcard-button"] a');
            if (vcardBtn) {
                showPostSaveCTA();
            }
        });

        // Track clicks on CTA buttons (delegated for both inline and floating)
        document.addEventListener('click', function (e) {
            if (e.target.closest('.mecard-post-save-cta-inline__btn, .mecard-post-save-cta__btn')) {
                track('post_save_cta_clicked');
            }
        });

        // Dismiss floating CTA
        var closeBtn = document.getElementById('mecard-post-save-cta-close');
        function dismissCTA() {
            var cta = document.getElementById('mecard-post-save-cta');
            if (cta) {
                cta.classList.remove('is-visible');
                setTimeout(function () { cta.style.display = 'none'; }, 300);
            }
            track('post_save_cta_dismissed');
        }
        if (closeBtn) closeBtn.addEventListener('click', dismissCTA);
    }

    // ─── QR Code branding for free profiles ──────────────────

    if (cfg.isFree) {
        // Wait for DOM and QR to render, then add branding below QR canvas
        function addQRBranding() {
            var qrCanvas = document.getElementById('mecard-qr-canvas');
            if (!qrCanvas) return;
            // Check if already added
            if (qrCanvas.parentNode.querySelector('.mecard-qr-branding')) return;

            var branding = document.createElement('div');
            branding.className = 'mecard-qr-branding';
            branding.innerHTML = '<span class="mecard-qr-branding__text">Powered by <strong>MeCard</strong></span>';
            qrCanvas.parentNode.insertBefore(branding, qrCanvas.nextSibling);
        }

        // Try on DOMContentLoaded and also after a delay (QR might render async)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                setTimeout(addQRBranding, 500);
            });
        } else {
            setTimeout(addQRBranding, 500);
        }

        // Also try when share panel opens
        var sharePanel = document.getElementById('mecard-share-panel');
        if (sharePanel) {
            var qrObs = new MutationObserver(function () {
                if (sharePanel.classList.contains('is-open')) {
                    setTimeout(addQRBranding, 200);
                }
            });
            qrObs.observe(sharePanel, { attributes: true, attributeFilter: ['class'] });
        }
    }
})();
