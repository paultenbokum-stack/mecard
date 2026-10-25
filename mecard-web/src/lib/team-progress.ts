import "server-only";
import { and, eq, isNotNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, companies, profiles } from "@/db/schema";

// The team path after Sign up: Set up your company, Add your people, Order
// cards. Ticked by what the account has, for the welcome strip and tracker.

export async function teamProgress(userId: number) {
  const [[company], people, [card]] = await Promise.all([
    db.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, userId)).limit(1),
    db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(or(eq(profiles.ownerId, userId), eq(profiles.managerId, userId)), eq(profiles.archived, false)))
      .limit(2),
    db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.ownerId, userId), isNotNull(cards.orderId)))
      .limit(1),
  ]);
  return { company: !!company, people: people.length >= 2, cards: !!card };
}
