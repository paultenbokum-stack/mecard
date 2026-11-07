import "server-only";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { events, users } from "@/db/schema";
import { FIRST_TOUCH_COOKIE, parseAcquisition } from "./acquisition";
import { salesReferralForSignup } from "./sales";
import { SALES_REF_COOKIE } from "./sales-rules";
import { SIGNUP_CONVERSION_COOKIE, type SignupFor } from "./signup-choice";
import { SESSION_COOKIE } from "./tracking";
import { teamWelcomeCookie } from "./upsell-rules";

/** Find a user by email or WordPress username, ignoring case. */
export async function userByLogin(login: string) {
  const l = login.toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${l} OR lower(${users.username}) = ${l}`)
    .limit(1);
  return user ?? null;
}

/**
 * Runs once for every new account. A team sign-up starts as a team account
 * (no onboarding profile; the team dashboard with its welcome strip), and the
 * choice is recorded on signup_completed for /admin/stats.
 */
export async function onNewUser(userId: number, opts: { source: string; signupFor: SignupFor | null }): Promise<void> {
  const jar = await cookies();
  // Conversion plan 0.1 / 0.2: the browser session that signed up, and where it first came from.
  const sid = jar.get(SESSION_COOKIE)?.value?.slice(0, 64) || null;
  const acquisition = parseAcquisition(jar.get(FIRST_TOUCH_COOKIE)?.value);
  // Signed up through a salesperson's link: their purchases earn that salesperson commission for 12 months.
  const referral = await salesReferralForSignup();
  await db
    .update(users)
    .set({ firstSessionId: sid, acquisition, ...referral, ...(opts.signupFor === "teams" ? { accountMode: "teams" } : {}) })
    .where(eq(users.id, userId));
  if (referral) jar.delete(SALES_REF_COOKIE);
  if (opts.signupFor === "teams") jar.set(teamWelcomeCookie(userId), "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  // meta.for is the signup intent (0.4): "me" or "teams", from the sign-up page's first question.
  await db.insert(events).values({ name: "signup_completed", userId, sessionId: sid, source: opts.source, meta: { for: opts.signupFor ?? "me" } });
  // Read in the browser by SignupConversion, which sends mecard_signup to Google.
  jar.set(SIGNUP_CONVERSION_COOKIE, opts.source, { path: "/", maxAge: 30 * 60, sameSite: "lax" });
}
