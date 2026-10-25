import Link from "next/link";
import { CARD_TYPES, ConfirmButton, DoneNotice, NewTab, ProPendingNote, Subnav, Thumb } from "@/components/account/Bits";
import { BundleJourney, BundleOffer, CardOffer, ClassicCardPreview, ProUpsell } from "@/components/account/Upsells";
import type { Viewer } from "@/lib/access";
import { cardProgress } from "@/lib/card-tabs";
import { listCards, pendingProUpgrades, type invitesForUser } from "@/lib/manage";
import { isPro } from "@/lib/profile-format";
import type { Upsells } from "@/lib/upsells";
import { InvitesPanel } from "./InvitesPanel";
import { switchToTeamsAction } from "./actions";

// The single view of /manage/ (one profile of your own, manageViewFor):
// WordPress's "My MeCard Home" (class-me-single-manage.php) in its wording and
// order. Adding another profile or setting up a company moves the user to the
// team view (Profiles, My Cards, Companies).

type Profile = { id: number; slug: string; firstName: string; lastName: string; type: string };

export async function SingleHome({ v, profile, u, done, invites }: { v: Viewer; profile: Profile; u: Upsells; done?: string; invites: Awaited<ReturnType<typeof invitesForUser>> }) {
  const [[basket, progress, live], pendingMap] = await Promise.all([
    Promise.all((["design", "progress", "live"] as const).map((tab) => listCards(v, { tab }))),
    pendingProUpgrades([profile.id], v.id),
  ]);
  const current = [
    ...basket.rows.slice(0, 3).map((c) => ({ c, stage: c.inBasket ? "In basket" : "Awaiting design" })),
    ...progress.rows.slice(0, 3).map((c) => ({ c, stage: cardProgress(c) })),
    ...live.rows.slice(0, 3).map((c) => ({ c, stage: "Live" })),
  ];
  const pro = isPro(profile);
  const proPending = pro ? undefined : pendingMap.get(profile.id);
  const editHref = "/manage/my-profile/";

  return (
    <div className="acc__wrap">
      <Subnav active="home" />
      <header className="acc-single__head">
        <p className="acc__eyebrow">My MeCard Home</p>
        <h1>Manage MeCard</h1>
        <p className="acc__lead">
          {pro
            ? "Your Pro profile is live and ready whenever you need it."
            : proPending
              ? "Your profile is live. Your Pro upgrade goes live as soon as it is paid."
              : "Your free profile is live and ready whenever you need it."}
        </p>
      </header>
      <DoneNotice done={done} />
      <InvitesPanel invites={invites} />

      <section className="acc-panel">
        <h2>Manage your profile</h2>
        <p>Open your live profile or jump straight into the inline editor.</p>
        {proPending ? (
          <ProPendingNote pending={proPending} />
        ) : !pro && u.eftPending ? (
          <p className="acc-panel acc-panel--notice">Your Pro upgrade is pending &mdash; we&rsquo;re just waiting for EFT confirmation.</p>
        ) : null}
        <div className="acc-actions">
          <a className="acc-btn" href={`/mecard-profile/${profile.slug}/`} target="_blank" rel="noopener">
            View profile <NewTab />
          </a>
          <Link className="acc-btn acc-btn--primary" href={editHref}>
            {u.journey ? "Continue profile setup" : "Edit profile"}
          </Link>
        </div>
      </section>

      {u.journey ? (
        <BundleJourney u={u} />
      ) : current.length ? (
        <>
          <ProUpsell u={u} />
          <section className="acc-panel">
            <h2>Your current cards</h2>
            <p>These cards are already in your basket, in progress, or live.</p>
            <ul className="acc-single__cards">
              {current.map(({ c, stage }) => (
                <li key={c.id}>
                  {c.type === "classiccard" ? (
                    <ClassicCardPreview logo={c.frontPath} name={c.nameOnCard || c.profileName || ""} jobTitle={c.jobTitleOnCard} />
                  ) : (
                    <Thumb path={c.frontPath} />
                  )}
                  <div className="acc-item__title">
                    {c.label || CARD_TYPES[c.type] || "Card"} <span className="acc-badge">{stage}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="acc-actions">
              {u.basketLines ? (
                <Link className="acc-btn acc-btn--cta" href="/checkout/">
                  Checkout
                </Link>
              ) : null}
              <Link className="acc-btn" href="/manage/cards/">
                Manage cards
              </Link>
            </div>
          </section>
          <BundleOffer u={u} />
          <CardOffer u={u} />
        </>
      ) : (
        <>
          <BundleOffer u={u} />
          <ProUpsell u={u} />
          <CardOffer u={u} />
        </>
      )}

      <section className="acc-panel">
        <p className="acc-upsell__kicker">For teams</p>
        <h2>Managing cards for a team?</h2>
        <p>Set up company branding, assign profiles to colleagues, and manage everything centrally from the team dashboard.</p>
        <form action={switchToTeamsAction} className="acc-actions">
          <ConfirmButton className="acc-btn">Switch to teams</ConfirmButton>
        </form>
        <p className="acc__muted" style={{ marginBottom: 0 }}>
          Your profile comes with you: it&rsquo;s the first one on your team dashboard, next to My Cards and Companies.
        </p>
      </section>
    </div>
  );
}
