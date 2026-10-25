import Link from "next/link";

// Markup shared by the sign-up pages and onboarding, from
// Me\Onboarding\Module (render_signup_features, render_progress_tracker).

export function SignupFeatures() {
  return (
    <div className="me-feature-list">
      <div className="me-feature-list__item">
        <strong>Launch sharing tools from your phone&apos;s home screen</strong>
        <span>Share via WhatsApp, QR code, or NFC tap — always one tap away.</span>
      </div>
      <div className="me-feature-list__item">
        <strong>Your details downloaded into recipient&apos;s contacts app</strong>
        <span>One tap saves your card directly to their phone.</span>
      </div>
      <div className="me-feature-list__item">
        <strong>Personal &amp; company details in one place</strong>
        <span>Mobile, email, social links and basic company info — all included free.</span>
      </div>
    </div>
  );
}

const GROUPS = [
  ["signup", "Sign up"],
  ["profile", "Create your free profile"],
  ["install", "Add launch button"],
  ["ready", "You're ready to share!"],
] as const;

export type ProgressGroup = (typeof GROUPS)[number][0];

const DONE: Record<ProgressGroup, ProgressGroup[]> = {
  signup: [],
  profile: ["signup"],
  install: ["signup", "profile"],
  ready: ["signup", "profile", "install", "ready"],
};

export function ProgressTracker({ current }: { current: ProgressGroup }) {
  return (
    <div className="me-progress me-progress--bottom">
      <ol className="me-progress__list">
        {GROUPS.map(([key, label]) => {
          const done = DONE[current].includes(key);
          return (
            <li key={key} className={`me-progress__step${done ? " is-complete" : ""}${current === key ? " is-current" : ""}`} data-progress-step={key}>
              <span className="me-progress__dot">{done ? "✓" : ""}</span>
              <span className="me-progress__label">{label}</span>
            </li>
          );
        })}
      </ol>
      <div className="me-progress__extra">Then: Add Cards and configure more features</div>
      <div className="me-progress-upsell">
        <div className="me-progress-upsell__section">
          <p className="me-progress-upsell__heading">Profile enhancements</p>
          <ul className="me-progress-upsell__list">
            <li>Custom branding &amp; colours</li>
            <li>Pro layouts &amp; themes</li>
            <li>Rich company information</li>
          </ul>
        </div>
        <div className="me-progress-upsell__section">
          <p className="me-progress-upsell__heading">Cards &amp; bundles</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="me-progress-upsell__bundle-img" src="/images/onboarding/custom_bundle_new.png" alt="MeCard custom card bundle" />
        </div>
      </div>
    </div>
  );
}

/** The Astra page title the WordPress sign-up pages showed. */
export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="me-page-title">{children}</h1>;
}

const TEAM_GROUPS = ["Sign up", "Set up your company", "Add your people", "Order cards"];

/** The team path's tracker on the sign-up pages ("For my team"): Sign up is the step they're on. */
export function TeamProgressTracker() {
  return (
    <div className="me-progress me-progress--bottom">
      <ol className="me-progress__list">
        {TEAM_GROUPS.map((label, i) => (
          <li key={label} className={`me-progress__step${i === 0 ? " is-current" : ""}`}>
            <span className="me-progress__dot" />
            <span className="me-progress__label">{label}</span>
          </li>
        ))}
      </ol>
      <div className="me-progress__extra">Your own profile is optional: add yourself whenever you like.</div>
    </div>
  );
}

/** "Just me" or "For my team": the first question on /sign-up/. */
export function SignupChoice() {
  return (
    <div className="me-signup-choice">
      <Link className="me-signup-choice__option" href="/sign-up/?for=me">
        <i className="fa-solid fa-user" aria-hidden="true" />
        <strong>Just me</strong>
        <span>A free digital business card for yourself, set up in a few steps.</span>
      </Link>
      <Link className="me-signup-choice__option" href="/sign-up/?for=teams">
        <i className="fa-solid fa-users" aria-hidden="true" />
        <strong>For my team</strong>
        <span>Your company&rsquo;s branding, a profile for each person and their cards, managed in one place.</span>
      </Link>
    </div>
  );
}
