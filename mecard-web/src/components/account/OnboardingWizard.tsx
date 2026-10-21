"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { onboardingStepAction, sendProfileLinkAction } from "@/app/(account)/sign-up/actions";
import { imageUrl } from "@/lib/images/paths";

// js/me-onboarding.js: basics → contact → preview → install, saved step by
// step, then on to the dashboard. The card and Pro offers are on /manage/.

interface Fields {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  photoPath: string | null;
  jobTitle: string;
  companyName: string;
  companyLogoPath: string | null;
  linkedin: string;
}

const STEP_META = {
  basics: { title: "Create your free profile", text: "Start with the personal details people need first." },
  contact: { title: "Your work", text: "Add the professional details that make your profile and classic card feel complete." },
  preview: { title: "Preview your profile", text: "Check how your free profile looks before you publish it." },
  install: { title: "Add launch button to your home screen", text: "" },
} as const;
type Step = keyof typeof STEP_META;
const ORDER: Step[] = ["basics", "contact", "preview", "install"];

const GROUP: Record<Step, "profile" | "install"> = { basics: "profile", contact: "profile", preview: "profile", install: "install" };
const GROUPS = [
  ["signup", "Sign up"],
  ["profile", "Create your free profile"],
  ["install", "Add launch button"],
  ["ready", "You're ready to share!"],
] as const;

type Gtag = (...args: unknown[]) => void;

export function OnboardingWizard({ initial, userEmail }: { initial: Fields & { id: number; slug: string; stage: string }; userEmail: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>((ORDER as string[]).includes(initial.stage) ? (initial.stage as Step) : "basics");
  const [f, setF] = useState<Fields>(initial);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, start] = useTransition();
  // Desktop: email the link to open on a phone; phone: open the share tools.
  const desktop = useSyncExternalStore(
    () => () => undefined,
    () => window.matchMedia("(min-width: 768px) and (pointer: fine)").matches,
    () => false,
  );
  const [previewKey, setPreviewKey] = useState(0);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setF((x) => ({ ...x, [k]: v }));
  const gtag = (...a: unknown[]) => (window as unknown as { gtag?: Gtag }).gtag?.(...a);

  const save = (s: Step, extra: Record<string, unknown> = {}) =>
    start(async () => {
      setError("");
      const res = await onboardingStepAction(initial.id, s, { ...f, ...extra });
      if (!res.ok) return setError(res.error);
      if (res.firstProfile) gtag("event", "first_profile_created", { event_source: "mecard", route: "solo" });
      if (res.done) {
        gtag("event", "onboarding_complete", { event_source: "mecard", transport_type: "beacon" });
        router.push("/manage/");
        return;
      }
      const next = ORDER[ORDER.indexOf(s) + 1] ?? "install";
      if (next === "preview") setPreviewKey((k) => k + 1);
      setStep(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

  const back = () => setStep(ORDER[Math.max(0, ORDER.indexOf(step) - 1)]);
  const profileUrl = `/mecard-profile/${initial.slug}/`;
  const current = GROUP[step];
  const done = current === "install" ? ["signup", "profile"] : ["signup"];
  const meta = STEP_META[step];

  return (
    <div className="me-onboarding" data-me-onboarding>
      <section className="me-onboarding__panel">
        <div className="me-step">
          <div className="me-step__header">
            <h3 className="me-step__title">{meta.title}</h3>
            {meta.text ? <p className="me-step__text">{meta.text}</p> : null}
          </div>

          {step === "basics" ? (
            <div className="me-step__grid">
              <Field id="me-first-name" label="First name" value={f.firstName} onChange={(v) => set("firstName", v)} />
              <Field id="me-last-name" label="Last name" value={f.lastName} onChange={(v) => set("lastName", v)} />
              <Field id="me-mobile" label="Mobile number" type="tel" value={f.mobile} onChange={(v) => set("mobile", v)} placeholder="+27 82 123 4567" />
              <Field id="me-email" label="Email address" type="email" value={f.email} onChange={(v) => set("email", v)} />
              <div className="me-step__field">
                <label>
                  Profile photo <span className="me-step__optional">optional</span>
                </label>
                <MediaPicker kind="photo" path={f.photoPath} onChange={(p) => set("photoPath", p)} onError={setError} />
              </div>
            </div>
          ) : null}

          {step === "contact" ? (
            <div className="me-step__grid">
              <Field id="me-job-title" label="Job title" value={f.jobTitle} onChange={(v) => set("jobTitle", v)} placeholder="e.g. Sales Manager" />
              <Field id="me-company-name" label="Company" value={f.companyName} onChange={(v) => set("companyName", v)} placeholder="e.g. Acme Corp" />
              <div className="me-step__field">
                <label>Company logo</label>
                <MediaPicker kind="logo" path={f.companyLogoPath} onChange={(p) => set("companyLogoPath", p)} onError={setError} />
              </div>
              <Field id="me-linkedin" label="LinkedIn URL" value={f.linkedin} onChange={(v) => set("linkedin", v)} placeholder="Optional" hint="You can add more social links later by editing your profile." />
            </div>
          ) : null}

          {step === "preview" ? (
            <div className="me-profile-frame me-profile-frame--wide">
              <div className="me-profile-frame__phone">
                <div className="me-profile-frame__bar" />
                <iframe key={previewKey} className="me-profile-frame__view" src={`${profileUrl}?me_preview=1&v=${previewKey}`} title="Profile preview" />
              </div>
            </div>
          ) : null}

          {step === "install" ? (
            <>
              <div className="me-install-demo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="me-install-demo__image" src="/images/onboarding/launchdemo.gif" alt="Move the MeCard launch button into your favourites tray" />
              </div>
              <p className="me-step__hint">
                {desktop
                  ? `We’ll send your profile link to ${userEmail}. Open it on your phone, then tap Share → Add to Home Screen to add your launch button.`
                  : "This opens your profile share tools in a new tab. Come back here after you’ve added the launch button."}
              </p>
            </>
          ) : null}

          {error ? (
            <p className="me-auth-error" role="alert">
              {error}
            </p>
          ) : null}
          {note ? (
            <p className="me-note me-note--success" role="status">
              {note}
            </p>
          ) : null}

          <div className="me-step__actions">
            {step === "basics" ? (
              <button type="button" className="me-btn me-btn--primary" disabled={busy} onClick={() => save("basics")}>
                Continue
              </button>
            ) : null}
            {step === "contact" ? (
              <>
                <button type="button" className="me-btn me-btn--secondary" onClick={back}>
                  Back
                </button>
                <button type="button" className="me-btn me-btn--primary" disabled={busy} onClick={() => save("contact")}>
                  Next
                </button>
              </>
            ) : null}
            {step === "preview" ? (
              <>
                <button type="button" className="me-btn me-btn--secondary" onClick={() => setStep("basics")}>
                  Edit profile
                </button>
                <button type="button" className="me-btn me-btn--primary" disabled={busy} onClick={() => save("preview")}>
                  Publish profile
                </button>
              </>
            ) : null}
            {step === "install" ? (
              <>
                <button type="button" className="me-btn me-btn--secondary" onClick={back}>
                  Back
                </button>
                {desktop ? (
                  <button
                    type="button"
                    className="me-btn me-btn--primary"
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        const r = await sendProfileLinkAction(initial.id);
                        setNote(r.ok ? `Sent! Check ${userEmail} on your phone.` : "");
                        setError(r.ok ? "" : "Could not send the email. Please try again.");
                      })
                    }
                  >
                    Send my profile link to my email
                  </button>
                ) : (
                  <a className="me-btn me-btn--primary" href={`${profileUrl}?me_share=1&me_share_target=install`} target="_blank" rel="noopener">
                    Add launch button
                  </a>
                )}
                <button type="button" className="me-btn me-btn--ghost" disabled={busy} onClick={() => save("install", { installStatus: "skipped" })}>
                  Skip for now
                </button>
                <button type="button" className="me-btn me-btn--secondary" disabled={busy} onClick={() => save("install", { installStatus: "done" })}>
                  I’m done
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <div className="me-progress me-progress--bottom">
        <ol className="me-progress__list">
          {GROUPS.map(([key, label]) => (
            <li key={key} className={`me-progress__step${done.includes(key) ? " is-complete" : ""}${current === key ? " is-current" : ""}`}>
              <span className="me-progress__dot">{done.includes(key) ? "✓" : ""}</span>
              <span className="me-progress__label">{label}</span>
            </li>
          ))}
        </ol>
        <div className="me-progress__extra">Then: Add Cards and configure more features</div>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, type = "text", placeholder, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string }) {
  return (
    <div className="me-step__field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="me-step__hint">{hint}</p> : null}
    </div>
  );
}

function MediaPicker({ kind, path, onChange, onError }: { kind: "photo" | "logo"; path: string | null; onChange: (p: string) => void; onError: (e: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const src = imageUrl(path, 320);
  async function upload(file: File) {
    setBusy(true);
    onError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload/", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !json.path) throw new Error(json.error || "Upload failed. Please try again.");
      onChange(json.path);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="me-media-picker" data-media-picker={kind}>
      <div className="me-media-picker__preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img className="me-media-picker__image" src={src} alt="" /> : <div className="me-media-picker__placeholder">{kind === "photo" ? "Photo" : "Logo"}</div>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      <button className="me-btn me-btn--secondary me-btn--small" type="button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : src ? `Change ${kind}` : `Choose ${kind}`}
      </button>
    </div>
  );
}
