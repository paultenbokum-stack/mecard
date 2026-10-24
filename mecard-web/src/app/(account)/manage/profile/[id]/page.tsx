import type { Metadata } from "next";
import { Subnav } from "@/components/account/Bits";
import { EditProfile, loadProfileEditor, ProfileBadge } from "./EditProfile";

export const metadata: Metadata = { title: "Edit profile" };

// Opened from the Profiles list this shows in a modal (@modal/(.)profile/[id]);
// a direct visit, refresh or shared link gets this full page.
export default async function EditProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await loadProfileEditor(id);
  return (
    <div className="acc__wrap acc__wrap--wide">
      <Subnav active="profile" />
      <p className="acc__eyebrow">Edit profile</p>
      <h1>
        {data.name} <ProfileBadge pro={data.pro} pending={!!data.proPending} />
      </h1>
      <EditProfile data={data} done={sp.done} />
    </div>
  );
}
