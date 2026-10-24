import type { Metadata } from "next";
import { Subnav } from "@/components/account/Bits";
import { AddProfile, loadAddProfile } from "./AddProfile";

export const metadata: Metadata = { title: "Add a profile" };

// Opened from the Profiles list this shows in a modal (@modal/(.)profile/new).
export default async function AddProfilePage() {
  const data = await loadAddProfile();
  return (
    <div className="acc__wrap">
      <Subnav active="home" />
      <h1>Add a new profile</h1>
      <section className="acc-panel acc-panel--white">
        <AddProfile {...data} />
      </section>
    </div>
  );
}
