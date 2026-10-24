import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

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

/** Runs once for every new account. Onboarding (a free profile) hooks in here. */
export async function onNewUser(userId: number): Promise<void> {
  void userId;
}
