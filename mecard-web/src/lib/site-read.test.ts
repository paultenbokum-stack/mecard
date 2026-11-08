import assert from "node:assert/strict";
import { test } from "node:test";
import { brandColours, firstStylesheet, isPrivateAddress, normaliseSiteUrl, parseCompanySite } from "./site-read";

const BASE = "https://acme.example/";

test("structured data wins over meta tags", () => {
  const html = `<title>Home | Wrong</title><meta property="og:site_name" content="Also wrong">
  <script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"Acme &amp; Sons","logo":{"url":"/logo.png"},"telephone":"031 000 0000","email":"hi@acme.example","sameAs":["https://www.linkedin.com/company/acme"],"address":{"streetAddress":"12 Harbour Road","addressLocality":"Durban","postalCode":"4001"}}]}</script>`;
  const r = parseCompanySite(html, BASE);
  assert.equal(r.name, "Acme & Sons");
  assert.equal(r.logoUrl, "https://acme.example/logo.png");
  assert.equal(r.phone, "031 000 0000");
  assert.equal(r.email, "hi@acme.example");
  assert.equal(r.address, "12 Harbour Road, Durban, 4001");
  assert.deepEqual(r.socials.map((s) => s.label), ["LinkedIn"]);
});

test("a plain page still gives its details", () => {
  const html = `<title>Welcome - Riverside Logistics</title><meta name="description" content="Road freight.">
  <img class="site-logo" src="img/brand.png"><a href="tel:031%20000%200000">Call</a><a href="mailto:info@riverside.example?subject=x">Mail</a>
  <a href="https://facebook.com/sharer/sharer.php?u=x">Share</a><a href="https://www.facebook.com/riverside">FB</a>`;
  const r = parseCompanySite(html, BASE);
  assert.equal(r.name, "Riverside Logistics");
  assert.equal(r.description, "Road freight.");
  assert.equal(r.logoUrl, "https://acme.example/img/brand.png");
  assert.equal(r.phone, "031 000 0000");
  assert.equal(r.email, "info@riverside.example");
  assert.equal(r.socials[0].url, "https://www.facebook.com/riverside");
});

test("broken JSON-LD doesn't stop the read", () => {
  const r = parseCompanySite(`<script type="application/ld+json">{oops</script><title>Acme</title>`, BASE);
  assert.equal(r.name, "Acme");
});

test("brand colours skip greys and rank by use, with the theme colour first", () => {
  const css = "a{color:#0f766e}b{color:#0f766e}c{color:#b45309}d{color:#ffffff}e{color:#333}f{color:#808080}";
  assert.deepEqual(brandColours(css, "#c42f3a"), ["#c42f3a", "#0f766e", "#b45309"]);
  assert.deepEqual(brandColours("a{color:#f00}"), ["#ff0000"]);
});

test("stylesheets skip Google Fonts", () => {
  const html = `<link rel="stylesheet" href="https://fonts.googleapis.com/css?x"><link href="/main.css" rel="stylesheet">`;
  assert.equal(firstStylesheet(html, BASE), "https://acme.example/main.css");
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
