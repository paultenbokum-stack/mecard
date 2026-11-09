import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { teamCompanies, teamPlaces, teamProfiles } from "@/lib/team";
import { TeamSteps } from "../TeamSteps";
import { TeamPeople } from "./TeamPeople";
import "../team.css";

export const metadata: Metadata = { title: { absolute: "Add your people - MeCard" } };

export default async function TeamPeoplePage({ searchParams }: { searchParams: Promise<{ company?: string; added?: string; error?: string }> }) {
  const sp = await searchParams;
  const userId = await requireUserId("/team/people/");
  const all = await teamCompanies(userId);
  const company = all.find((c) => c.id === Number(sp.company)) ?? all[0];
  if (!company) redirect("/team/setup/");
  const [people, { places }] = await Promise.all([teamProfiles(company.id), teamPlaces(userId)]);
  const total = people.length + places;

  return (
    <div className="team team--narrow">
      <TeamSteps now="people" />
      <div className="team-main">
        <div>
          <h1>Who’s on the team?</h1>
          <p>Your order is safe. Add people now or later. Each card prints once its name is in, and Pro profiles go live as soon as you add people.</p>
        </div>
        {sp.added ? <p className="team-ok" role="status">{sp.added === "1" ? "1 person added." : `${sp.added} people added.`}</p> : null}
        {sp.error ? <p className="team-error" role="alert">Add at least one name to the list.</p> : null}
        <TeamPeople companyId={company.id} added={people.length} total={total} />
        {people.length ? (
          <section className="team-panel">
            <h2>{company.name}</h2>
            <ul className="team-people">
              {people.map((p) => (
                <li key={p.id}><b>{`${p.firstName} ${p.lastName}`.trim()}</b>{p.jobTitle ? `, ${p.jobTitle}` : ""}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <div className="team-foot">
          <Link href="/manage/">I’ll do this later</Link>
          <Link className="team-btn team-btn--primary" href="/manage/">Go to my team</Link>
        </div>
      </div>
    </div>
  );
}
