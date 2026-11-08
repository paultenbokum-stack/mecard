import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { teamCompanies } from "@/lib/team";
import { TeamSetup } from "./TeamSetup";
import "../team.css";

export const metadata: Metadata = { title: { absolute: "Your company - MeCard" } };

const FREE_MAIL = /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|proton|protonmail|webmail|mweb|telkomsa|vodamail|afrihost)\./i;

/** The website implied by a work email address, to save typing it. */
const websiteFromEmail = (email: string) => {
  const domain = email.split("@")[1] ?? "";
  return domain && !FREE_MAIL.test(domain) ? domain : "";
};

// Step 2 of the team flow. An account that already has a company carries on to step 3.
export default async function TeamSetupPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const userId = await requireUserId("/team/setup/");
  const [existing] = await teamCompanies(userId);
  if (existing && !(await searchParams).new) redirect("/team/order/");
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return (
    <div className="team">
      <ol className="team-steps" aria-label="Progress">
        <li className="is-done">1 Your account, done</li>
        <li className="is-now" aria-current="step">2 Your company</li>
        <li>3 Team size and pay</li>
      </ol>
      <TeamSetup suggestedWebsite={websiteFromEmail(u?.email ?? "")} />
    </div>
  );
}
