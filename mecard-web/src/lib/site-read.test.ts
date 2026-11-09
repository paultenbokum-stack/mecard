import assert from "node:assert/strict";
import { test } from "node:test";
import { contrast, decodeEntities, domainKey, domainScore, guessPalette, isPrivateAddress, logoColours, matchFont, normaliseSiteUrl, parseColour, parseCompanySite, stylesheets } from "./site-read";

const BASE = "https://acme.example/";

test("structured data wins over meta tags", () => {
  const html = `<title>Home | Wrong</title><meta property="og:site_name" content="Also wrong">
  <script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"Acme &amp; Sons","logo":{"url":"/logo.png"},"telephone":"031 000 0000","email":"hi@acme.example","sameAs":["https://www.linkedin.com/company/acme"],"address":{"streetAddress":"12 Harbour Road","addressLocality":"Durban","postalCode":"4001"}}]}</script>`;
  const r = parseCompanySite(html, BASE);
  assert.equal(r.name, "Acme & Sons");
  assert.equal(r.nameFrom, "structured");
  assert.equal(r.logos[0].url, "https://acme.example/logo.png");
  assert.equal(r.phone, "031 000 0000");
  assert.equal(r.email, "hi@acme.example");
  assert.equal(r.address, "12 Harbour Road, Durban, 4001");
  assert.deepEqual(r.socials.map((s) => s.label), ["LinkedIn"]);
});

test("a plain page still gives its details", () => {
  const html = `<title>Welcome - Riverside Logistics</title><meta name="description" content="Road freight.">
  <img class="site-logo" src="img/brand.png"><a href="tel:031%20000%200000">Call</a><a href="mailto:info@riverside.example?subject=x">Mail</a>
  <a href="https://facebook.com/sharer/sharer.php?u=x">Share</a><a href="https://www.facebook.com/riverside">FB</a>`;
  const r = parseCompanySite(html, "https://riverside.example/");
  assert.equal(r.name, "Riverside Logistics");
  assert.equal(r.description, "Road freight.");
  assert.equal(r.logos[0].url, "https://riverside.example/img/brand.png");
  assert.equal(r.phone, "031 000 0000");
  assert.equal(r.email, "info@riverside.example");
  assert.equal(r.socials[0].url, "https://www.facebook.com/riverside");
});

test("broken JSON-LD doesn't stop the read", () => {
  const r = parseCompanySite(`<script type="application/ld+json">{oops</script><title>Acme</title>`, BASE);
  assert.equal(r.name, "Acme");
});

test("every entity is decoded, including hex and double-encoded ones", () => {
  assert.equal(decodeEntities("everyone&#x27;s &#8211; Smith &#038; Sons&rsquo; caf&eacute;"), "everyone's – Smith & Sons’ café");
  const r = parseCompanySite(`<title>Smith &amp;#038; Sons</title>`, "https://smithandsons.co.za/");
  assert.equal(r.name, "Smith & Sons");
});

test("the domain decides which part of the title is the name", () => {
  assert.equal(domainKey("https://app.guestwave.co/"), "guestwave");
  assert.equal(domainKey("https://www.smith-jones.co.za/about"), "smithjones");
  const r = parseCompanySite(`<title>GuestWave — one tap, everyone&#x27;s in the moment</title><h1>One tap. Everyone’s in the moment.</h1>`, "https://app.guestwave.co/");
  assert.equal(r.name, "GuestWave");
  assert.equal(r.nameFrom, "domain");
  const wp = parseCompanySite(`<title>About us – Riverside Logistics</title>`, "https://riversidelogistics.co.za/");
  assert.equal(wp.name, "Riverside Logistics");
  assert.equal(domainScore("Bowman Clarke Law", "bcl"), 2);
  assert.ok(domainScore("Acme (Pty) Ltd", "acme") >= 4);
});

test("a name that matches nothing is a guess for the AI step, with hints", () => {
  const r = parseCompanySite(`<title>Leading attorneys in Durban | Since 1980</title><footer>© 2026 Bowman Clarke Law. All rights reserved.</footer>`, "https://bcl.co.za/");
  assert.equal(r.name, "Bowman Clarke Law");
  assert.equal(r.nameFrom, "domain");
  const g = parseCompanySite(`<title>Leading attorneys in Durban | Since 1980</title>`, "https://xyz.co.za/");
  assert.equal(g.nameFrom, "title");
  assert.equal(g.name, "Leading attorneys in Durban");
  assert.ok(g.nameHints.length > 0);
});

test("the logo is found in the header's home link, inline svg included", () => {
  const html = `<body><header class="site-header"><a href="/about"><img src="/team.jpg" width="300"></a><a href="https://acme.example/" class="brand"><img data-src="/img/acme-mark.png" src="data:image/gif;base64,R0"></a></header><img class="partner-logo" src="/partner.png"></body>`;
  assert.equal(parseCompanySite(html, BASE).logos[0].url, "https://acme.example/img/acme-mark.png");
  const svg = parseCompanySite(`<body><header><a href="/"><svg viewBox="0 0 100 20"><path d="M0 0h10v10z"/></svg></a></header></body>`, BASE).logos[0];
  assert.equal(svg.url, "");
  assert.match(svg.svg ?? "", /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  const wp = parseCompanySite(`<a href="/" class="custom-logo-link"><img class="custom-logo" srcset="/l-300.png 300w, /l-600.png 600w" src="/l-300.png"></a>`, BASE);
  assert.equal(wp.logos[0].url, "https://acme.example/l-600.png");
  assert.equal(wp.logos[0].source, "site-logo");
});

test("colours parse from hex, rgb, hsl and variables", () => {
  const vars = new Map([["--brand", "#C42F3A"], ["--alias", "var(--brand)"]]);
  assert.equal(parseColour("var(--alias)", vars), "#c42f3a");
  assert.equal(parseColour("rgb(255 0 0 / 1)"), "#ff0000");
  assert.equal(parseColour("rgba(0,0,0,0.1)"), null);
  assert.equal(parseColour("hsl(0, 100%, 50%)"), "#ff0000");
  assert.equal(parseColour("#abc"), "#aabbcc");
});

test("Elementor's global colours and fonts become the palette", () => {
  const css = `.elementor-kit-5{--e-global-color-primary:#0B3D59;--e-global-color-secondary:#E8A33D;--e-global-color-text:#4A4A4A;--e-global-typography-primary-font-family:"Poppins";--e-global-typography-text-font-family:"Lato"}
  .elementor-kit-5 h1{color:var(--e-global-color-primary)}`;
  const { palette } = guessPalette(css);
  assert.equal(palette.accentColour, "#0b3d59");
  assert.equal(palette.buttonTextColour, "#ffffff");
  assert.equal(palette.downloadColour, "#e8a33d");
  assert.equal(palette.bodyColour, "#4a4a4a");
  assert.equal(palette.headingColour, "#0b3d59");
  assert.equal(palette.headingFont, "Montserrat");
  assert.equal(palette.bodyFont, "opensans");
});

test("button styles beat colour counts, and stock and hover colours are ignored", () => {
  const css = `a{color:#cf2e2e}.x{color:#cf2e2e}.y{color:#cf2e2e}.btn-primary{background-color:#127a3a;color:#fff}.btn-primary:hover{background:#ff00ff}
  h1,h2{color:#14213d;font-family:'Playfair Display',serif}body{color:#333;font-family:Roboto,sans-serif}.z{border-color:#f39c12}.w{color:#f39c12}`;
  const { palette, colours } = guessPalette(css);
  assert.equal(palette.accentColour, "#127a3a");
  assert.equal(palette.buttonTextColour, "#ffffff");
  assert.equal(palette.headingColour, "#14213d");
  assert.equal(palette.headingFont, "playfairdisplay");
  assert.equal(palette.bodyFont, "Roboto");
  assert.ok(!colours.includes("#cf2e2e"));
});

test("text that wouldn't read on white is dropped, and button text keeps contrast", () => {
  const { palette } = guessPalette(`h1{color:#ffffff}body{color:#dddddd}button{background:#ffd60a;color:#ffffff}`);
  assert.equal(palette.headingColour, "");
  assert.equal(palette.bodyColour, "");
  assert.equal(palette.accentColour, "#ffd60a");
  assert.ok(contrast(palette.buttonTextColour, palette.accentColour) >= 4.5);
});

test("fonts map to the profile's choices", () => {
  assert.equal(matchFont("Open Sans", "body"), "opensans");
  assert.equal(matchFont("Lora", "heading"), "playfairdisplay");
  assert.equal(matchFont("Lora", "body"), "Merriweather");
  assert.equal(matchFont("Poppins", "heading"), "Montserrat");
  assert.equal(matchFont("Font Awesome 6 Free", "body"), "");
});

test("a logo's main colour, and whether it's white", () => {
  const px = (r: number, g: number, b: number, a = 255, n = 50) => Array.from({ length: n }, () => [r, g, b, a]).flat();
  const red = logoColours(Uint8Array.from([...px(200, 20, 40), ...px(0, 0, 0, 0, 200)]));
  assert.equal(red.colour, "#c81428");
  assert.equal(red.light, false);
  assert.equal(logoColours(Uint8Array.from(px(255, 255, 255))).light, true);
});

test("stylesheets skip Google Fonts and core files, theme first", () => {
  const html = `<link rel="stylesheet" href="https://fonts.googleapis.com/css?x"><link href="/wp-includes/css/x.css" rel="stylesheet"><link href="/main.css" rel="stylesheet"><link rel="stylesheet" href="/wp-content/themes/astra/style.css">`;
  assert.deepEqual(stylesheets(html, BASE), ["https://acme.example/wp-content/themes/astra/style.css", "https://acme.example/main.css"]);
});

test("website addresses are normalised and bad ones refused", () => {
  assert.equal(normaliseSiteUrl("acme.co.za"), "https://acme.co.za/");
  assert.equal(normaliseSiteUrl("http://acme.co.za/about"), "http://acme.co.za/about");
  for (const bad of ["", "not a site", "localhost", "ftp://acme.co.za", "https://user:pw@acme.co.za", "https://acme.co.za:8080/"]) {
    assert.equal(normaliseSiteUrl(bad), null, bad);
  }
});

test("private addresses are refused", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) assert.equal(isPrivateAddress(ip), false, ip);
});
