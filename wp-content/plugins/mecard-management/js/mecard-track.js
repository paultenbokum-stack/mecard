(function () {
    'use strict';

    var cfg   = window.MECARD_TRACK || {};
    var endpoint = cfg.endpoint || '';
    var debug    = !!cfg.debug;

    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : '';
    }

    function getSessionId() {
        var sid = getCookie('mecard_sid');
        if (!sid) {
            // Client-side fallback for first pageview before server sets the cookie
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                sid = 'cs-' + crypto.randomUUID();
            } else {
                sid = 'cs-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
            }
        }
        return sid;
    }

    function getSource() {
        try {
            var params = new URLSearchParams(location.search);
            return params.get('me_source') || params.get('utm_source') || cfg.defaultSource || null;
        } catch (e) {
            return cfg.defaultSource || null;
        }
    }

    /**
     * Track an event to the MeCard custom event store.
     *
     * @param {string} eventName - Snake_case event name from the allowed list.
     * @param {Object} [params]  - Optional params: profile_id, company_id, source, meta.
     */
    window.mecardTrack = function (eventName, params) {
        if (!endpoint) return;

        params = params || {};

        var payload = {
            event_name: eventName,
            session_id: getSessionId(),
            profile_id: params.profile_id || cfg.profileId || null,
            company_id: params.company_id || cfg.companyId || null,
            source:     params.source     || getSource(),
            referrer:   document.referrer || null,
            meta:       params.meta       || null
        };

        if (debug) {
            console.debug('[mecardTrack]', eventName, payload);
        }

        var body = JSON.stringify(payload);

        // Prefer sendBeacon — survives page unload
        if (navigator.sendBeacon) {
            navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
        } else {
            // Fallback for older browsers
            var xhr = new XMLHttpRequest();
            xhr.open('POST', endpoint, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(body);
        }
    };
})();
