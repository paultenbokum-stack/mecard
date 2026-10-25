import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { googleEnabled } from "@/auth";
import { PageTitle, ProgressTracker, SignupChoice, SignupFeatures, TeamProgressTracker } from "@/components/account/Signup";
import { LOGIN } from "@/lib/auth-paths";
import { accountState } from "@/lib/onboarding";
import { currentUserId } from "@/lib/session";
import { signupFor, signupLanding } from "@/lib/signup-choice";
import { googleAction } from "../my-account/actions";
import "../onboarding.css";

export const metadata: Metadata = { title: { absolute: "Sign Up - MeCard" }, robots: { index: true, follow: true } };

// [me_signup]: first "Just me" or "For my team", then Google or email. Signed-in people go on to onboarding or their home.
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const forWhom = signupFor((await searchParams).for);
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
          {!forWhom ? (
            <>
              <h2 className="me-auth-entry__title">Who is MeCard for?</h2>
              <p className="me-auth-card__text">Pick one to get the right start. You can switch to managing a team later.</p>
              <SignupChoice />
              <p className="me-auth-screen__footer">
                Already have an account? <Link href={LOGIN}>Log in</Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="me-auth-entry__title">{teams ? "Create your team account" : "Create your MeCard Profile"}</h2>
              <p className="me-auth-card__text">
                {teams
                  ? "Sign up, then set up your company, add your people and order their cards from your team dashboard."
                  : "Create your free shareable profile in seconds, then add it to your home screen for instant sharing."}
              </p>
              {googleEnabled ? (
                <>
                  <form action={googleAction} className="me-auth-screen__nsl">
                    <input type="hidden" name="next" value={signupLanding(forWhom)} />
                    <input type="hidden" name="for" value={forWhom} />
                    <button type="submit" className="acc-google">
                      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                        <path
                          fill="#FFC107"
                          d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
                        />
                        <path
                          fill="#FF3D00"
                          d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                        />
                        <path
                          fill="#4CAF50"
                          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
                        />
                        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                      </svg>
                      Continue with Google
                    </button>
                  </form>
                  <div className="me-auth-divider">
                    <span>or</span>
                  </div>
                </>
              ) : null}
              <Link className="me-auth-email-link" href={`/sign-up/email/?for=${forWhom}`}>
                <span className="me-auth-email-link__icon">@</span>
                <span>Sign up with email</span>
              </Link>
              <p className="me-auth-screen__footer">
                Already have an account? <Link href={LOGIN}>Log in</Link> &middot;{" "}
                <Link href="/sign-up/">{teams ? "Just for me instead" : "For a team instead"}</Link>
              </p>
              {teams ? null : <SignupFeatures />}
            </>
          )}
        </div>
        {teams ? <TeamProgressTracker /> : <ProgressTracker current="signup" />}
      </div>
    </div>
  );
}
