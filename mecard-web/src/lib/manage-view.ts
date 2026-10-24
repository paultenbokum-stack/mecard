import "server-only";
import { and, eq, or } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { companies, profiles } from "@/db/schema";
import { manageView } from "./manage-view-rules";
import { currentUserId } from "./session";

/** The signed-in user's /manage/ view (manageView) and, in the single view, their profile. Once per request. */
export const manageViewFor = cache(async (userId?: number | null) => {
  const id = userId ?? (await currentUserId());
  if (!id) return { view: "team" as const, profileId: null };
  const [own, [company]] = await Promise.all([
    db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(or(eq(profiles.ownerId, id), eq(profiles.managerId, id)), eq(profiles.archived, false)))
      .limit(2),
    db.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, id)).limit(1),
  ]);
  const view = manageView({ ownProfiles: own.length, ownsCompany: !!company });
  return { view, profileId: view === "single" ? own[0].id : null };
});
