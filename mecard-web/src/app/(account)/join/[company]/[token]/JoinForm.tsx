"use client";

import { useActionState, useState } from "react";
import { joinTeamAction, type JoinState } from "@/app/(account)/team/actions";

export function JoinForm({ companyId, token, company }: { companyId: number; token: string; company: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinTeamAction, {});
  const [started] = useState(() => Date.now());

  if (state.slug) {
    return (
      <div className="team-panel">
        <h1>You’re on the team</h1>
        <p>Thanks. {company} can now finish your MeCard, and you’ll hear from them when your card is on its way.</p>
      </div>
    );
  }
  return (
    <form action={action} className="team-panel">
      <div>
        <h1>Join {company}</h1>
        <p>Add your details for your MeCard. It takes about 30 seconds, with no password or app needed.</p>
      </div>
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="started" value={started} />
      <div className="team-hidden" aria-hidden="true">
        <label htmlFor="join-website">Website</label>
        <input id="join-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.error ? <p className="team-error" role="alert">{state.error}</p> : null}
      <div className="team-field"><label htmlFor="join-first">First name</label><input id="join-first" name="first_name" required autoComplete="given-name" /></div>
      <div className="team-field"><label htmlFor="join-last">Last name</label><input id="join-last" name="last_name" required autoComplete="family-name" /></div>
      <div className="team-field"><label htmlFor="join-job">Job title</label><input id="join-job" name="job_title" autoComplete="organization-title" /></div>
      <div className="team-field"><label htmlFor="join-mobile">Mobile number</label><input id="join-mobile" name="mobile" type="tel" autoComplete="tel" /></div>
      <div className="team-field"><label htmlFor="join-email">Work email</label><input id="join-email" name="email" type="email" autoComplete="email" /></div>
      <button type="submit" className="team-btn team-btn--primary team-btn--block" disabled={pending}>{pending ? "Sending…" : "Send my details"}</button>
    </form>
  );
}
