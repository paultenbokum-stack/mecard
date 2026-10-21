import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { PageTitle } from "@/components/account/Signup";
import { OnboardingWizard } from "@/components/account/OnboardingWizard";
import { accountState, ensureOnboardingProfile, type Onboarding } from "@/lib/onboarding";
import { currentUserId } from "@/lib/session";
import "../onboarding.css";

export const metadata: Metadata = { title: { absolute: "Onboarding - MeCard" } };

// [me_onboarding]: first-time users only; everyone else goes to their home.
export default async function OnboardingPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-up/");
  const state = await accountState(userId);
  if (state === "existing") redirect("/manage/");

  const profileId = await ensureOnboardingProfile(userId);
  const [[p], [u]] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1),
    db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
  const o = p.onboarding as Onboarding;

  return (
    <div className="acc__wrap acc__wrap--wide">
      <PageTitle>Create your MeCard</PageTitle>
      <OnboardingWizard
        userEmail={u.email}
        initial={{
          id: p.id,
          slug: p.slug,
          stage: o.stage || "basics",
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          mobile: p.mobile,
          photoPath: p.photoPath,
          jobTitle: p.jobTitle,
          companyName: p.companyName,
          companyLogoPath: p.companyLogoPath,
          linkedin: p.socials.linkedin ?? "",
        }}
      />
    </div>
  );
}
