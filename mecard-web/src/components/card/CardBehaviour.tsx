"use client";

import { encodeAcquisition, FIRST_TOUCH_COOKIE, FIRST_TOUCH_DAYS, parseAcquisition, withReferral } from "@/lib/acquisition";
import { classifyContactLink } from "@/lib/contact-action";
import { useEffect } from "react";

// All the scripts a card page ran on WordPress, attached to the server-rendered
// markup: mecard-track.js (event store), mecard-ga4.js (GA4 + event mapping),
// the share panel and vCard code from mecard-management.js, and mecard-viral.js.
// The page HTML is the same for every visitor, so it can be cached.

export interface CardConfig {
  /** What is being viewed: the tag (/t/) or the profile itself. */
  contextType: "tag" | "profile";
  contextId: number;
  tagType: string | null;
  profileId: number;
  profileSlug: string;
  /** WordPress values: "professional" | "standard". */
  profileType: string;
  companyId: number | null;
  /** Canonical URL of the page being viewed (what gets shared). */
  pageUrl: string;
  isFree: boolean;
  ownerName: string;
  vcardName: string;
  autoDownload: boolean;
}

type Params = Record<string, unknown>;
type Gtag = (...args: unknown[]) => void;
type BeforeInstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

declare global {
  interface Window {
    mecardTrack?: (eventName: string, params?: Params) => void;
    gtag?: Gtag;
    dataLayer?: unknown[];
    MECARD_BIP?: BeforeInstallPrompt | null;
  }
}

const TRACK_ENDPOINT = "/api/track/";
const INTL_TEL_VERSION = "25.15.0";

// Once per page load, even if the effect runs twice (React dev mode, remounts).
const firedOnce = new Set<string>();
const once = (key: string) => (firedOnce.has(key) ? false : (firedOnce.add(key), true));

function getCookie(name: string) {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}
function setCookie(name: string, value: string, days: number) {
  document.cookie = `${name}=${value};expires=${new Date(Date.now() + days * 864e5).toUTCString()};path=/`;
}

export function CardBehaviour({ config }: { config: CardConfig }) {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    const on = <K extends keyof DocumentEventMap>(type: K, selector: string, handler: (e: DocumentEventMap[K], el: Element) => void) => {
      const fn = (e: DocumentEventMap[K]) => {
        const el = (e.target as Element | null)?.closest?.(selector);
        if (el) handler(e, el);
      };
      document.addEventListener(type, fn);
      cleanups.push(() => document.removeEventListener(type, fn));
    };

    // ── mecard-track.js ────────────────────────────────────
    const source = (() => {
      const q = new URLSearchParams(location.search);
      return q.get("me_source") || q.get("utm_source") || (config.contextType === "tag" ? "nfc" : null);
    })();
    const sessionId = () => getCookie("mecard_sid") || "cs-" + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

    const track = (eventName: string, params: Params = {}) => {
      const body = JSON.stringify({
        event_name: eventName,
        session_id: sessionId(),
        profile_id: params.profile_id || config.profileId || null,
        company_id: params.company_id || config.companyId || null,
        source: params.source || source,
        referrer: document.referrer || null,
        meta: params.meta || null,
      });
      if (navigator.sendBeacon) navigator.sendBeacon(TRACK_ENDPOINT, new Blob([body], { type: "application/json" }));
      else void fetch(TRACK_ENDPOINT, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    };
    window.mecardTrack = track;

    // ── mecard-ga4.js: GA4 events, mapped onto the event store ──
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") window.gtag = (...args: unknown[]) => void window.dataLayer!.push(args);
    const STORE_NAME: Record<string, string> = {
      profile_view: "profile_viewed",
      "download-contact": "vcard_downloaded",
      whatsapp_share: "share_intent",
      copy_link: "share_intent",
      sms_share: "share_intent",
      email_share: "share_intent",
      share_action: "share_intent",
      qr_download: "share_intent",
      a2hs_prompt_shown: "a2hs_prompted",
      a2hs_installed: "a2hs_accepted",
    };
    const METHOD: Record<string, string> = { whatsapp_share: "wa", copy_link: "copy", sms_share: "sms", email_share: "email", share_action: "native", qr_download: "qr" };
    const push = (eventName: string, params: Params = {}) => {
      window.gtag!("event", eventName, {
        event_source: "mecard",
        page_location: location.href,
        referrer: document.referrer || null,
        entity_type: config.contextType,
        entity_id: config.contextId,
        tag_type: config.tagType,
        profile_id: config.profileId,
        profile_slug: config.profileSlug,
        account_id: null,
        profile_type: config.profileType,
        logged_in: false,
        ...params,
      });
      let name = STORE_NAME[eventName];
      if (eventName === "a2hs_prompt_result") name = params.outcome === "accepted" ? "a2hs_accepted" : "a2hs_dismissed";
      if (!name) return;
      let meta: Params | undefined = METHOD[eventName] ? { method: METHOD[eventName], ...params } : Object.keys(params).length ? params : undefined;
      if (name === "profile_viewed") meta = { entry_url_pattern: config.contextType === "tag" ? "t" : "mecard-profile", ...(meta || {}) };
      track(name, meta ? { meta } : {});
    };

    // ── Owner extras (Me\Viral, single-mecard-profile.php) ──
    // The page is the same for everyone; ask who is looking. Owners get the
    // edit bar and, on free profiles, the Pro upsell in the share panel, and
    // their own visits aren't counted as views. Visitors see the viral prompts.
    let owner = false;
    const access = once(`access:${config.pageUrl}`)
      ? fetch(`/api/me/card/?profile_id=${config.profileId}`, { credentials: "same-origin", cache: "no-store" })
          .then((r) => (r.ok ? (r.json() as Promise<{ canEdit?: boolean; isOwner?: boolean; editUrl?: string | null }>) : null))
          .catch(() => null)
      : Promise.resolve(null);
    void access.then((a) => {
      owner = !!a?.isOwner;
      if (!owner) push("profile_view");
      if (a?.canEdit && a.editUrl && !new URLSearchParams(location.search).has("me_preview")) showEditBar(a.editUrl);
      if (owner && config.isFree) showOwnerUpsell();
      if (owner) document.getElementById("mecard-watermark-strip")?.remove();
    });
    // Taps on the card's own contact details (call, email, WhatsApp, website, map,
    // socials, extra links): a beacon, so the tap itself is never held up.
    // Owners trying their own links don't count, as with views.
    on("click", "a[href]", (_e, el) => {
      if (owner) return;
      if (!el.closest(".mecard-public-card, .standard-profile-container")) return;
      if (el.closest("#mecard-share-panel, .vcard-download, .mecard-edit-bar, [data-mecard-viral], .mecard-watermark-strip")) return;
      const a = el as HTMLAnchorElement;
      const field = a.getAttribute("data-me-field") || a.closest("[data-me-field]")?.getAttribute("data-me-field") || "";
      const text = a.getAttribute("aria-label") || a.textContent || "";
      const action = classifyContactLink(a.getAttribute("href") || "", field, text);
      if (action) track("contact_action", { meta: action });
    });
    function showEditBar(href: string) {
      const card = document.querySelector(".mecard-public-card");
      if (!card || card.querySelector(".mecard-edit-bar")) return;
      const bar = document.createElement("div");
      bar.className = "mecard-edit-bar";
      const a = document.createElement("a");
      a.href = href;
      a.innerHTML = '<i class="fas fa-pencil-alt" aria-hidden="true"></i> Edit Profile';
      bar.append(a);
      card.append(bar);
      cleanups.push(() => bar.remove());
    }
    function showOwnerUpsell() {
      const body = document.querySelector("#mecard-share-panel .container-fluid");
      if (!body || document.getElementById("mecard-share-upsell")) return;
      const box = document.createElement("div");
      box.className = "mecard-share-upsell";
      box.id = "mecard-share-upsell";
      box.innerHTML =
        `<a href="/manage/profile/${config.profileId}/?utm_source=watermark&amp;utm_medium=share_panel&amp;utm_campaign=pro_upsell" class="mecard-share-upsell__link" data-mecard-viral="share_panel">` +
        '<span class="mecard-share-upsell__icon">&#9733;</span> <span class="mecard-share-upsell__text">Go Pro to remove MeCard branding from your shares</span></a>';
      body.prepend(box);
      cleanups.push(() => box.remove());
    }
    on("click", "#mecard-share-upsell a", () => track("pro_upsell_clicked", { meta: { surface: "share_panel", placement: "share_panel", trigger: "share_panel_open" } }));
    on("click", "div.vcard-button", () => push("download-contact", { file_type: "vcard", file_url: null }));
    on("click", 'button[data-action="whatsapp-number"]', () => push("whatsapp_share"));
    on("click", 'button[data-action="copy-link"]', () => push("copy_link"));
    on("click", 'button[data-action="sms"]', () => push("sms_share"));
    on("click", 'button[data-action="email"]', () => push("email_share"));
    on("click", 'button[data-action="native-share"]', (_e, el) => push("share_action", { method: (el as HTMLElement).dataset.share || "unknown", target: null, content_type: "profile" }));
    on("click", 'button[data-action="download-qr"]', () => push("qr_download", { format: "png", size: null, file_url: null }));

    // ── vCard download ([mecard_vcard_button]) ─────────────
    const vcardLink = document.querySelector<HTMLAnchorElement>(".vcard-button a");
    const iframe = document.getElementById("vcard-download") as HTMLIFrameElement | null;
    const message = document.getElementById("download-message");
    const timers: number[] = [];
    const startDownload = () => {
      if (!vcardLink || !iframe) return;
      const ua = navigator.userAgent;
      const isAndroid = /android/i.test(ua);
      const isIphone = /iphone/i.test(ua);
      let url = `/vcard/?profile_id=${config.profileId}&profile_name=${encodeURIComponent(config.vcardName)}`;
      if (isIphone) url += "&iphone=1";
      setCookie(`me_${config.profileId}`, "1", 10000);
      iframe.src = url;
      if (isAndroid && message) message.style.display = "block";
      vcardLink.textContent = "Downloading...";
      timers.push(window.setTimeout(() => (vcardLink.textContent = "Downloaded"), 5000));
      timers.push(window.setTimeout(() => (vcardLink.textContent = "Download Again"), 7000));
      showPostSaveCta();
    };
    on("click", ".vcard-button a", (e) => {
      e.preventDefault();
      startDownload();
    });
    on("click", "#download-close", () => message && (message.style.display = "none"));
    if (config.autoDownload && !getCookie(`me_${config.profileId}`) && once(`auto:${config.profileId}`)) startDownload();
    cleanups.push(() => timers.forEach(clearTimeout));

    // ── mecard-viral.js (free profiles) ────────────────────
    let shareUrl = config.pageUrl;
    const shareFooter = config.isFree ? ` — Get yours at mecard.co.za` : "";
    let ctaShown = false;
    function showPostSaveCta() {
      if (!config.isFree || ctaShown || owner) return;
      ctaShown = true;
      if (/android/i.test(navigator.userAgent)) {
        const slot = document.getElementById("mecard-download-cta-slot");
        const tpl = document.getElementById("mecard-post-save-cta-tpl");
        if (slot && tpl) slot.replaceChildren(...[...tpl.children].map((n) => n.cloneNode(true)));
      } else {
        const cta = document.getElementById("mecard-post-save-cta");
        if (cta)
          timers.push(
            window.setTimeout(() => {
              cta.style.display = "";
              requestAnimationFrame(() => cta.classList.add("is-visible"));
            }, 2000),
          );
      }
      track("post_save_cta_viewed", { meta: { surface: "post_save" } });
    }
    if (config.isFree) {
      shareUrl += (shareUrl.includes("?") ? "&" : "?") + "utm_source=watermark&utm_medium=share&utm_campaign=free_viral";
      const strip = document.getElementById("mecard-watermark-strip");
      if (strip && "IntersectionObserver" in window) {
        const io = new IntersectionObserver(
          (entries) => {
            if (entries.some((x) => x.isIntersecting)) {
              track("recipient_ad_viewed", { meta: { surface: "profile_strip" } });
              io.disconnect();
            }
          },
          { threshold: 0.5 },
        );
        io.observe(strip);
        cleanups.push(() => io.disconnect());
      }
      // A signup after a viral click is credited to this profile (conversion plan 0.3).
      const markReferral = () => {
        if (!config.profileId) return;
        const value = encodeAcquisition(withReferral(parseAcquisition(getCookie(FIRST_TOUCH_COOKIE)), config.profileId));
        document.cookie = `${FIRST_TOUCH_COOKIE}=${value};max-age=${FIRST_TOUCH_DAYS * 86400};path=/;samesite=lax`;
      };
      on("click", "#mecard-watermark-strip", () => {
        markReferral();
        track("recipient_ad_clicked", { meta: { surface: "profile_strip" } });
      });
      on("click", ".mecard-post-save-cta-inline__btn, .mecard-post-save-cta__btn", () => {
        markReferral();
        track("post_save_cta_clicked");
      });
      on("click", "#mecard-post-save-cta-close", () => {
        const cta = document.getElementById("mecard-post-save-cta");
        if (cta) {
          cta.classList.remove("is-visible");
          timers.push(window.setTimeout(() => (cta.style.display = "none"), 300));
        }
        track("post_save_cta_dismissed");
      });
    }

    // ── Share panel ([mecard_share_panel]) ─────────────────
    const panel = document.getElementById("mecard-share-panel");
    const fab = document.querySelector<HTMLButtonElement>(".mecard-share-fab");
    const scrim = document.querySelector(".mecard-share-scrim");
    if (panel && fab) {
      const waInput = document.getElementById("mecard-wa-msisdn") as HTMLInputElement | null;
      const waFeedback = document.getElementById("mecard-wa-feedback");
      let iti: IntlTelInput | null = null;
      let qrDone = false;

      const makeQr = async () => {
        const box = document.getElementById("mecard-qr-canvas");
        if (!box || qrDone) return;
        qrDone = true;
        const QR = await import("qrcode");
        const canvas = document.createElement("canvas");
        await QR.toCanvas(canvas, config.pageUrl, { width: 256, margin: 0, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } });
        box.replaceChildren(canvas);
        if (config.isFree && !box.parentElement?.querySelector(".mecard-qr-branding")) {
          const b = document.createElement("div");
          b.className = "mecard-qr-branding";
          b.innerHTML = '<span class="mecard-qr-branding__text">Powered by <strong>MeCard</strong></span>';
          box.after(b);
        }
      };

      const open = () => {
        panel.classList.add("is-open");
        panel.setAttribute("data-visible", "true");
        panel.setAttribute("aria-hidden", "false");
        document.body.classList.add("mecard-share-open");
        fab.setAttribute("aria-expanded", "true");
        fab.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
        scrim?.classList.add("is-visible");
        push("share_menu_view", { control: "mecard-share-fab", aria_controls: "mecard-share-panel" });
        if (document.getElementById("mecard-share-upsell") && once("upsell_viewed")) {
          track("upsell_viewed", { meta: { offer: "pro", placement: "share_panel", trigger: "share_panel_open" } });
        }
        void makeQr();
        void initWhatsapp();
        const a2hs = document.getElementById("mecard-a2hs-card");
        if (a2hs && a2hs.style.display !== "none") push("a2hs_prompted");
      };
      const close = () => {
        if (waInput) waInput.value = "";
        setWaFeedback("", false);
        panel.classList.remove("is-open");
        panel.setAttribute("data-visible", "false");
        panel.setAttribute("aria-hidden", "true");
        document.body.classList.remove("mecard-share-open");
        fab.setAttribute("aria-expanded", "false");
        fab.innerHTML = '<i class="fas fa-share-alt" aria-hidden="true"></i>';
        scrim?.classList.remove("is-visible");
      };
      const toggle = () => (panel.classList.contains("is-open") ? close() : open());
      fab.addEventListener("click", toggle);
      scrim?.addEventListener("click", close);
      cleanups.push(() => {
        fab.removeEventListener("click", toggle);
        scrim?.removeEventListener("click", close);
        document.body.classList.remove("mecard-share-open");
      });

      // Swipe left on the profile to open, right on the panel to close (phones).
      if (window.matchMedia("(max-width: 767.98px)").matches) {
        let x0: number | null = null;
        let y0: number | null = null;
        const start = (e: TouchEvent) => {
          x0 = e.touches[0].clientX;
          y0 = e.touches[0].clientY;
        };
        const move = (dir: 1 | -1, act: () => void) => (e: TouchEvent) => {
          if (x0 === null || y0 === null) return;
          const dx = x0 - e.touches[0].clientX;
          const dy = y0 - e.touches[0].clientY;
          if (Math.abs(dx) > Math.abs(dy) && dx * dir > 40) {
            act();
            x0 = y0 = null;
          }
        };
        const profile = document.querySelector(".pro-profile-container");
        const moveOpen = move(1, open);
        const moveClose = move(-1, close);
        profile?.addEventListener("touchstart", start as EventListener, { passive: true });
        profile?.addEventListener("touchmove", moveOpen as EventListener, { passive: true });
        panel.addEventListener("touchstart", start, { passive: true });
        panel.addEventListener("touchmove", moveClose, { passive: true });
      }

      // ?me_share=1&me_share_target=install opens the panel at that card (onboarding links).
      const q = new URLSearchParams(location.search);
      if (q.get("me_share") === "1") {
        const target = q.get("me_share_target");
        timers.push(
          window.setTimeout(() => {
            open();
            const el = target ? panel.querySelector(`[data-share-target="${CSS.escape(target)}"]`) : null;
            if (el) {
              timers.push(window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 180));
              el.classList.add("is-guided-target");
              timers.push(window.setTimeout(() => el.classList.remove("is-guided-target"), 2400));
            }
          }, 150),
        );
        q.delete("me_share");
        q.delete("me_share_target");
        history.replaceState({}, document.title, location.pathname + (q.size ? `?${q}` : "") + location.hash);
      }

      // WhatsApp a number: intl-tel-input from the CDN on first open, as on WordPress.
      function setWaFeedback(msg: string, isError: boolean) {
        if (!waFeedback) return;
        waFeedback.hidden = !msg;
        waFeedback.textContent = msg;
        waFeedback.classList.toggle("text-success", !!msg && !isError);
        waFeedback.classList.toggle("text-danger", !!msg && isError);
        waInput?.classList.toggle("is-invalid", !!msg && isError);
        waInput?.classList.toggle("is-valid", !!msg && !isError);
      }
      async function initWhatsapp() {
        if (!waInput || iti) return;
        await loadIntlTelInput();
        if (!window.intlTelInput || iti) return;
        const last = safeStorage("get", "mecard.share.whatsapp.country");
        iti = window.intlTelInput(waInput, {
          initialCountry: last || countryHint() || "za",
          countryOrder: ["za", "gb", "us"],
          autoPlaceholder: "polite",
          countrySearch: true,
          dropdownContainer: document.body,
          nationalMode: true,
          separateDialCode: true,
        });
        waInput.addEventListener("countrychange", () => {
          const c = iti?.getSelectedCountryData()?.iso2;
          if (c) safeStorage("set", "mecard.share.whatsapp.country", c);
        });
        waInput.addEventListener("input", () => setWaFeedback("", false));
      }
      const waDigits = () => {
        if (!waInput) return "";
        const raw = waInput.value.trim();
        if (raw.startsWith("+") || raw.startsWith("00")) return raw.replace(/^00/, "+").replace(/[^\d]/g, "");
        const dial = iti?.getSelectedCountryData()?.dialCode ?? "27";
        let local = raw.replace(/[^\d]/g, "");
        if (!local) return "";
        if (local.startsWith("0")) local = local.slice(1);
        return `${dial}${local}`;
      };

      const onPanelClick = (e: Event) => {
        const btn = (e.target as Element).closest<HTMLButtonElement>("button[data-action]");
        if (!btn) return;
        const action = btn.dataset.action;
        const enc = encodeURIComponent;
        if (action === "whatsapp-number") {
          e.preventDefault();
          const digits = waDigits();
          if (digits.length < 8) {
            setWaFeedback("Please enter a valid WhatsApp number.", true);
            return;
          }
          const c = iti?.getSelectedCountryData()?.iso2;
          if (c) safeStorage("set", "mecard.share.whatsapp.country", c);
          if (waInput) waInput.value = "";
          setWaFeedback("", false);
          window.open(`https://wa.me/${digits}?text=${enc(`Hi, here’s my profile: ${shareUrl}${shareFooter}`)}`, "_blank", "noopener");
        }
        if (action === "download-qr") {
          const canvas = document.querySelector<HTMLCanvasElement>("#mecard-qr-canvas canvas");
          if (canvas) {
            const a = document.createElement("a");
            a.href = canvas.toDataURL("image/png");
            a.download = "mecard-qr.png";
            document.body.appendChild(a);
            a.click();
            a.remove();
          }
        }
        if (action === "native-share") {
          const data = { title: document.title || "My profile", text: "Here’s my smart business card:" + (shareFooter ? "\n" + shareFooter : ""), url: shareUrl };
          if (navigator.share) navigator.share(data).catch(() => {});
          else copy(btn, '<i class="fas fa-share-alt"></i> Share link');
        }
        if (action === "copy-link") copy(btn, '<i class="fas fa-link"></i> Copy link');
        if (action === "email") {
          const footer = shareFooter ? `%0D%0A%0D%0A${enc(shareFooter)}` : "";
          location.href = `mailto:?subject=${enc("My smart business card")}&body=Hi,%0D%0A%0D%0AHere's my profile:%0D%0A${enc(shareUrl)}${footer}`;
        }
        if (action === "sms") {
          const body = enc(`My profile: ${shareUrl}${shareFooter}`);
          location.href = /iPad|iPhone|iPod/.test(navigator.userAgent) ? `sms:&body=${body}` : `sms:?body=${body}`;
        }
      };
      const copy = (btn: HTMLButtonElement, label: string) => {
        if (!navigator.clipboard) return alert("Press and hold to copy");
        navigator.clipboard
          .writeText(shareUrl)
          .then(() => {
            btn.innerHTML = '<i class="fas fa-check"></i> Copied';
            timers.push(window.setTimeout(() => (btn.innerHTML = label), 1200));
          })
          .catch(() => alert("Press and hold to copy"));
      };
      panel.addEventListener("click", onPanelClick);
      cleanups.push(() => panel.removeEventListener("click", onPanelClick));

      // Add to Home Screen.
      const show = (id: string) => document.getElementById(id)?.style.removeProperty("display");
      const hide = (id: string) => document.getElementById(id)?.style.setProperty("display", "none");
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      const onBip = (e: Event) => {
        e.preventDefault();
        window.MECARD_BIP = e as BeforeInstallPrompt;
        show("mecard-a2hs-card");
        show("mecard-a2hs-android");
        hide("mecard-a2hs-ios");
      };
      const onInstalled = () => {
        show("mecard-a2hs-card");
        hide("mecard-a2hs-ios");
        hide("mecard-a2hs-android");
        show("mecard-a2hs-installed");
        push("a2hs_installed");
      };
      window.addEventListener("beforeinstallprompt", onBip, { once: true });
      window.addEventListener("appinstalled", onInstalled);
      cleanups.push(() => {
        window.removeEventListener("beforeinstallprompt", onBip);
        window.removeEventListener("appinstalled", onInstalled);
      });
      const installBtn = document.getElementById("mecard-a2hs-install-btn");
      const onInstall = async () => {
        push("a2hs_prompt_clicked");
        const bip = window.MECARD_BIP;
        if (!bip) {
          alert('If you don\'t see an install prompt, open Chrome menu (⋮) → "Install app".');
          return;
        }
        await bip.prompt();
        const { outcome } = await bip.userChoice;
        push("a2hs_prompt_result", { outcome });
        if (outcome === "accepted") {
          hide("mecard-a2hs-android");
          show("mecard-a2hs-installed");
        }
        window.MECARD_BIP = null;
      };
      installBtn?.addEventListener("click", onInstall);
      cleanups.push(() => installBtn?.removeEventListener("click", onInstall));
      const desktopReview = !isIOS && !window.matchMedia("(max-width: 767.98px)").matches;
      if (isIOS && !standalone) {
        show("mecard-a2hs-card");
        show("mecard-a2hs-ios");
        hide("mecard-a2hs-android");
      }
      if (desktopReview) {
        show("mecard-a2hs-card");
        show("mecard-a2hs-ios");
        show("mecard-a2hs-android");
      }
      if (q.get("me_share_target") === "install" && !isIOS && !desktopReview) {
        show("mecard-a2hs-card");
        show("mecard-a2hs-android");
      }
    }

    return () => cleanups.forEach((f) => f());
  }, [config]);

  return null;
}

// ── helpers ──────────────────────────────────────────────

interface IntlTelInput {
  getSelectedCountryData(): { iso2?: string; dialCode?: string } | undefined;
}
declare global {
  interface Window {
    intlTelInput?: (input: HTMLInputElement, options: Record<string, unknown>) => IntlTelInput;
  }
}

let intlTelLoading: Promise<void> | null = null;
function loadIntlTelInput() {
  if (window.intlTelInput) return Promise.resolve();
  intlTelLoading ??= new Promise<void>((resolve) => {
    const base = `https://cdn.jsdelivr.net/npm/intl-tel-input@${INTL_TEL_VERSION}/build`;
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${base}/css/intlTelInput.css`;
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = `${base}/js/intlTelInput.min.js`;
    js.async = true;
    js.onload = () => resolve();
    js.onerror = () => resolve(); // falls back to plain number entry
    document.head.appendChild(js);
  });
  return intlTelLoading;
}

// From the time zone only: most browsers in South Africa report en-US, which would pick the US.
function countryHint() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  return ({ "Africa/Johannesburg": "za", "Europe/London": "gb", "America/New_York": "us", "Australia/Sydney": "au", "Pacific/Auckland": "nz" } as Record<string, string>)[tz] ?? "";
}

function safeStorage(op: "get" | "set", key: string, value?: string) {
  try {
    if (op === "get") return localStorage.getItem(key) ?? "";
    localStorage.setItem(key, value ?? "");
  } catch {
    // private mode, blocked storage
  }
  return "";
}
