"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveProfileAction } from "@/app/(account)/manage/editor-actions";
import type { Link as ProfileLink, ProfileView } from "@/lib/profile-view";
import { Field, ImageField, LinksEditor, LivePreview, SaveBar, WizardNav, type LinkRow, type WizardLinks } from "./EditorParts";

// The profile editor: every field the single-profile editor and the
// edit-mecard-profile forms had, with the card rendered live beside it.

const SOCIALS: [key: string, label: string, placeholder: string][] = [
  ["linkedin", "LinkedIn", "https://www.linkedin.com/in/…"],
  ["facebook", "Facebook", "https://www.facebook.com/…"],
  ["instagram", "Instagram", "@yourname or link"],
  ["twitter", "X (Twitter)", "@yourname or link"],
  ["youtube", "YouTube", "https://www.youtube.com/@…"],
  ["tiktok", "TikTok", "@yourname or link"],
];

type Fields = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  mobile: string;
  whatsapp: string;
  workPhone: string;
  companyName: string;
  photoPath: string | null;
  hideProfileLinkOnVcard: boolean;
  socials: Record<string, string>;
};

const toRows = (links: ProfileLink[]): LinkRow[] => links.map((l) => ({ key: `l${l.id}`, id: l.id, label: l.label, url: l.url }));

/**
 * pendingPayment: Pro is unlocked but not paid yet, so saving doesn't change the public card's template.
 * wizard: the single view's step buttons; moving on saves first.
 */
export function ProfileEditor({
  initial,
  pro,
  pendingPayment,
  wizard,
  children,
}: {
  initial: ProfileView;
  pro: boolean;
  pendingPayment?: boolean;
  wizard?: WizardLinks;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const p0 = initial.profile;
  const start: Fields = {
    firstName: p0.firstName,
    lastName: p0.lastName,
    jobTitle: p0.jobTitle,
    email: p0.email,
    mobile: p0.mobile,
    whatsapp: p0.whatsapp,
    workPhone: p0.workPhone,
    companyName: p0.companyName,
    photoPath: p0.photoPath,
    hideProfileLinkOnVcard: p0.hideProfileLinkOnVcard,
    socials: { ...p0.socials },
  };
  const [saved, setSaved] = useState({ fields: start, links: toRows(initial.profileLinks) });
  const [f, setF] = useState<Fields>(start);
  const [links, setLinks] = useState<LinkRow[]>(saved.links);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();

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
    value: f[k] as string,
    maxLength: max,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never),
  });

  const view: ProfileView = {
    profile: { ...p0, ...f, socials: Object.fromEntries(Object.entries(f.socials).filter(([, v]) => v.trim())) },
    company: initial.company,
    companyLinks: initial.companyLinks,
    profileLinks: links.filter((l) => l.label.trim()).map((l, i) => ({ id: l.id ?? -(i + 1), label: l.label, url: l.url, icon: "" })),
  };

  const save = (then?: () => void) =>
    startSave(async () => {
      const res = await saveProfileAction(p0.id, { ...f, links: links.map(({ id, label, url }) => ({ id, label, url })) });
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      // Rows without a label or link are dropped on save; new rows get ids on reload.
      const kept = links.filter((l) => l.label.trim() && l.url.trim());
      setLinks(kept);
      setSaved({ fields: f, links: kept });
      setMessage({
        ok: true,
        text: res.becamePro ? "Saved. Your Pro upgrade was applied." : pendingPayment ? "Saved. Your Pro details go live once payment is received." : "Saved. Your card is up to date.",
      });
      if (then) then();
      else router.refresh();
    });

  return (
    <div className="acc-editor" data-dirty={dirty}>
      <div>
        <section className="acc-panel acc-panel--white">
          <h2>About you</h2>
          <div className="acc-form">
            <ImageField label="Profile photo" path={f.photoPath} onChange={(path) => set("photoPath", path)} hint="A square photo works best. JPG or PNG, up to 10 MB." />
            <div className="acc-grid">
              <Field id="pe-first" label="First name">
                <input id="pe-first" type="text" autoComplete="given-name" {...text("firstName", 100)} />
              </Field>
              <Field id="pe-last" label="Last name">
                <input id="pe-last" type="text" autoComplete="family-name" {...text("lastName", 100)} />
              </Field>
            </div>
            <Field id="pe-job" label="Job title">
              <input id="pe-job" type="text" autoComplete="organization-title" {...text("jobTitle", 200)} />
            </Field>
            {initial.company ? null : (
              <Field id="pe-company" label="Company name">
                <input id="pe-company" type="text" autoComplete="organization" {...text("companyName")} />
              </Field>
            )}
          </div>
        </section>

        <section className="acc-panel acc-panel--white">
          <h2>Contact details</h2>
          <div className="acc-form">
            <Field id="pe-email" label="Email address">
              <input id="pe-email" type="email" autoComplete="email" {...text("email")} />
            </Field>
            <div className="acc-grid">
              <Field id="pe-mobile" label="Mobile number">
                <input id="pe-mobile" type="tel" autoComplete="tel" {...text("mobile", 50)} />
              </Field>
              <Field id="pe-wa" label="WhatsApp number" hint="Leave blank to use your mobile number.">
                <input id="pe-wa" type="tel" {...text("whatsapp", 50)} />
              </Field>
              {pro ? (
                <Field id="pe-work" label="Direct line" hint="Your office number; the company number is set on the company.">
                  <input id="pe-work" type="tel" {...text("workPhone", 50)} />
                </Field>
              ) : null}
            </div>
          </div>
        </section>

        <section className="acc-panel acc-panel--white">
          <h2>Social links</h2>
          <div className="acc-grid">
            {SOCIALS.map(([key, label, ph]) => (
              <Field id={`pe-s-${key}`} label={label} key={key}>
                <input
                  id={`pe-s-${key}`}
                  type="text"
                  inputMode="url"
                  placeholder={ph}
                  value={f.socials[key] ?? ""}
                  maxLength={500}
                  onChange={(e) => set("socials", { ...f.socials, [key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </section>

        {pro ? (
          <section className="acc-panel acc-panel--white">
            <h2>My Links</h2>
            <p className="acc__muted">Extra buttons on your card, in this order. {initial.companyLinks.length ? "Your company's buttons show above them." : ""}</p>
            <LinksEditor
              rows={links}
              onChange={(rows) => {
                setLinks(rows);
                setMessage(null);
              }}
              addLabel="+ Add a link"
            />
          </section>
        ) : null}

        {children}

        <section className="acc-panel acc-panel--white">
          <h2>Saved contact</h2>
          <div className="acc-check">
            <input type="checkbox" id="pe-hide" checked={f.hideProfileLinkOnVcard} onChange={(e) => set("hideProfileLinkOnVcard", e.target.checked)} />
            <label htmlFor="pe-hide">Leave the link to this profile out of the contact people save</label>
          </div>
        </section>

        <SaveBar
          dirty={dirty}
          saving={saving}
          message={message}
          onSave={() => save()}
          extra={wizard ? <WizardNav links={wizard} busy={saving} onNext={(go) => (dirty ? save(go) : go())} /> : null}
        />
      </div>
      <aside className="acc-editor__preview">
        <LivePreview view={view} pro={pro} />
      </aside>
    </div>
  );
}

