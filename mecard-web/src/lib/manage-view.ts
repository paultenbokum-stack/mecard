import "server-only";
import { and, eq, ne, or } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { companies, profiles } from "@/db/schema";
import { manageView } from "./manage-view-rules";
import { currentUserId } from "./session";

/** The signed-in user's /manage/ view (manageView) and, in the single view, their profile. Once per request. */
export const manageViewFor = cache(async (userId?: number | null) => {
  const id = userId ?? (await currentUserId());
  if (!id) return { view: "team" as const, profileId: null };
  const [own, owned] = await Promise.all([
    db
      .select({ id: profiles.id, companyId: profiles.companyId })
      .from(profiles)
      .where(and(or(eq(profiles.ownerId, id), eq(profiles.managerId, id)), eq(profiles.archived, false)))
      .limit(2),
    db.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, id)).limit(2),
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
  const view = manageView({ ownProfiles: own.length, ownsCompany: owned.length > 0, companyIsOwnBranding });
  return { view, profileId: view === "single" ? own[0].id : null };
});
