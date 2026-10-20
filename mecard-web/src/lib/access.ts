import "server-only";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, companies, profiles, users } from "@/db/schema";

// Who may change what, as the plugin decided it (user_can_edit_profile(),
// the Toolset forms' author='$current' filters and the company editor):
//   profile: its owner, its manager (WordPress post_author), the owner of its
//            company, or a site admin;
//   company: its owner (post_author) or a site admin;
//   card:    its owner, the owner of its company, whoever may edit the profile
//            it is linked to, or a site admin.

export interface Viewer {
  id: number;
  isAdmin: boolean;
}

export async function viewer(userId: number): Promise<Viewer> {
  const [u] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  return { id: userId, isAdmin: !!u?.isAdmin };
}

const ownedCompanyIds = (userId: number) => sql`(SELECT ${companies.id} FROM ${companies} WHERE ${companies.ownerId} = ${userId})`;

/** Profiles the user may edit (not counting admin rights). */
export function editableProfilesWhere(userId: number): SQL {
  return or(eq(profiles.ownerId, userId), eq(profiles.managerId, userId), inArray(profiles.companyId, ownedCompanyIds(userId)))!;
}

/** Cards the user may manage (not counting admin rights). */
export function manageableCardsWhere(userId: number): SQL {
  return or(
    eq(cards.ownerId, userId),
    inArray(cards.companyId, ownedCompanyIds(userId)),
    inArray(cards.profileId, sql`(SELECT ${profiles.id} FROM ${profiles} WHERE ${editableProfilesWhere(userId)})`),
  )!;
}

export async function canEditProfile(v: Viewer, profileId: number): Promise<boolean> {
  if (!profileId) return false;
  const where = v.isAdmin ? eq(profiles.id, profileId) : and(eq(profiles.id, profileId), editableProfilesWhere(v.id));
  const [row] = await db.select({ id: profiles.id }).from(profiles).where(where).limit(1);
  return !!row;
}

export async function canManageCompany(v: Viewer, companyId: number): Promise<boolean> {
  if (!companyId) return false;
  const [row] = await db.select({ ownerId: companies.ownerId }).from(companies).where(eq(companies.id, companyId)).limit(1);
  return !!row && (v.isAdmin || row.ownerId === v.id);
}

export async function canManageCard(v: Viewer, cardId: number): Promise<boolean> {
  if (!cardId) return false;
  const where = v.isAdmin ? eq(cards.id, cardId) : and(eq(cards.id, cardId), manageableCardsWhere(v.id));
  const [row] = await db.select({ id: cards.id }).from(cards).where(where).limit(1);
  return !!row;
}

/** The profile owner (for "is this my own profile?" checks such as view counting). */
export async function isProfileOwner(userId: number, profileId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), or(eq(profiles.ownerId, userId), eq(profiles.managerId, userId))))
    .limit(1);
  return !!row;
}
