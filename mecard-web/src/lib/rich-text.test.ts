import { test } from "node:test";
import assert from "node:assert/strict";
import { autop, sanitizeRichHtml } from "./rich-text";

test("sanitizeRichHtml keeps formatting, lists, headings and safe links", () => {
  const html = '<h2>About</h2><p><strong>Bold</strong> <em>italic</em> <a href="https://x.co" target="_blank" rel="noopener">link</a></p><ul><li>one</li></ul><ol><li>two</li></ol>';
  assert.equal(sanitizeRichHtml(html), html);
});

test("sanitizeRichHtml drops scripts, handlers and unsafe URLs", () => {
  assert.equal(sanitizeRichHtml('<p onclick="x()">Hi<script>alert(1)</script></p>'), "<p>Hi</p>");
  assert.equal(sanitizeRichHtml('<a href="javascript:alert(1)">x</a>'), "<a>x</a>");
  assert.equal(sanitizeRichHtml('<p style="background:url(x)">x</p>'), "<p>x</p>");
  assert.equal(sanitizeRichHtml("<font color=red>kept text</font>"), "kept text");
});

test("sanitizeRichHtml escapes text and empties a blank editor", () => {
  assert.equal(sanitizeRichHtml("<p>Tom &amp; Jerry &lt;3</p>"), "<p>Tom &amp; Jerry &lt;3</p>");
  assert.equal(sanitizeRichHtml("<p><br></p>"), "");
  assert.equal(sanitizeRichHtml("  "), "");
  assert.equal(sanitizeRichHtml("Plain text"), "Plain text");
});

test("autop turns WordPress's blank-line paragraphs into <p>", () => {
  assert.equal(autop("One <strong>a</strong>\n\nTwo\nline"), "<p>One <strong>a</strong></p>\n<p>Two<br>\nline</p>");
  assert.equal(autop("<h3>Head</h3>\n\nText"), "<h3>Head</h3>\n<p>Text</p>");
  assert.equal(autop("<p>Already</p>\n<p>done</p>"), "<p>Already</p>\n<p>done</p>");
  assert.equal(autop("Single line"), "Single line");
});
