import { uploadKey } from "./images/paths";

// The media library's rules, pure so tests can use them; media-library.ts does
// the database side.

export const UPLOADS = "/wp-content/uploads/";

/** "/wp-content/uploads/2024/03/logo.png" for any form of an upload path or URL, or null. */
export function libraryPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const key = uploadKey(path);
  return key ? UPLOADS + key : null;
}

/** Card artwork goes to print from the original file, so only PNG and JPG images can be used on a card. */
export const isPrintable = (path: string) => /\.(png|jpe?g)$/i.test(path);

export type ImageSlot = "photo" | "logo" | "artwork";

export const slotAccepts = (slot: ImageSlot, path: string) => (slot === "artwork" ? isPrintable(path) : true);

/**
 * May this image be saved on a record? Clearing it or keeping what's already
 * there always may; anything else must be in the user's (or their company's)
 * library, which `inLibrary` answers. Staff may use any image.
 */
export async function mayUseImage(opts: {
  path: string | null | undefined;
  current: string | null | undefined;
  isAdmin: boolean;
  slot?: ImageSlot;
  inLibrary: (path: string) => Promise<boolean>;
}): Promise<boolean> {
  const next = libraryPath(opts.path);
  if (!opts.path) return true;
  if (!next) return false;
  if (next === libraryPath(opts.current)) return true;
  if (opts.slot && !slotAccepts(opts.slot, next)) return false;
  return opts.isAdmin || opts.inLibrary(next);
}

export type UsageKind = "profile-photo" | "profile-logo" | "company-logo" | "card-front" | "card-back";

export const USAGE_LABEL: Record<UsageKind, string> = {
  "profile-photo": "Profile photo",
  "profile-logo": "Profile logo",
  "company-logo": "Company logo",
  "card-front": "Card front",
  "card-back": "Card back",
};

export interface Usage {
  kind: UsageKind;
  id: number;
  name: string;
}

/** Group the records that use an image by its path ("where is this used?", and later "delete unused"). */
export function groupUsage(rows: (Usage & { path: string | null })[]): Map<string, Usage[]> {
  const out = new Map<string, Usage[]>();
  for (const { path, ...use } of rows) {
    const p = libraryPath(path);
    if (!p) continue;
    if (!out.has(p)) out.set(p, []);
    out.get(p)!.push(use);
  }
  return out;
}

/** "logo-final.png" → "logo-final" (WordPress titles new attachments the same way). */
export const titleFromFilename = (name: string) => name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim().slice(0, 255);
