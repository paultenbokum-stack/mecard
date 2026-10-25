import type { Metadata } from "next";
import { and, asc, eq, or } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { companies, profileLinks, profiles } from "@/db/schema";
import { DoneNotice, Subnav } from "@/components/account/Bits";
import { CompanyEditor } from "@/components/account/CompanyEditor";
import { canManageCompany, viewer } from "@/lib/access";
import { COLOUR_FIELDS, FONT_CHOICES, ICON_CHOICES } from "@/lib/company-edit";
import { COMPANY_LINK_ORDER, getProfileView, type Company, type Profile, type ProfileView } from "@/lib/public-profile";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Edit company" };

type SP = { tab?: string; done?: string };

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) notFound();
  const v = await viewer(await requireUserId(`/manage/company/${companyId}/`));
  if (!(await canManageCompany(v, companyId))) redirect("/manage/companies/?done=denied");
  if (sp.tab === "team") redirect("/manage/");
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) notFound();

  return (
    <div className="acc__wrap acc__wrap--wide">
      <Subnav active="companies" />
      <p className="acc__eyebrow">Company</p>
      <h1>{company.name}</h1>
      <DoneNotice done={sp.done} />
      <Editor company={company} />
    </div>
  );
}

async function Editor({ company }: { company: Company }) {
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
