"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { companies, events, products, profileLinks, profiles } from "@/db/schema";
import { canEditProfile, canManageCompany, viewer } from "@/lib/access";
import { cleanCompanyInput, saveCompany } from "@/lib/company-edit";
import { cancelInvite, createInvite } from "@/lib/invites";
import { addToCart } from "@/lib/cart";
import { PRODUCT } from "@/lib/catalog";
import { applyProUpgrade, pendingProUpgrades, refreshProfilePages } from "@/lib/manage";
import { cleanEmail, cleanText, cleanUrl } from "@/lib/form-values";
import { canUseImage } from "@/lib/media-library";
import { cleanProfileInput, createCompanyForProfile, saveProfile } from "@/lib/profile-edit";
import { requireUserId } from "@/lib/session";
import { sanitizeKey } from "@/lib/tracking";

// Saves from the profile and company editors.

/** Where to go after an action from the single view's wizard (a /manage/ path), or the default. */
function nextPath(form: FormData, fallback: string, done: string) {
  const next = String(form.get("next") ?? "");
  const path = next.startsWith("/manage/") && !next.includes("//") ? next : fallback;
  return `${path}${path.includes("?") ? "&" : "?"}done=${done}`;
}

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
  redirect(nextPath(form, `/manage/profile/${profileId}/`, applied ? "upgrade-applied" : "upgrade-none"));
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
  // Forms without a browser-side click event (the editors) name their placement here (conversion plan 0.5).
  const placement = sanitizeKey(form.get("placement"), 40);
  if (placement) {
    await db.insert(events).values({ name: "pro_upsell_clicked", userId: v.id, profileId, source: "editor", meta: { context: placement, placement, trigger: "page_load" } });
  }
  if (!(await pendingProUpgrades([profileId])).has(profileId)) {
    const [product] = await db.select({ active: products.active }).from(products).where(eq(products.id, PRODUCT.proUpgrade)).limit(1);
    if (!product?.active) redirect(`/manage/profile/${profileId}/?done=upgrade-unavailable`);
    await addToCart(v.id, PRODUCT.proUpgrade, 1, profileId);
    // Its company details now wait for payment too (getPublicProfileView).
    await refreshProfilePages(profileId);
  }
  redirect(nextPath(form, `/manage/profile/${profileId}/`, "pro-pending"));
}

export async function setupCompanyAction(form: FormData) {
  const v = await viewer(await requireUserId());
  const profileId = Number(form.get("profile_id"));
  if (!(await canEditProfile(v, profileId))) redirect("/manage/?done=denied");
  const companyId = await createCompanyForProfile(profileId, v.id);
  redirect(nextPath(form, `/manage/company/${companyId}/`, "company-created"));
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

/** Back to the Profiles list (the page the form was on), with a ?done= message, at the profile's row. */
function listBack(form: FormData, done: string, profileId: number): never {
  const raw = String(form.get("back") ?? "/manage/");
  const url = new URL(raw.startsWith("/manage/") ? raw : "/manage/", "http://x");
  url.searchParams.set("done", done);
  redirect(`${url.pathname}${url.search}#p${profileId}`);
}

/** "Invite others to edit" (WordPress's CRED invite form) from a profile's menu on the Profiles list. */
export async function inviteAction(form: FormData) {
  const v = await viewer(await requireUserId());
  const profileId = Number(form.get("profile_id"));
  if (!(await canEditProfile(v, profileId))) listBack(form, "denied", profileId);
  const email = cleanEmail(form.get("email"));
  if (!email) listBack(form, "invite-invalid", profileId);
  await createInvite(profileId, email, v.id);
  listBack(form, "invite-sent", profileId);
}

export async function cancelInviteAction(form: FormData) {
  const v = await viewer(await requireUserId());
  const profileId = Number(form.get("profile_id"));
  if (!(await canEditProfile(v, profileId))) listBack(form, "denied", profileId);
  await cancelInvite(Number(form.get("invite_id")), profileId);
  listBack(form, "invite-cancelled", profileId);
}

/** "Add a website link" (WordPress's add-more-link form): one more button on the profile, after its others. */
export async function addProfileLinkAction(form: FormData) {
  const v = await viewer(await requireUserId());
  const profileId = Number(form.get("profile_id"));
  if (!(await canEditProfile(v, profileId))) listBack(form, "denied", profileId);
  const label = cleanText(form.get("label"), 255);
  const url = cleanUrl(form.get("url"));
  if (!label || !url) listBack(form, "link-invalid", profileId);
  const [last] = await db
    .select({ n: sql<number>`coalesce(max(${profileLinks.sortOrder}), 0)::int` })
    .from(profileLinks)
    .where(eq(profileLinks.profileId, profileId));
  await db.insert(profileLinks).values({ profileId, label, url, sortOrder: (last?.n ?? 0) + 1 });
  await refreshProfilePages(profileId);
  listBack(form, "link-added", profileId);
}
