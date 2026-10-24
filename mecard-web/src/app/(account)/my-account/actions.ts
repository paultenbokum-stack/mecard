"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { parseAccountDetails } from "@/lib/account-details";
import { LOGIN, safeNext } from "@/lib/auth-paths";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requestPasswordReset, resetPassword } from "@/lib/password-reset";
import { requireUserId } from "@/lib/session";

export type FormState = { error?: string; ok?: string; username?: string } | null;

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username or email address and your password." };
  try {
    await signIn("credentials", { username, password, redirectTo: safeNext(form.get("next")) });
  } catch (e) {
    if (e instanceof AuthError) return { error: "The username, email address or password is incorrect.", username };
    throw e; // the redirect after a successful sign-in
  }
  return null;
}

export async function googleAction(form: FormData) {
  await signIn("google", { redirectTo: safeNext(form.get("next")) });
}

export async function logoutAction() {
  await signOut({ redirectTo: LOGIN });
}

export async function lostPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const login = String(form.get("user_login") ?? "").trim();
  if (!login) return { error: "Enter a username or email address." };
  await requestPasswordReset(login);
  return { ok: "If that matches a MeCard account, a password reset email is on its way. Check your inbox (and spam folder)." };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password_1") ?? "");
  if (password !== String(form.get("password_2") ?? "")) return { error: "The passwords don't match." };
  const res = await resetPassword(String(form.get("token") ?? ""), password);
  if (!res.ok) return { error: res.error };
  redirect(`${LOGIN}?reset=1`);
}

/** My Account → Account details. The current password is needed to change it; Google-only accounts set their first one. */
export async function saveAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId("/my-account/edit-account/");
  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { error: "Your account couldn't be found. Please log in again." };
  const parsed = parseAccountDetails(form, !!user.passwordHash);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.details;

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(ne(users.id, userId), sql`(lower(${users.email}) = ${d.email.toLowerCase()} OR lower(${users.username}) = ${d.email.toLowerCase()})`))
    .limit(1);
  if (taken) return { error: "This email address is already registered." };
  if (d.newPassword && user.passwordHash && !(await verifyPassword(d.currentPassword, user.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }

  await db
    .update(users)
    .set({
      firstName: d.firstName,
      lastName: d.lastName,
      displayName: d.displayName,
      email: d.email,
      ...(d.newPassword ? { passwordHash: await hashPassword(d.newPassword) } : {}),
    })
    .where(eq(users.id, userId));
  revalidatePath("/my-account/", "layout");
  return { ok: d.newPassword ? "Account details and password changed successfully." : "Account details changed successfully." };
}
