"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, events } from "@/db/schema";
import { canEditProfile, canManageCompany, viewer } from "@/lib/access";
import { addToCart, getCart, setLineQty } from "@/lib/cart";
import { cleanCompanyInput, saveCompany } from "@/lib/company-edit";
import { createCompany } from "@/lib/manage";
import { setAccountMode } from "@/lib/manage-view";
import { requireUserId } from "@/lib/session";
import { addTeamList, addTeamPerson, noteIfComplete, readCompanySite, replaceLeaver, teamPlaces, type SiteReadResult } from "@/lib/team";
import { clampPeople, teamPackage } from "@/lib/team-packages";
import { parseTeamList, verifyJoinToken } from "@/lib/team-people-rules";

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

const joinForm = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  jobTitle: z.string().trim().max(200),
  mobile: z.string().trim().max(50),
  email: z.union([z.literal(""), z.email().max(255)]),
});

export type JoinState = { error?: string; slug?: string };

/** A staff member adds themselves from the team's link. Limited to the places the team has paid for. */
export async function joinTeamAction(_: JoinState, form: FormData): Promise<JoinState> {
  const companyId = Number(form.get("company_id"));
  if (!Number.isInteger(companyId) || !verifyJoinToken(companyId, String(form.get("token") ?? ""))) return { error: "This link isn't valid. Ask your manager for a new one." };
  // Bots fill the hidden field or post straight away.
  const started = Number(form.get("started"));
  if (String(form.get("website") ?? "") !== "" || !started || Date.now() - started < 2000) return { error: "Please try again." };
  const parsed = joinForm.safeParse({ firstName: form.get("first_name") ?? "", lastName: form.get("last_name") ?? "", jobTitle: form.get("job_title") ?? "", mobile: form.get("mobile") ?? "", email: String(form.get("email") ?? "").trim() });
  if (!parsed.success) return { error: "Enter your first name, last name and a valid email address, if you add one." };
  const [company] = await db.select({ ownerId: companies.ownerId }).from(companies).where(and(eq(companies.id, companyId))).limit(1);
  if (!company?.ownerId) return { error: "This link isn't valid. Ask your manager for a new one." };
  const { places } = await teamPlaces(company.ownerId);
  if (places < 1) return { error: "Every place on this team has been filled. Ask your manager to add you." };
  const profileId = await addTeamPerson(company.ownerId, companyId, parsed.data);
  await db.insert(events).values({ name: "team_invite_accepted", companyId, profileId, source: "team_link" });
  await noteIfComplete(company.ownerId, companyId);
  revalidatePath("/manage", "layout");
  return { slug: String(profileId) };
}

/** "Has left": move their card to the new person, or keep it as a spare. */
export async function leaverAction(form: FormData) {
  const v = await me();
  const profileId = Number(form.get("profile_id"));
  if (!(await canEditProfile(v, profileId))) redirect("/manage/?done=denied");
  const outcome = form.get("outcome");
  const first = String(form.get("first_name") ?? "").trim().slice(0, 100);
  if (outcome === "move" && !first) redirect(`/team/left/${profileId}/?error=name`);
  await replaceLeaver(v.id, profileId, outcome === "move" ? { firstName: first, lastName: String(form.get("last_name") ?? "").trim().slice(0, 100), jobTitle: String(form.get("job_title") ?? "").trim().slice(0, 200) } : null);
  revalidatePath("/manage", "layout");
  redirect(`/manage/?done=${outcome === "move" ? "card-moved" : "card-spare"}`);
}
