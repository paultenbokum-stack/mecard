"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { canEditProfile, canManageCompany, viewer } from "@/lib/access";
import { addToCart, getCart, setLineQty } from "@/lib/cart";
import { cleanCompanyInput, saveCompany } from "@/lib/company-edit";
import { createCompany } from "@/lib/manage";
import { setAccountMode } from "@/lib/manage-view";
import { requireUserId } from "@/lib/session";
import { addTeamList, archiveLeaver, readCompanySite, type SiteReadResult } from "@/lib/team";
import { clampPeople, teamPackage } from "@/lib/team-packages";
import { parseTeamList } from "@/lib/team-people-rules";

// The team flow's forms. Each checks the user's rights again.

const me = async () => viewer(await requireUserId("/team/setup/"));

export async function readSiteAction(url: string): Promise<SiteReadResult> {
  const v = await me();
  return readCompanySite(v.id, String(url ?? ""));
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type SetupInput = { name: string; website: string; phone: string; address: string; about: string; colour: string; logoPath: string | null; socials: { label: string; url: string; icon: string }[]; fromSite: boolean };

/** Step 2: save the company, whether it came from the website or was typed in. */
export async function saveTeamCompanyAction(input: SetupInput): Promise<{ error: string } | never> {
  const v = await me();
  const name = String(input.name ?? "").trim().slice(0, 255);
  if (!name) return { error: "Enter your company name." };
  const id = await createCompany(v, name);
  const about = String(input.about ?? "").trim().slice(0, 1000);
  await saveCompany(
    id,
    cleanCompanyInput({
      name,
      website: input.website,
      phone: input.phone,
      address: input.address,
      logoPath: input.logoPath,
      accentColour: input.colour,
      downloadColour: input.colour,
      headingColour: input.colour,
      descriptionHtml: about ? `<p>${escapeHtml(about)}</p>` : "",
      links: input.socials,
    }),
  );
  await setAccountMode(v.id, "teams");
  await db.insert(events).values({ name: "team_company_created", userId: v.id, companyId: id, source: "team", meta: { has_logo: !!input.logoPath, from_site: !!input.fromSite } });
  revalidatePath("/manage", "layout");
  redirect("/team/order/");
}

/** Step 3: one order for the whole team. Setting the same choice again changes the basket rather than doubling it. */
export async function placeTeamOrderAction(form: FormData) {
  const v = await me();
  const people = clampPeople(form.get("people"));
  const pkg = teamPackage(form.get("option"));
  const wantsQuote = form.get("intent") === "quote";
  const cart = await getCart(v.id);
  for (const productId of pkg.products) {
    const line = cart.items.find((l) => l.productId === productId && !l.profileId);
    if (line) await setLineQty(v.id, line.key, people);
    else await addToCart(v.id, productId, people);
  }
  await db.insert(events).values({ name: "team_package_chosen", userId: v.id, source: "team", meta: { people, option: pkg.id, quote: wantsQuote } });
  redirect(wantsQuote ? "/request-quote/" : "/checkout/");
}

/** After paying: a pasted list, in the order it was given. */
export async function addTeamListAction(form: FormData) {
  const v = await me();
  const companyId = Number(form.get("company_id"));
  if (!(await canManageCompany(v, companyId))) redirect("/manage/?done=denied");
  const people = parseTeamList(String(form.get("list") ?? ""));
  if (!people.length) redirect(`/team/people/?company=${companyId}&error=empty`);
  await addTeamList(v.id, companyId, people, form.get("invite") === "1", v.id);
  revalidatePath("/manage", "layout");
  redirect(`/team/people/?company=${companyId}&added=${people.length}`);
}

/** "Has left": archive the profile, and deactivate or reassign their card. */
export async function leaverAction(form: FormData) {
  const v = await me();
  const profileId = Number(form.get("profile_id"));
  if (!(await canEditProfile(v, profileId))) redirect("/manage/?done=denied");
  const text = (name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);
  let done = "profile-left";
  if (form.get("card_choice") === "reassign") {
    const to = form.get("reassign_to");
    if (to && to !== "new") {
      const toProfileId = Number(to);
      if (toProfileId === profileId || !(await canEditProfile(v, toProfileId))) redirect("/manage/?done=denied");
      await archiveLeaver(v.id, profileId, { kind: "reassign", toProfileId });
    } else {
      const firstName = text("first_name", 100);
      if (!firstName) redirect(`/team/left/${profileId}/?error=name`);
      await archiveLeaver(v.id, profileId, { kind: "reassign", person: { firstName, lastName: text("last_name", 100), jobTitle: text("job_title", 200) } });
    }
    done = "card-reassigned";
  } else {
    await archiveLeaver(v.id, profileId, { kind: "deactivate" });
  }
  revalidatePath("/manage", "layout");
  redirect(`/manage/?done=${done}`);
}
