import "server-only";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, profileLinks, profiles } from "@/db/schema";
import { cleanEmail, cleanPhone, cleanSocial, cleanText, cleanUrl } from "./form-values";
import { applyProUpgrade, createCompany, pendingProUpgrades, refreshProfilePages } from "./manage";
import { isPro } from "./profile-format";

// Saving the profile editor (Me\Single_Editor\Module::ajax_save and the
// edit-mecard-profile-ajax form). Standard profiles keep to what the standard
// template shows: no direct line and no "My Links" buttons (those are Pro).
// A profile whose Pro upgrade is ordered but not paid yet saves them too, so
// they are there when payment makes it Pro; its public card stays standard.

export const SOCIAL_NETWORKS = ["facebook", "instagram", "linkedin", "youtube", "twitter", "tiktok"] as const;
export const MAX_LINKS = 20;

export interface ProfileInput {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  mobile: string;
  whatsapp: string;
  workPhone: string;
  companyName: string;
  socials: Record<string, string>;
  photoPath: string | null;
  hideProfileLinkOnVcard: boolean;
  links: { id?: number; label: string; url: string }[];
}

/** What the browser sent, cleaned. Unknown keys are ignored. */
export function cleanProfileInput(raw: Record<string, unknown>): ProfileInput {
  const socialsRaw = (raw.socials && typeof raw.socials === "object" ? raw.socials : {}) as Record<string, unknown>;
  const socials: Record<string, string> = {};
  for (const n of SOCIAL_NETWORKS) {
    const v = cleanSocial(n, socialsRaw[n]);
    if (v) socials[n] = v;
  }
  const photo = typeof raw.photoPath === "string" && raw.photoPath.startsWith("/wp-content/uploads/") ? raw.photoPath.slice(0, 500) : null;
  const links = (Array.isArray(raw.links) ? raw.links : [])
    .slice(0, MAX_LINKS)
    .map((l) => {
      const o = (l ?? {}) as Record<string, unknown>;
      const id = Number(o.id);
      return { id: Number.isInteger(id) && id > 0 ? id : undefined, label: cleanText(o.label, 255), url: cleanUrl(o.url) };
    })
    .filter((l) => l.label && l.url);
  return {
    firstName: cleanText(raw.firstName, 100),
    lastName: cleanText(raw.lastName, 100),
    jobTitle: cleanText(raw.jobTitle, 200),
    email: cleanEmail(raw.email),
    mobile: cleanPhone(raw.mobile),
    whatsapp: cleanPhone(raw.whatsapp),
    workPhone: cleanPhone(raw.workPhone),
    companyName: cleanText(raw.companyName, 255),
    socials,
    photoPath: photo,
    hideProfileLinkOnVcard: raw.hideProfileLinkOnVcard === true,
    links,
  };
}

export async function saveProfile(profileId: number, input: ProfileInput): Promise<{ becamePro: boolean }> {
  const [current] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!current) throw new Error(`Profile ${profileId} not found`);
  const pro = isPro(current);
  const proFields = pro || (await pendingProUpgrades([profileId])).has(profileId);

  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        firstName: input.firstName,
        lastName: input.lastName,
        jobTitle: input.jobTitle,
        email: input.email,
        mobile: input.mobile,
        whatsapp: input.whatsapp,
        ...(proFields ? { workPhone: input.workPhone } : {}),
        // The typed company name only shows when there is no company record.
        ...(current.companyId ? {} : { companyName: input.companyName }),
        socials: input.socials,
        ...(input.photoPath ? { photoPath: input.photoPath } : {}),
        hideProfileLinkOnVcard: input.hideProfileLinkOnVcard,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, profileId));

    if (proFields) await replaceLinks(tx, { profileId }, input.links);
  });

  // Saving spends a paid, unused Pro upgrade, as on WordPress (maybe_assign_on_profile_save).
  const owner = current.ownerId ?? current.managerId;
  const becamePro = !pro && owner ? await applyProUpgrade(profileId, owner) : false;
  if (!becamePro) await refreshProfilePages(profileId);
  return { becamePro };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Make a profile's or company's links match the editor: rows that were removed
 * are deleted, the rest updated or added, numbered 1, 2, … in the order shown.
 */
export async function replaceLinks(tx: Tx, owner: { profileId: number } | { companyId: number }, links: { id?: number; label: string; url: string; icon?: string }[]) {
  const ownerWhere = "profileId" in owner ? eq(profileLinks.profileId, owner.profileId) : eq(profileLinks.companyId, owner.companyId);
  const existing = await tx.select({ id: profileLinks.id }).from(profileLinks).where(ownerWhere);
  const mine = new Set(existing.map((r) => r.id));
  const keep = links.filter((l) => l.id && mine.has(l.id)).map((l) => l.id!);
  await tx.delete(profileLinks).where(keep.length ? and(ownerWhere, notInArray(profileLinks.id, keep)) : ownerWhere);
  const now = new Date();
  for (const [i, l] of links.entries()) {
    const values = { label: l.label, url: l.url, ...(l.icon !== undefined ? { icon: l.icon } : {}), sortOrder: i + 1 };
    if (l.id && mine.has(l.id)) await tx.update(profileLinks).set({ ...values, updatedAt: now }).where(eq(profileLinks.id, l.id));
    else await tx.insert(profileLinks).values({ ...values, ...owner });
  }
}

/** create_company_for_profile(): a company for a Pro profile that has none, owned by the user. */
export async function createCompanyForProfile(profileId: number, userId: number): Promise<number> {
  const [p] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!p) throw new Error(`Profile ${profileId} not found`);
  if (p.companyId) return p.companyId;
  const id = await createCompany({ id: userId, isAdmin: false }, p.companyName || `${p.firstName} ${p.lastName} Company`.trim());
  // The logo uploaded during onboarding (me_profile_company_logo_id) becomes the company logo.
  if (p.companyLogoPath) await db.update(companies).set({ logoPath: p.companyLogoPath }).where(eq(companies.id, id));
  await db.update(profiles).set({ companyId: id, updatedAt: new Date() }).where(eq(profiles.id, profileId));
  await refreshProfilePages(profileId);
  return id;
}
