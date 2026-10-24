import type { companies, profileLinks, profiles } from "@/db/schema";

// The shape the card templates render, plus the naming helpers they share.
// Kept free of database imports so the editors can render the same templates
// in the browser as a live preview.

export type Profile = typeof profiles.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Link = Pick<typeof profileLinks.$inferSelect, "id" | "label" | "url" | "icon">;

export interface ProfileView {
  profile: Profile;
  company: Company | null;
  companyLinks: Link[];
  profileLinks: Link[];
}

export const fullName = (p: Pick<Profile, "firstName" | "lastName">) => `${p.firstName} ${p.lastName}`.trim();

/** "Jane Doe" — the WordPress post title, used in titles and file names. */
export const displayName = (p: Pick<Profile, "firstName" | "lastName" | "slug">) => fullName(p) || p.slug;

export const companyLabel = (v: Pick<ProfileView, "profile" | "company">) => v.company?.name || v.profile.companyName;
