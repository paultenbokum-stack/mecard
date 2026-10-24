import { test } from "node:test";
import assert from "node:assert/strict";
import { checkContact, rateLimited } from "./contact";
import { conditionAudience, convertPostContent, mapLink, wrapGroupContent } from "./wp-content";

test("mapLink makes own links relative and maps dead and old paths", () => {
  assert.equal(mapLink("https://mecard.co.za/sign-up/"), "/sign-up/");
  assert.equal(mapLink("https://localhost/mecard/for-teams/"), "/for-teams/");
  assert.equal(mapLink("/get-started/"), "/sign-up/");
  assert.equal(mapLink("/teams/"), "/for-teams/");
  assert.equal(mapLink("https://mecard.co.za/manage-mecard-profiles/new-cards-and-tags"), "/manage/cards/?tab=new");
  assert.equal(mapLink("https://mecard.co.za/manage"), "/manage/");
  assert.equal(mapLink("/how-it-works?x=1"), "/how-it-works/?x=1");
  assert.equal(mapLink("/wp-content/uploads/a.png"), "/wp-content/uploads/a.png");
  assert.equal(mapLink("#mc-teams-how"), "#mc-teams-how");
  assert.equal(mapLink("https://taggable.co.za/privacy/"), "https://taggable.co.za/privacy/");
});

test("Toolset conditions become logged-in / logged-out wrappers", () => {
  assert.equal(conditionAudience(`  ( ( '[wpv-current-user info="role"]' eq '' ) ) `), "out");
  assert.equal(conditionAudience(`  ( empty( '[wpv-current-user info="id"]') ) `), "out");
  assert.equal(conditionAudience(` NOT ( empty( '[wpv-current-user info="id"]') ) `), "in");
  assert.equal(conditionAudience(`( ( '[wpv-current-user info="role"]' eq 'author' ) )`), "in");
  const { html } = convertPostContent(`[wpv-conditional if="  ( ( '[wpv-current-user info="role"]' eq '' ) ) " ]<p>Sign up</p>[/wpv-conditional]`);
  assert.equal(html, '<div class="mc-when-out"><p>Sign up</p></div>');
});

test("blocks get the classes WordPress adds when rendering", () => {
  const { html } = convertPostContent(
    `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->\n<div class="wp-block-buttons"><!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link" href="https://mecard.co.za/sign-up/">Go</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->`,
  );
  assert.match(html, /class="wp-block-buttons is-layout-flex wp-block-buttons-is-layout-flex is-content-justification-center"/);
  assert.match(html, /href="\/sign-up\/"/);
  assert.doesNotMatch(html, /wp:/);
});

test("groups get an inner container; full-width ones no layout classes", () => {
  const src = `<!-- wp:group {"align":"full","layout":{"type":"constrained"}} -->\n<div class="wp-block-group alignfull"><!-- wp:heading -->\n<h2 class="wp-block-heading">Hi</h2>\n<!-- /wp:heading --></div>\n<!-- /wp:group -->`;
  assert.equal(wrapGroupContent(src).match(/wp-block-group__inner-container/g)?.length, 1);
  const { html } = convertPostContent(src.replace('"align":"full",', "").replace(" alignfull", ""));
  assert.match(html, /^<div class="wp-block-group is-layout-constrained wp-block-group-is-layout-constrained"><div class="wp-block-group__inner-container">/);
  assert.doesNotMatch(convertPostContent(src).html, /is-layout-constrained/);
});

test("accordion panels start closed except the open item; shortcodes become slots or are dropped", () => {
  const { html, dropped } = convertPostContent(
    `<div class="wp-block-accordion-item is-open"><h3>A</h3><div role="region" class="wp-block-accordion-panel"><p>1</p></div></div><div class="wp-block-accordion-item"><h3>B</h3><div role="region" class="wp-block-accordion-panel"><p>2</p></div></div>[cred-form form="contact-us" ][instagram-feed feed=2][something else]`,
  );
  assert.equal(html.match(/wp-block-accordion-panel" hidden/g)?.length, 1);
  assert.match(html, /data-mc-slot="contact-form"/);
  assert.match(html, /data-mc-slot="gallery"/);
  assert.deepEqual(dropped, ["[something else]"]);
});

test("contact form checks", () => {
  const now = 1_000_000;
  const good = { name: "Jo", email: "jo@x.co.za", phone: "082", message: "Hi there", website: "", started: now - 10_000 };
  assert.deepEqual(checkContact(good, now), { ok: true, value: { name: "Jo", email: "jo@x.co.za", phone: "082", message: "Hi there" } });
  assert.equal(checkContact({ ...good, website: "spam.com" }, now).ok, false);
  assert.equal(checkContact({ ...good, started: now - 500 }, now).ok, false);
  assert.deepEqual(checkContact({ ...good, email: "nope" }, now), { ok: false, error: "Please enter a valid email address." });
  assert.equal(rateLimited("t", 0, 2), false);
  assert.equal(rateLimited("t", 1, 2), false);
  assert.equal(rateLimited("t", 2, 2), true);
});
