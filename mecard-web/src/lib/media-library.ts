import "server-only";
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, companies, media, mediaLibrary, profiles } from "@/db/schema";
import { editableProfilesWhere, manageableCardsWhere, type Viewer } from "./access";
import { groupUsage, libraryPath, mayUseImage, titleFromFilename, UPLOADS, type ImageSlot, type Usage } from "./media-rules";

// An account's images (media_library): the media picker, My images, and the
// check that a picked image is the user's own (or their company's) before a
// profile, company or card saves it.

export const MEDIA_PAGE_SIZE = 30;

const companiesManagedBy = (userId: number) => sql`(SELECT ${companies.id} FROM ${companies} WHERE ${companies.ownerId} = ${userId})`;

/** Images the user may see and use: their own, and those of companies they manage. */
export function libraryWhere(userId: number): SQL {
  return or(eq(mediaLibrary.ownerId, userId), inArray(mediaLibrary.companyId, companiesManagedBy(userId)))!;
}

/** A new upload goes into the uploader's library (and the company's, when uploaded for one they manage). */
export async function recordUpload(row: { ownerId: number; companyId?: number | null; path: string; filename: string; mimeType: string; bytes: number }) {
  const path = libraryPath(row.path);
  if (!path) return;
  await db
    .insert(mediaLibrary)
    .values({
      ownerId: row.ownerId,
      companyId: row.companyId ?? null,
      path,
      filename: row.filename.slice(0, 255),
      title: titleFromFilename(row.filename),
      mimeType: row.mimeType.slice(0, 100),
      bytes: row.bytes,
    })
    .onConflictDoNothing();
}

export async function inLibrary(userId: number, path: string): Promise<boolean> {
  const [row] = await db
    .select({ id: mediaLibrary.id })
    .from(mediaLibrary)
    .where(and(eq(mediaLibrary.path, path), libraryWhere(userId)))
    .limit(1);
  return !!row;
}

/** The server-side check behind every pick: see mayUseImage(). */
export function canUseImage(v: Viewer, path: string | null | undefined, current: string | null | undefined, slot?: ImageSlot) {
  return mayUseImage({ path, current, isAdmin: v.isAdmin, slot, inLibrary: (p) => inLibrary(v.id, p) });
}

export type LibraryImage = Awaited<ReturnType<typeof listLibrary>>["rows"][number];

/**
 * The user's images, newest first, searchable by filename or title. `active`
 * says whether the WebP master is in the media bucket: the grid only shows
 * thumbnails for those, so browsing never restores from the archive bucket
 * (which charges per retrieval); using one restores it on demand.
 */
export async function listLibrary(userId: number, opts: { q?: string; page?: number; printable?: boolean } = {}) {
  const conds: SQL[] = [libraryWhere(userId)];
  const q = opts.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(or(ilike(mediaLibrary.filename, like), ilike(mediaLibrary.title, like))!);
  }
  if (opts.printable) conds.push(sql`${mediaLibrary.path} ~* '\\.(png|jpe?g)$'`);
  const where = and(...conds);
  const page = Math.max(1, opts.page ?? 1);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: mediaLibrary.id,
        path: mediaLibrary.path,
        filename: mediaLibrary.filename,
        title: mediaLibrary.title,
        ownerId: mediaLibrary.ownerId,
        companyId: mediaLibrary.companyId,
        createdAt: mediaLibrary.createdAt,
        width: media.width,
        height: media.height,
        active: sql<boolean>`(${media.legacyPath} IS NOT NULL)`,
      })
      .from(mediaLibrary)
      .leftJoin(media, eq(media.legacyPath, sql`substring(${mediaLibrary.path} from ${sql.raw(String(UPLOADS.length + 1))})`))
      .where(where)
      .orderBy(desc(mediaLibrary.createdAt), desc(mediaLibrary.id))
      .limit(MEDIA_PAGE_SIZE)
      .offset((page - 1) * MEDIA_PAGE_SIZE),
    db.select({ total: count() }).from(mediaLibrary).where(where),
  ]);
  return { rows, total, page };
}

/** Where each of these images is used, among the records the user manages. */
export async function mediaUsage(userId: number, paths: string[]): Promise<Map<string, Usage[]>> {
  if (!paths.length) return new Map();
  const forms = [...new Set(paths.flatMap((p) => [p, p.slice(UPLOADS.length)]))];
  const name = sql<string>`trim(${profiles.firstName} || ' ' || ${profiles.lastName})`;
  const [ps, cs, ks] = await Promise.all([
    db
      .select({ id: profiles.id, name, photo: profiles.photoPath, logo: profiles.companyLogoPath })
      .from(profiles)
      .where(and(editableProfilesWhere(userId), or(inArray(profiles.photoPath, forms), inArray(profiles.companyLogoPath, forms)))),
    db
      .select({ id: companies.id, name: companies.name, logo: companies.logoPath })
      .from(companies)
      .where(and(eq(companies.ownerId, userId), inArray(companies.logoPath, forms))),
    db
      .select({ id: cards.id, name: sql<string>`coalesce(nullif(${cards.label}, ''), ${cards.slug})`, front: cards.frontPath, back: cards.backPath })
      .from(cards)
      .where(and(manageableCardsWhere(userId), eq(cards.archived, false), or(inArray(cards.frontPath, forms), inArray(cards.backPath, forms)))),
  ]);
  return groupUsage([
    ...ps.flatMap((p) => [
      { path: p.photo, kind: "profile-photo" as const, id: p.id, name: p.name },
      { path: p.logo, kind: "profile-logo" as const, id: p.id, name: p.name },
    ]),
    ...cs.map((c) => ({ path: c.logo, kind: "company-logo" as const, id: c.id, name: c.name })),
    ...ks.flatMap((k) => [
      { path: k.front, kind: "card-front" as const, id: k.id, name: k.name },
      { path: k.back, kind: "card-back" as const, id: k.id, name: k.name },
    ]),
  ]);
}
