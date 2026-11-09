"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveCompanyAction, sitePaletteAction } from "@/app/(account)/manage/editor-actions";
import type { Company, ProfileView } from "@/lib/profile-view";
import { Field, ImageField, LinksEditor, LivePreview, SaveBar, WizardNav, type LinkRow, type WizardLinks } from "./EditorParts";
import { RichTextEditor } from "./RichTextEditor";
import { DEFAULT_COLOURS, LOGO_PADDING, LOGO_WIDTH } from "@/lib/branding";
import { autop } from "@/lib/rich-text";

// The company editor (edit-companies form, Me\Company_Editor and the company
// half of the single editor), previewed on one of the company's profiles.

type Fields = Pick<
  Company,
  | "name"
  | "phone"
  | "website"
  | "address"
  | "supportEmail"
  | "vatNumber"
  | "descriptionHtml"
  | "logoPath"
  | "logoWidth"
  | "logoPadding"
  | "logoBg"
  | "headingFont"
  | "bodyFont"
  | "headingColour"
  | "bodyColour"
  | "accentColour"
  | "buttonTextColour"
  | "downloadColour"
  | "downloadTextColour"
  | "customCss"
>;

const TABS = [
  ["details", "Details"],
  ["branding", "Branding"],
  ["buttons", "Buttons"],
] as const;

export function CompanyEditor({
  sample,
  fonts,
  colours,
  icons,
  sampleLabel,
  wizard,
}: {
  sample: ProfileView & { company: Company };
  fonts: [string, string][];
  colours: readonly (readonly [keyof Fields, string])[];
  icons: { class: string; label: string }[];
  sampleLabel: string;
  /** The single view's step buttons; moving on saves first. */
  wizard?: WizardLinks;
}) {
  const router = useRouter();
  const c0 = sample.company;
  const start: Fields = {
    name: c0.name,
    phone: c0.phone,
    website: c0.website,
    address: c0.address,
    supportEmail: c0.supportEmail,
    vatNumber: c0.vatNumber,
    // Older descriptions keep paragraphs as blank lines; the editor needs the <p> tags.
    descriptionHtml: autop(c0.descriptionHtml),
    logoPath: c0.logoPath,
    logoWidth: c0.logoWidth,
    logoPadding: c0.logoPadding,
    logoBg: c0.logoBg,
    headingFont: c0.headingFont,
    bodyFont: c0.bodyFont,
    headingColour: c0.headingColour,
    bodyColour: c0.bodyColour,
    accentColour: c0.accentColour,
    buttonTextColour: c0.buttonTextColour,
    downloadColour: c0.downloadColour,
    downloadTextColour: c0.downloadTextColour,
    customCss: c0.customCss,
  };
  const startLinks: LinkRow[] = sample.companyLinks.map((l) => ({ key: `l${l.id}`, id: l.id, label: l.label, url: l.url, icon: l.icon }));
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("details");
  const [saved, setSaved] = useState({ fields: start, links: startLinks });
  const [f, setF] = useState<Fields>(start);
  const [links, setLinks] = useState<LinkRow[]>(startLinks);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [reading, startRead] = useTransition();

  const dirty = useMemo(() => JSON.stringify([f, links]) !== JSON.stringify([saved.fields, saved.links]), [f, links, saved]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setMessage(null);
  };
  const text = (k: keyof Fields, max = 255) => ({
    value: (f[k] as string) ?? "",
    maxLength: max,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
  });

  const view: ProfileView = {
    profile: sample.profile,
    company: { ...c0, ...f },
    companyLinks: links.filter((l) => l.label.trim()).map((l, i) => ({ id: l.id ?? -(i + 1), label: l.label, url: l.url, icon: l.icon ?? "" })),
    profileLinks: sample.profileLinks,
  };

  const save = (then?: () => void) =>
    startSave(async () => {
      const res = await saveCompanyAction(c0.id, { ...f, links: links.map(({ id, label, url, icon }) => ({ id, label, url, icon })) });
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      const kept = links.filter((l) => l.label.trim() && l.url.trim());
      setLinks(kept);
      setSaved({ fields: f, links: kept });
      setMessage({ ok: true, text: "Saved. Every profile in the company shows the change." });
      if (then) then();
      else router.refresh();
    });

  return (
    <div className="acc-editor" data-dirty={dirty}>
      <div>
        <nav className="acc-tabs" aria-label="Company settings">
          {TABS.map(([key, label]) => (
            <a
              key={key}
              href={`#${key}`}
              aria-current={tab === key ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                setTab(key);
              }}
            >
              {label}
            </a>
          ))}
        </nav>

        {tab === "details" ? (
          <section className="acc-panel acc-panel--white">
            <div className="acc-form">
              <Field id="ce-name" label="Company name">
                <input id="ce-name" type="text" required {...text("name")} />
              </Field>
              <ImageField label="Logo" logo companyId={c0.id} path={f.logoPath} onChange={(path) => set("logoPath", path)} hint="Shown at the top of every Pro profile. A PNG with a transparent background works best." />
              {f.logoPath ? (
                <fieldset className="acc-logo-fit">
                  <legend>Logo area</legend>
                  <div className="acc-grid">
                    <Field id="ce-logo-width" label={`Logo size: ${f.logoWidth}%`} hint="A short, wide logo often looks best smaller.">
                      <input id="ce-logo-width" type="range" min={LOGO_WIDTH.min} max={LOGO_WIDTH.max} step={5} value={f.logoWidth} onChange={(e) => set("logoWidth", Number(e.target.value))} />
                    </Field>
                    <Field id="ce-logo-pad" label={`Space above and below: ${f.logoPadding}px`} hint="Gives the logo room, centred in its area.">
                      <input id="ce-logo-pad" type="range" min={LOGO_PADDING.min} max={LOGO_PADDING.max} step={4} value={f.logoPadding} onChange={(e) => set("logoPadding", Number(e.target.value))} />
                    </Field>
                  </div>
                  <div className="acc-field">
                    <label htmlFor="ce-logo-bg">Logo background</label>
                    <div className="acc-colour">
                      <input type="color" aria-label="Logo background picker" value={f.logoBg || "#ffffff"} onChange={(e) => set("logoBg", e.target.value)} />
                      <input id="ce-logo-bg" type="text" placeholder="Default (#ffffff)" {...text("logoBg", 7)} />
                    </div>
                    <span className="acc-field__hint">
                      For a white logo, choose your brand’s dark colour.{" "}
                      {f.logoWidth !== 100 || f.logoPadding !== 0 || f.logoBg ? (
                        <button
                          type="button"
                          className="acc-link"
                          onClick={() => setF((x) => ({ ...x, logoWidth: 100, logoPadding: 0, logoBg: "" }))}
                        >
                          Reset the logo area
                        </button>
                      ) : null}
                    </span>
                  </div>
                </fieldset>
              ) : null}
              <div className="acc-grid">
                <Field id="ce-phone" label="Office number">
                  <input id="ce-phone" type="tel" {...text("phone", 100)} />
                </Field>
                <Field id="ce-email" label="Support email">
                  <input id="ce-email" type="email" {...text("supportEmail")} />
                </Field>
              </div>
              <Field id="ce-vat" label="VAT number (optional)" hint="Only used on quotes and invoices; not shown on profiles.">
                <input id="ce-vat" type="text" {...text("vatNumber", 30)} />
              </Field>
              <Field id="ce-web" label="Website">
                <input id="ce-web" type="url" inputMode="url" placeholder="https://" {...text("website", 500)} />
              </Field>
              <Field id="ce-address" label="Address" hint="Shown with a Directions button that opens Google Maps.">
                <input id="ce-address" type="text" {...text("address", 500)} />
              </Field>
              <Field id="ce-desc" label="About the company" hint="Use the toolbar for headings, bold, italics, lists and links. HTML shows the code.">
                <RichTextEditor id="ce-desc" label="About the company" value={f.descriptionHtml} onChange={(html) => set("descriptionHtml", html)} />
              </Field>
            </div>
          </section>
        ) : null}

        {tab === "branding" ? (
          <section className="acc-panel acc-panel--white">
            <div className="acc-form">
              <div className="acc-siteread">
                <button
                  type="button"
                  className="acc-btn acc-btn--small"
                  disabled={reading || !f.website.trim()}
                  onClick={() =>
                    startRead(async () => {
                      const r = await sitePaletteAction(c0.id, f.website);
                      if (!r.ok) return setMessage({ ok: false, text: r.error });
                      // Only what the site gives: blank roles keep what's set.
                      setF((x) => ({ ...x, ...Object.fromEntries(Object.entries(r.palette).filter(([, v]) => v)) }));
                      setMessage({ ok: true, text: "Colours and fonts read from your website. Check the preview, then save." });
                    })
                  }
                >
                  {reading ? "Reading your website…" : "Read colours from my website"}
                </button>
                <span className="acc-field__hint">{f.website.trim() ? `From ${f.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : "Add your website on Details first."}</span>
              </div>
              <div className="acc-grid">
                <Field id="ce-hfont" label="Heading font">
                  <select id="ce-hfont" value={f.headingFont} onChange={(e) => set("headingFont", e.target.value)}>
                    {fonts.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="ce-bfont" label="Text font">
                  <select id="ce-bfont" value={f.bodyFont} onChange={(e) => set("bodyFont", e.target.value)}>
                    {fonts.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="acc-grid">
                {colours.map(([key, label]) => {
                  const value = (f[key] as string) ?? "";
                  // A blank field uses the card's default colour: the swatch shows that colour, so picking another (black too) is a change.
                  const fallback = DEFAULT_COLOURS[key as keyof typeof DEFAULT_COLOURS] ?? "#000000";
                  return (
                    <div className="acc-field" key={key}>
                      <label htmlFor={`ce-${key}`}>{label}</label>
                      <div className="acc-colour">
                        <input type="color" aria-label={`${label} picker`} value={value || fallback} onChange={(e) => set(key, e.target.value as never)} />
                        <input id={`ce-${key}`} type="text" placeholder={`Default (${fallback})`} {...text(key, 7)} />
                      </div>
                      <span className="acc-field__hint">
                        {value ? (
                          <button type="button" className="acc-link" onClick={() => set(key, "" as never)}>
                            Reset to default
                          </button>
                        ) : (
                          "Using the default colour"
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Field id="ce-css" label="Custom CSS" hint="For fine-tuning. It only applies inside your profiles, never to the rest of the page.">
                <textarea id="ce-css" className="acc-code" spellCheck={false} {...text("customCss", 20000)} />
              </Field>
            </div>
          </section>
        ) : null}

        {tab === "buttons" ? (
          <section className="acc-panel acc-panel--white">
            <p className="acc__muted">Buttons on every profile in the company, above each person&rsquo;s own links.</p>
            <LinksEditor
              rows={links}
              icons={icons}
              onChange={(rows) => {
                setLinks(rows);
                setMessage(null);
              }}
              addLabel="+ Add a company button"
            />
          </section>
        ) : null}

        <SaveBar
          dirty={dirty}
          saving={saving}
          message={message}
          onSave={() => save()}
          extra={wizard ? <WizardNav links={wizard} busy={saving} onNext={(go) => (dirty ? save(go) : go())} /> : null}
        />
      </div>
      <aside className="acc-editor__preview">
        <LivePreview view={view} pro label={sampleLabel} />
      </aside>
    </div>
  );
}
