"use client";

import Link from "next/link";
import { useState } from "react";
import { teamPromptCookie } from "@/lib/upsell-rules";

// "Managing a team? Set up a company": the one step from single profiles to a
// team, on Profiles for owners of two or more profiles with no company yet.
// Dismissing it is remembered for this user (a cookie), as the page reads it.

export function TeamPrompt({ userId }: { userId: number }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const dismiss = () => {
    document.cookie = `${teamPromptCookie(userId)}=dismissed; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setOpen(false);
  };
  return (
    <div className="acc-panel acc-panel--white acc-teamprompt" role="note">
      <p style={{ margin: 0 }}>
        <strong>Managing a team?</strong>{" "}
        Set up a company to share your branding and manage everyone&rsquo;s profiles and cards in one place.
      </p>
      <div className="acc-actions" style={{ marginTop: 0 }}>
        <Link className="acc-btn acc-btn--small acc-btn--primary" href="/manage/companies/">
          Set up a company
        </Link>
        <button type="button" className="acc-btn acc-btn--small" onClick={dismiss} aria-label="Dismiss the team suggestion">
          Not now
        </button>
      </div>
    </div>
  );
}
