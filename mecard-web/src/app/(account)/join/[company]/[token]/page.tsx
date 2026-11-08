import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { verifyJoinToken } from "@/lib/team-people-rules";
import { JoinForm } from "./JoinForm";
import "../../../team/team.css";

export const metadata: Metadata = { title: { absolute: "Join your team - MeCard" }, robots: { index: false, follow: false } };

// The link a team admin shares with staff. Open to anyone who has it, and
// limited to the places the team has paid for (joinTeamAction).
export default async function JoinPage({ params }: { params: Promise<{ company: string; token: string }> }) {
  const { company, token } = await params;
  const id = Number(company);
  if (!Number.isInteger(id) || !verifyJoinToken(id, token)) notFound();
  const [c] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, id)).limit(1);
  if (!c) notFound();
  return (
    <div className="team team--narrow">
      <JoinForm companyId={id} token={token} company={c.name} />
    </div>
  );
}
