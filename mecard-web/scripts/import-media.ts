// The media library (media_library) from WordPress: every image attachment,
// owned by its post_author (WordPress showed customers only their own uploads),
// plus every image a profile, company or card uses, in its owner's library
// (staff often uploaded a customer's logo for them). Company logos are shared
// with the company. Run after the main import (npm run import:wp runs it), or
// on its own to rebuild the library:
//
//   WP_DATABASE_URL=mysql://user:pass@127.0.0.1:3306/dbname npm run import:media
//
// Only rows are written: images that are only in the archive bucket stay there
// until someone uses one (thumbnails come from the active media bucket only).
// --records-only skips the attachments (no WordPress database needed).

import { config } from "dotenv";
import mysql from "mysql2/promise";

config({ path: ".env.local" });

type R = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : String(v));
const utc = (v: unknown) => (v && !String(v).startsWith("0000") ? new Date(String(v).replace(" ", "T") + "Z") : null);

/** `wp` null: only the images the records use (no WordPress database to hand). */
export async function importMedia(wp: mysql.Connection | null) {
  const { db } = await import("../src/db/client");
  const s = await import("../src/db/schema");
  const { sql } = await import("drizzle-orm");
  const { libraryPath, titleFromFilename } = await import("../src/lib/media-rules");
  const q = async (text: string, params: unknown[] = []) => (wp ? ((await wp.query(text, params))[0] as R[]) : []);

  await db.execute(sql`TRUNCATE media_library RESTART IDENTITY`);
  const userIds = new Set((await db.select({ id: s.users.id }).from(s.users)).map((u) => u.id));
  type Row = typeof s.mediaLibrary.$inferInsert;
  const rows = new Map<string, Row>(); // owner|path → row
  const add = (r: Row) => {
    const k = `${r.ownerId}|${r.path}`;
    const had = rows.get(k);
    if (had) {
      had.companyId ??= r.companyId;
      had.wpAttachmentId ??= r.wpAttachmentId;
    } else rows.set(k, r);
  };

  // 1. Image attachments, by author.
  const atts = await q(
    `SELECT p.ID, p.post_author, p.post_title, p.post_mime_type, p.post_date_gmt, m.meta_value AS file
       FROM wp_posts p JOIN wp_postmeta m ON m.post_id = p.ID AND m.meta_key = '_wp_attached_file'
      WHERE p.post_type = 'attachment' AND p.post_mime_type LIKE 'image/%'`,
  );
  let attachments = 0;
  for (const a of atts) {
    const owner = Number(a.post_author);
    const path = libraryPath(str(a.file));
    if (!userIds.has(owner) || !path) continue;
    const filename = str(a.file).split("/").pop() ?? "";
    add({
      ownerId: owner,
      path,
      filename: filename.slice(0, 255),
      title: (str(a.post_title).trim() || titleFromFilename(filename)).slice(0, 255),
      mimeType: str(a.post_mime_type).slice(0, 100),
      wpAttachmentId: Number(a.ID),
      createdAt: utc(a.post_date_gmt) ?? new Date(),
    });
    attachments++;
  }

  // 2. Images the records use, in their owners' libraries.
  const byPath = new Map([...rows.values()].map((r) => [r.path, r]));
  const used = (ownerId: number | null, companyId: number | null, raw: string | null) => {
    const path = libraryPath(raw);
    if (!ownerId || !userIds.has(ownerId) || !path) return;
    const from = byPath.get(path);
    const filename = path.split("/").pop() ?? "";
    add({
      ownerId,
      companyId,
      path,
      filename: from?.filename ?? filename,
      title: from?.title ?? titleFromFilename(filename),
      mimeType: from?.mimeType ?? "",
      wpAttachmentId: from?.wpAttachmentId ?? null,
      createdAt: from?.createdAt ?? new Date(),
    });
  };
  const ps = await db.select({ owner: s.profiles.ownerId, manager: s.profiles.managerId, company: s.profiles.companyId, photo: s.profiles.photoPath, logo: s.profiles.companyLogoPath }).from(s.profiles);
  for (const p of ps) {
    used(p.manager ?? p.owner, null, p.photo);
    used(p.manager ?? p.owner, null, p.logo);
  }
  const cs = await db.select({ id: s.companies.id, owner: s.companies.ownerId, logo: s.companies.logoPath }).from(s.companies);
  for (const c of cs) used(c.owner, c.id, c.logo);
  const companyOwner = new Map(cs.map((c) => [c.id, c.owner]));
  const ks = await db.select({ owner: s.cards.ownerId, company: s.cards.companyId, front: s.cards.frontPath, back: s.cards.backPath }).from(s.cards);
  for (const k of ks) {
    const owner = k.owner ?? (k.company ? (companyOwner.get(k.company) ?? null) : null);
    used(owner, k.company, k.front);
    used(owner, k.company, k.back);
  }

  const all = [...rows.values()];
  for (let i = 0; i < all.length; i += 1000) await db.insert(s.mediaLibrary).values(all.slice(i, i + 1000)).onConflictDoNothing();

  // Counts for the import report.
  const [{ referenced }] = (await db.execute(sql`
    SELECT count(DISTINCT l.path)::int AS referenced FROM media_library l
     WHERE l.path IN (SELECT photo_path FROM profiles UNION SELECT company_logo_path FROM profiles UNION SELECT logo_path FROM companies
                      UNION SELECT front_path FROM cards UNION SELECT back_path FROM cards)`)) as unknown as { referenced: number }[];
  const perUser = new Map<number, number>();
  for (const r of all) perUser.set(r.ownerId, (perUser.get(r.ownerId) ?? 0) + 1);
  const counts = [...perUser.values()].sort((a, b) => a - b);
  const [{ active }] = (await db.execute(sql`SELECT count(*)::int AS active FROM media_library l JOIN media m ON m.legacy_path = substring(l.path from 21)`)) as unknown as { active: number }[];
  console.log(`media library    ${all.length} images for ${perUser.size} users (${attachments} from attachments)`);
  console.log(`  per user: median ${counts[Math.floor(counts.length / 2)] ?? 0}, max ${counts.at(-1) ?? 0}`);
  console.log(`  ${new Set(all.map((r) => r.path)).size} distinct images, ${referenced} used by a profile, company or card; ${active} rows already in the active bucket`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/import-media.ts")) {
  const url = process.env.WP_DATABASE_URL;
  const recordsOnly = process.argv.includes("--records-only");
  if (!url && !recordsOnly) throw new Error("Set WP_DATABASE_URL (or pass --records-only)");
  void (async () => {
    const wp = recordsOnly ? null : await mysql.createConnection({ uri: url!, timezone: "Z", dateStrings: ["DATETIME", "DATE"] });
    await importMedia(wp);
    await wp?.end();
    process.exit(0);
  })();
}
