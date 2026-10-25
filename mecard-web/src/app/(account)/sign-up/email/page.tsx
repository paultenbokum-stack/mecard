import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailSignupForm } from "@/components/account/EmailSignupForm";
import { PageTitle, ProgressTracker, SignupFeatures, TeamProgressTracker } from "@/components/account/Signup";
import { LOGIN } from "@/lib/auth-paths";
import { accountState } from "@/lib/onboarding";
import { currentUserId } from "@/lib/session";
import { signupFor } from "@/lib/signup-choice";
import "../../onboarding.css";

export const metadata: Metadata = { title: { absolute: "Sign Up - MeCard" } };

// [me_signup_email]
export default async function EmailSignUpPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const forWhom = signupFor((await searchParams).for) ?? "me";
  const teams = forWhom === "teams";
  const state = await accountState(await currentUserId());
  if (state === "first_time" || state === "onboarding") redirect("/onboarding/");
  if (state === "existing") redirect("/manage/");

  return (
    <div className="acc__wrap acc__wrap--wide">
      <PageTitle>Sign Up</PageTitle>
      <div className="me-auth-entry">
        <div className="me-auth-card me-auth-card--single">
          <p className="me-auth-entry__eyebrow">Step 1</p>
          <h2 className="me-auth-entry__title">{teams ? "Create your team account" : "Create your MeCard Profile"}</h2>
          <p className="me-auth-card__text">
            {teams ? "Your details for the account. Your team dashboard opens next." : "Start with the basics here and we will carry them into your free profile."}
          </p>
          <EmailSignupForm forWhom={forWhom} />
          <p className="me-auth-screen__footer">
            Already have an account? <Link href={LOGIN}>Log in</Link>
          </p>
          {teams ? null : <SignupFeatures />}
          <div className="me-auth-card__actions">
            <Link className="me-auth-back-anchor" href={`/sign-up/?for=${forWhom}`}>
              Back to social sign up
            </Link>
          </div>
        </div>
        {teams ? <TeamProgressTracker /> : <ProgressTracker current="signup" />}
      </div>
    </div>
  );
}
