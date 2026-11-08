import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { cards, profiles } from "@/db/schema";
import { canEditProfile, viewer } from "@/lib/access";
import { requireUserId } from "@/lib/session";
import { leaverAction } from "../../actions";
import "../../team.css";

export const metadata: Metadata = { title: { absolute: "Someone has left - MeCard" } };

// "Has left" on the team list: their card moves to the next person without reprinting.
export default async function LeaverPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const id = Number((await params).id);
  const v = await viewer(await requireUserId(`/team/left/${id}/`));
  if (!(await canEditProfile(v, id))) notFound();
  const [p] = await db.select({ firstName: profiles.firstName, lastName: profiles.lastName, jobTitle: profiles.jobTitle }).from(profiles).where(and(eq(profiles.id, id), eq(profiles.archived, false))).limit(1);
  if (!p) notFound();
  const linked = await db.select({ id: cards.id }).from(cards).where(and(eq(cards.profileId, id), eq(cards.archived, false)));
  const name = `${p.firstName} ${p.lastName}`.trim();
  const error = (await searchParams).error;

  return (
    <div className="team team--narrow">
      <form action={leaverAction} className="team-panel">
        <input type="hidden" name="profile_id" value={id} />
        <div>
          <h1>{name} has left. Who gets the card?</h1>
          <p>{linked.length ? `${name}’s profile will be archived and ${linked.length === 1 ? "their card" : `their ${linked.length} cards and tags`} will show the new person’s details straight away.` : `${name}’s profile will be archived. They don’t have a card linked.`}</p>
        </div>
        {error ? <p className="team-error" role="alert">Enter the new person’s first name.</p> : null}
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
          <input id="left-job" name="job_title" defaultValue={p.jobTitle} />
        </div>
        <div className="team-inline">
          <button type="submit" name="outcome" value="move" className="team-btn team-btn--primary">Move the card</button>
          <button type="submit" name="outcome" value="spare" className="team-btn" formNoValidate>Keep it as a spare</button>
          <Link className="team-btn" href="/manage/">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
