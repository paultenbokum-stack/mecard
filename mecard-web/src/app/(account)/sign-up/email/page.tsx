import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailSignupForm } from "@/components/account/EmailSignupForm";
import { PageTitle, ProgressTracker, SignupFeatures } from "@/components/account/Signup";
import { LOGIN } from "@/lib/auth-paths";
import { accountState } from "@/lib/onboarding";
import { currentUserId } from "@/lib/session";
import "../../onboarding.css";

export const metadata: Metadata = { title: { absolute: "Sign Up - MeCard" } };

// [me_signup_email]
export default async function EmailSignUpPage() {
  const state = await accountState(await currentUserId());
  if (state === "first_time" || state === "onboarding") redirect("/onboarding/");
  if (state === "existing") redirect("/manage/");

  return (
    <div className="acc__wrap acc__wrap--wide">
      <PageTitle>Sign Up</PageTitle>
      <div className="me-auth-entry">
        <div className="me-auth-card me-auth-card--single">
          <p className="me-auth-entry__eyebrow">Step 1</p>
          <h2 className="me-auth-entry__title">Create your MeCard Profile</h2>
          <p className="me-auth-card__text">Start with the basics here and we will carry them into your free profile.</p>
          <EmailSignupForm />
          <p className="me-auth-screen__footer">
            Already have an account? <Link href={LOGIN}>Log in</Link>
          </p>
          <SignupFeatures />
          <div className="me-auth-card__actions">
            <Link className="me-auth-back-anchor" href="/sign-up/">
              Back to social sign up
            </Link>
          </div>
        </div>
        <ProgressTracker current="signup" />
      </div>
    </div>
  );
}
