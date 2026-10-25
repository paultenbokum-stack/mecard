import "server-only";
import { and, eq, ne, or } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { companies, profiles, users } from "@/db/schema";
import { type AccountMode, canGoIndividual, manageView, shouldMarkTeams } from "./manage-view-rules";
import { currentUserId } from "./session";

/** The signed-in user's /manage/ view (manageView) and, in the single view, their profile. Once per request. */
export const manageViewFor = cache(async (userId?: number | null) => {
  const id = userId ?? (await currentUserId());
  if (!id) return { view: "team" as const, profileId: null, mode: null as AccountMode, canGoIndividual: false };
  const [own, owned, [user]] = await Promise.all([
    db
      .select({ id: profiles.id, companyId: profiles.companyId })
      .from(profiles)
      .where(and(or(eq(profiles.ownerId, id), eq(profiles.managerId, id)), eq(profiles.archived, false)))
      .limit(2),
    db.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, id)).limit(2),
    db.select({ mode: users.accountMode }).from(users).where(eq(users.id, id)).limit(1),
  ]);
  // One company, used by their one profile and nobody else's: it's that profile's branding.
  let companyIsOwnBranding = false;
  if (own.length === 1 && owned.length === 1 && own[0].companyId === owned[0].id) {
    const [other] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.companyId, owned[0].id), eq(profiles.archived, false), ne(profiles.id, own[0].id)))
      .limit(1);
    companyIsOwnBranding = !other;
  }
  const mode = (user?.mode ?? null) as AccountMode;
  const facts = { mode, ownProfiles: own.length, ownsCompany: owned.length > 0, companyIsOwnBranding };
  // Once they have a team the account is a team account, even if they archive down to one profile later.
  if (shouldMarkTeams(facts)) await setAccountMode(id, "teams");
  const view = manageView(facts);
  return { view, profileId: view === "single" ? own[0].id : null, mode: shouldMarkTeams(facts) ? ("teams" as const) : mode, canGoIndividual: canGoIndividual(facts) };
});

/** Switch to teams / Back to individual view, and team sign-ups. */
export async function setAccountMode(userId: number, mode: Exclude<AccountMode, null>) {
  await db.update(users).set({ accountMode: mode }).where(eq(users.id, userId));
}
