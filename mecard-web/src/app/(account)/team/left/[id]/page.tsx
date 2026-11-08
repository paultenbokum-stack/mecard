import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { cards, profiles } from "@/db/schema";
import { canEditProfile, viewer } from "@/lib/access";
import { requireUserId } from "@/lib/session";
import { leaverAction } from "../../actions";
import "../../team.css";

export const metadata: Metadata = { title: { absolute: "Someone has left - MeCard" } };

// "Has left" on the team list: archive the profile, then deactivate or reassign their card.
export default async function LeaverPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const id = Number((await params).id);
  const v = await viewer(await requireUserId(`/team/left/${id}/`));
  if (!(await canEditProfile(v, id))) notFound();
  const [p] = await db.select({ firstName: profiles.firstName, lastName: profiles.lastName, companyId: profiles.companyId }).from(profiles).where(and(eq(profiles.id, id), eq(profiles.archived, false))).limit(1);
  if (!p) notFound();
  const [linked, colleagues] = await Promise.all([
    db.select({ id: cards.id }).from(cards).where(and(eq(cards.profileId, id), eq(cards.archived, false))),
    p.companyId
      ? db.select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName }).from(profiles).where(and(eq(profiles.companyId, p.companyId), eq(profiles.archived, false), ne(profiles.id, id))).orderBy(profiles.firstName)
      : Promise.resolve([]),
  ]);
  const name = `${p.firstName} ${p.lastName}`.trim();
  const error = (await searchParams).error;
  const noun = linked.length === 1 ? "their card" : `their ${linked.length} cards and tags`;

  return (
    <div className="team team--narrow">
      <form action={leaverAction} className="team-panel">
        <input type="hidden" name="profile_id" value={id} />
        <div>
          <h1>{name} has left</h1>
          <p>We’ll archive {name}’s profile.{linked.length ? ` What should happen to ${noun}?` : " They don’t have a card linked."}</p>
        </div>
        {error ? <p className="team-error" role="alert">Enter the new person’s first name, or choose someone from the list.</p> : null}

        {linked.length ? (
          <>
            <label className="team-check">
              <input type="radio" name="card_choice" value="deactivate" defaultChecked />
              <span><b>Deactivate it</b><small>The card stops working. Best if it’s printed with {name}’s name.</small></span>
            </label>
            <label className="team-check">
              <input type="radio" name="card_choice" value="reassign" />
              <span><b>Reassign it to someone else</b><small>The card opens their profile instead. Any name printed on it stays the same.</small></span>
            </label>
            <div className="team-field">
              <label htmlFor="left-to">Reassign to</label>
              <select id="left-to" name="reassign_to" defaultValue="new" className="team-select">
                <option value="new">A new person</option>
                {colleagues.map((c) => (
                  <option key={c.id} value={c.id}>{`${c.firstName} ${c.lastName}`.trim()}</option>
                ))}
              </select>
            </div>
            <div className="team-field">
              <label htmlFor="left-first">New person’s first name</label>
              <input id="left-first" name="first_name" />
            </div>
            <div className="team-field">
              <label htmlFor="left-last">Last name</label>
              <input id="left-last" name="last_name" />
            </div>
            <div className="team-field">
              <label htmlFor="left-job">Job title</label>
              <input id="left-job" name="job_title" />
            </div>
          </>
        ) : null}

        <div className="team-inline">
          <button type="submit" className="team-btn team-btn--primary">Archive profile</button>
          <Link className="team-btn" href="/manage/">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
