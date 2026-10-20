"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { canEditProfile, canManageCard, canManageCompany, viewer } from "@/lib/access";
import { acceptInvite } from "@/lib/invites";
import { createCompany, createProfile, linkCard, setProfileArchived, updateCardSettings } from "@/lib/manage";
import { requireUserId } from "@/lib/session";

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

async function me() {
  return viewer(await requireUserId("/manage/"));
}

export async function linkCardAction(form: FormData) {
  const v = await me();
  const cardId = id(form.get("card_id"));
  const profileId = id(form.get("profile_id"));
  if (!(await canManageCard(v, cardId)) || !(await canEditProfile(v, profileId))) back(form, "denied");
  await linkCard(cardId, profileId);
  back(form, "card-linked");
}

export async function unlinkCardAction(form: FormData) {
  const v = await me();
  const cardId = id(form.get("card_id"));
  if (!(await canManageCard(v, cardId))) back(form, "denied");
  await linkCard(cardId, null);
  back(form, "card-unlinked");
}

export async function cardSettingsAction(form: FormData) {
  const v = await me();
  const cardId = id(form.get("card_id"));
  if (!(await canManageCard(v, cardId))) back(form, "denied");
  await updateCardSettings(cardId, { label: String(form.get("label") ?? "").trim().slice(0, 255), autoDownloadVcard: form.get("auto_download") === "1" });
  back(form, "card-saved");
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
  back(form, res.ok ? "invite-accepted" : "invite-failed");
}
