// Sign up "Just me" or "For my team" (/sign-up/?for=…). The choice rides
// along on the email form, and through Google's round trip in a short-lived
// cookie, so the new account can start as a team account.

export type SignupFor = "me" | "teams";

export const SIGNUP_FOR_COOKIE = "mecard_signup_for";

export const signupFor = (v: unknown): SignupFor | null => (v === "teams" ? "teams" : v === "me" ? "me" : null);

/** Where a new account goes first: a team starts on Companies (set up your company), a person on onboarding. */
export const signupLanding = (f: SignupFor | null) => (f === "teams" ? "/manage/companies/" : "/onboarding/");
