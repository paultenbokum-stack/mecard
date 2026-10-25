import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { cards, carts, companies, entitlements, orderItems, orders, profileInvites, profiles, users } from "@/db/schema";
import { editableProfilesWhere, manageableCardsWhere, type Viewer } from "./access";
import { CARD_TABS, DEAD_ORDER_STATUSES, DESIGNED_CARD_TYPES, type CardTab } from "./card-tabs";
import { profilePaths } from "./public-profile";
import { nextFreeSlug, slugify } from "./slug";

// Data and changes behind /manage/, the logged-in home that replaces the
// single-profile home (Me\Single_Manage), the team console's Toolset views
// (profile-admin-ajax, shared-profiles, configured-tags-2, tag-admin-ajax,
// company-management-v2) and the add-mecard-profile / add-company forms.

export const PAGE_SIZE = 40;

const profileCols = {
  id: profiles.id,
  slug: profiles.slug,
  firstName: profiles.firstName,
  lastName: profiles.lastName,
  jobTitle: profiles.jobTitle,
  email: profiles.email,
  mobile: profiles.mobile,
  type: profiles.type,
  archived: profiles.archived,
  photoPath: profiles.photoPath,
  companyId: profiles.companyId,
  companyName: sql<string>`coalesce(${companies.name}, ${profiles.companyName})`,
  companyRecord: companies.name,
  ownerId: profiles.ownerId,
  managerId: profiles.managerId,
};

export type ProfileRow = Awaited<ReturnType<typeof listProfiles>>["rows"][number];

export async function listProfiles(v: Viewer, opts: { archived: boolean; q?: string; page?: number }) {
  const conds: SQL[] = [editableProfilesWhere(v.id), eq(profiles.archived, opts.archived)];
  const q = opts.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(
      or(
        ilike(sql`${profiles.firstName} || ' ' || ${profiles.lastName}`, like),
        ilike(profiles.email, like),
        ilike(profiles.jobTitle, like),
        ilike(companies.name, like),
        ilike(profiles.companyName, like),
      )!,
    );
  }
  const where = and(...conds);
  const page = Math.max(1, opts.page ?? 1);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(profileCols)
      .from(profiles)
      .leftJoin(companies, eq(companies.id, profiles.companyId))
      .where(where)
      .orderBy(asc(profiles.firstName), asc(profiles.lastName), asc(profiles.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(profiles).leftJoin(companies, eq(companies.id, profiles.companyId)).where(where),
  ]);
  return { rows, total, page };
}

/** Every active profile the user can link a card to (for the pickers). */
export async function profileChoices(v: Viewer) {
  return db
    .select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName, slug: profiles.slug, companyName: sql<string>`coalesce(${companies.name}, ${profiles.companyName})` })
    .from(profiles)
    .leftJoin(companies, eq(companies.id, profiles.companyId))
    .where(and(editableProfilesWhere(v.id), eq(profiles.archived, false)))
    .orderBy(asc(profiles.firstName), asc(profiles.lastName), asc(profiles.id));
}

export type CardRow = Awaited<ReturnType<typeof listCards>>["rows"][number];

const list = (xs: string[]) => sql.join(xs.map((x) => sql`${x}`), sql`, `);

/** cardTab() (card-tabs.ts) in SQL, for a query that left-joins the card's order. */
const cardTabSql = sql<CardTab>`CASE
  WHEN ${cards.archived} OR ${orders.status} IN (${list(DEAD_ORDER_STATUSES)}) THEN 'archived'
  WHEN ${orders.id} IS NULL AND ${cards.cartItemKey} IS NOT NULL THEN 'design'
  WHEN ${orders.status} <> 'completed' AND ${cards.type} IN (${list(DESIGNED_CARD_TYPES)}) AND NOT ${cards.designSubmitted} AND NOT ${cards.shipped} THEN 'design'
  WHEN ${orders.status} <> 'completed' THEN 'progress'
  WHEN ${cards.profileId} IS NOT NULL THEN 'live'
  ELSE 'unassigned'
END`;

/** How many of the viewer's cards are on each My Cards tab. */
export async function cardTabCounts(v: Viewer): Promise<Record<CardTab, number>> {
  const rows = await db
    .select({ tab: cardTabSql, n: count() })
    .from(cards)
    .leftJoin(orders, eq(orders.id, cards.orderId))
    .where(manageableCardsWhere(v.id))
    .groupBy(sql`1`);
  const counts = Object.fromEntries(CARD_TABS.map(([k]) => [k, 0])) as Record<CardTab, number>;
  for (const r of rows) counts[r.tab] = r.n;
  return counts;
}

/** The My Cards tab one card is on now. */
export async function cardTabOf(cardId: number): Promise<CardTab | null> {
  const [row] = await db.select({ tab: cardTabSql }).from(cards).leftJoin(orders, eq(orders.id, cards.orderId)).where(eq(cards.id, cardId));
  return row?.tab ?? null;
}

/** The viewer's cards on one My Cards tab (see card-tabs.ts). */
export async function listCards(v: Viewer, opts: { tab: CardTab; q?: string; page?: number }) {
  const conds: SQL[] = [manageableCardsWhere(v.id), sql`${cardTabSql} = ${opts.tab}`];
  const q = opts.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(or(ilike(cards.label, like), ilike(cards.slug, like), ilike(cards.nameOnCard, like), ilike(sql`${profiles.firstName} || ' ' || ${profiles.lastName}`, like))!);
  }
  const where = and(...conds);
  const page = Math.max(1, opts.page ?? 1);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: cards.id,
        slug: cards.slug,
        type: cards.type,
        label: cards.label,
        title: cards.title,
        nameOnCard: cards.nameOnCard,
        jobTitleOnCard: cards.jobTitleOnCard,
        frontPath: cards.frontPath,
        autoDownloadVcard: cards.autoDownloadVcard,
        orderId: cards.orderId,
        printed: cards.printed,
        shipped: cards.shipped,
        designSubmitted: cards.designSubmitted,
        designReceived: cards.designReceived,
        profileId: cards.profileId,
        profileName: sql<string | null>`nullif(trim(${profiles.firstName} || ' ' || ${profiles.lastName}), '')`,
        companyName: companies.name,
        encoded: cards.encoded,
        packaged: cards.packaged,
        orderStatus: orders.status,
        inBasket: sql<boolean>`(${orders.id} IS NULL AND ${cards.cartItemKey} IS NOT NULL)`,
      })
      .from(cards)
      .leftJoin(profiles, eq(profiles.id, cards.profileId))
      .leftJoin(companies, eq(companies.id, cards.companyId))
      .leftJoin(orders, eq(orders.id, cards.orderId))
      .where(where)
      .orderBy(desc(cards.createdAt), desc(cards.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(cards).leftJoin(profiles, eq(profiles.id, cards.profileId)).leftJoin(orders, eq(orders.id, cards.orderId)).where(where),
  ]);
  return { rows, total, page };
}

export async function listCompanies(v: Viewer) {
  return db
    .select({
      id: companies.id,
      name: companies.name,
      logoPath: companies.logoPath,
      website: companies.website,
      profiles: sql<number>`(SELECT count(*)::int FROM ${profiles} WHERE ${profiles.companyId} = ${companies.id} AND NOT ${profiles.archived})`,
    })
    .from(companies)
    .where(eq(companies.ownerId, v.id))
    .orderBy(asc(companies.name));
}

/** Invites sent to the user's email address that are still open. */
export async function invitesForUser(userId: number) {
  return db
    .select({ id: profileInvites.id, profileId: profileInvites.profileId, firstName: profiles.firstName, lastName: profiles.lastName, companyName: sql<string>`coalesce(${companies.name}, ${profiles.companyName})`, inviterName: users.displayName })
    .from(profileInvites)
    .innerJoin(profiles, eq(profiles.id, profileInvites.profileId))
    .leftJoin(companies, eq(companies.id, profiles.companyId))
    .leftJoin(users, eq(users.id, profileInvites.invitedBy))
    .where(
      and(
        eq(profileInvites.status, "pending"),
        eq(profiles.archived, false),
        sql`lower(${profileInvites.email}) = (SELECT lower(${users.email}) FROM ${users} WHERE ${users.id} = ${userId})`,
        or(isNull(profiles.ownerId), ne(profiles.ownerId, userId)),
      ),
    )
    .orderBy(desc(profileInvites.createdAt));
}

/** Pro upgrades the user has paid for and not used yet (paid_unassigned entitlements). */
export async function availableProUpgrades(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(entitlements)
    .where(and(eq(entitlements.ownerId, userId), eq(entitlements.type, "pro_upgrade"), eq(entitlements.status, "paid_unassigned")));
  return row?.n ?? 0;
}

// Products that carry a Pro upgrade: the upgrade itself and both bundles
// (MECARD_PROFILE_UPGRADE_PRODUCT_ID, MECARD_BUNDLE_PRODUCT_ID, MECARD_CLASSIC_BUNDLE_PRODUCT_ID).
export const UPGRADE_PRODUCT_IDS = [41811, 2044, 11160];

/**
 * user_has_pending_upgrade(): an upgrade row not yet used up, or an on-hold /
 * pending order with an upgrade product (EFT payments not cleared yet).
 */
export async function hasPendingUpgrade(userId: number, opts: { unassignedOnly?: boolean } = {}): Promise<boolean> {
  // unassignedOnly: leave out upgrades ordered for a particular profile (pendingProUpgrades covers those).
  const [row] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.ownerId, userId),
        eq(entitlements.type, "pro_upgrade"),
        inArray(entitlements.status, ["in_cart", "paid_unassigned", "paid_assigned"]),
        opts.unassignedOnly ? isNull(entitlements.assignedProfileId) : undefined,
      ),
    )
    .limit(1);
  if (row) return true;
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        inArray(orders.status, ["on-hold", "pending"]),
        inArray(orderItems.productId, UPGRADE_PRODUCT_IDS),
        opts.unassignedOnly ? sql`coalesce(${orderItems.meta}->>'profileId', '') IN ('', '0')` : undefined,
      ),
    )
    .limit(1);
  return !!order;
}

/** A Pro upgrade for a profile that is ordered but not paid yet; payHref is null when someone else pays. */
export type ProPending = { via: "basket" | "eft" | "payfast"; payHref: string | null };

/**
 * Profiles whose Pro upgrade (on its own or in a bundle) is in the basket or on
 * an unpaid order. Pro editing is unlocked for them while the public card stays
 * standard; paying makes them Pro (processPaidOrder). viewerId decides who gets
 * a Pay now link: the person whose basket or order it is.
 */
export async function pendingProUpgrades(profileIds: number[], viewerId?: number): Promise<Map<number, ProPending>> {
  const out = new Map<number, ProPending>();
  if (!profileIds.length) return out;
  const rows = await db
    .select({ profileId: entitlements.assignedProfileId, ownerId: entitlements.ownerId, key: entitlements.cartItemKey })
    .from(entitlements)
    .where(and(eq(entitlements.type, "pro_upgrade"), eq(entitlements.status, "in_cart"), inArray(entitlements.assignedProfileId, profileIds)))
    .orderBy(desc(entitlements.id));
  const keys = [...new Set(rows.map((r) => r.key).filter((k): k is string => !!k))];
  if (!keys.length) return out;
  const [unpaid, baskets] = await Promise.all([
    db
      .select({ id: orders.id, status: orders.status, userId: orders.userId, key: sql<string>`${orderItems.meta}->>'cartItemKey'` })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(inArray(orders.status, ["on-hold", "pending"]), inArray(sql`${orderItems.meta}->>'cartItemKey'`, keys)))
      .orderBy(desc(orders.id)),
    db
      .select({ userId: carts.userId, key: sql<string>`l->>'key'` })
      .from(carts)
      .innerJoin(sql`jsonb_array_elements(${carts.items}) AS l`, sql`true`)
      .where(and(inArray(carts.userId, [...new Set(rows.map((r) => r.ownerId))]), inArray(sql`l->>'key'`, keys))),
  ]);
  for (const r of rows) {
    if (!r.profileId || !r.key || out.has(r.profileId)) continue;
    const mine = viewerId === undefined || viewerId === r.ownerId;
    const order = unpaid.find((o) => o.key === r.key && o.userId === r.ownerId);
    if (order) {
      out.set(r.profileId, order.status === "on-hold" ? { via: "eft", payHref: mine ? `/checkout/order-received/${order.id}/` : null } : { via: "payfast", payHref: mine ? `/checkout/pay/${order.id}/` : null });
    } else if (baskets.some((b) => b.key === r.key && b.userId === r.ownerId)) {
      out.set(r.profileId, { via: "basket", payHref: mine ? "/checkout/" : null });
    }
  }
  return out;
}

/**
 * assign_next_available_upgrade(): spend the user's oldest paid, unused Pro
 * upgrade on a standard profile. Returns true when the profile became pro.
 */
export async function applyProUpgrade(profileId: number, ownerUserId: number): Promise<boolean> {
  const done = await db.transaction(async (tx) => {
    const [p] = await tx.select({ type: profiles.type }).from(profiles).where(eq(profiles.id, profileId)).for("update").limit(1);
    if (!p || p.type === "pro" || p.type === "professional") return false;
    const [row] = await tx
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(and(eq(entitlements.ownerId, ownerUserId), eq(entitlements.type, "pro_upgrade"), eq(entitlements.status, "paid_unassigned")))
      .orderBy(asc(entitlements.id))
      .for("update", { skipLocked: true })
      .limit(1);
    if (!row) return false;
    const now = new Date();
    await tx.update(entitlements).set({ status: "consumed", assignedProfileId: profileId, consumedAt: now, updatedAt: now }).where(eq(entitlements.id, row.id));
    await tx.update(profiles).set({ type: "pro", updatedAt: now }).where(eq(profiles.id, profileId));
    return true;
  });
  if (done) await refreshProfilePages(profileId);
  return done;
}

// ── Changes ─────────────────────────────────────────────

/** Refresh the cached public pages that show this profile. */
export async function refreshProfilePages(profileId: number) {
  for (const p of await profilePaths(profileId)) revalidatePath(p);
}

/** Refresh every public page showing a profile of this company (after a branding change). */
export async function refreshCompanyPages(companyId: number) {
  const rows = await db
    .select({ profile: profiles.slug, card: cards.slug })
    .from(profiles)
    .leftJoin(cards, and(eq(cards.profileId, profiles.id), eq(cards.archived, false)))
    .where(eq(profiles.companyId, companyId));
  const paths = new Set<string>();
  for (const r of rows) {
    paths.add(`/mecard-profile/${r.profile}/`);
    if (r.card) paths.add(`/t/${r.card}/`);
  }
  for (const p of paths) revalidatePath(p);
}

async function freeSlug(table: typeof profiles | typeof companies, base: string) {
  const taken = await db
    .select({ slug: table.slug })
    .from(table)
    .where(or(eq(table.slug, base), sql`${table.slug} ~ ${`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-[0-9]+$`}`));
  return nextFreeSlug(base, taken.map((r) => r.slug));
}

export async function createProfile(
  v: Viewer,
  input: { firstName: string; lastName: string; email?: string; jobTitle?: string; companyId: number | null },
): Promise<number> {
  const slug = await freeSlug(profiles, slugify(`${input.firstName} ${input.lastName}`));
  // Profiles added for a company belong to its owner's team (the person takes
  // over by accepting an invite); a profile for yourself is your own.
  const ownForSelf = !input.companyId;
  const [row] = await db
    .insert(profiles)
    .values({
      slug,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? "",
      jobTitle: input.jobTitle ?? "",
      companyId: input.companyId,
      // Company profiles were pro on WordPress (the company branding needs it).
      type: input.companyId ? "pro" : "standard",
      ownerId: ownForSelf ? v.id : null,
      managerId: v.id,
    })
    .returning({ id: profiles.id });
  return row.id;
}

export async function createCompany(v: Viewer, name: string): Promise<number> {
  const slug = await freeSlug(companies, slugify(name, "company"));
  const [row] = await db.insert(companies).values({ name, slug, ownerId: v.id }).returning({ id: companies.id });
  return row.id;
}

export async function setProfileArchived(profileId: number, archived: boolean) {
  await db.update(profiles).set({ archived, updatedAt: new Date() }).where(eq(profiles.id, profileId));
  await refreshProfilePages(profileId);
}

/** Link a card to a profile (or unlink it with null). The card takes the profile's company. */
export async function linkCard(cardId: number, profileId: number | null) {
  const [before] = await db.select({ slug: cards.slug, profileId: cards.profileId }).from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!before) return;
  let companyId: number | null | undefined;
  if (profileId) {
    const [p] = await db.select({ companyId: profiles.companyId }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
    companyId = p?.companyId ?? undefined;
  }
  await db
    .update(cards)
    .set({ profileId, ...(companyId ? { companyId } : {}), updatedAt: new Date() })
    .where(eq(cards.id, cardId));
  revalidatePath(`/t/${before.slug}/`);
}

export async function updateCardSettings(cardId: number, input: { label: string; autoDownloadVcard: boolean }) {
  const [c] = await db
    .update(cards)
    .set({ label: input.label, autoDownloadVcard: input.autoDownloadVcard, updatedAt: new Date() })
    .where(eq(cards.id, cardId))
    .returning({ slug: cards.slug });
  if (c) revalidatePath(`/t/${c.slug}/`);
}

/** A card found from its printed /t/<slug>/ URL, for the "Activate this card" flow. */
export async function cardForActivation(slug: string) {
  const [c] = await db
    .select({ id: cards.id, slug: cards.slug, type: cards.type, label: cards.label, profileId: cards.profileId, archived: cards.archived, ownerId: cards.ownerId, frontPath: cards.frontPath, ownerEmail: users.email })
    .from(cards)
    .leftJoin(users, eq(users.id, cards.ownerId))
    .where(eq(cards.slug, slug))
    .limit(1);
  return c ?? null;
}

/** "j***@example.com": enough for someone to recognise their other account. */
export function maskEmail(email: string | null): string {
  if (!email) return "another account";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}***@${domain ?? ""}`;
}

export async function profilesByIds(ids: number[]) {
  if (!ids.length) return [];
  return db.select({ id: profiles.id, slug: profiles.slug }).from(profiles).where(inArray(profiles.id, ids));
}
