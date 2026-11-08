"use client";

import { useState } from "react";
import { beacon } from "@/lib/beacon";
import { addTeamListAction } from "../actions";

// After paying: send one link, or paste a list.

export function TeamPeople({ companyId, url, joined, total, company }: { companyId: number; url: string; joined: number; total: number; company: string }) {
  const [tab, setTab] = useState<"link" | "list">("link");
  const [copied, setCopied] = useState(false);
  const message = encodeURIComponent(`Please add your details for your ${company} MeCard. It takes about 30 seconds: ${url}`);

  const shared = (method: string) => beacon("team_invite_sent", { meta: { method } });
  const copy = async () => {
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopied(true);
    shared("copy");
  };

  return (
    <>
      <div className="team-tabs" role="group" aria-label="How to add people">
        <button type="button" className={`team-tab${tab === "link" ? " is-on" : ""}`} aria-pressed={tab === "link"} onClick={() => setTab("link")}>Share a link</button>
        <button type="button" className={`team-tab${tab === "list" ? " is-on" : ""}`} aria-pressed={tab === "list"} onClick={() => setTab("list")}>I have a list</button>
      </div>

      {tab === "link" ? (
        <section className="team-panel">
          <div>
            <h2>Send your team one link</h2>
            <p>Each person adds their own name, job title and mobile, and you see them appear here. No list needed.</p>
          </div>
          <div className="team-url">{url}</div>
          <div className="team-inline">
            <button type="button" className="team-btn team-btn--primary" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
            <a className="team-btn" href={`https://wa.me/?text=${message}`} target="_blank" rel="noopener" onClick={() => shared("whatsapp")}>Share on WhatsApp</a>
            <a className="team-btn" href={`mailto:?subject=${encodeURIComponent("Your MeCard")}&body=${message}`} onClick={() => shared("email")}>Email it</a>
          </div>
          {total > 0 ? (
            <div>
              <div className="team-progress"><span>{joined} of {total} added</span></div>
              <div className="team-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.round((joined / total) * 100))}%` }} /></div>
            </div>
          ) : null}
        </section>
      ) : (
        <form action={addTeamListAction} className="team-panel">
          <input type="hidden" name="company_id" value={companyId} />
          <div className="team-field">
            <label htmlFor="team-list">One person per line: name, job title, email</label>
            <textarea id="team-list" name="list" rows={8} className="team-mono" placeholder={"Thandi Mokoena, Operations manager, thandi@company.co.za\nJohan Botha, Sales manager"} required />
            <p className="team-note">Paste straight from a spreadsheet. Email is optional.</p>
          </div>
          <label className="team-check">
            <input type="checkbox" name="invite" value="1" defaultChecked />
            <span><b>Email each person a link to finish their details</b><small>They can add a photo and mobile number. The branding stays locked.</small></span>
          </label>
          <button type="submit" className="team-btn team-btn--primary team-btn--block">Add these people</button>
        </form>
      )}
    </>
  );
}
