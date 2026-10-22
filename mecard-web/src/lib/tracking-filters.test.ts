import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyContactLink } from "./contact-action";
import { deviceClass, isBotUserAgent } from "./tracking";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  cubot: "Mozilla/5.0 (Linux; Android 12; CUBOT X50) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  fbInApp: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]",
};

test("device class from the user agent", () => {
  assert.equal(deviceClass(UA.iphone), "phone");
  assert.equal(deviceClass(UA.android), "phone");
  assert.equal(deviceClass(UA.cubot), "phone");
  assert.equal(deviceClass(UA.androidTablet), "tablet");
  assert.equal(deviceClass(UA.ipad), "tablet");
  assert.equal(deviceClass(UA.windows), "desktop");
  assert.equal(deviceClass(""), null);
});

test("crawlers, link previews and headless browsers are bots; people (and in-app browsers) aren't", () => {
  for (const ua of [
    "WhatsApp/2.23.20.0 A",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "Twitterbot/1.0",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
    "TelegramBot (like TwitterBot)",
    "curl/8.4.0",
    "",
  ]) assert.equal(isBotUserAgent(ua), true, ua);
  for (const ua of [UA.iphone, UA.android, UA.windows, UA.cubot, UA.fbInApp, UA.ipad]) assert.equal(isBotUserAgent(ua), false, ua);
});

test("contact links are classified by what they do", () => {
  assert.deepEqual(classifyContactLink("tel:+27%2011%20719%208000", "company-phone"), { kind: "call", label: "company-phone" });
  assert.deepEqual(classifyContactLink("mailto:a@b.co", "email"), { kind: "email", label: "email" });
  assert.deepEqual(classifyContactLink("https://wa.me/27611565934", "wa"), { kind: "whatsapp", label: "wa" });
  assert.deepEqual(classifyContactLink("sms:+27611565934"), { kind: "sms", label: "sms" });
  assert.deepEqual(classifyContactLink("https://www.google.com/maps/search/?api=1&query=x", "company-directions"), { kind: "map", label: "company-directions" });
  assert.deepEqual(classifyContactLink("https://www.linkedin.com/in/someone", "", "linkedin"), { kind: "social", label: "linkedin" });
  assert.deepEqual(classifyContactLink("https://www.qlink.co.za/hr.php", "company-website"), { kind: "website", label: "company-website" });
  assert.deepEqual(classifyContactLink("https://shop.example.com/x", "", "  Our   brochure "), { kind: "website", label: "Our brochure" });
  assert.equal(classifyContactLink("#", "email"), null);
  assert.equal(classifyContactLink("javascript:void(0)"), null);
});
