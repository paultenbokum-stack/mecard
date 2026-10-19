import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { media } from "@/db/schema";
import type { ImageDeps, MediaIndex } from "./pipeline";
import { GcsStore, LocalStore } from "./store";

// Production: MEDIA_BUCKET (WebP masters) and ARCHIVE_BUCKET (every original
// WordPress upload, stored under its upload path, e.g. 2024/03/photo.jpg).
// Without them (local dev) originals come from wp-content/uploads in the
// checkout (or LOCAL_UPLOADS_DIR) and masters are cached in .media-cache/.

const dbIndex: MediaIndex = {
  async get(legacyPath) {
    const [row] = await db.select({ storageKey: media.storageKey }).from(media).where(eq(media.legacyPath, legacyPath)).limit(1);
    return row ?? null;
  },
  async record(row) {
    await db
      .insert(media)
      .values(row)
      .onConflictDoUpdate({ target: media.legacyPath, set: { storageKey: row.storageKey, width: row.width, height: row.height, bytes: row.bytes } });
  },
};

let deps: ImageDeps | null = null;

export function imageDeps(): ImageDeps {
  if (deps) return deps;
  const { MEDIA_BUCKET, ARCHIVE_BUCKET, LOCAL_UPLOADS_DIR } = process.env;
  if (MEDIA_BUCKET && ARCHIVE_BUCKET) {
    deps = { media: new GcsStore(MEDIA_BUCKET), archive: new GcsStore(ARCHIVE_BUCKET), index: dbIndex };
  } else {
    deps = {
      media: new LocalStore(path.resolve(process.cwd(), ".media-cache")),
      archive: new LocalStore(LOCAL_UPLOADS_DIR || path.resolve(process.cwd(), "../wp-content/uploads")),
      index: dbIndex,
    };
  }
  return deps;
}
