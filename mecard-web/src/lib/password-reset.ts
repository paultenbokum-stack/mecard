import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { passwordResets, users } from "@/db/schema";
import { userByLogin } from "./accounts";
import { sendEmail } from "./email";
import { hashPassword } from "./password";
import { siteUrl } from "./site";

// "Lost your password?" (WooCommerce's lost-password endpoint): a one-hour,
// single-use link sent by email. Only a hash of the token is stored.

const TTL_MS = 60 * 60 * 1000;
export const MIN_PASSWORD = 8;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Sends the reset email if the login matches an account. Says nothing about whether it did. */
export async function requestPasswordReset(login: string): Promise<void> {
  const user = await userByLogin(login);
  if (!user) return;
  const token = randomBytes(32).toString("base64url");
  await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));
  await db.delete(passwordResets).where(lt(passwordResets.expiresAt, new Date()));
  await db.insert(passwordResets).values({ token: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + TTL_MS) });
  const link = siteUrl(`/my-account/reset-password/?token=${token}`);
  const name = user.firstName || user.displayName || user.username || "there";
  await sendEmail({
    to: user.email,
    subject: "Password reset request for MeCard",
    text: [
      `Hi ${name},`,
      "",
      "Someone has requested a new password for your MeCard account.",
      user.username ? `Username: ${user.username}` : "",
      "",
      "If you didn't make this request, just ignore this email. If you'd like to proceed, set a new password here (the link works for one hour):",
      link,
      "",
      "Thanks for using MeCard.",
    ]
      .filter((l, i, a) => l !== "" || a[i - 1] !== "")
      .join("\n"),
  });
}

/** The user a reset token belongs to, if it is still valid. */
export async function resetTokenUser(token: string): Promise<number | null> {
  if (!token) return null;
  const [row] = await db
    .select({ userId: passwordResets.userId })
    .from(passwordResets)
    .where(and(eq(passwordResets.token, hashToken(token)), gt(passwordResets.expiresAt, new Date())))
    .limit(1);
  return row?.userId ?? null;
}

export async function resetPassword(token: string, password: string): Promise<{ ok: true; login: string } | { ok: false; error: string }> {
  if (password.length < MIN_PASSWORD) return { ok: false, error: `Use at least ${MIN_PASSWORD} characters.` };
  const userId = await resetTokenUser(token);
  if (!userId) return { ok: false, error: "This password reset link has expired or was already used. Ask for a new one below." };
  const [u] = await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, userId)).returning({ email: users.email });
  await db.delete(passwordResets).where(eq(passwordResets.userId, userId));
  return { ok: true, login: u.email };
}
