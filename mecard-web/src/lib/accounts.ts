import "server-only";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { events, users } from "@/db/schema";
import type { SignupFor } from "./signup-choice";
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
  if (opts.signupFor === "teams") {
    await db.update(users).set({ accountMode: "teams" }).where(eq(users.id, userId));
    (await cookies()).set(teamWelcomeCookie(userId), "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  await db.insert(events).values({ name: "signup_completed", userId, source: opts.source, meta: { for: opts.signupFor ?? "me" } });
}
