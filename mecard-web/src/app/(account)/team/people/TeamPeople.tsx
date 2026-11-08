"use client";

import { addTeamListAction } from "../actions";

// After paying: the admin pastes the team from a spreadsheet. Each person can
// then be invited by email to sign in and edit their own details.

export function TeamPeople({ companyId, added, total }: { companyId: number; added: number; total: number }) {
  return (
    <form action={addTeamListAction} className="team-panel">
      <input type="hidden" name="company_id" value={companyId} />
      <div className="team-field">
        <label htmlFor="team-list">One person per line: name, job title, email, mobile</label>
        <textarea id="team-list" name="list" rows={8} className="team-mono" placeholder={"Thandi Mokoena, Operations manager, thandi@company.co.za, 082 000 0000\nJohan Botha, Sales manager, johan@company.co.za"} required />
        <p className="team-note">Copy the rows straight from Excel or Google Sheets. Email and mobile are optional.</p>
      </div>
      <label className="team-check">
        <input type="checkbox" name="invite" value="1" defaultChecked />
        <span><b>Email each person an invite</b><small>They sign in and can edit their own details. The branding stays locked.</small></span>
      </label>
      <button type="submit" className="team-btn team-btn--primary team-btn--block">Add these people</button>
      {total > 0 ? (
        <div>
          <div className="team-progress"><span>{added} of {total} added</span></div>
          <div className="team-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.round((added / total) * 100))}%` }} /></div>
        </div>
      ) : null}
    </form>
  );
}
