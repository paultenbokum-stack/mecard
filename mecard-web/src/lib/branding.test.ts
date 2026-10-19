import { test } from "node:test";
import assert from "node:assert/strict";
import { designCss, fontToStack, scopeCss } from "./branding";
import type { Company } from "./public-profile";

const S = ".pro-profile-container.post-7";

test("plain rules are prefixed like the WordPress scope_css()", () => {
  assert.equal(scopeCss(".pro-logo img { margin-bottom: 50px; }\n\ndiv.a, span.b > i {color:red}", S), `${S} .pro-logo img { margin-bottom: 50px; }\n${S} div.a, ${S} span.b > i {color:red}`);
});

test("@media blocks are scoped inside; @font-face and @keyframes pass through", () => {
  const out = scopeCss("@media only screen and (max-width: 640px) {\n div#content { color: red; }\n}\n@font-face { font-family: X; src: url(x.woff2); }\n@keyframes spin { from { opacity: 0 } to { opacity: 1 } }", S);
  assert.match(out, /^@media only screen and \(max-width: 640px\) \{\n\.pro-profile-container\.post-7 div#content \{ color: red; \}\n\}/);
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

test("font stacks: quoted families were dropped by WordPress and stay dropped", () => {
  assert.equal(fontToStack("opensans"), '"Open Sans", sans-serif');
  assert.equal(fontToStack(""), '"Montserrat", sans-serif');
  assert.equal(fontToStack("Lato"), "Lato");
  const company = { headingFont: "Montserrat", bodyFont: "opensans", headingColour: "#000000", bodyColour: "#666366", accentColour: "#f78620", buttonTextColour: "#ffffff", downloadColour: "#000000", downloadTextColour: "#f78620", customCss: "" } as Company;
  const css = designCss(7, company);
  assert.match(css, /\.post-7 h1, .*\{ font-family: var\(--font-montserrat\), Montserrat, sans-serif; color: #000000; \}/);
  assert.match(css, new RegExp(`${S.replace(/\./g, "\\.")} \\{ color: #666366;  \\}`), "Open Sans body font is not applied");
  assert.match(css, /#vcard-button-7\.vcard-button \{ background-color: #000000; \}/);
  assert.match(css, /button:not\(\.mecard-share-fab\) \{ background-color: #f78620; color: #ffffff; border: 0; \}/);
});

test("colour values that aren't colours are left out", () => {
  const company = { headingFont: "", bodyFont: "", headingColour: "red;} body{display:none", bodyColour: "", accentColour: "", buttonTextColour: "", downloadColour: "", downloadTextColour: "", customCss: "" } as Company;
  const css = designCss(1, company);
  assert.ok(!css.includes("display:none"));
  assert.match(css, /color: #333333;/, "empty colours fall back to the WordPress defaults");
});
