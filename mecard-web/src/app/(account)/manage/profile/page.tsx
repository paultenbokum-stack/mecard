import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { editableProfilesWhere } from "@/lib/access";
import { requireUserId } from "@/lib/session";

// WordPress /manage/profile/ edited "the" profile of single-profile users
// (resolve_single_profile_id); everyone else picks one on /manage/.
export default async function MyProfile() {
  const userId = await requireUserId("/manage/profile/");
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(editableProfilesWhere(userId), eq(profiles.archived, false)))
    .limit(2);
  redirect(rows.length === 1 ? `/manage/profile/${rows[0].id}/` : "/manage/");
}
