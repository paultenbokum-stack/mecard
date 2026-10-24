import { test } from "node:test";
import assert from "node:assert/strict";
import { groupUsage, libraryPath, mayUseImage, titleFromFilename } from "./media-rules";

test("libraryPath gives one form for upload paths and URLs", () => {
  assert.equal(libraryPath("https://mecard.co.za/wp-content/uploads/2024/03/logo.png"), "/wp-content/uploads/2024/03/logo.png");
  assert.equal(libraryPath("/wp-content/uploads/2024/03/logo.png?w=480"), null);
  assert.equal(libraryPath("2024/03/logo.png"), "/wp-content/uploads/2024/03/logo.png");
  assert.equal(libraryPath("/wp-content/uploads/../secret.png"), null);
  assert.equal(libraryPath(null), null);
});

test("mayUseImage: clearing or keeping the current image is fine, anything else must be in the library", async () => {
  const mine = new Set(["/wp-content/uploads/mecard/2026/10/1-a.webp", "/wp-content/uploads/2024/03/logo.png"]);
  const inLibrary = async (p: string) => mine.has(p);
  const base = { isAdmin: false, inLibrary };
  assert.equal(await mayUseImage({ ...base, path: "", current: "/wp-content/uploads/x.png" }), true);
  assert.equal(await mayUseImage({ ...base, path: "/wp-content/uploads/someone/else.png", current: "/wp-content/uploads/someone/else.png" }), true);
  assert.equal(await mayUseImage({ ...base, path: "/wp-content/uploads/mecard/2026/10/1-a.webp", current: null }), true);
  assert.equal(await mayUseImage({ ...base, path: "/wp-content/uploads/someone/else.png", current: null }), false);
  assert.equal(await mayUseImage({ ...base, path: "https://evil.example/x.png", current: null }), false);
  assert.equal(await mayUseImage({ ...base, isAdmin: true, path: "/wp-content/uploads/someone/else.png", current: null }), true);
});

test("mayUseImage: card artwork must be a PNG or JPG", async () => {
  const inLibrary = async () => true;
  assert.equal(await mayUseImage({ path: "/wp-content/uploads/mecard/2026/10/1-a.webp", current: null, isAdmin: false, slot: "artwork", inLibrary }), false);
  assert.equal(await mayUseImage({ path: "/wp-content/uploads/2024/03/logo.png", current: null, isAdmin: false, slot: "artwork", inLibrary }), true);
});

test("groupUsage lists the records using each image", () => {
  const usage = groupUsage([
    { path: "/wp-content/uploads/2024/03/logo.png", kind: "company-logo", id: 5, name: "Acme" },
    { path: "2024/03/logo.png", kind: "card-front", id: 9, name: "Classic card" },
    { path: null, kind: "profile-photo", id: 1, name: "Jane" },
  ]);
  assert.deepEqual(usage.get("/wp-content/uploads/2024/03/logo.png")?.map((u) => u.kind), ["company-logo", "card-front"]);
  assert.equal(usage.size, 1);
});

test("titleFromFilename", () => {
  assert.equal(titleFromFilename("acme_logo-final.PNG"), "acme logo final");
});
