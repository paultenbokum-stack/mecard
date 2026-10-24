import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { loginUrl } from "./auth-paths";

export async function currentUserId(): Promise<number | null> {
  const s = await auth();
  return s?.user?.id ? Number(s.user.id) : null;
}

/** Logged-in user id, or a redirect to the login page (like WordPress /my-account/), coming back to `next` after. */
export async function requireUserId(next?: string): Promise<number> {
  const id = await currentUserId();
  if (!id) redirect(loginUrl(next));
  return id;
}


/** True when the user is still an admin in the database (the session flag lasts until logout). */
export async function isAdminUser(userId: number): Promise<boolean> {
  const [u] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  return !!u?.isAdmin;
}

/** Staff screens (/admin/): signed-out visitors go to the login page first; customers to their account. */
export async function requireAdmin(next = "/admin/"): Promise<number> {
  const s = await auth();
  const id = Number(s?.user?.id);
  if (!id) redirect(loginUrl(next));
  if (!s?.user?.isAdmin || !id || !(await isAdminUser(id))) redirect("/my-account/");
  return id;
}
