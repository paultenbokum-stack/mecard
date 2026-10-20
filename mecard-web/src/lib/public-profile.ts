import { cache } from "react";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, companies, profileLinks, profiles } from "@/db/schema";
import { normalizeSlug } from "./profile-format";
import type { ProfileView } from "./profile-view";

// Data for the public card pages (/t/<slug>/ and /mecard-profile/<slug>/),
// shaped like Me\Preview\Module::get_profile_data() / get_company_data().

export type { Company, Link, Profile, ProfileView } from "./profile-view";
export { companyLabel, displayName, fullName } from "./profile-view";

export { isPro } from "./profile-format";

export { needsCanonicalRedirect } from "./profile-format";
const norm = normalizeSlug;

export const getProfileBySlug = cache(async (slug: string) => {
  const [p] = await db.select().from(profiles).where(eq(profiles.slug, norm(slug))).limit(1);
  return p ?? null;
});

export const getCardBySlug = cache(async (slug: string) => {
  const [c] = await db
    .select({ id: cards.id, slug: cards.slug, title: cards.title, type: cards.type, archived: cards.archived, profileId: cards.profileId, autoDownloadVcard: cards.autoDownloadVcard })
    .from(cards)
    .where(eq(cards.slug, norm(slug)))
    .limit(1);
  return c ?? null;
});

// Links keep the order the editor saved (sort_order 1, 2, …). Links nobody has
// reordered yet are all 0 and keep the Toolset views' order: company links most
// recently changed first (ties oldest post first), profile links newest first.
export const COMPANY_LINK_ORDER = [asc(profileLinks.sortOrder), desc(profileLinks.updatedAt), asc(profileLinks.id)] as const;
export const PROFILE_LINK_ORDER = [asc(profileLinks.sortOrder), desc(profileLinks.createdAt), desc(profileLinks.id)] as const;

export const getProfileView = cache(async (profileId: number): Promise<ProfileView | null> => {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!profile) return null;
  const [company] = profile.companyId ? await db.select().from(companies).where(eq(companies.id, profile.companyId)).limit(1) : [];
  const linkCols = { id: profileLinks.id, label: profileLinks.label, url: profileLinks.url, icon: profileLinks.icon };
  const [companyLinks, ownLinks] = await Promise.all([
    company
      ? db.select(linkCols).from(profileLinks).where(eq(profileLinks.companyId, company.id)).orderBy(...COMPANY_LINK_ORDER)
      : [],
    db.select(linkCols).from(profileLinks).where(eq(profileLinks.profileId, profile.id)).orderBy(...PROFILE_LINK_ORDER),
  ]);
  return { profile, company: company ?? null, companyLinks, profileLinks: ownLinks };
});

/** Public paths that show this profile: its own page and every card linked to it. */
export async function profilePaths(profileId: number): Promise<string[]> {
  const [p] = await db.select({ slug: profiles.slug }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
  const tagRows = await db
    .select({ slug: cards.slug })
    .from(cards)
    .where(and(eq(cards.profileId, profileId), eq(cards.archived, false)));
  return [...(p ? [`/mecard-profile/${p.slug}/`] : []), ...tagRows.map((t) => `/t/${t.slug}/`)];
}
