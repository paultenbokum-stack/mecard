import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { cards, companies, entitlements, orderItems, orders, profileInvites, profiles, users } from "@/db/schema";
import { editableProfilesWhere, manageableCardsWhere, type Viewer } from "./access";
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
  type: profiles.type,
  archived: profiles.archived,
  photoPath: profiles.photoPath,
  companyId: profiles.companyId,
  companyName: sql<string>`coalesce(${companies.name}, ${profiles.companyName})`,
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

/** Live cards (linked to a profile) or new ones (not linked yet). */
export async function listCards(v: Viewer, opts: { linked: boolean; q?: string; page?: number }) {
  const conds: SQL[] = [manageableCardsWhere(v.id), eq(cards.archived, false), opts.linked ? sql`${cards.profileId} IS NOT NULL` : isNull(cards.profileId)];
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
        frontPath: cards.frontPath,
        autoDownloadVcard: cards.autoDownloadVcard,
        orderId: cards.orderId,
        printed: cards.printed,
        shipped: cards.shipped,
        designSubmitted: cards.designSubmitted,
        profileId: cards.profileId,
        profileName: sql<string | null>`nullif(trim(${profiles.firstName} || ' ' || ${profiles.lastName}), '')`,
        companyName: companies.name,
      })
      .from(cards)
      .leftJoin(profiles, eq(profiles.id, cards.profileId))
      .leftJoin(companies, eq(companies.id, cards.companyId))
      .where(where)
      .orderBy(desc(cards.createdAt), desc(cards.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(cards).leftJoin(profiles, eq(profiles.id, cards.profileId)).where(where),
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
export async function hasPendingUpgrade(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(and(eq(entitlements.ownerId, userId), eq(entitlements.type, "pro_upgrade"), inArray(entitlements.status, ["in_cart", "paid_unassigned", "paid_assigned"])))
    .limit(1);
  if (row) return true;
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.userId, userId), inArray(orders.status, ["on-hold", "pending"]), inArray(orderItems.productId, UPGRADE_PRODUCT_IDS)))
    .limit(1);
  return !!order;
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
