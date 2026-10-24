import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConfirmButton, DoneNotice } from "@/components/account/Bits";
import { ProfileEditor } from "@/components/account/ProfileEditor";
import { canEditProfile, canManageCompany, viewer } from "@/lib/access";
import { availableProUpgrades, hasPendingUpgrade } from "@/lib/manage";
import { isPro } from "@/lib/profile-format";
import { displayName, getProfileView } from "@/lib/public-profile";
import { requireUserId } from "@/lib/session";
import { applyUpgradeAction, setupCompanyAction } from "../../editor-actions";

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
  const [upgrades, pending, manageCompany] = await Promise.all([
    pro ? 0 : Promise.all(payers.map(availableProUpgrades)).then((n) => n.reduce((a, b) => a + b, 0)),
    pro ? false : hasPendingUpgrade(p.ownerId ?? v.id),
    view.company ? canManageCompany(v, view.company.id) : Promise.resolve(false),
  ]);
  return { view, pro, upgrades, pending, manageCompany, name: displayName(p) };
}

export function ProfileBadge({ pro }: { pro: boolean }) {
  return <span className={`acc-badge${pro ? " acc-badge--pro" : ""}`}>{pro ? "Pro" : "Standard"}</span>;
}

export function EditProfile({ data, done }: { data: Awaited<ReturnType<typeof loadProfileEditor>>; done?: string }) {
  const { view, pro, upgrades, pending, manageCompany } = data;
  const p = view.profile;
  return (
    <>
      <p className="acc__lead">
        Changes show on your card as soon as you save. <a href={`/mecard-profile/${p.slug}/`}>View your live profile</a>
        {p.archived ? " (archived: it isn't public until you restore it under Profiles)" : ""}.
      </p>
      <DoneNotice done={done} />

      <ProfileEditor key={p.id} initial={view} pro={pro}>
        {pro ? (
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
                <form action={setupCompanyAction}>
                  <input type="hidden" name="profile_id" value={p.id} />
                  <ConfirmButton className="acc-btn acc-btn--primary">Set up company branding</ConfirmButton>
                </form>
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
                <p className="acc-item__title">R199 once off</p>
                <Link className="acc-btn acc-btn--cta" href={`/product/profile-upgrade/?profile_id=${p.id}`}>
                  Upgrade to Pro
                </Link>
              </>
            )}
          </section>
        )}
      </ProfileEditor>
    </>
  );
}
