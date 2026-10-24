"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProProfile } from "@/components/card/ProProfile";
import { StandardProfile } from "@/components/card/StandardProfile";
import { VcardBar } from "@/components/card/VcardBar";
import { designCss } from "@/lib/branding";
import { imageUrl } from "@/lib/images/paths";
import { displayName, type ProfileView } from "@/lib/profile-view";
import { ImageLibrary } from "./ImageLibrary";

// Pieces shared by the profile and company editors.

/** The public card, rendered from the editor's unsaved values. */
export function LivePreview({ view, pro, label }: { view: ProfileView; pro: boolean; label?: string }) {
  const p = view.profile;
  return (
    <>
      {pro && view.company ? <style dangerouslySetInnerHTML={{ __html: designCss(p.id, view.company) }} /> : null}
      <div className="acc-phone" aria-label="Preview">
        <div className="acc-phone__screen">
          <div className="mc-card-container acc-preview-inert" inert>
            <div className="mecard-public-card">
              {pro ? (
                <ProProfile view={view}>
                  <VcardBar profileId={p.id} name={displayName(p)} />
                </ProProfile>
              ) : (
                <StandardProfile view={view}>
                  <VcardBar profileId={p.id} name={displayName(p)} />
                </StandardProfile>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="acc-phone__label">{label ?? "Preview — this is how your card looks when tapped."}</p>
    </>
  );
}

/** A photo or logo, chosen in the media picker (upload or reuse from My images); the path is kept in the form until saved. */
export function ImageField({
  label,
  path,
  onChange,
  logo = false,
  hint,
  companyId,
}: {
  label: string;
  path: string | null;
  onChange: (path: string) => void;
  logo?: boolean;
  hint?: string;
  /** Uploads are shared with this company's admins. */
  companyId?: number;
}) {
  const [open, setOpen] = useState(false);
  const src = imageUrl(path, logo ? 480 : 320);

  return (
    <div className="acc-field">
      <span className="acc-field__label">{label}</span>
      <div className={`acc-photo${logo ? " acc-photo--logo" : ""}`}>
        <button type="button" className="acc-photo__pick" onClick={() => setOpen(true)} aria-label={src ? `Change ${label.toLowerCase()}` : `Choose ${label.toLowerCase()}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt="" /> : <span className="acc-avatar" style={logo ? { width: 120, height: 60, borderRadius: 8 } : { width: 88, height: 88 }} />}
        </button>
        <div>
          <button type="button" className="acc-btn acc-btn--small" onClick={() => setOpen(true)}>
            {src ? "Change" : "Choose image"}
          </button>
          {hint ? <div className="acc-field__hint" style={{ marginTop: 6 }}>{hint}</div> : null}
        </div>
      </div>
      {open ? <ImageLibrary slot={logo ? "logo" : "photo"} title={label} companyId={companyId} onPick={onChange} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

export interface LinkRow {
  key: string;
  id?: number;
  label: string;
  url: string;
  icon?: string;
}

let keySeq = 0;
export const newKey = () => `new-${++keySeq}`;

/** "My Links" / company buttons: add, edit, reorder, remove. */
export function LinksEditor({
  rows,
  onChange,
  icons,
  addLabel,
}: {
  rows: LinkRow[];
  onChange: (rows: LinkRow[]) => void;
  icons?: { class: string; label: string }[];
  addLabel: string;
}) {
  const set = (i: number, patch: Partial<LinkRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...rows];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="acc-links">
      {rows.map((r, i) => (
        <div className={`acc-link-row${icons ? " acc-link-row--icon" : ""}`} key={r.key}>
          <div className="acc-field">
            <label htmlFor={`${r.key}-label`}>Button text</label>
            <input id={`${r.key}-label`} type="text" value={r.label} maxLength={255} onChange={(e) => set(i, { label: e.target.value })} placeholder="e.g. Book a meeting" />
          </div>
          <div className="acc-field">
            <label htmlFor={`${r.key}-url`}>Link</label>
            <input id={`${r.key}-url`} type="url" inputMode="url" value={r.url} onChange={(e) => set(i, { url: e.target.value })} placeholder="https://" />
          </div>
          {icons ? (
            <div className="acc-field">
              <label htmlFor={`${r.key}-icon`}>Icon</label>
              <select id={`${r.key}-icon`} value={r.icon ?? ""} onChange={(e) => set(i, { icon: e.target.value })}>
                <option value="">None</option>
                {r.icon && !icons.some((x) => x.class === r.icon) ? <option value={r.icon}>{r.icon}</option> : null}
                {icons.map((x) => (
                  <option key={x.class} value={x.class}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="acc-link-row__tools">
            <button type="button" className="acc-btn acc-btn--small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">
              ↑
            </button>
            <button type="button" className="acc-btn acc-btn--small" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" title="Move down">
              ↓
            </button>
            <button type="button" className="acc-btn acc-btn--small acc-btn--danger" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove" title="Remove">
              ✕
            </button>
          </div>
        </div>
      ))}
      {rows.length < 20 ? (
        <div>
          <button type="button" className="acc-btn acc-btn--small" onClick={() => onChange([...rows, { key: newKey(), label: "", url: "", icon: icons ? "fa-solid fa-globe" : undefined }])}>
            {addLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The sticky save bar with the result of the last save. */
export type WizardLinks = { back?: { href: string; label: string }; next: { href: string; label: string } };

/** Back and Next in the single view's profile wizard. onNext saves unsaved changes first, then calls go. */
export function WizardNav({ links, busy, onNext }: { links: WizardLinks; busy: boolean; onNext: (go: () => void) => void }) {
  const router = useRouter();
  return (
    <span className="acc-wizard-nav">
      {links.back ? (
        <Link className="acc-btn" href={links.back.href}>
          &larr; {links.back.label}
        </Link>
      ) : null}
      <button type="button" className="acc-btn acc-btn--primary" disabled={busy} onClick={() => onNext(() => router.push(links.next.href))}>
        {links.next.label}{" "}&rarr;
      </button>
    </span>
  );
}

/** extra: the wizard's Back and Next, which then take the main button and Save steps back. */
export function SaveBar({ dirty, saving, message, onSave, extra }: { dirty: boolean; saving: boolean; message: { ok: boolean; text: string } | null; onSave: () => void; extra?: React.ReactNode }) {
  return (
    <div className="acc-savebar">
      <span className="acc-savebar__status" role="status">
        {message ? <span className={message.ok ? "acc-ok" : "acc-error"}>{message.text}</span> : dirty ? "You have unsaved changes." : "All changes saved."}
      </span>
      <button type="button" className={`acc-btn${extra ? "" : " acc-btn--primary"}`} onClick={onSave} disabled={saving || !dirty}>
        {saving ? "Saving…" : "Save changes"}
      </button>
      {extra}
    </div>
  );
}

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: React.ReactNode; id: string }) {
  return (
    <div className="acc-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <span className="acc-field__hint">{hint}</span> : null}
    </div>
  );
}
