// Legacy WordPress upload paths, as stored on records and found in old links,
// vCards and emails: /wp-content/uploads/2024/03/photo.jpg

const PREFIX = "/wp-content/uploads/";

// Widths the image route renders. Requests are rounded up to the next one so
// the CDN only ever caches a handful of variants per image.
export const IMAGE_WIDTHS = [160, 320, 480, 640, 960, 1200] as const;
export const MASTER_WIDTH = 1200;

/**
 * The path below /wp-content/uploads/ ("2024/03/photo.jpg"), or null when the
 * path is not a safe upload path.
 */
export function uploadKey(path: string): string | null {
  let p = path;
  try {
    p = decodeURIComponent(p);
  } catch {
    return null;
  }
  p = p.replace(/\\/g, "/");
  const at = p.indexOf(PREFIX);
  if (at >= 0) p = p.slice(at + PREFIX.length);
  p = p.replace(/^\/+/, "");
  if (!p || p.length > 500) return null;
  const parts = p.split("/");
  if (parts.some((s) => s === "" || s === "." || s === ".." || s.includes("\0"))) return null;
  if (!/\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i.test(p)) return null;
  return p;
}

/** Site-relative URL for an upload path, at an optional width. */
export function imageUrl(path: string | null | undefined, width?: number): string | null {
  if (!path) return null;
  const key = uploadKey(path);
  if (!key) return null;
  const url = PREFIX + key.split("/").map(encodeURIComponent).join("/");
  return width ? `${url}?w=${pickWidth(width)}` : url;
}

export function pickWidth(w: number | null | undefined): number {
  if (!w || !Number.isFinite(w) || w <= 0) return MASTER_WIDTH;
  return IMAGE_WIDTHS.find((x) => x >= w) ?? MASTER_WIDTH;
}

/**
 * Upload paths to try, best first. Old links often point at a WordPress
 * resized copy ("photo-300x300.jpg") or an Imagify WebP twin
 * ("photo.jpg.webp") that was never recorded; fall back to the original.
 */
export function sourceCandidates(key: string): string[] {
  const out = [key];
  const noWebp = key.replace(/\.webp$/i, "");
  if (noWebp !== key && /\.(jpe?g|png|gif)$/i.test(noWebp)) out.push(noWebp);
  for (const k of [...out]) {
    const original = k.replace(/-\d+x\d+(\.[a-z]+)$/i, "$1");
    if (original !== k) out.push(original);
    const unscaled = k.replace(/-scaled(\.[a-z]+)$/i, "$1");
    if (unscaled !== k) out.push(unscaled);
  }
  return [...new Set(out)];
}

/** Storage key of the 1,200 px WebP master in the media bucket. */
export function masterKey(sourceKey: string): string {
  return `masters/${sourceKey}.webp`;
}
