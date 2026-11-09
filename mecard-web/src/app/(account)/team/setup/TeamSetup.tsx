"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState, useTransition } from "react";
import { LivePreview } from "@/components/account/EditorParts";
import { beacon } from "@/lib/beacon";
import { imageUrl } from "@/lib/images/paths";
import type { Company, Profile, ProfileView } from "@/lib/profile-view";
import { textOn, type Palette } from "@/lib/site-read";
import type { FoundLogo } from "@/lib/team";
import { readSiteAction, saveTeamCompanyAction } from "../actions";

// Step 2: the website fills in the team's profile (name, logo, colours and fonts),
// shown on the real profile template, and anything can be changed.

const STARTERS = ["#0066ff", "#0f1729", "#047857", "#b45309"];

const starterPalette = (accent: string): Palette => {
  const text = textOn(accent);
  return { headingColour: "", bodyColour: "", accentColour: accent, buttonTextColour: text, downloadColour: accent, downloadTextColour: text, headingFont: "", bodyFont: "" };
};

const ROLES: [keyof Palette, string][] = [
  ["accentColour", "Buttons and links"],
  ["buttonTextColour", "Button text"],
  ["headingColour", "Headings"],
  ["bodyColour", "Text"],
  ["downloadColour", "Save contact button"],
  ["downloadTextColour", "Save contact text"],
];

export function TeamSetup({
  suggestedWebsite,
  sampleProfile,
  baseCompany,
  fonts,
}: {
  suggestedWebsite: string;
  sampleProfile: Profile;
  baseCompany: Company;
  fonts: [string, string][];
}) {
  const [site, setSite] = useState(suggestedWebsite);
  const [mode, setMode] = useState<"start" | "found" | "manual">("start");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [about, setAbout] = useState("");
  const [website, setWebsite] = useState("");
  const [logos, setLogos] = useState<FoundLogo[]>([]);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [colours, setColours] = useState<string[]>(STARTERS);
  const [found, setFound] = useState<{ palette: Palette; name: string; logoPath: string | null } | null>(null);
  const [palette, setPalette] = useState<Palette>(starterPalette(STARTERS[0]));
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
      const p = r.palette.accentColour ? r.palette : { ...starterPalette(STARTERS[0]), ...Object.fromEntries(Object.entries(r.palette).filter(([, v]) => v)) };
      setName(r.name);
      setPhone(r.phone);
      setAddress(r.address);
      setAbout(r.description);
      setWebsite(r.website);
      setLogos(r.logos);
      setLogoPath(r.logos[0]?.path ?? null);
      setSocials(r.socials);
      setColours([...new Set([...r.colours, ...STARTERS])].slice(0, 8));
      setPalette(p);
      setFound({ palette: p, name: r.name, logoPath: r.logos[0]?.path ?? null });
      setMode("found");
    });

  const setRole = (k: keyof Palette, v: string) =>
    setPalette((p) => {
      const next = { ...p, [k]: v };
      // A new button colour brings readable text with it, and the save button follows when it matched.
      if (k === "accentColour") {
        next.buttonTextColour = textOn(v);
        if (p.downloadColour === p.accentColour) {
          next.downloadColour = v;
          next.downloadTextColour = textOn(v);
        }
      }
      if (k === "downloadColour") next.downloadTextColour = textOn(v);
      return next;
    });

  const changedPalette = !!found && JSON.stringify(found.palette) !== JSON.stringify(palette);

  const save = () =>
    startSave(async () => {
      setMessage("");
      const r = await saveTeamCompanyAction({
        name,
        website: website || site,
        phone,
        address,
        about,
        palette,
        logoPath,
        socials,
        fromSite: mode === "found",
        changed: { palette: changedPalette, logo: !!found && found.logoPath !== logoPath, name: !!found && found.name !== name },
      });
      if (r?.error) setMessage(r.error);
    });

  const chosen = logos.find((l) => l.path === logoPath);
  const view: ProfileView = useMemo(
    () => ({
      profile: { ...sampleProfile, companyName: name.trim() || "Your company" },
      company: {
        ...baseCompany,
        ...palette,
        name: name.trim() || "Your company",
        phone,
        address,
        website: website || site,
        logoPath,
        descriptionHtml: about ? `<p>${about.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "",
      },
      companyLinks: socials.map((s, i) => ({ id: -(i + 1), label: s.label, url: s.url, icon: s.icon })),
      profileLinks: [],
    }),
    [sampleProfile, baseCompany, palette, name, phone, address, website, site, logoPath, about, socials],
  );

  return (
    <div className="team-grid">
      <div className="team-main team-panel">
        <div>
          <h1>What’s your company website?</h1>
          <p>We’ll use it to build your team’s online profile, in your own colours. You can change anything.</p>
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

            {logos.length ? (
              <div className="team-field">
                <span id="team-logo-label" className="team-label">Logo</span>
                <div className="team-logos" role="radiogroup" aria-labelledby="team-logo-label">
                  {logos.map((l, i) => (
                    <button type="button" role="radio" aria-checked={l.path === logoPath} className={`team-logo-choice${l.path === logoPath ? " is-on" : ""}${l.light ? " is-light" : ""}`} key={l.path} onClick={() => setLogoPath(l.path)}>
                      <img src={imageUrl(l.path, 320) ?? ""} alt={`Logo option ${i + 1} from your website`} />
                    </button>
                  ))}
                  <button type="button" role="radio" aria-checked={logoPath === null} className={`team-logo-choice team-logo-choice--none${logoPath === null ? " is-on" : ""}`} onClick={() => setLogoPath(null)}>
                    No logo
                  </button>
                </div>
                {chosen?.light ? <p className="team-note">This logo is white, made for a dark background, so it won’t show on the profile. Pick another, or upload a darker version later under Companies.</p> : <p className="team-note">You can upload a different logo later, under Companies.</p>}
              </div>
            ) : null}

            <fieldset className="team-brand">
              <legend className="team-label">Your brand</legend>
              {ROLES.map(([k, label]) => {
                const value = palette[k];
                // Text colours start with dark and white; button colours with the brand's.
                const neutrals = k === "accentColour" || k === "downloadColour" ? [] : ["#111111", "#ffffff"];
                const options = [...new Set([...(value ? [value] : []), ...neutrals, ...colours])].slice(0, 8);
                return (
                  <div className="team-brand__row" key={k}>
                    <span id={`team-role-${k}`} className="team-brand__name">{label}</span>
                    <div className="team-swatches team-swatches--small" role="radiogroup" aria-labelledby={`team-role-${k}`}>
                      {options.map((c) => (
                        <button type="button" role="radio" aria-checked={c === value} aria-label={`${label} ${c}`} className={`team-swatch${c === value ? " is-on" : ""}`} style={{ background: c }} key={c} onClick={() => setRole(k, c)} />
                      ))}
                      <input type="color" aria-label={`${label}, choose any colour`} value={value || "#333333"} onChange={(e) => setRole(k, e.target.value)} className="team-colour-input" />
                    </div>
                  </div>
                );
              })}
              <div className="team-brand__fonts">
                {(["headingFont", "bodyFont"] as const).map((k) => (
                  <div className="team-field" key={k}>
                    <label htmlFor={`team-${k}`}>{k === "headingFont" ? "Heading font" : "Text font"}</label>
                    <select id={`team-${k}`} value={palette[k]} onChange={(e) => setPalette((p) => ({ ...p, [k]: e.target.value }))}>
                      {fonts.map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {changedPalette ? (
                <button type="button" className="team-link" onClick={() => found && setPalette(found.palette)}>
                  Use my website’s colours again
                </button>
              ) : null}
            </fieldset>

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

      <aside className="team-side team-preview" aria-label="Sample online profile">
        <p className="team-eyebrow">Your team’s online profile</p>
        <LivePreview view={view} pro label="This is what people see when they tap or scan. Each person gets their own name, photo and number on it." />
      </aside>
    </div>
  );
}
