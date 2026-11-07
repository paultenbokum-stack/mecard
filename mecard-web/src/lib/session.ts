import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { loginUrl } from "./auth-paths";
import { VIEW_AS_COOKIE } from "./view-as-rules";
import { readViewAsToken } from "./view-as-token";

/** The customer a staff member is viewing as, or null. Staff must still be staff, and only customers can be viewed. */
const viewAsTarget = cache(async (signedInId: number): Promise<number | null> => {
  const raw = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!raw) return null;
  const token = readViewAsToken(raw, process.env.AUTH_SECRET ?? "");
  if (!token || token.actorId !== signedInId) return null;
  const [target] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, token.targetId)).limit(1);
  if (!target || target.isAdmin || !(await isAdminUser(signedInId))) return null;
  return token.targetId;
});

/** Who the page is for: the signed-in user, or the customer staff are viewing as. Staff screens use requireAdmin() instead. */
export async function currentUserId(): Promise<number | null> {
  const s = await auth();
  const id = s?.user?.id ? Number(s.user.id) : null;
  return id ? ((await viewAsTarget(id)) ?? id) : null;
}

/** True during staff view-as, so pages can skip what they write on load. The proxy refuses every other write. */
export async function isViewingAs(): Promise<boolean> {
  const s = await auth();
  return !!s?.user?.id && (await viewAsTarget(Number(s.user.id))) !== null;
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

/** The signed-in user's real roles, never the customer staff are viewing as. */
async function staffRoles() {
  const s = await auth();
  const id = Number(s?.user?.id);
  if (!id) return null;
  const [u] = await db.select({ isAdmin: users.isAdmin, isSales: users.isSales }).from(users).where(eq(users.id, id)).limit(1);
  return u ? { id, ...u } : null;
}

/**
 * Staff or a salesperson, for what both may do. The caller keeps a salesperson
 * to their own records; src/proxy.ts keeps them to the screens in admin-paths.ts.
 */
export async function requireQuoteStaff(next = "/admin/commissions/"): Promise<{ id: number; isAdmin: boolean; isSales: boolean }> {
  const who = await staffRoles();
  if (!who) redirect(loginUrl(next));
  if (!who.isAdmin && !who.isSales) redirect("/my-account/");
  return who;
}

/** Staff screens (/admin/): signed-out visitors go to the login page first; customers to their account. */
export async function requireAdmin(next = "/admin/"): Promise<number> {
  const s = await auth();
  const id = Number(s?.user?.id);
  if (!id) redirect(loginUrl(next));
  if (!s?.user?.isAdmin || !id || !(await isAdminUser(id))) redirect("/my-account/");
  return id;
}
