"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { beacon } from "@/lib/beacon";
import { imageUrl } from "@/lib/images/paths";
import { readSiteAction, saveTeamCompanyAction } from "../actions";

// Step 2: the website fills in a sample profile, and anything can be changed.

const STARTERS = ["#0066ff", "#0f1729", "#047857", "#b45309"];

export function TeamSetup({ suggestedWebsite }: { suggestedWebsite: string }) {
  const [site, setSite] = useState(suggestedWebsite);
  const [mode, setMode] = useState<"start" | "found" | "manual">("start");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [about, setAbout] = useState("");
  const [website, setWebsite] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [colours, setColours] = useState<string[]>(STARTERS);
  const [colour, setColour] = useState(STARTERS[0]);
  const [socials, setSocials] = useState<{ label: string; url: string; icon: string }[]>([]);
  const [message, setMessage] = useState("");
  const [reading, startRead] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => beacon("team_step_viewed", { meta: { step: "company" } }), []);

  const find = () =>
    startRead(async () => {
      setMessage("");
      const r = await readSiteAction(site);
      if ("error" in r) {
        setMessage(r.error);
        setMode("manual");
        return;
      }
      setName(r.name);
      setPhone(r.phone);
      setAddress(r.address);
      setAbout(r.description);
      setWebsite(r.website);
      setLogoPath(r.logoPath);
      setSocials(r.socials);
      const found = [...new Set([...r.colours, ...STARTERS])].slice(0, 5);
      setColours(found);
      setColour(found[0]);
      setMode("found");
    });

  const save = () =>
    startSave(async () => {
      setMessage("");
      const r = await saveTeamCompanyAction({ name, website: website || site, phone, address, about, colour, logoPath, socials, fromSite: mode === "found" });
      if (r?.error) setMessage(r.error);
    });

  const logo = logoPath ? imageUrl(logoPath, 320) : null;
  const shown = name.trim() || "Your company";

  return (
    <div className="team-grid" style={{ "--team-colour": colour } as CSSProperties}>
      <div className="team-main team-panel">
        <div>
          <h1>What’s your company website?</h1>
          <p>We’ll use it to build your team’s online profile. You can change anything.</p>
        </div>
        <div className="team-field">
          <label htmlFor="team-site">Website</label>
          <div className="team-inline">
            <input id="team-site" value={site} onChange={(e) => setSite(e.target.value)} placeholder="yourcompany.co.za" autoComplete="url" inputMode="url" />
            <button type="button" className="team-btn team-btn--primary" onClick={find} disabled={reading || !site.trim()}>
              {reading ? "Reading your website…" : "Build my profile"}
            </button>
          </div>
          {mode === "start" ? (
            <button type="button" className="team-link" onClick={() => setMode("manual")}>
              No website? Enter details myself
            </button>
          ) : null}
        </div>
        {message ? <p className="team-error" role="alert">{message}</p> : null}

        {mode !== "start" ? (
          <>
            {mode === "found" ? <p className="team-ok" role="status">Built from your website. Check it’s right.</p> : null}
            <div className="team-field">
              <label htmlFor="team-name">Company name</label>
              <input id="team-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" />
            </div>
            {logo ? (
              <div className="team-field">
                <span className="team-label">Logo</span>
                <div className="team-logo">
                  <img src={logo} alt="Logo found on your website" />
                  <button type="button" className="team-link" onClick={() => setLogoPath(null)}>Remove</button>
                </div>
                <p className="team-note">You can upload a different logo later, under Companies.</p>
              </div>
            ) : null}
            <div>
              <span id="team-colour" className="team-label">Colour</span>
              <div className="team-swatches" role="radiogroup" aria-labelledby="team-colour">
                {colours.map((c) => (
                  <button type="button" role="radio" aria-checked={c === colour} aria-label={`Colour ${c}`} className={`team-swatch${c === colour ? " is-on" : ""}`} style={{ background: c }} key={c} onClick={() => setColour(c)} />
                ))}
              </div>
            </div>
            <div className="team-field">
              <label htmlFor="team-phone">Office number</label>
              <input id="team-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
            <div className="team-field">
              <label htmlFor="team-address">Address</label>
              <input id="team-address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
            </div>
            <div className="team-field">
              <label htmlFor="team-about">About the company</label>
              <textarea id="team-about" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} />
            </div>
            <button type="button" className="team-btn team-btn--primary team-btn--block" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Looks right, continue"}
            </button>
          </>
        ) : null}
      </div>

      <aside className="team-side" aria-label="Sample online profile">
        <p className="team-eyebrow">Your team’s online profile</p>
        <div className="team-phone">
          <div className="team-phone__screen">
            <div className="team-phone__cover">{logo ? <img src={logo} alt="" /> : shown}</div>
            <div className="team-phone__photo">Staff photo</div>
            <div className="team-phone__name">
              <b>Sample Person</b>
              <i>Job title</i>
            </div>
            <div className="team-phone__actions"><span>Call</span><span>Email</span><span>WhatsApp</span></div>
            <div className="team-phone__about">
              <b>{shown}</b>
              <em>{address || "Your address"}</em>
              <span>{phone || "Your office number"}</span>
              <p>{about || "A short line about your company."}</p>
            </div>
            <div className="team-phone__save">Save contact</div>
          </div>
        </div>
        <p className="team-note" style={{ textAlign: "center" }}>This is what people see when they tap or scan. Each person gets their own name, photo and number on it.</p>
      </aside>
    </div>
  );
}
