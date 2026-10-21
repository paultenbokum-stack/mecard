import "server-only";
import { and, desc, eq, ilike, isNull, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, orders, profiles, users } from "@/db/schema";
import { CARD_STAGES, type CardStage, ENCODE_TYPES, PRINT_TYPES } from "./admin-cards";

// Inlined, not parameters: the same expression is used in GROUP BY, which
// Postgres only matches when the text is identical. The types are constants.
const list = (types: string[]) => sql.raw(types.map((t) => `'${t.replace(/[^a-z]/g, "")}'`).join(", "));

/** cardStage() in SQL, so the tabs can filter and count in the database. */
export const STAGE_SQL = sql<string>`case
  when ${cards.shipped} then 'done'
  when ${cards.packaged} then 'ship'
  when ${cards.type} in (${list(PRINT_TYPES)}) and not ${cards.designSubmitted} then 'design'
  when ${cards.type} in (${list(PRINT_TYPES)}) and not ${cards.designReceived} then 'check'
  when ${cards.type} in (${list(PRINT_TYPES)}) and not ${cards.printed} then 'print'
  when ${cards.type} in (${list(ENCODE_TYPES)}) and not ${cards.encoded} then 'encode'
  else 'pack' end`;

/**
 * The cards staff work on (the tag-backend-admin view): ordered, so not still
 * in someone's basket, and not archived. Cards from before the shop moved
 * (no order) are included, as the view did.
 */
export const PROCESSING_CARDS = and(or(isNull(cards.cartItemKey), eq(cards.cartItemKey, "")), eq(cards.archived, false))!;

/** "To do" hides finished cards and cards whose order isn't paid (pending, on hold, cancelled). */
const TODO = and(sql`${STAGE_SQL} <> 'done'`, or(isNull(cards.orderId), sql`${orders.status} in ('processing', 'completed')`))!;

export async function cardStageCounts(): Promise<Record<Exclude<CardStage, "todo" | "all">, number>> {
  const rows = await db
    .select({ stage: STAGE_SQL, n: sql<number>`count(*)::int` })
    .from(cards)
    .leftJoin(orders, eq(orders.id, cards.orderId))
    .where(and(PROCESSING_CARDS, TODO))
    .groupBy(STAGE_SQL);
  const out = { design: 0, check: 0, print: 0, encode: 0, pack: 0, ship: 0, done: 0 };
  for (const r of rows) out[r.stage as keyof typeof out] = r.n;
  return out;
}

export const CARD_PAGE_SIZE = 30;

export async function listProcessingCards(opts: { stage: CardStage; q?: string; page: number }) {
  const filters: SQL[] = [PROCESSING_CARDS];
  if (opts.stage === "todo") filters.push(TODO);
  else if (opts.stage === "done") filters.push(sql`${STAGE_SQL} = 'done'`);
  else if (opts.stage !== "all") filters.push(TODO, sql`${STAGE_SQL} = ${opts.stage}`);
  const q = opts.q?.trim().replace(/^#/, "");
  if (q) {
    const like = `%${q}%`;
    filters.push(
      or(
        ...(/^\d+$/.test(q) ? [eq(cards.id, Number(q)), eq(cards.orderId, Number(q))] : []),
        ilike(cards.slug, like),
        ilike(cards.label, like),
        ilike(users.email, like),
        ilike(users.displayName, like),
        sql`(${profiles.firstName} || ' ' || ${profiles.lastName}) ilike ${like}`,
      )!,
    );
  }
  const where = and(...filters);
  const base = () =>
    db
      .select({
        c: cards,
        stage: STAGE_SQL,
        orderStatus: orders.status,
        ownerEmail: users.email,
        ownerName: users.displayName,
        first: profiles.firstName,
        last: profiles.lastName,
        jobTitle: profiles.jobTitle,
      })
      .from(cards)
      .leftJoin(orders, eq(orders.id, cards.orderId))
      .leftJoin(users, eq(users.id, cards.ownerId))
      .leftJoin(profiles, eq(profiles.id, cards.profileId));
  const [rows, [{ total }]] = await Promise.all([
    base()
      .where(where)
      .orderBy(desc(cards.id))
      .limit(CARD_PAGE_SIZE)
      .offset((opts.page - 1) * CARD_PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(cards)
      .leftJoin(orders, eq(orders.id, cards.orderId))
      .leftJoin(users, eq(users.id, cards.ownerId))
      .leftJoin(profiles, eq(profiles.id, cards.profileId))
      .where(where),
  ]);
  return { rows, total };
}

export const isCardStage = (v: unknown): v is CardStage => typeof v === "string" && v in CARD_STAGES;
