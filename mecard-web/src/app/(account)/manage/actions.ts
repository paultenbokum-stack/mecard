"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canEditProfile, canManageCard, canManageCompany, viewer } from "@/lib/access";
import { acceptInvite } from "@/lib/invites";
import { cardsListHref, isCardTab } from "@/lib/card-tabs";
import { cardTabOf, createCompany, createProfile, linkCard, setProfileArchived, updateCardSettings } from "@/lib/manage";
import { getCart, removeLine } from "@/lib/cart";
import { isBundle } from "@/lib/catalog";
import { manageViewFor, setAccountMode } from "@/lib/manage-view";
import { requireUserId } from "@/lib/session";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { teamWelcomeCookie } from "@/lib/upsell-rules";

// Form actions on /manage/. Each checks the user's rights again (the page
// only shows what they may do) and comes back to /manage/ with a message.

const id = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/** Back to where the form was (a /manage/ URL), with a ?done= message. */
function back(form: FormData, done: string): never {
  const raw = String(form.get("back") ?? "/manage/");
  const url = new URL(raw.startsWith("/manage/") ? raw : "/manage/", "http://x");
  url.searchParams.delete("activate");
  url.searchParams.set("done", done);
  redirect(url.pathname + url.search + (form.get("anchor") ? `#${form.get("anchor")}` : ""));
}

/** Back to My Cards on the tab the card is on now: the one it was opened from (from_tab), or its new one with a "Moved to" notice. */
async function cardBack(form: FormData, cardId: number, done: string): Promise<never> {
  const from = form.get("from_tab");
  redirect(cardsListHref(isCardTab(from) ? from : null, await cardTabOf(cardId), { done }));
}

async function me() {
  return viewer(await requireUserId("/manage/"));
}

export async function linkCardAction(form: FormData) {
  const v = await me();
  const cardId = id(form.get("card_id"));
  const profileId = id(form.get("profile_id"));
  if (!(await canManageCard(v, cardId)) || !(await canEditProfile(v, profileId))) back(form, "denied");
  await linkCard(cardId, profileId);
  await cardBack(form, cardId, "card-linked");
}

export async function unlinkCardAction(form: FormData) {
  const v = await me();
  const cardId = id(form.get("card_id"));
  if (!(await canManageCard(v, cardId))) back(form, "denied");
  await linkCard(cardId, null);
  await cardBack(form, cardId, "card-unlinked");
}

export async function cardSettingsAction(form: FormData) {
  const v = await me();
  const cardId = id(form.get("card_id"));
  if (!(await canManageCard(v, cardId))) back(form, "denied");
  await updateCardSettings(cardId, { label: String(form.get("label") ?? "").trim().slice(0, 255), autoDownloadVcard: form.get("auto_download") === "1" });
  await cardBack(form, cardId, "card-saved");
}

export async function archiveProfileAction(form: FormData) {
  const v = await me();
  const profileId = id(form.get("profile_id"));
  if (!(await canEditProfile(v, profileId))) back(form, "denied");
  const archive = form.get("archive") === "1";
  await setProfileArchived(profileId, archive);
  back(form, archive ? "profile-archived" : "profile-restored");
}

const newProfile = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100),
  email: z.union([z.literal(""), z.email().max(255)]),
  jobTitle: z.string().trim().max(200),
});

export async function addProfileAction(form: FormData) {
  const v = await me();
  const parsed = newProfile.safeParse({
    firstName: form.get("first_name") ?? "",
    lastName: form.get("last_name") ?? "",
    email: String(form.get("email") ?? "").trim(),
    jobTitle: form.get("job_title") ?? "",
  });
  if (!parsed.success) back(form, "profile-invalid");
  const companyId = id(form.get("company_id")) || null;
  if (companyId && !(await canManageCompany(v, companyId))) back(form, "denied");
  const profileId = await createProfile(v, { ...parsed.data, companyId });
  // A second profile turns the single view into the team view: the list behind the editor and the subnav re-render.
  revalidatePath("/manage", "layout");
  redirect(`/manage/profile/${profileId}/?done=profile-created`);
}

export async function addCompanyAction(form: FormData) {
  const v = await me();
  const name = String(form.get("name") ?? "").trim().slice(0, 255);
  if (!name) back(form, "company-invalid");
  const companyId = await createCompany(v, name);
  redirect(`/manage/company/${companyId}/?done=company-created`);
}

export async function acceptInviteAction(form: FormData) {
  const v = await me();
  const res = await acceptInvite(id(form.get("invite_id")), v.id, { requireEmailMatch: true });
  if (res.ok) revalidatePath("/manage", "layout");
  back(form, res.ok ? "invite-accepted" : "invite-failed");
}

/** "Remove bundle" on the bundle journey: the bundle line (and the cards and entitlements it made) leave the basket. */
export async function removeBundleAction(form: FormData) {
  const userId = (await me()).id;
  const key = String(form.get("key") ?? "");
  const line = (await getCart(userId)).items.find((l) => l.key === key && isBundle(l.productId));
  if (line) await removeLine(userId, key);
  redirect("/manage/?done=bundle-removed");
}

/** Switch to teams: the team dashboard (Profiles, My Cards, Companies) with the welcome strip. */
export async function switchToTeamsAction() {
  const userId = await requireUserId("/manage/");
  await setAccountMode(userId, "teams");
  (await cookies()).set(teamWelcomeCookie(userId), "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirect("/manage/");
}

/** Back to individual view: only offered while the account has one profile and no company others use (canGoIndividual). */
export async function backToIndividualAction() {
  const userId = await requireUserId("/manage/");
  if (!(await manageViewFor(userId)).canGoIndividual) redirect("/manage/");
  await setAccountMode(userId, "individual");
  (await cookies()).delete(teamWelcomeCookie(userId));
  revalidatePath("/", "layout");
  redirect("/manage/");
}

/** "Add myself" on an empty Profiles tab: a profile of their own, from the account's name, email and phone. */
export async function addMyselfAction() {
  const v = await me();
  const [u] = await db.select().from(users).where(eq(users.id, v.id)).limit(1);
  const [first, ...rest] = (u?.displayName || "").split(" ");
  const profileId = await createProfile(v, {
    firstName: u?.firstName || first || "My",
    lastName: u?.lastName || rest.join(" "),
    email: u?.email ?? "",
    companyId: null,
  });
  if (u?.phone) await db.update(profiles).set({ mobile: u.phone }).where(eq(profiles.id, profileId));
  revalidatePath("/manage", "layout");
  redirect(`/manage/profile/${profileId}/?done=profile-created`);
}
