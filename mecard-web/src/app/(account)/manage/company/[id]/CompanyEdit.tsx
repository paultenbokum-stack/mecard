import { and, asc, eq, or } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { companies, profileLinks, profiles } from "@/db/schema";
import { CompanyEditor } from "@/components/account/CompanyEditor";
import { canManageCompany, viewer } from "@/lib/access";
import { COLOUR_FIELDS, FONT_CHOICES, ICON_CHOICES } from "@/lib/company-edit";
import { COMPANY_LINK_ORDER, getProfileView, type Company, type Profile, type ProfileView } from "@/lib/public-profile";
import { requireUserId } from "@/lib/session";

// The company editor, as a page of its own (company/[id]) and in a modal over
// Companies (@modal/(.)company/[id]), like the profile and card editors.

/** The company, once the user may manage it. */
export async function loadCompany(id: string, tab?: string) {
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) notFound();
  const v = await viewer(await requireUserId(`/manage/company/${companyId}/`));
  if (!(await canManageCompany(v, companyId))) redirect("/manage/companies/?done=denied");
  // The Team tab is gone: its people are on Profiles, each with WordPress's menu.
  if (tab === "team") redirect("/manage/");
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) notFound();
  return company;
}

export async function Editor({ company }: { company: Company }) {
  // Preview on one of the company's Pro profiles, or a stand-in when it has none.
  const [first] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.companyId, company.id), eq(profiles.archived, false), or(eq(profiles.type, "pro"), eq(profiles.type, "professional"))))
    .orderBy(asc(profiles.id))
    .limit(1);
  const real = first ? await getProfileView(first.id) : null;
  const sample: ProfileView & { company: Company } = real
    ? { ...real, company }
    : { profile: standIn(company), company, companyLinks: await companyLinks(company.id), profileLinks: [] };
  const label = real ? `Preview on ${`${real.profile.firstName} ${real.profile.lastName}`.trim()}’s profile.` : "Preview with a sample person.";
  return <CompanyEditor sample={sample} fonts={FONT_CHOICES} colours={COLOUR_FIELDS} icons={ICON_CHOICES} sampleLabel={label} />;
}

function companyLinks(companyId: number) {
  return db
    .select({ id: profileLinks.id, label: profileLinks.label, url: profileLinks.url, icon: profileLinks.icon })
    .from(profileLinks)
    .where(eq(profileLinks.companyId, companyId))
    .orderBy(...COMPANY_LINK_ORDER);
}

function standIn(c: Company): Profile {
  const now = new Date();
  return {
    id: 0, slug: "preview", ownerId: null, managerId: null, companyId: c.id, type: "pro",
    firstName: "Your", lastName: "Name", jobTitle: "Job title", email: "you@example.com", mobile: "082 000 0000", whatsapp: "", workPhone: "",
    companyName: "", website: "", socials: { linkedin: "https://www.linkedin.com/" }, photoPath: null, companyLogoPath: null,
    hideProfileLinkOnVcard: false, onboarding: {}, archived: false, createdAt: now, updatedAt: now,
  };
}
