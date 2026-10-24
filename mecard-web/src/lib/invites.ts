import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, profileInvites, profiles, users } from "@/db/schema";
import { sendEmail } from "./email";
import { inviteToken, verifyInviteToken } from "./invite-token";
import { refreshProfilePages } from "./manage";
import { siteUrl } from "./site";

// Profile invites (the Toolset add-request form and `request` posts): a team
// admin invites someone by email to take over a profile. Accepting makes them
// its owner (mecard_accept_profile_invite()); the admin keeps managing it.

export const invitePath = (inviteId: number, email: string) => `/invite/${inviteId}/${inviteToken(inviteId, email)}/`;

export async function invitesForProfiles(profileIds: number[]) {
  if (!profileIds.length) return [];
  return db
    .select({ id: profileInvites.id, profileId: profileInvites.profileId, email: profileInvites.email, status: profileInvites.status, createdAt: profileInvites.createdAt })
    .from(profileInvites)
    .where(inArray(profileInvites.profileId, profileIds))
    .orderBy(desc(profileInvites.createdAt));
}

export async function createInvite(profileId: number, email: string, invitedBy: number) {
  const [p] = await db
    .select({ firstName: profiles.firstName, lastName: profiles.lastName, companyName: sql<string>`coalesce(${companies.name}, ${profiles.companyName})` })
    .from(profiles)
    .leftJoin(companies, eq(companies.id, profiles.companyId))
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!p) return null;
  // One open invite per profile: re-inviting replaces the previous one.
  await db.delete(profileInvites).where(and(eq(profileInvites.profileId, profileId), eq(profileInvites.status, "pending")));
  const [row] = await db.insert(profileInvites).values({ profileId, email, invitedBy }).returning({ id: profileInvites.id });
  const [inviter] = await db.select({ name: users.displayName, email: users.email }).from(users).where(eq(users.id, invitedBy)).limit(1);
  const who = inviter?.name || inviter?.email || "Your team admin";
  const name = `${p.firstName} ${p.lastName}`.trim();
  await sendEmail({
    to: email,
    replyTo: inviter?.email,
    subject: `${who} has invited you to your MeCard profile`,
    text: [
      "Hi,",
      "",
      `${who} has set up a MeCard digital business card for you${name ? ` (${name}` : ""}${name && p.companyName ? `, ${p.companyName}` : ""}${name ? ")" : ""}.`,
      "Accept the invite to take ownership of your profile, keep it up to date and link your cards to it:",
      siteUrl(invitePath(row.id, email)),
      "",
      "Sign in or create a free MeCard account with this email address, then press Accept.",
      "",
      "The MeCard team",
    ].join("\n"),
  });
  return row.id;
}

export async function cancelInvite(inviteId: number, profileId: number) {
  await db.delete(profileInvites).where(and(eq(profileInvites.id, inviteId), eq(profileInvites.profileId, profileId), eq(profileInvites.status, "pending")));
}

export async function inviteById(inviteId: number) {
  const [row] = await db
    .select({
      id: profileInvites.id,
      email: profileInvites.email,
      status: profileInvites.status,
      profileId: profileInvites.profileId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      archived: profiles.archived,
      companyName: sql<string>`coalesce(${companies.name}, ${profiles.companyName})`,
    })
    .from(profileInvites)
    .innerJoin(profiles, eq(profiles.id, profileInvites.profileId))
    .leftJoin(companies, eq(companies.id, profiles.companyId))
    .where(eq(profileInvites.id, inviteId))
    .limit(1);
  return row ?? null;
}

export { verifyInviteToken };

/**
 * Make the user the profile's owner. From the emailed link the token proves the
 * invite was meant for whoever holds it (as on WordPress); from /manage/ the
 * invite must be addressed to the user's own email.
 */
export async function acceptInvite(inviteId: number, userId: number, opts: { requireEmailMatch: boolean }): Promise<{ ok: boolean; error?: string; profileId?: number }> {
  const inv = await inviteById(inviteId);
  if (!inv || inv.archived) return { ok: false, error: "This invite no longer exists." };
  if (inv.status === "accepted") return { ok: false, error: "This invite has already been accepted." };
  if (opts.requireEmailMatch) {
    const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!u || u.email.toLowerCase() !== inv.email.toLowerCase()) return { ok: false, error: "This invite was sent to a different email address." };
  }
  await db.transaction(async (tx) => {
    await tx.update(profiles).set({ ownerId: userId, updatedAt: new Date() }).where(eq(profiles.id, inv.profileId));
    await tx.update(profileInvites).set({ status: "accepted" }).where(eq(profileInvites.id, inviteId));
  });
  await refreshProfilePages(inv.profileId);
  return { ok: true, profileId: inv.profileId };
}
