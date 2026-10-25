"use client";

import Link from "next/link";
import { useState } from "react";
import { teamWelcomeCookie } from "@/lib/upsell-rules";

// "You're now managing a team": after Switch to teams or a team sign-up, the
// three steps of the team path, ticked as the account gets there. Shown until
// dismissed (the cookie Switch to teams set is cleared).

export const TEAM_STEPS = [
  ["company", "Set up your company", "Your logo, colours and contact details, shared by every profile.", "/manage/companies/"],
  ["people", "Add your people", "A profile for each person, linked to your company.", "/manage/profile/new/"],
  ["cards", "Order cards", "An NFC card for each profile.", "/manage/cards/new/"],
] as const;

export type TeamProgress = Record<(typeof TEAM_STEPS)[number][0], boolean>;

export function TeamWelcome({ userId, progress }: { userId: number; progress: TeamProgress }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const dismiss = () => {
    document.cookie = `${teamWelcomeCookie(userId)}=; path=/; max-age=0; samesite=lax`;
    setOpen(false);
  };
  const next = TEAM_STEPS.find(([key]) => !progress[key])?.[0];
  return (
    <section className="acc-panel acc-panel--white acc-teamwelcome" aria-labelledby="team-welcome-title">
      <div className="acc-teamwelcome__head">
        <h2 id="team-welcome-title">You&rsquo;re now managing a team</h2>
        <button type="button" className="acc-btn acc-btn--small" onClick={dismiss}>
          Dismiss
        </button>
      </div>
      <p className="acc__muted">Your profiles, cards and company are all managed from here. Three steps get your team going:</p>
      <ol className="acc-teamwelcome__steps">
        {TEAM_STEPS.map(([key, label, sub, href]) => (
          <li key={key} className={progress[key] ? "is-done" : key === next ? "is-next" : undefined}>
            <span className="acc-teamwelcome__tick" aria-hidden="true">
              {progress[key] ? <i className="fa-solid fa-check" /> : TEAM_STEPS.findIndex(([k]) => k === key) + 1}
            </span>
            <span>
              {progress[key] ? (
                <strong>
                  {label} <span className="screen-reader-text">(done)</span>
                </strong>
              ) : (
                <Link href={href} scroll={false}>
                  <strong>{label}</strong>
                </Link>
              )}
              <span className="acc-teamwelcome__sub">{sub}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
