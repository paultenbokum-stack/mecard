"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { companies, products, profiles } from "@/db/schema";
import { canEditProfile, canManageCompany, viewer } from "@/lib/access";
import { cleanCompanyInput, saveCompany } from "@/lib/company-edit";
import { cancelInvite, createInvite } from "@/lib/invites";
import { addToCart } from "@/lib/cart";
import { PRODUCT } from "@/lib/catalog";
import { applyProUpgrade, pendingProUpgrades } from "@/lib/manage";
import { cleanEmail } from "@/lib/form-values";
import { canUseImage } from "@/lib/media-library";
import { cleanProfileInput, createCompanyForProfile, saveProfile } from "@/lib/profile-edit";
import { requireUserId } from "@/lib/session";

// Saves from the profile and company editors.

export type SaveResult = { ok: true; becamePro?: boolean } | { ok: false; error: string };

export async function saveProfileAction(profileId: number, raw: Record<string, unknown>): Promise<SaveResult> {
  const v = await viewer(await requireUserId());
  if (!(await canEditProfile(v, profileId))) return { ok: false, error: "You don't have permission to edit this profile." };
  const input = cleanProfileInput(raw ?? {});
  if (!input.firstName && !input.lastName) return { ok: false, error: "Enter a name for the profile." };
  const [now] = await db.select({ photo: profiles.photoPath }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!(await canUseImage(v, input.photoPath, now?.photo, "photo"))) return { ok: false, error: "You can only use images from your own library. Choose the image again from My images." };
  const { becamePro } = await saveProfile(profileId, input);
  return { ok: true, becamePro };
}

export async function applyUpgradeAction(form: FormData) {
  const v = await viewer(await requireUserId());
  const profileId = Number(form.get("profile_id"));
  if (!(await canEditProfile(v, profileId))) redirect("/manage/?done=denied");
  const [p] = await db.select({ ownerId: profiles.ownerId, managerId: profiles.managerId }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
  // Whoever paid: the editor themselves first, then the profile's owner or manager.
  let applied = false;
  for (const payer of new Set([v.id, p?.ownerId, p?.managerId].filter((x): x is number => !!x))) {
    if ((applied = await applyProUpgrade(profileId, payer))) break;
  }
  redirect(`/manage/profile/${profileId}/?done=${applied ? "upgrade-applied" : "upgrade-none"}`);
}

/**
 * Upgrade to Pro without paying first: the upgrade goes in the basket for this
 * profile and the editor opens in Pro straight away. The public card stays
 * standard until the order is paid (PayFast, or EFT marked paid by staff).
 */
export async function startProUpgradeAction(form: FormData) {
  const v = await viewer(await requireUserId());
  const profileId = Number(form.get("profile_id"));
  if (!(await canEditProfile(v, profileId))) redirect("/manage/?done=denied");
  const [p] = await db.select({ type: profiles.type }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (p && p.type !== "standard") redirect(`/manage/profile/${profileId}/?done=already-pro`);
  if (!(await pendingProUpgrades([profileId])).has(profileId)) {
    const [product] = await db.select({ active: products.active }).from(products).where(eq(products.id, PRODUCT.proUpgrade)).limit(1);
    if (!product?.active) redirect(`/manage/profile/${profileId}/?done=upgrade-unavailable`);
    await addToCart(v.id, PRODUCT.proUpgrade, 1, profileId);
  }
  redirect(`/manage/profile/${profileId}/?done=pro-pending`);
}

export async function setupCompanyAction(form: FormData) {
  const v = await viewer(await requireUserId());
  const profileId = Number(form.get("profile_id"));
  if (!(await canEditProfile(v, profileId))) redirect("/manage/?done=denied");
  const companyId = await createCompanyForProfile(profileId, v.id);
  redirect(`/manage/company/${companyId}/?done=company-created`);
}

export async function saveCompanyAction(companyId: number, raw: Record<string, unknown>): Promise<SaveResult> {
  const v = await viewer(await requireUserId());
  if (!(await canManageCompany(v, companyId))) return { ok: false, error: "You don't have permission to edit this company." };
  const input = cleanCompanyInput(raw ?? {});
  if (!input.name) return { ok: false, error: "Enter the company name." };
  const [now] = await db.select({ logo: companies.logoPath }).from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!(await canUseImage(v, input.logoPath, now?.logo, "logo"))) return { ok: false, error: "You can only use images from your own library. Choose the image again from My images." };
  await saveCompany(companyId, input);
  return { ok: true };
}

export async function inviteAction(form: FormData) {
  const v = await viewer(await requireUserId());
  const profileId = Number(form.get("profile_id"));
  const companyId = Number(form.get("company_id"));
  const back = `/manage/company/${companyId}/?tab=team`;
  if (!(await canEditProfile(v, profileId)) || !(await canManageCompany(v, companyId))) redirect(`${back}&done=denied`);
  const email = cleanEmail(form.get("email"));
  if (!email) redirect(`${back}&done=invite-invalid#p${profileId}`);
  await createInvite(profileId, email, v.id);
  redirect(`${back}&done=invite-sent#p${profileId}`);
}

export async function cancelInviteAction(form: FormData) {
  const v = await viewer(await requireUserId());
  const profileId = Number(form.get("profile_id"));
  const companyId = Number(form.get("company_id"));
  const back = `/manage/company/${companyId}/?tab=team`;
  if (!(await canEditProfile(v, profileId))) redirect(`${back}&done=denied`);
  await cancelInvite(Number(form.get("invite_id")), profileId);
  redirect(`${back}&done=invite-cancelled#p${profileId}`);
}
