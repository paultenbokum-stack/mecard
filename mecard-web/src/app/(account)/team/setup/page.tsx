import type { Metadata } from "next";
import { and, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { orders, users } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { FONT_CHOICES } from "@/lib/company-edit";
import type { Company, Profile } from "@/lib/profile-view";
import { teamCompanies } from "@/lib/team";
import { TeamSteps } from "../TeamSteps";
import { TeamSetup } from "./TeamSetup";
import "../team.css";

export const metadata: Metadata = { title: { absolute: "Your company - MeCard" } };

const FREE_MAIL = /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|proton|protonmail|webmail|mweb|telkomsa|vodamail|afrihost)\./i;

/** The website implied by a work email address, to save typing it. */
const websiteFromEmail = (email: string) => {
  const domain = email.split("@")[1] ?? "";
  return domain && !FREE_MAIL.test(domain) ? domain : "";
};

// Step 3 of the team flow, after paying. The checkout's company name and email
// fill in what they can. An account that already has a company carries on to its people.
export default async function TeamSetupPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const userId = await requireUserId("/team/setup/");
  const [existing] = await teamCompanies(userId);
  if (existing && !(await searchParams).new) redirect("/team/people/");
  const [[u], [order]] = await Promise.all([
    db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
    db
      .select({ company: orders.billingCompany, email: orders.billingEmail })
      .from(orders)
      .where(and(eq(orders.userId, userId), sql`${orders.status} NOT LIKE 'ywraq%'`))
      .orderBy(desc(orders.id))
      .limit(1),
  ]);
  return (
    <div className="team">
      <TeamSteps now="company" />
      <TeamSetup
        suggestedWebsite={websiteFromEmail(order?.email || u?.email || "") || websiteFromEmail(u?.email ?? "")}
        suggestedName={order?.company?.trim() ?? ""}
        sampleProfile={sampleProfile()}
        baseCompany={baseCompany()}
        fonts={FONT_CHOICES}
      />
    </div>
  );
}

/** The stand-in person on the preview: the real profile template, with sample details. */
function sampleProfile(): Profile {
  const now = new Date();
  return {
    id: 0, slug: "preview", ownerId: null, managerId: null, companyId: null, type: "pro",
    firstName: "Sample", lastName: "Person", jobTitle: "Job title", email: "you@example.com", mobile: "082 000 0000", whatsapp: "", workPhone: "",
    companyName: "", website: "", socials: { linkedin: "https://www.linkedin.com/" }, photoPath: null, companyLogoPath: null,
    hideProfileLinkOnVcard: false, autoDownloadVcard: false, onboarding: {}, archived: false, createdAt: now, updatedAt: now,
  };
}

/** An empty company for the preview, filled from the form as the admin goes. */
function baseCompany(): Company {
  const now = new Date();
  return {
    id: 0, name: "", slug: "preview", ownerId: null, phone: "", website: "", address: "", supportEmail: "", vatNumber: "", descriptionHtml: "", logoPath: null,
    headingFont: "", headingColour: "", bodyFont: "", bodyColour: "", accentColour: "", buttonTextColour: "", downloadColour: "", downloadTextColour: "",
    customCss: "", createdAt: now, updatedAt: now,
  };
}
