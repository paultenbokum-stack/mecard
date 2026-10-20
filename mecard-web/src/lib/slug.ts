// URL slugs for new profiles and companies, like WordPress sanitize_title():
// lowercase ASCII words joined by hyphens, accents dropped, and -2, -3 … added
// when the slug is taken.

export function slugify(text: string, fallback = "profile"): string {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180)
    .replace(/-+$/, "");
  return s || fallback;
}

/** The first of base, base-2, base-3 … not in `taken`. */
export function nextFreeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}
