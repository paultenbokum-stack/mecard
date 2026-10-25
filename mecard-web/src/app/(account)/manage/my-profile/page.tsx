import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmButton, DoneNotice, ProPendingNote, Subnav } from "@/components/account/Bits";
import { CompanyEditor } from "@/components/account/CompanyEditor";
import { ProfileEditor } from "@/components/account/ProfileEditor";
import { UpsellSeen } from "@/components/account/Upsells";
import { COLOUR_FIELDS, FONT_CHOICES, ICON_CHOICES } from "@/lib/company-edit";
import { manageViewFor } from "@/lib/manage-view";
import { requireUserId } from "@/lib/session";
import { applyUpgradeAction, setupCompanyAction, startProUpgradeAction } from "../editor-actions";
import { loadProfileEditor, ProfileBadge } from "../profile/[id]/EditProfile";

export const metadata: Metadata = { title: "Edit profile" };

// The single view's profile editor (one profile of your own): a page of its
// own, not the Profiles list's modal, in two steps. 1. Your details;
// 2. Look and feel, the company logo, colours, fonts and buttons, edited right
// here. A standard profile sees step 2 locked behind Upgrade to Pro, which
// unlocks it at once (the upgrade waits in the basket to be paid).

const HERE = "/manage/my-profile/";
const STEPS = [
  ["details", "Your details"],
  ["look", "Look and feel"],
] as const;
type Step = (typeof STEPS)[number][0];

export default async function MyProfileWizard({ searchParams }: { searchParams: Promise<{ step?: string; done?: string }> }) {
  const sp = await searchParams;
  const userId = await requireUserId(HERE);
  const { view, profileId } = await manageViewFor(userId);
  if (view !== "single" || !profileId) redirect("/manage/");
  const data = await loadProfileEditor(String(profileId));
  const step: Step = sp.step === "look" ? "look" : "details";
  const p = data.view.profile;
  const proEditing = data.pro || !!data.proPending;

  return (
    <div className="acc__wrap acc__wrap--wide">
      <Subnav active="profile" />
      <p className="acc__eyebrow">Edit profile</p>
      <h1>
        {data.name} <ProfileBadge pro={data.pro} pending={!!data.proPending} />
      </h1>
      <ol className="acc-steps" aria-label="Profile setup">
        {STEPS.map(([key, label], i) => (
          <li key={key} className={key === step ? "is-current" : i < STEPS.findIndex(([k]) => k === step) ? "is-done" : undefined}>
            <Link href={key === "details" ? HERE : `${HERE}?step=${key}`} aria-current={key === step ? "step" : undefined}>
              <span className="acc-steps__num">{i + 1}</span> {label}
              {key === "look" && !proEditing ? <span className="acc-badge">Pro</span> : null}
            </Link>
          </li>
        ))}
      </ol>
      <DoneNotice done={sp.done} />
      {data.proPending ? <ProPendingNote pending={data.proPending} editing /> : null}

      {step === "details" ? (
        <>
          <p className="acc__lead">
            Start with your own details. <a href={`/mecard-profile/${p.slug}/`} target="_blank" rel="noopener">View your live profile</a>
            {p.archived ? " (archived: it isn't public until you restore it)" : ""}.
          </p>
          <ProfileEditor key={p.id} initial={data.view} pro={proEditing} pendingPayment={!!data.proPending} wizard={{ next: { href: `${HERE}?step=look`, label: "Next: look and feel" } }} />
        </>
      ) : (
        <LookAndFeel data={data} proEditing={proEditing} />
      )}
    </div>
  );
}

const FINISH = { href: "/manage/?done=profile-saved", label: "Finish" };
const BACK = { href: HERE, label: "Your details" };

function LookAndFeel({ data, proEditing }: { data: Awaited<ReturnType<typeof loadProfileEditor>>; proEditing: boolean }) {
  const { view, upgrades, pending, manageCompany } = data;
  const p = view.profile;
  const next = `${HERE}?step=look`;

  if (!proEditing) {
    return (
      <>
        <section className="acc-panel">
          <p className="acc__eyebrow" style={{ marginTop: 0 }}>
            Pro
          </p>
          <h2>Make your card look like your company</h2>
          <ul>
            <li>Your company logo, colours and fonts</li>
            <li>Company details: address, website, office number</li>
            <li>Extra buttons and links</li>
            <li>No MeCard branding when you share</li>
          </ul>
          {upgrades > 0 ? (
            <form action={applyUpgradeAction}>
              <input type="hidden" name="profile_id" value={p.id} />
              <input type="hidden" name="next" value={next} />
              <p>You have {upgrades === 1 ? "a paid Pro upgrade" : `${upgrades} paid Pro upgrades`} ready to use.</p>
              <ConfirmButton className="acc-btn acc-btn--primary" confirm="Use a Pro upgrade on this profile?">
                Apply my Pro upgrade
              </ConfirmButton>
            </form>
          ) : pending ? (
            <p style={{ marginBottom: 0 }}>Your Pro upgrade is pending &mdash; we&rsquo;re just waiting for EFT confirmation.</p>
          ) : (
            <>
              <p className="acc-item__title">R199 once off</p>
              <UpsellSeen offer="pro" placement="look_and_feel" trigger="step_locked" profileId={p.id} />
              <form action={startProUpgradeAction}>
                <input type="hidden" name="profile_id" value={p.id} />
                <input type="hidden" name="next" value={next} />
                <input type="hidden" name="placement" value="look_and_feel" />
                <ConfirmButton className="acc-btn acc-btn--primary">Upgrade to Pro</ConfirmButton>
              </form>
              <p className="acc__muted" style={{ marginBottom: 0 }}>
                Set up your look and feel straight away and pay when you&rsquo;re ready. Your public card switches to Pro once payment is received.
              </p>
            </>
          )}
        </section>
        <StepButtons />
      </>
    );
  }

  if (!view.company) {
    return (
      <>
        <section className="acc-panel">
          <h2>Set up your look and feel</h2>
          <p>Add your company&rsquo;s logo, colours, fonts, address and buttons to your card. You can change them any time.</p>
          <form action={setupCompanyAction}>
            <input type="hidden" name="profile_id" value={p.id} />
            <input type="hidden" name="next" value={next} />
            <ConfirmButton className="acc-btn acc-btn--primary">Start designing</ConfirmButton>
          </form>
        </section>
        <StepButtons />
      </>
    );
  }

  if (!manageCompany) {
    return (
      <>
        <section className="acc-panel">
          <h2>Look and feel</h2>
          <p style={{ marginBottom: 0 }}>
            Your card uses the branding of <strong>{view.company.name}</strong>, which your team admin manages.
          </p>
        </section>
        <StepButtons primary />
      </>
    );
  }

  return (
    <>
      <p className="acc__lead">Your company&rsquo;s logo, colours, fonts and buttons. The preview shows your card as it will look with Pro.</p>
      <CompanyEditor
        sample={{ ...view, company: view.company }}
        fonts={FONT_CHOICES}
        colours={COLOUR_FIELDS}
        icons={ICON_CHOICES}
        sampleLabel="Preview on your profile."
        wizard={{ back: BACK, next: FINISH }}
      />
    </>
  );
}

/** primary: Finish is the step's main button (nothing else on it is). */
function StepButtons({ primary }: { primary?: boolean }) {
  return (
    <div className="acc-actions">
      <Link className="acc-btn" href={BACK.href}>
        &larr; {BACK.label}
      </Link>
      <Link className={`acc-btn${primary ? " acc-btn--primary" : ""}`} href={FINISH.href}>
        {FINISH.label}
      </Link>
    </div>
  );
}
