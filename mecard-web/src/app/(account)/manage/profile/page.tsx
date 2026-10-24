import { redirect } from "next/navigation";
import { manageViewFor } from "@/lib/manage-view";
import { requireUserId } from "@/lib/session";

// WordPress /manage/profile/ edited "the" profile of single-profile users
// (resolve_single_profile_id); the team view picks one on /manage/.
export default async function MyProfile() {
  const { view, profileId } = await manageViewFor(await requireUserId("/manage/profile/"));
  redirect(view === "single" && profileId ? `/manage/profile/${profileId}/` : "/manage/");
}
