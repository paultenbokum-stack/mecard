"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { db } from "@/db/client";
import { events, profiles, users } from "@/db/schema";
import { onNewUser } from "@/lib/accounts";
import { cleanEmail, cleanPhone, cleanText } from "@/lib/form-values";
import { freeUsername, saveOnboardingStep, sendProfileLink } from "@/lib/onboarding";
import { hashPassword } from "@/lib/password";
import { MIN_PASSWORD } from "@/lib/password-reset";
import { requireUserId } from "@/lib/session";

export type SignupState = { errors?: string[]; values?: Record<string, string> } | null;

/** The email sign-up form (render_signup_email_entry). */
export async function emailSignupAction(_: SignupState, form: FormData): Promise<SignupState> {
  // Honeypot and a 3-second minimum, as on WordPress: bots are sent back quietly.
  const started = Number(form.get("started"));
  if (String(form.get("website") ?? "") !== "" || (started > 0 && Date.now() - started < 3000)) redirect("/sign-up/");

  const values = {
    firstName: cleanText(form.get("first_name"), 100),
    lastName: cleanText(form.get("last_name"), 100),
    email: cleanEmail(form.get("email")),
    mobile: cleanPhone(form.get("mobile")),
  };
  const password = String(form.get("password") ?? "");
  const errors: string[] = [];
  if (!values.firstName) errors.push("First name is required.");
  if (!values.lastName) errors.push("Last name is required.");
  if (!values.email) errors.push("A valid email address is required.");
  if (!values.mobile) errors.push("Mobile number is required.");
  if (password.length < MIN_PASSWORD) errors.push(`Password must be at least ${MIN_PASSWORD} characters.`);
  if (values.email) {
    const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${values.email.toLowerCase()}`).limit(1);
    if (taken) errors.push("An account with that email already exists. Please log in instead.");
  }
  if (errors.length) return { errors, values: { first_name: values.firstName, last_name: values.lastName, email: String(form.get("email") ?? ""), mobile: values.mobile } };

  const [user] = await db
    .insert(users)
    .values({
      email: values.email,
      username: await freeUsername(values.email),
      passwordHash: await hashPassword(password),
      firstName: values.firstName,
      lastName: values.lastName,
      displayName: `${values.firstName} ${values.lastName}`.trim(),
      phone: values.mobile,
    })
    .returning({ id: users.id });
  await onNewUser(user.id);
  await db.insert(events).values({ name: "signup_completed", userId: user.id, source: "email" });
  await signIn("credentials", { username: values.email, password, redirectTo: "/onboarding/" });
  return null;
}

export async function onboardingStepAction(profileId: number, step: string, data: Record<string, unknown>) {
  const userId = await requireUserId("/onboarding/");
  try {
    return { ok: true as const, ...(await saveOnboardingStep(userId, profileId, step, data ?? {})) };
  } catch {
    return { ok: false as const, error: "Your progress couldn't be saved. Please try again." };
  }
}

export async function sendProfileLinkAction(profileId: number) {
  const userId = await requireUserId("/onboarding/");
  const [p] = await db.select({ slug: profiles.slug, ownerId: profiles.ownerId }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!p || p.ownerId !== userId) return { ok: false };
  const res = await sendProfileLink(userId, p.slug);
  return { ok: res.ok };
}
