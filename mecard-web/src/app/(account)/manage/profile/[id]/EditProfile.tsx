import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConfirmButton, DoneNotice, NewTab, ProPendingBadge, ProPendingNote } from "@/components/account/Bits";
import { ProfileEditor } from "@/components/account/ProfileEditor";
import { UpsellSeen } from "@/components/account/Upsells";
import { canEditProfile, canManageCompany, viewer } from "@/lib/access";
import { PRODUCT } from "@/lib/catalog";
import { availableProUpgrades, hasPendingUpgrade, pendingProUpgrades } from "@/lib/manage";
import { productPriceWords } from "@/lib/product-prices";
import { isPro } from "@/lib/profile-format";
import { displayName, getProfileView } from "@/lib/public-profile";
import { requireUserId } from "@/lib/session";
import { accountCompaniesForProfile } from "@/lib/profile-edit";
import { applyUpgradeAction, linkCompanyAction, setupCompanyAction, startProUpgradeAction } from "../../editor-actions";

/** The profile editor and what is loaded for it; the page and the /manage/ modal both show it. */
export async function loadProfileEditor(id: string) {
  const profileId = Number(id);
  if (!Number.isInteger(profileId) || profileId <= 0) notFound();
  const v = await viewer(await requireUserId(`/manage/profile/${profileId}/`));
  if (!(await canEditProfile(v, profileId))) redirect("/manage/?done=denied");
  const view = await getProfileView(profileId);
  if (!view) notFound();
  const p = view.profile;
  const pro = isPro(p);
  const payers = [...new Set([v.id, p.ownerId, p.managerId].filter((x): x is number => !!x))];
  const [upgrades, pending, proPending, manageCompany] = await Promise.all([
    pro ? 0 : Promise.all(payers.map(availableProUpgrades)).then((n) => n.reduce((a, b) => a + b, 0)),
    pro ? false : hasPendingUpgrade(p.ownerId ?? v.id, { unassignedOnly: true }),
    pro ? undefined : pendingProUpgrades([p.id], v.id).then((m) => m.get(p.id)),
    view.company ? canManageCompany(v, view.company.id) : Promise.resolve(false),
  ]);
  // A profile with no company is offered the companies its account already has before a new one.
  const accountCompanies = view.company ? [] : await accountCompaniesForProfile(p.id);
  const proPrice = (await productPriceWords())[PRODUCT.proUpgrade];
  return { view, pro, upgrades, pending, proPending, manageCompany, accountCompanies, name: displayName(p), proPrice };
}

export function ProfileBadge({ pro, pending }: { pro: boolean; pending?: boolean }) {
  if (!pro && pending) return <ProPendingBadge />;
  return <span className={`acc-badge${pro ? " acc-badge--pro" : ""}`}>{pro ? "Pro" : "Standard"}</span>;
}

/**
 * The company step for a profile with no company: the account's own companies
 * to use, then a new one. With none, just the button to set one up.
 */
export function CompanyChoice({ profileId, companies, next, newLabel }: { profileId: number; companies: { id: number; name: string }[]; next?: string; newLabel: string }) {
  const setup = (
    <form action={setupCompanyAction}>
      <input type="hidden" name="profile_id" value={profileId} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <ConfirmButton className={`acc-btn${companies.length ? "" : " acc-btn--primary"}`}>{companies.length ? "Set up a new company" : newLabel}</ConfirmButton>
    </form>
  );
  if (!companies.length) return setup;
  return (
    <>
      <p>Use one of your companies, so this card shares its logo, colours and details:</p>
      <ul className="acc-company-choice">
        {companies.map((c) => (
          <li key={c.id}>
            <form action={linkCompanyAction}>
              <input type="hidden" name="profile_id" value={profileId} />
              <input type="hidden" name="company_id" value={c.id} />
              {next ? <input type="hidden" name="next" value={next} /> : null}
              <ConfirmButton className="acc-btn acc-btn--primary">Use {c.name}</ConfirmButton>
            </form>
          </li>
        ))}
      </ul>
      <p className="acc__muted">Or start a separate company for this card.</p>
      {setup}
    </>
  );
}

export function EditProfile({ data, done }: { data: Awaited<ReturnType<typeof loadProfileEditor>>; done?: string }) {
  const { view, pro, upgrades, pending, proPending, manageCompany, accountCompanies, proPrice } = data;
  // Ordered but not paid: Pro is unlocked here, the public card stays standard.
  const proEditing = pro || !!proPending;
  const p = view.profile;
  return (
    <>
      <p className="acc__lead">
        Changes show on your card as soon as you save. <a href={`/mecard-profile/${p.slug}/`} target="_blank" rel="noopener">View your live profile <NewTab /></a>
        {p.archived ? " (archived: it isn't public until you restore it under Profiles)" : ""}.
      </p>
      <DoneNotice done={done} />

      {proPending ? <ProPendingNote pending={proPending} editing /> : null}

      <ProfileEditor key={p.id} initial={view} pro={proEditing} pendingPayment={!!proPending}>
        {proEditing ? (
          <section className="acc-panel">
            <h2>Company</h2>
            {view.company ? (
              manageCompany ? (
                <>
                  <p>
                    Your card uses the branding, contact details and buttons of <strong>{view.company.name}</strong>.
                  </p>
                  <Link className="acc-btn acc-btn--primary" href={`/manage/company/${view.company.id}/`}>
                    Edit company and branding
                  </Link>
                </>
              ) : (
                <p style={{ marginBottom: 0 }}>
                  Your card uses the branding of <strong>{view.company.name}</strong>, which your team admin manages.
                </p>
              )
            ) : (
              <>
                <p>Add your company&rsquo;s logo, colours, fonts, address and buttons to your card.</p>
                <CompanyChoice profileId={p.id} companies={accountCompanies} newLabel="Set up company branding" />
              </>
            )}
          </section>
        ) : (
          <section className="acc-panel">
            <p className="acc__eyebrow" style={{ marginTop: 0 }}>
              Upgrade to Pro
            </p>
            <h2>All standard features, plus</h2>
            <ul>
              <li>Your company logo, colours and fonts</li>
              <li>Company details: address, website, office number</li>
              <li>Extra buttons and links</li>
              <li>No MeCard branding when you share</li>
            </ul>
            {upgrades > 0 ? (
              <form action={applyUpgradeAction}>
                <input type="hidden" name="profile_id" value={p.id} />
                <p>You have {upgrades === 1 ? "a paid Pro upgrade" : `${upgrades} paid Pro upgrades`} ready to use.</p>
                <ConfirmButton className="acc-btn acc-btn--cta" confirm="Use a Pro upgrade on this profile?">
                  Apply my Pro upgrade
                </ConfirmButton>
              </form>
            ) : pending ? (
              <p style={{ marginBottom: 0 }}>Your Pro upgrade is pending &mdash; we&rsquo;re just waiting for EFT confirmation.</p>
            ) : (
              <>
                {proPrice ? <p className="acc-item__title">{proPrice} once off</p> : null}
                <UpsellSeen offer="pro" placement="profile_editor" profileId={p.id} />
                <form action={startProUpgradeAction}>
                  <input type="hidden" name="profile_id" value={p.id} />
                  <input type="hidden" name="placement" value="profile_editor" />
                  <ConfirmButton className="acc-btn acc-btn--cta">Upgrade to Pro</ConfirmButton>
                </form>
                <p className="acc__muted" style={{ marginBottom: 0 }}>
                  Set up your Pro profile straight away and pay when you&rsquo;re ready. Your public card switches to Pro once payment is received.
                </p>
              </>
            )}
          </section>
        )}
      </ProfileEditor>
    </>
  );
}
