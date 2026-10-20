"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { LOGIN, safeNext } from "@/lib/auth-paths";
import { requestPasswordReset, resetPassword } from "@/lib/password-reset";

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
