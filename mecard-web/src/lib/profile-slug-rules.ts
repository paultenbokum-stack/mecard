// Checks for a profile address (/mecard-profile/<slug>/) that staff type in:
// lowercase letters, digits and single hyphens, like the slugs slugify() makes.

export const PROFILE_SLUG_MIN = 3;
export const PROFILE_SLUG_MAX = 180;

export type SlugCheck = { ok: true; slug: string } | { ok: false; error: string };

/** The slug staff typed, tidied (case, spaces, a pasted full URL), or why it can't be used. */
export function checkProfileSlug(input: string): SlugCheck {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/^.*\/mecard-profile\//, "")
    .replace(/^\/+|\/+$/g, "");
  if (!slug) return { ok: false, error: "Please enter an address." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return { ok: false, error: "Use only lowercase letters, numbers and single hyphens (no spaces, and no hyphen at the start or end)." };
  if (slug.length < PROFILE_SLUG_MIN) return { ok: false, error: `Use at least ${PROFILE_SLUG_MIN} characters.` };
  if (slug.length > PROFILE_SLUG_MAX) return { ok: false, error: `Use at most ${PROFILE_SLUG_MAX} characters.` };
  return { ok: true, slug };
}
