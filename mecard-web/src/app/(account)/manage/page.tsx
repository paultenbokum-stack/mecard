import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, ConfirmButton, DoneNotice, Pager, Subnav, Thumb, CARD_TYPES } from "@/components/account/Bits";
import { canEditProfile, canManageCard, viewer } from "@/lib/access";
import { LOGOUT } from "@/lib/auth-paths";
import {
  availableProUpgrades,
  cardForActivation,
  hasPendingUpgrade,
  invitesForUser,
  listCompanies,
  listProfiles,
  maskEmail,
  PAGE_SIZE,
  profileChoices,
} from "@/lib/manage";
import { normalizeSlug, isPro } from "@/lib/profile-format";
import { redirect } from "next/navigation";
import { accountState } from "@/lib/onboarding";
import { requireUserId } from "@/lib/session";
import { acceptInviteAction, addProfileAction, archiveProfileAction, linkCardAction } from "./actions";

export const metadata: Metadata = { title: "Manage MeCard" };

type SP = { done?: string; activate?: string; q?: string; page?: string; show?: string };

export default async function ManageHome({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const here = `/manage/${sp.activate ? `?activate=${encodeURIComponent(sp.activate)}` : ""}`;
  const v = await viewer(await requireUserId(here));
  // A brand-new account (no profile, no cards) starts with onboarding.
  if (!sp.activate && (await accountState(v.id)) === "first_time") redirect("/onboarding/");
  const archived = sp.show === "archived";
  const page = Math.max(1, Number(sp.page) || 1);

  const [list, companies, invites, upgrades, pending, activeCount] = await Promise.all([
    listProfiles(v, { archived, q: sp.q, page }),
    listCompanies(v),
    invitesForUser(v.id),
    availableProUpgrades(v.id),
    hasPendingUpgrade(v.id),
    archived || sp.q ? listProfiles(v, { archived: false, page: 1 }).then((r) => r.total) : Promise.resolve(-1),
  ]);
  const totalActive = activeCount >= 0 ? activeCount : list.total;
  const single = !archived && !sp.q && list.total === 1 ? list.rows[0] : null;
  // A paid upgrade that's ready to use beats "waiting for EFT".
  const waitingForEft = pending && upgrades === 0;
  const backUrl = (extra: Record<string, string | number | undefined> = {}) => {
    const u = new URLSearchParams();
    for (const [k, val] of Object.entries({ q: sp.q, show: sp.show, page: page > 1 ? page : undefined, ...extra })) if (val) u.set(k, String(val));
    return `/manage/${u.size ? `?${u}` : ""}`;
  };

  return (
    <div className="acc__wrap">
      <Subnav active="home" />
      <p className="acc__eyebrow">My MeCard Home</p>
      <h1>Manage MeCard</h1>
      <DoneNotice done={sp.done} />

      {sp.activate ? <Activate slug={sp.activate} userId={v.id} isAdmin={v.isAdmin} /> : null}

      {invites.length ? (
        <section className="acc-panel acc-panel--notice">
          <h2>Profiles waiting for you</h2>
          <p>You have been invited to take over {invites.length === 1 ? "this profile" : "these profiles"}:</p>
          <ul className="acc-list">
            {invites.map((i) => (
              <li className="acc-item" key={i.id}>
                <div className="acc-item__main">
                  <div className="acc-item__text">
                    <div className="acc-item__title">{`${i.firstName} ${i.lastName}`.trim() || "Profile"}</div>
                    <div className="acc-item__sub">
                      {[i.companyName, i.inviterName ? `invited by ${i.inviterName}` : ""].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
                <form action={acceptInviteAction} className="acc-item__actions">
                  <input type="hidden" name="invite_id" value={i.id} />
                  <ConfirmButton className="acc-btn acc-btn--small acc-btn--primary">Accept</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {single ? (
        <section className="acc-panel">
          <h2>Manage your profile</h2>
          <div className="acc-item" style={{ border: 0, padding: 0, background: "none" }}>
            <div className="acc-item__main">
              <Avatar path={single.photoPath} />
              <div className="acc-item__text">
                <div className="acc-item__title">
                  {`${single.firstName} ${single.lastName}`.trim() || single.slug}{" "}
                  <span className={`acc-badge${isPro(single) ? " acc-badge--pro" : ""}`}>{isPro(single) ? "Pro" : "Standard"}</span>
                </div>
                <div className="acc-item__sub">{[single.jobTitle, single.companyName].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
          </div>
          {!isPro(single) && waitingForEft ? <p className="acc__muted" style={{ marginTop: 12 }}>Your Pro upgrade is pending — we&rsquo;re just waiting for EFT confirmation.</p> : null}
          <div className="acc-actions">
            <a className="acc-btn" href={`/mecard-profile/${single.slug}/`}>
              View profile
            </a>
            <Link className="acc-btn acc-btn--primary" href={`/manage/profile/${single.id}/`}>
              Edit profile
            </Link>
          </div>
        </section>
      ) : null}

      {single && !isPro(single) && !waitingForEft ? (
        <section className="acc-panel">
          <p className="acc__eyebrow" style={{ marginTop: 0 }}>
            Upgrade to Pro
          </p>
          <h2>Supercharge your profile</h2>
          <ul>
            <li>Customise look and feel to your company branding</li>
            <li>Add company info</li>
            <li>Extra buttons and links</li>
          </ul>
          {upgrades > 0 ? (
            <p>
              You have {upgrades === 1 ? "a Pro upgrade" : `${upgrades} Pro upgrades`} ready to use. <Link href={`/manage/profile/${single.id}/`}>Apply it in the profile editor.</Link>
            </p>
          ) : (
            <>
              <p className="acc-item__title">R199 once off</p>
              <div className="acc-actions">
                <Link className="acc-btn acc-btn--primary" href={`/product/profile-upgrade/?profile_id=${single.id}`}>
                  Get Pro
                </Link>
              </div>
            </>
          )}
        </section>
      ) : null}

      <section className="acc-panel" id="profiles">
        <div className="acc-panel__head">
          <h2>{archived ? "Archived profiles" : single ? "Profiles" : "Your profiles"}</h2>
          <span className="acc__muted">
            {archived ? (
              <Link href="/manage/">Show active profiles</Link>
            ) : (
              <Link href="/manage/?show=archived#profiles">Show archived</Link>
            )}
          </span>
        </div>
        {totalActive > 8 || sp.q ? (
          <form className="acc-toolbar" action="/manage/">
            {archived ? <input type="hidden" name="show" value="archived" /> : null}
            <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Search by name, email, job title or company" aria-label="Search profiles" />
            <button className="acc-btn" type="submit">
              Search
            </button>
            {sp.q ? (
              <Link className="acc-btn" href={archived ? "/manage/?show=archived" : "/manage/"}>
                Clear
              </Link>
            ) : null}
          </form>
        ) : null}
        {list.rows.length ? (
          <ul className="acc-list">
            {list.rows.map((p) => (
              <li className="acc-item" key={p.id}>
                <div className="acc-item__main">
                  <Avatar path={p.photoPath} />
                  <div className="acc-item__text">
                    <div className="acc-item__title">
                      {`${p.firstName} ${p.lastName}`.trim() || p.slug} <span className={`acc-badge${isPro(p) ? " acc-badge--pro" : ""}`}>{isPro(p) ? "Pro" : "Standard"}</span>{" "}
                      {p.ownerId === v.id && p.managerId && p.managerId !== v.id ? <span className="acc-badge">Shared with you</span> : null}
                    </div>
                    <div className="acc-item__sub">{[p.jobTitle, p.companyName].filter(Boolean).join(" · ") || " "}</div>
                  </div>
                </div>
                <div className="acc-item__actions">
                  {!p.archived ? (
                    <>
                      <a className="acc-btn acc-btn--small" href={`/mecard-profile/${p.slug}/`}>
                        View
                      </a>
                      <Link className="acc-btn acc-btn--small acc-btn--primary" href={`/manage/profile/${p.id}/`}>
                        Edit
                      </Link>
                    </>
                  ) : null}
                  <form action={archiveProfileAction}>
                    <input type="hidden" name="profile_id" value={p.id} />
                    <input type="hidden" name="archive" value={p.archived ? "0" : "1"} />
                    <input type="hidden" name="back" value={backUrl()} />
                    <input type="hidden" name="anchor" value="profiles" />
                    {p.archived ? (
                      <ConfirmButton>Restore</ConfirmButton>
                    ) : (
                      <ConfirmButton className="acc-btn acc-btn--small acc-btn--danger" confirm="Archive this profile? Its page and any cards linked to it stop working until you restore it.">
                        Archive
                      </ConfirmButton>
                    )}
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="acc-empty">{sp.q ? "No profiles match your search." : archived ? "No archived profiles." : "You don't have a profile yet. Create one below."}</div>
        )}
        <Pager page={list.page} total={list.total} size={PAGE_SIZE} href={(n) => backUrl({ page: n > 1 ? n : undefined }) + "#profiles"} />

        {!archived ? (
          <details className="acc-details" style={{ marginTop: 16 }} open={list.total === 0 && !sp.q}>
            <summary className="acc-btn">+ Add a profile</summary>
            <form action={addProfileAction} className="acc-form" style={{ marginTop: 14 }}>
              <input type="hidden" name="back" value="/manage/" />
              <div className="acc-grid">
                <div className="acc-field">
                  <label htmlFor="np-first">First name</label>
                  <input id="np-first" name="first_name" type="text" required maxLength={100} />
                </div>
                <div className="acc-field">
                  <label htmlFor="np-last">Last name</label>
                  <input id="np-last" name="last_name" type="text" maxLength={100} />
                </div>
                <div className="acc-field">
                  <label htmlFor="np-job">Job title</label>
                  <input id="np-job" name="job_title" type="text" maxLength={200} />
                </div>
                <div className="acc-field">
                  <label htmlFor="np-email">Email address</label>
                  <input id="np-email" name="email" type="email" maxLength={255} />
                </div>
              </div>
              {companies.length ? (
                <div className="acc-field">
                  <label htmlFor="np-company">Company</label>
                  <select id="np-company" name="company_id" defaultValue="">
                    <option value="">None — a profile for myself</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="acc-field__hint">Company profiles are Pro and use the company&rsquo;s branding. Invite the person from the company&rsquo;s Team tab so they can take it over.</span>
                </div>
              ) : null}
              <div>
                <ConfirmButton className="acc-btn acc-btn--primary">Create profile</ConfirmButton>
              </div>
            </form>
          </details>
        ) : null}
      </section>

      <section className="acc-panel">
        <h2>Cards and companies</h2>
        <p>Link your cards and tags to profiles, and set up company branding for your team.</p>
        <div className="acc-actions">
          <Link className="acc-btn acc-btn--primary" href="/manage/cards/">
            My cards
          </Link>
          <Link className="acc-btn" href="/manage/companies/">
            {companies.length ? `Companies (${companies.length})` : "Create a team"}
          </Link>
          <Link className="acc-btn" href="/shop/">
            Order cards
          </Link>
        </div>
      </section>
    </div>
  );
}

/** "Activate this card": the unlinked-card page sends people here with the card's slug. */
async function Activate({ slug, userId, isAdmin }: { slug: string; userId: number; isAdmin: boolean }) {
  const card = await cardForActivation(normalizeSlug(slug));
  const v = { id: userId, isAdmin };
  if (!card || card.archived)
    return (
      <section className="acc-panel acc-panel--error">
        <h2>Card not found</h2>
        <p style={{ marginBottom: 0 }}>We couldn&rsquo;t find a card at /t/{slug}/. Check the address on the card, or contact us for help.</p>
      </section>
    );
  const type = CARD_TYPES[card.type] ?? "Card";
  if (!(await canManageCard(v, card.id)))
    return (
      <section className="acc-panel acc-panel--notice">
        <h2>Activate this {type.toLowerCase()}</h2>
        <p>
          This card is registered to {maskEmail(card.ownerEmail)}. <Link href={LOGOUT}>Log out</Link> and sign in with that account to link it to a profile.
        </p>
        <p className="acc__muted" style={{ marginBottom: 0 }}>
          Bought it for someone else? Ask whoever placed the order to link it, or <Link href="/contact-us/">contact us</Link>.
        </p>
      </section>
    );
  const choices = await profileChoices(v);
  const current = card.profileId && (await canEditProfile(v, card.profileId)) ? choices.find((p) => p.id === card.profileId) : null;
  return (
    <section className="acc-panel acc-panel--notice" id="activate">
      <h2>{card.profileId ? `Change the profile on this ${type.toLowerCase()}` : `Activate this ${type.toLowerCase()}`}</h2>
      <div className="acc-item" style={{ marginBottom: 12 }}>
        <div className="acc-item__main">
          <Thumb path={card.frontPath} />
          <div className="acc-item__text">
            <div className="acc-item__title">{card.label || type}</div>
            <div className="acc-item__sub">
              /t/{card.slug}/{current ? ` · now opens ${`${current.firstName} ${current.lastName}`.trim()}` : ""}
            </div>
          </div>
        </div>
      </div>
      {choices.length ? (
        <form action={linkCardAction} className="acc-inline-form">
          <input type="hidden" name="card_id" value={card.id} />
          <input type="hidden" name="back" value="/manage/cards/" />
          <select name="profile_id" defaultValue={card.profileId ?? choices[0].id} aria-label="Profile to open when the card is tapped">
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {`${p.firstName} ${p.lastName}`.trim() || p.slug}
                {p.companyName ? ` — ${p.companyName}` : ""}
              </option>
            ))}
          </select>
          <ConfirmButton className="acc-btn acc-btn--primary">{card.profileId ? "Change profile" : "Link card to profile"}</ConfirmButton>
        </form>
      ) : (
        <p style={{ marginBottom: 0 }}>Create your profile first (below), then come back to this card&rsquo;s link to activate it.</p>
      )}
    </section>
  );
}
