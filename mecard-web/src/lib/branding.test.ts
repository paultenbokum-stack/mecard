import { test } from "node:test";
import assert from "node:assert/strict";
import { designCss, fontToStack, scopeCss, scopeSelector, withFontFallback } from "./branding";
import type { Company } from "./public-profile";

const S = ".pro-profile-container.post-7";

const company = (over: Partial<Company> = {}) =>
  ({ headingFont: "", bodyFont: "", headingColour: "", bodyColour: "", accentColour: "", buttonTextColour: "", downloadColour: "", downloadTextColour: "", customCss: "", ...over }) as Company;

test("plain rules are prefixed like the WordPress scope_css()", () => {
  assert.equal(scopeCss(".pro-logo img { margin-bottom: 50px; }\n\ndiv.a, span.b > i {color:red}", S), `${S} .pro-logo img { margin-bottom: 50px; }\n${S} div.a, ${S} span.b > i {color:red}`);
});

test("rules written for the profile container itself apply to the profile", () => {
  assert.equal(scopeSelector("div.pro-profile-container h1", S), `${S} h1`);
  assert.equal(scopeSelector(".pro-profile-container .profile-buttons button.email", S), `${S} .profile-buttons button.email`);
  assert.equal(scopeSelector("div.pro-profile-container", S), S);
  assert.equal(scopeSelector("div.pro-profile-container > h1.has-text-align-center", S), `${S} > h1.has-text-align-center`);
  assert.equal(scopeSelector(".pro-profile-container-x a", S), `${S} .pro-profile-container-x a`);
});

test("page-level selectors apply to the profile; theme footer rules to this page's footer", () => {
  assert.equal(scopeSelector("body", S), S);
  assert.equal(scopeSelector("div#content", S), S);
  assert.equal(scopeSelector("html body h1", S), `${S} h1`);
  assert.equal(scopeSelector("body > .x", S), `${S} > .x`);
  assert.equal(scopeSelector(".ast-footer-copyright", S), ".mc-site-footer__copy");
  assert.equal(scopeSelector(".ast-footer-copyright p", S), ".mc-site-footer__copy p");
  assert.equal(scopeSelector("bodyguard", S), `${S} bodyguard`);
});

test("custom font lists get a fallback; @font-face names are left alone", () => {
  assert.equal(withFontFallback("\nfont-family: Brandon !important;\n"), "\nfont-family: Brandon, sans-serif !important;\n");
  assert.equal(withFontFallback(" font-family: 'Calibri'"), " font-family: 'Calibri', sans-serif");
  assert.equal(withFontFallback("font-family: 'Questrial', sans-serif;"), "font-family: 'Questrial', sans-serif;");
  assert.equal(withFontFallback("color: red; font-family: inherit;"), "color: red; font-family: inherit;");
  assert.match(scopeCss("@font-face { font-family: Brandon; src: url(b.woff2); }", S), /font-family: Brandon;/);
  assert.match(scopeCss("div.pro-profile-container h1 { font-family: Brandon !important; }", S), /\.post-7 h1 \{ font-family: Brandon, sans-serif !important; \}/);
});

test("@media blocks are scoped inside; @font-face and @keyframes pass through", () => {
  const out = scopeCss("@media only screen and (max-width: 640px) {\n div#content { color: red; }\n}\n@font-face { font-family: X; src: url(x.woff2); }\n@keyframes spin { from { opacity: 0 } to { opacity: 1 } }", S);
  assert.match(out, /^@media only screen and \(max-width: 640px\) \{\n\.pro-profile-container\.post-7 \{ color: red; \}\n\}/);
  assert.match(out, /@font-face \{ font-family: X; src: url\(x\.woff2\); \}/);
  assert.match(out, /@keyframes spin \{ from \{ opacity: 0 \} to \{ opacity: 1 \} \}/);
});

test("Google Fonts imports are hoisted, other imports and stray text dropped", () => {
  const out = scopeCss("a{color:red}\n@import url('https://fonts.googleapis.com/css2?family=Lato');\n@import url(https://evil.example/x.css);", S);
  assert.equal(out.split("\n")[0], "@import url('https://fonts.googleapis.com/css2?family=Lato');");
  assert.ok(!out.includes("evil"));
  assert.equal(scopeCss("Founded in 1965, we have been serving customers ever since.", S), "");
});

test("custom CSS cannot close the style element", () => {
  assert.ok(!/<\/style/i.test(scopeCss("a{color:red}</style><script>alert(1)</script>", S)));
});

test("chosen fonts apply, quoted names included; no choice leaves the theme fonts", () => {
  assert.equal(fontToStack("opensans"), 'var(--font-open-sans), "Open Sans", sans-serif');
  assert.equal(fontToStack("playfairdisplay"), 'var(--font-playfair), "Playfair Display", serif');
  assert.equal(fontToStack(""), "");
  assert.equal(fontToStack("Lato"), "Lato");
  const css = designCss(7, company({ headingFont: "Montserrat", bodyFont: "opensans", headingColour: "#000000", bodyColour: "#666366", accentColour: "#f78620", buttonTextColour: "#ffffff", downloadColour: "#000000", downloadTextColour: "#f78620" }));
  assert.match(css, /\.post-7 h1, .*\{ font-family: var\(--font-montserrat\), Montserrat, sans-serif; color: #000000; \}/);
  assert.match(css, /\.post-7 \{ color: #666366; font-family: var\(--font-open-sans\), "Open Sans", sans-serif; \}/);
  assert.match(css, /#vcard-button-7\.vcard-button \{ background-color: #000000; \}/);
  assert.match(css, /button:not\(\.mecard-share-fab\) \{ background-color: #f78620; color: #ffffff; border: 0; \}/);
  assert.ok(!designCss(7, company()).includes("font-family"), "no font chosen → no font rule");
});

test("values that could break out of the declaration are left out", () => {
  const css = designCss(1, company({ headingColour: "red;} body{display:none", bodyFont: "x;} body{display:none" }));
  assert.ok(!css.includes("display:none"));
  assert.match(css, /color: #333333;/, "empty colours fall back to the WordPress defaults");
});
