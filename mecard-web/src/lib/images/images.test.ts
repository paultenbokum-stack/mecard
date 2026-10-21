import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { imageUrl, masterKey, pickWidth, sourceCandidates, uploadKey } from "./paths";
import { loadMaster, renderVariant, storeArtwork, storeUpload, type MediaIndex, type MediaRow } from "./pipeline";
import { GcsStore, metadataToken, type BlobStore } from "./store";

class MemoryStore implements BlobStore {
  files = new Map<string, Buffer>();
  reads: string[] = [];
  async read(key: string) {
    this.reads.push(key);
    return this.files.get(key) ?? null;
  }
  async write(key: string, data: Buffer) {
    this.files.set(key, data);
  }
}

class MemoryIndex implements MediaIndex {
  rows = new Map<string, MediaRow>();
  async get(p: string) {
    return this.rows.get(p) ?? null;
  }
  async record(row: MediaRow) {
    this.rows.set(row.legacyPath, row);
  }
}

const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#f78620" } }).png().toBuffer();

test("uploadKey accepts upload paths and rejects anything else", () => {
  assert.equal(uploadKey("/wp-content/uploads/2025/09/jane-doe.png"), "2025/09/jane-doe.png");
  assert.equal(uploadKey("https://mecard.co.za/wp-content/uploads/2024/03/a%20b.jpg"), "2024/03/a b.jpg");
  assert.equal(uploadKey("2024/03/photo.JPG"), "2024/03/photo.JPG");
  assert.equal(uploadKey("/wp-content/uploads/../../wp-config.php"), null);
  assert.equal(uploadKey("/wp-content/uploads/2024/03/../x.jpg"), null);
  assert.equal(uploadKey("/wp-content/uploads/2024/03/script.php"), null);
  assert.equal(uploadKey("/wp-content/uploads/%E0%A4%A"), null);
});

test("imageUrl builds route URLs with a rounded width", () => {
  assert.equal(imageUrl("/wp-content/uploads/2024/03/a b.jpg", 300), "/wp-content/uploads/2024/03/a%20b.jpg?w=320");
  assert.equal(imageUrl("/wp-content/uploads/2024/03/a.jpg"), "/wp-content/uploads/2024/03/a.jpg");
  assert.equal(imageUrl(null), null);
  assert.equal(pickWidth(5000), 1200);
  assert.equal(pickWidth(0), 1200);
  assert.equal(pickWidth(161), 320);
});

test("sourceCandidates falls back from resized and WebP copies to the original", () => {
  assert.deepEqual(sourceCandidates("2024/03/me-300x300.jpg"), ["2024/03/me-300x300.jpg", "2024/03/me.jpg"]);
  assert.deepEqual(sourceCandidates("2024/03/me-150x150.png.webp"), [
    "2024/03/me-150x150.png.webp",
    "2024/03/me-150x150.png",
    "2024/03/me.png",
  ]);
  assert.deepEqual(sourceCandidates("2024/03/big-scaled.jpg"), ["2024/03/big-scaled.jpg", "2024/03/big.jpg"]);
  assert.equal(masterKey("2024/03/me.jpg"), "masters/2024/03/me.jpg.webp");
});

test("a cold image is restored from the archive once, then served from the media store", async () => {
  const media = new MemoryStore();
  const archive = new MemoryStore();
  const index = new MemoryIndex();
  archive.files.set("2024/03/me.jpg", await png(2400, 1600));

  const first = await loadMaster("2024/03/me.jpg", { media, archive, index });
  assert.ok(first);
  const meta = await sharp(first).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 800);
  assert.ok(media.files.has("masters/2024/03/me.jpg.webp"));
  assert.deepEqual(
    { ...index.rows.get("2024/03/me.jpg"), bytes: 0 },
    { legacyPath: "2024/03/me.jpg", storageKey: "masters/2024/03/me.jpg.webp", width: 1200, height: 800, bytes: 0, restoredFromArchive: true },
  );

  archive.reads = [];
  const second = await loadMaster("2024/03/me.jpg", { media, archive, index });
  assert.ok(second?.equals(first));
  assert.deepEqual(archive.reads, [], "second request must not touch the archive");
});

test("an old resized URL restores the original and is indexed under both paths", async () => {
  const deps = { media: new MemoryStore(), archive: new MemoryStore(), index: new MemoryIndex() };
  deps.archive.files.set("2023/01/logo.png", await png(400, 200));
  const master = await loadMaster("2023/01/logo-300x150.png", deps);
  assert.ok(master);
  assert.equal((await sharp(master).metadata()).width, 400, "small originals are not enlarged");
  assert.equal(deps.index.rows.get("2023/01/logo-300x150.png")?.storageKey, "masters/2023/01/logo.png.webp");
  assert.equal(deps.index.rows.get("2023/01/logo.png")?.storageKey, "masters/2023/01/logo.png.webp");
});

test("a missing or undecodable image is a miss", async () => {
  const deps = { media: new MemoryStore(), archive: new MemoryStore(), index: new MemoryIndex() };
  assert.equal(await loadMaster("2020/01/nope.jpg", deps), null);
  deps.archive.files.set("2020/01/broken.jpg", Buffer.from("not an image"));
  assert.equal(await loadMaster("2020/01/broken.jpg", deps), null);
  assert.equal(deps.index.rows.size, 0);
});

test("concurrent requests for the same cold image share one restore", async () => {
  const deps = { media: new MemoryStore(), archive: new MemoryStore(), index: new MemoryIndex() };
  deps.archive.files.set("2024/05/x.jpg", await png(800, 800));
  await Promise.all([loadMaster("2024/05/x.jpg", deps), loadMaster("2024/05/x.jpg", deps), loadMaster("2024/05/x.jpg", deps)]);
  assert.equal(deps.archive.reads.filter((k) => k === "2024/05/x.jpg").length, 1);
});

test("variants are narrower WebP, or JPEG for vCards", async () => {
  const master = await sharp(await png(1200, 600)).webp().toBuffer();
  const small = await sharp(await renderVariant(master, 320)).metadata();
  assert.deepEqual([small.format, small.width, small.height], ["webp", 320, 160]);
  const jpeg = await sharp(await renderVariant(master, 400, "jpeg")).metadata();
  assert.deepEqual([jpeg.format, jpeg.width], ["jpeg", 400]);
});

test("GcsStore reads, writes and maps 404 to null", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.includes("missing")) return new Response("", { status: 404 });
    if (init?.method === "POST") return new Response("{}", { status: 200 });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  }) as typeof fetch;
  const store = new GcsStore("mecard-media", async () => "tok", fake);

  assert.deepEqual(await store.read("masters/2024/03/a b.jpg.webp"), Buffer.from([1, 2, 3]));
  assert.equal(calls[0].url, "https://storage.googleapis.com/storage/v1/b/mecard-media/o/masters%2F2024%2F03%2Fa%20b.jpg.webp?alt=media");
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer tok");
  assert.equal(await store.read("missing.jpg"), null);

  await store.write("masters/x.webp", Buffer.from([9]), "image/webp");
  const w = calls.at(-1)!;
  assert.equal(w.url, "https://storage.googleapis.com/upload/storage/v1/b/mecard-media/o?uploadType=media&name=masters%2Fx.webp");
  assert.equal((w.init?.headers as Record<string, string>)["Content-Type"], "image/webp");

  const failing = new GcsStore("b", async () => "t", (async () => new Response("", { status: 500 })) as unknown as typeof fetch);
  await assert.rejects(failing.read("x.jpg"), /failed: 500/);
});

test("metadataToken caches the token until shortly before it expires", async () => {
  let now = 0;
  let calls = 0;
  const fake = (async (_url: string, init?: RequestInit) => {
    calls++;
    assert.equal((init?.headers as Record<string, string>)["Metadata-Flavor"], "Google");
    return Response.json({ access_token: `t${calls}`, expires_in: 3600 });
  }) as typeof fetch;
  const token = metadataToken(fake, () => now);
  assert.equal(await token(), "t1");
  now = 3500 * 1000;
  assert.equal(await token(), "t1");
  now = 3541 * 1000;
  assert.equal(await token(), "t2");
});

test("storeUpload saves a WebP master that loadMaster then serves", async () => {
  const deps = { media: new MemoryStore(), archive: new MemoryStore(), index: new MemoryIndex() };
  const path = await storeUpload(await png(2400, 1600), deps, { id: "abc123", now: new Date("2026-10-20T12:00:00Z") });
  assert.equal(path, "/wp-content/uploads/mecard/2026/10/abc123.webp");
  const key = uploadKey(path!)!;
  assert.equal(deps.index.rows.get(key)?.width, 1200);
  const master = await loadMaster(key, deps);
  assert.equal((await sharp(master!).metadata()).format, "webp");
  assert.deepEqual(deps.archive.reads, []);
});

test("storeUpload refuses files that aren't images", async () => {
  const deps = { media: new MemoryStore(), archive: new MemoryStore(), index: new MemoryIndex() };
  assert.equal(await storeUpload(Buffer.from("<?php echo 1;"), deps, { id: "x" }), null);
  assert.equal(await storeUpload(Buffer.alloc(0), deps, { id: "x" }), null);
  assert.equal(deps.media.files.size, 0);
});

test("storeArtwork keeps the original PNG for printing and a WebP master for the pages", async () => {
  const deps = { media: new MemoryStore(), archive: new MemoryStore(), index: new MemoryIndex() };
  const original = await png(856, 540);
  const path = await storeArtwork(original, deps, { id: "card1", now: new Date("2026-10-21T08:00:00Z") });
  assert.equal(path, "/wp-content/uploads/mecard/2026/10/card1.png");
  assert.deepEqual(deps.archive.files.get("mecard/2026/10/card1.png"), original);
  assert.equal((await sharp(deps.media.files.get("masters/mecard/2026/10/card1.png.webp")!).metadata()).format, "webp");
  const webp = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).webp().toBuffer();
  assert.equal(await storeArtwork(webp, deps, { id: "x" }), null); // print artwork must be PNG or JPG
});
