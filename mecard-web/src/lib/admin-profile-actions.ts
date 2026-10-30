"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { cards, companies, profiles, profileSlugHistory, users } from "@/db/schema";
import { profileArchiveGuard } from "@/lib/admin-guards";
import { logAdmin } from "@/lib/admin-log";
import { createProfile, refreshProfilePages, setProfileArchived } from "@/lib/manage";
import { checkProfileSlug } from "@/lib/profile-slug-rules";
import { requireAdmin } from "@/lib/session";

// Staff management of profiles. The profile's own details (name, contact
// details, photo, links) are edited in the profile editor (/manage/profile/<id>/),
// which staff can open too; here: who it belongs to, its company, its type.

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function back(path: string, outcome: { saved?: string; error?: string }): never {
  redirect(`${path}?${new URLSearchParams(outcome as Record<string, string>)}`);
}

async function userByEmail(email: string) {
  if (!email) return null;
  const [u] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
  return u ?? null;
}

async function companyByRef(ref: string) {
  const r = ref.trim().replace(/^#/, "");
  if (!r) return null;
  const [c] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(/^\d+$/.test(r) ? eq(companies.id, Number(r)) : eq(companies.slug, r.toLowerCase()));
  return c ?? null;
}

export async function createProfileAction(form: FormData) {
  const me = await requireAdmin();
  const first = str(form, "first_name").slice(0, 100);
  const last = str(form, "last_name").slice(0, 100);
  if (!first && !last) back("/admin/profiles/", { error: "Please enter a name." });
  const owner = await userByEmail(str(form, "owner"));
  if (!owner) back("/admin/profiles/", { error: "No account with that email: create the account first (Users)." });
  const companyRef = str(form, "company");
  const company = companyRef ? await companyByRef(companyRef) : null;
  if (companyRef && !company) back("/admin/profiles/", { error: "No company with that number or address." });
  const id = await createProfile({ id: owner.id, isAdmin: false }, { firstName: first, lastName: last, email: str(form, "email").slice(0, 255), companyId: company?.id ?? null });
  // createProfile leaves a company profile with the company's team; staff create it for the person named.
  await db.update(profiles).set({ ownerId: owner.id, managerId: owner.id }).where(eq(profiles.id, id));
  await logAdmin(me, "profile", id, "created", `${first} ${last}`.trim() + `, owner ${owner.email}${company ? `, company ${company.name}` : ""}`);
  back(`/admin/profiles/${id}/`, { saved: "Profile created. Fill it in with the profile editor." });
}

export async function saveProfileAdminAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("profile_id"));
  const path = `/admin/profiles/${id}/`;
  const [p] = await db.select().from(profiles).where(eq(profiles.id, id));
  if (!p) back("/admin/profiles/", { error: "Profile not found." });
  const ownerEmail = str(form, "owner");
  const managerEmail = str(form, "manager");
  const owner = await userByEmail(ownerEmail);
  const manager = await userByEmail(managerEmail);
  if (ownerEmail && !owner) back(path, { error: `No account for ${ownerEmail}.` });
  if (managerEmail && !manager) back(path, { error: `No account for ${managerEmail}.` });
  const companyRef = str(form, "company");
  const company = companyRef ? await companyByRef(companyRef) : null;
  if (companyRef && !company) back(path, { error: "No company with that number or address." });
  const type = str(form, "type") === "pro" ? "pro" : "standard";

  const values = { ownerId: owner?.id ?? null, managerId: manager?.id ?? null, companyId: company?.id ?? null, type };
  const changes: string[] = [];
  if (values.ownerId !== p.ownerId) changes.push(`owner → ${owner?.email ?? "none"}`);
  if (values.managerId !== p.managerId) changes.push(`manager → ${manager?.email ?? "none"}`);
  if (values.companyId !== p.companyId) changes.push(`company → ${company?.name ?? "none"}`);
  if (type !== p.type) changes.push(`type ${p.type} → ${type}`);
  if (!changes.length) back(path, { saved: "Nothing changed." });
  await db.update(profiles).set({ ...values, updatedAt: new Date() }).where(eq(profiles.id, id));
  // The profile's tags follow it into (or out of) a company.
  if (values.companyId !== p.companyId) await db.update(cards).set({ companyId: values.companyId, updatedAt: new Date() }).where(and(eq(cards.profileId, id), eq(cards.archived, false)));
  await refreshProfilePages(id);
  await logAdmin(me, "profile", id, "edited", changes.join(", "));
  back(path, { saved: "Profile saved." });
}

// The profile's address, /mecard-profile/<slug>/. The old one goes into
// profile_slug_history and redirects to the new one. Tag URLs (/t/<slug>/)
// point at the profile by id and don't change.
export async function changeProfileSlugAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("profile_id"));
  const path = `/admin/profiles/${id}/`;
  const [p] = await db.select({ slug: profiles.slug }).from(profiles).where(eq(profiles.id, id));
  if (!p) back("/admin/profiles/", { error: "Profile not found." });
  const check = checkProfileSlug(str(form, "slug"));
  if (!check.ok) back(path, { error: check.error });
  const slug = check.slug;
  if (slug === p.slug) back(path, { saved: "Nothing changed." });

  const [inUse] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.slug, slug));
  if (inUse) back(path, { error: `/mecard-profile/${slug}/ is already profile #${inUse.id}'s address.` });
  const [former] = await db.select({ id: profileSlugHistory.profileId }).from(profileSlugHistory).where(eq(profileSlugHistory.oldSlug, slug));
  if (former && former.id !== id) back(path, { error: `/mecard-profile/${slug}/ was profile #${former.id}'s address and still redirects there.` });

  try {
    await db.transaction(async (tx) => {
      // Taking back one of its own earlier addresses: that one stops redirecting.
      await tx.delete(profileSlugHistory).where(eq(profileSlugHistory.oldSlug, slug));
      await tx.insert(profileSlugHistory).values({ oldSlug: p.slug, profileId: id }).onConflictDoUpdate({ target: profileSlugHistory.oldSlug, set: { profileId: id } });
      await tx.update(profiles).set({ slug, updatedAt: new Date() }).where(eq(profiles.id, id));
    });
  } catch {
    back(path, { error: `/mecard-profile/${slug}/ was taken just now. Try another.` });
  }
  revalidatePath(`/mecard-profile/${p.slug}/`);
  await refreshProfilePages(id);
  await logAdmin(me, "profile", id, "address changed", `/mecard-profile/${p.slug}/ → /mecard-profile/${slug}/ (old address redirects)`);
  back(path, { saved: `Address changed. /mecard-profile/${p.slug}/ now redirects to /mecard-profile/${slug}/.` });
}

export async function profileArchiveCounts(id: number) {
  const [k] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(cards)
    .where(and(eq(cards.profileId, id), eq(cards.archived, false)));
  return { cards: k.n };
}

export async function archiveProfileAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("profile_id"));
  const path = `/admin/profiles/${id}/`;
  const [p] = await db.select({ slug: profiles.slug }).from(profiles).where(eq(profiles.id, id));
  if (!p) back("/admin/profiles/", { error: "Profile not found." });
  if (str(form, "confirm") !== p.slug) back(path, { error: `Type the profile's address (${p.slug}) exactly to archive it.` });
  const g = profileArchiveGuard(await profileArchiveCounts(id));
  if (!g.ok) back(path, { error: g.blockers.join(" ") });
  await setProfileArchived(id, true);
  await logAdmin(me, "profile", id, "archived", p.slug);
  back(path, { saved: "Profile archived: its page now shows not found." });
}

export async function restoreProfileAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("profile_id"));
  await setProfileArchived(id, false);
  await logAdmin(me, "profile", id, "restored");
  back(`/admin/profiles/${id}/`, { saved: "Profile restored." });
}
