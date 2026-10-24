"use server";

import { and, eq, ne, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { cards, companies, orders, profiles, users } from "@/db/schema";
import { userDeleteGuard } from "@/lib/admin-guards";
import { logAdmin } from "@/lib/admin-log";
import { cleanEmail } from "@/lib/form-values";
import { requestPasswordReset } from "@/lib/password-reset";
import { requireAdmin } from "@/lib/session";

// Staff management of accounts (WordPress's Users screen).

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function back(path: string, outcome: { saved?: string; error?: string }): never {
  redirect(`${path}?${new URLSearchParams(outcome as Record<string, string>)}`);
}

async function emailTaken(email: string, exceptId: number | null) {
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, exceptId ? ne(users.id, exceptId) : undefined));
  return u?.id ?? null;
}

export async function saveUserAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("user_id"));
  const path = `/admin/users/${id}/`;
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) back("/admin/users/", { error: "Account not found." });
  const email = cleanEmail(form.get("email"));
  if (!email) back(path, { error: "Please enter a valid email address." });
  const clash = await emailTaken(email, id);
  if (clash) back(path, { error: `Account ${clash} already uses ${email}.` });
  const isAdmin = form.get("role") === "staff";
  if (id === me && !isAdmin) back(path, { error: "You can't remove your own staff access." });
  const values = {
    email,
    firstName: str(form, "first_name").slice(0, 100),
    lastName: str(form, "last_name").slice(0, 100),
    displayName: str(form, "display_name").slice(0, 250),
    phone: str(form, "phone").slice(0, 50),
    isAdmin,
  };
  const changed = (Object.keys(values) as (keyof typeof values)[]).filter((k) => String(values[k]) !== String(u[k]));
  if (!changed.length) back(path, { saved: "Nothing changed." });
  await db.update(users).set(values).where(eq(users.id, id));
  await logAdmin(me, "user", id, "edited", changed.map((k) => (k === "isAdmin" ? `role ${isAdmin ? "staff" : "customer"}` : k === "email" ? `email ${u.email} → ${email}` : k)).join(", "));
  back(path, { saved: "Account saved." });
}

export async function createUserAction(form: FormData) {
  const me = await requireAdmin();
  const email = cleanEmail(form.get("email"));
  if (!email) back("/admin/users/", { error: "Please enter a valid email address." });
  const clash = await emailTaken(email, null);
  if (clash) back(`/admin/users/${clash}/`, { error: `There is already an account for ${email}.` });
  const first = str(form, "first_name").slice(0, 100);
  const last = str(form, "last_name").slice(0, 100);
  const [u] = await db
    .insert(users)
    .values({ email, firstName: first, lastName: last, displayName: `${first} ${last}`.trim() || email, isAdmin: form.get("role") === "staff" })
    .returning({ id: users.id });
  await logAdmin(me, "user", u.id, "created", email);
  if (form.get("send_reset") === "on") await requestPasswordReset(email);
  back(`/admin/users/${u.id}/`, { saved: form.get("send_reset") === "on" ? "Account created and a set-password email sent." : "Account created. It has no password until a reset is sent." });
}

/** The customer's own "lost password" email: they choose the new password. */
export async function sendResetAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("user_id"));
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, id));
  if (!u) back("/admin/users/", { error: "Account not found." });
  await requestPasswordReset(u.email);
  await logAdmin(me, "user", id, "sent password reset", u.email);
  back(`/admin/users/${id}/`, { saved: `Password reset email sent to ${u.email}.` });
}

export async function userDeleteCounts(id: number) {
  const [[o], [p], [c], [k]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.userId, id)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(profiles)
      .where(and(eq(profiles.archived, false), or(eq(profiles.ownerId, id), eq(profiles.managerId, id)))),
    db.select({ n: sql<number>`count(*)::int` }).from(companies).where(eq(companies.ownerId, id)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(cards)
      .where(and(eq(cards.ownerId, id), eq(cards.archived, false))),
  ]);
  return { orders: o.n, profiles: p.n, companies: c.n, cards: k.n };
}

export async function deleteUserAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("user_id"));
  const path = `/admin/users/${id}/`;
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, id));
  if (!u) back("/admin/users/", { error: "Account not found." });
  if (str(form, "confirm").toLowerCase() !== u.email.toLowerCase()) back(path, { error: "Type the account's email address exactly to delete it." });
  const g = userDeleteGuard({ ...(await userDeleteCounts(id)), isSelf: id === me });
  if (!g.ok) back(path, { error: g.blockers.join(" ") });
  await db.delete(users).where(eq(users.id, id));
  await logAdmin(me, "user", id, "deleted", u.email);
  back("/admin/users/", { saved: `Deleted the account for ${u.email}.` });
}
