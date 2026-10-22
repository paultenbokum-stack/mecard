"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { cards, companies, profiles, users } from "@/db/schema";
import { companyDeleteGuard } from "@/lib/admin-guards";
import { logAdmin } from "@/lib/admin-log";
import { createCompany, refreshCompanyPages } from "@/lib/manage";
import { requireAdmin } from "@/lib/session";

// Staff management of companies. Branding, links and custom CSS are edited in
// the company editor (/manage/company/<id>/), which staff can open too.

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function back(path: string, outcome: { saved?: string; error?: string }): never {
  redirect(`${path}?${new URLSearchParams(outcome as Record<string, string>)}`);
}

async function userByEmail(email: string) {
  const [u] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
  return u ?? null;
}

export async function createCompanyAction(form: FormData) {
  const me = await requireAdmin();
  const name = str(form, "name").slice(0, 255);
  if (!name) back("/admin/companies/", { error: "Please enter the company name." });
  const owner = await userByEmail(str(form, "owner"));
  if (!owner) back("/admin/companies/", { error: "No account with that email: create the account first (Users)." });
  const id = await createCompany({ id: owner.id, isAdmin: false }, name);
  await logAdmin(me, "company", id, "created", `${name}, owner ${owner.email}`);
  back(`/admin/companies/${id}/`, { saved: "Company created. Its branding is set in the company editor." });
}

export async function saveCompanyAdminAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("company_id"));
  const path = `/admin/companies/${id}/`;
  const [c] = await db.select().from(companies).where(eq(companies.id, id));
  if (!c) back("/admin/companies/", { error: "Company not found." });
  const name = str(form, "name").slice(0, 255);
  if (!name) back(path, { error: "The company needs a name." });
  const ownerEmail = str(form, "owner");
  const owner = ownerEmail ? await userByEmail(ownerEmail) : null;
  if (ownerEmail && !owner) back(path, { error: `No account for ${ownerEmail}.` });
  const changes: string[] = [];
  if (name !== c.name) changes.push(`name ${c.name} → ${name}`);
  if ((owner?.id ?? null) !== c.ownerId) changes.push(`owner → ${owner?.email ?? "none"}`);
  if (!changes.length) back(path, { saved: "Nothing changed." });
  await db.update(companies).set({ name, ownerId: owner?.id ?? null, updatedAt: new Date() }).where(eq(companies.id, id));
  await refreshCompanyPages(id);
  await logAdmin(me, "company", id, "edited", changes.join(", "));
  back(path, { saved: "Company saved." });
}

export async function companyDeleteCounts(id: number) {
  const [[p], [k]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(profiles)
      .where(and(eq(profiles.companyId, id), eq(profiles.archived, false))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(cards)
      .where(and(eq(cards.companyId, id), eq(cards.archived, false))),
  ]);
  return { profiles: p.n, cards: k.n };
}

export async function deleteCompanyAction(form: FormData) {
  const me = await requireAdmin();
  const id = Number(form.get("company_id"));
  const path = `/admin/companies/${id}/`;
  const [c] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, id));
  if (!c) back("/admin/companies/", { error: "Company not found." });
  if (str(form, "confirm") !== c.name) back(path, { error: "Type the company name exactly to delete it." });
  const g = companyDeleteGuard(await companyDeleteCounts(id));
  if (!g.ok) back(path, { error: g.blockers.join(" ") });
  // Archived profiles and tags keep pointing nowhere (company_id is set to null by the foreign keys).
  await db.delete(companies).where(eq(companies.id, id));
  await logAdmin(me, "company", id, "deleted", c.name);
  back("/admin/companies/", { saved: `Deleted ${c.name}.` });
}
