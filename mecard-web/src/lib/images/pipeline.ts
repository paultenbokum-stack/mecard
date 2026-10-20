import sharp from "sharp";
import { MASTER_WIDTH, masterKey, sourceCandidates } from "./paths";
import type { BlobStore } from "./store";

// Every image request goes through here:
//   1. the media table says where the WebP master is → read it from the media bucket;
//   2. otherwise restore it: read the original from the archive bucket, resize it
//      once to a 1,200 px WebP master, save that to the media bucket and record it;
//   3. otherwise it is a miss, and the caller serves a placeholder.
// Smaller widths are cut from the master on request; the CDN caches them.

export interface MediaRow {
  legacyPath: string;
  storageKey: string;
  width: number | null;
  height: number | null;
  bytes: number;
  restoredFromArchive: boolean;
}

export interface MediaIndex {
  get(legacyPath: string): Promise<{ storageKey: string } | null>;
  record(row: MediaRow): Promise<void>;
}

export interface ImageDeps {
  media: BlobStore;
  archive: BlobStore;
  index: MediaIndex;
}

export async function toMaster(original: Buffer) {
  const { data, info } = await sharp(original, { animated: false })
    .rotate()
    .resize({ width: MASTER_WIDTH, height: MASTER_WIDTH, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const inFlight = new Map<string, Promise<Buffer | null>>();

/** The WebP master for an upload key ("2024/03/photo.jpg"), restoring it if needed. */
export function loadMaster(key: string, deps: ImageDeps): Promise<Buffer | null> {
  // Two visitors asking for the same cold image share one restore.
  let p = inFlight.get(key);
  if (!p) {
    p = findOrRestore(key, deps).finally(() => inFlight.delete(key));
    inFlight.set(key, p);
  }
  return p;
}

async function findOrRestore(key: string, deps: ImageDeps): Promise<Buffer | null> {
  const candidates = sourceCandidates(key);

  for (const c of candidates) {
    const row = await deps.index.get(c);
    if (!row) continue;
    const data = await deps.media.read(row.storageKey);
    if (data) {
      if (c !== key) await deps.index.record({ ...(await describe(data)), legacyPath: key, storageKey: row.storageKey, restoredFromArchive: false });
      return data;
    }
  }

  for (const c of candidates) {
    const original = await deps.archive.read(c);
    if (!original) continue;
    let master: Awaited<ReturnType<typeof toMaster>>;
    try {
      master = await toMaster(original);
    } catch {
      // Not a decodable image (corrupt upload, unsupported format).
      continue;
    }
    const storageKey = masterKey(c);
    await deps.media.write(storageKey, master.data, "image/webp");
    const row = { storageKey, width: master.width, height: master.height, bytes: master.data.length, restoredFromArchive: true };
    await deps.index.record({ ...row, legacyPath: c });
    if (c !== key) await deps.index.record({ ...row, legacyPath: key });
    return master.data;
  }

  return null;
}

async function describe(data: Buffer) {
  const m = await sharp(data).metadata();
  return { width: m.width ?? null, height: m.height ?? null, bytes: data.length };
}

export type OutputFormat = "webp" | "jpeg";

/** A variant cut from the master: narrower, and JPEG when asked (vCards). */
export async function renderVariant(master: Buffer, width: number, format: OutputFormat = "webp") {
  let img = sharp(master).resize({ width, withoutEnlargement: true });
  img = format === "jpeg" ? img.flatten({ background: "#ffffff" }).jpeg({ quality: 82 }) : img.webp({ quality: 80 });
  return img.toBuffer();
}

// Neutral grey placeholder for images that exist nowhere.
export const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">' +
  '<rect width="300" height="300" fill="#e9ecef"/>' +
  '<circle cx="150" cy="118" r="46" fill="#ced4da"/><path d="M62 262c0-48 40-82 88-82s88 34 88 82z" fill="#ced4da"/></svg>';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * A new upload from the editors (profile photo, company logo): resized once to
 * a WebP master and recorded like a migrated image, so it is served by the
 * same /wp-content/uploads/… route. Returns that path, or null when the file
 * isn't an image.
 */
export async function storeUpload(original: Buffer, deps: ImageDeps, opts: { now?: Date; id: string }): Promise<string | null> {
  if (!original.length || original.length > MAX_UPLOAD_BYTES) return null;
  let master: Awaited<ReturnType<typeof toMaster>>;
  try {
    master = await toMaster(original);
  } catch {
    return null;
  }
  const now = opts.now ?? new Date();
  const key = `mecard/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${opts.id}.webp`;
  const storageKey = masterKey(key);
  await deps.media.write(storageKey, master.data, "image/webp");
  await deps.index.record({ legacyPath: key, storageKey, width: master.width, height: master.height, bytes: master.data.length, restoredFromArchive: false });
  return `/wp-content/uploads/${key}`;
}
