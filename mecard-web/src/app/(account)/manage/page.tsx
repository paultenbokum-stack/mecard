import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, ConfirmButton, DoneNotice, Pager, ProPendingBadge, Subnav, NewTab } from "@/components/account/Bits";
import { viewer } from "@/lib/access";
import {
  invitesForUser,
  listCompanies,
  hasPendingUpgrade,
  listProfiles,
  PAGE_SIZE,
  pendingProUpgrades,
} from "@/lib/manage";
import { isPro } from "@/lib/profile-format";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accountState } from "@/lib/onboarding";
import { requireUserId } from "@/lib/session";
import { TeamPrompt } from "@/components/account/TeamPrompt";
import { teamPromptCookie, teamWelcomeCookie } from "@/lib/upsell-rules";
import { teamProgress } from "@/lib/team-progress";
import { TeamWelcome } from "@/components/account/TeamWelcome";
import { BundleJourney, UpgradeButton } from "@/components/account/Upsells";
import { loadUpsells } from "@/lib/upsells";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { manageViewFor } from "@/lib/manage-view";
import { SingleHome } from "./SingleHome";
import { archiveProfileAction, backToIndividualAction } from "./actions";
import { InvitesPanel } from "./InvitesPanel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await manageViewFor()).view === "single" ? "My MeCard Home" : "Profiles" };
}

type SP = { done?: string; activate?: string; q?: string; page?: string; show?: string };

export default async function ManageHome({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const here = `/manage/${sp.activate ? `?activate=${encodeURIComponent(sp.activate)}` : ""}`;
  const v = await viewer(await requireUserId(here));
  // A brand-new account (no profile, no cards) starts with onboarding.
  if (!sp.activate && (await accountState(v.id)) === "first_time") redirect("/onboarding/");
  // Activating a card happens on My Cards now; old links (the unlinked-card page, emails) still land here.
  if (sp.activate) redirect(`/manage/cards/?activate=${encodeURIComponent(sp.activate)}#activate`);
  // One profile of their own: WordPress's single "My MeCard Home" instead of the team dashboard.
  const mv = await manageViewFor(v.id);
  if (mv.view === "single" && mv.profileId) {
    const [[profile], u, invites] = await Promise.all([
      db.select({ id: profiles.id, slug: profiles.slug, firstName: profiles.firstName, lastName: profiles.lastName, type: profiles.type }).from(profiles).where(eq(profiles.id, mv.profileId)),
      loadUpsells(v),
      invitesForUser(v.id),
    ]);
    return <SingleHome v={v} profile={profile} u={u} done={sp.done} invites={invites} />;
  }
  const archived = sp.show === "archived";
  const page = Math.max(1, Number(sp.page) || 1);

  const jar = await cookies();
  const welcome = jar.has(teamWelcomeCookie(v.id));
  const [list, companies, invites, u, activeCount, progress] = await Promise.all([
    listProfiles(v, { archived, q: sp.q, page }),
    listCompanies(v),
    invitesForUser(v.id),
    loadUpsells(v),
    archived || sp.q ? listProfiles(v, { archived: false, page: 1 }).then((r) => r.total) : Promise.resolve(-1),
    welcome ? teamProgress(v.id) : null,
  ]);
  const totalActive = activeCount >= 0 ? activeCount : list.total;
  // Upgrades ordered for a profile but not paid yet: Pro is unlocked in the editor, the card stays standard.
  // An upgrade ordered for no particular profile (an EFT bundle) hides the per-profile Upgrade, as before.
  const [proPending, unassignedPending] = await Promise.all([
    pendingProUpgrades(list.rows.filter((p) => !isPro(p)).map((p) => p.id), v.id),
    hasPendingUpgrade(v.id, { unassignedOnly: true }),
  ]);
  // The list as it is now (search, page), for the profile editor to come back to.
  const listQs = new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(page > 1 ? { page: String(page) } : {}) }).toString();
  const editHref = (id: number) => `/manage/profile/${id}/${listQs ? `?back=${encodeURIComponent(`/manage/?${listQs}`)}` : ""}`;
  const backUrl = (extra: Record<string, string | number | undefined> = {}) => {
    const u = new URLSearchParams();
    for (const [k, val] of Object.entries({ q: sp.q, show: sp.show, page: page > 1 ? page : undefined, ...extra })) if (val) u.set(k, String(val));
    return `/manage/${u.size ? `?${u}` : ""}`;
  };

  return (
    <div className="acc__wrap">
      <Subnav active="home" />
      <div className="acc-pagehead">
        <h1>Profiles</h1>
        <Link className="acc-btn acc-btn--primary" href="/manage/profile/new/" scroll={false}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Add new profile
        </Link>
      </div>
      <DoneNotice done={sp.done} />
      {progress ? <TeamWelcome userId={v.id} progress={progress} /> : null}

      <InvitesPanel invites={invites} />

      <BundleJourney u={u} />
      {u.eftPending && !proPending.size ? <div className="acc-panel acc-panel--notice">Your Pro upgrade is pending &mdash; we&rsquo;re just waiting for EFT confirmation.</div> : null}

      <section className="acc-panel" id="profiles">
        <div className="acc-panel__head">
          <h2>{archived ? "Archived profiles" : "Your profiles"}</h2>
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
                      {`${p.firstName} ${p.lastName}`.trim() || p.slug} {proPending.has(p.id) ? <ProPendingBadge /> : <span className={`acc-badge${isPro(p) ? " acc-badge--pro" : ""}`}>{isPro(p) ? "Pro" : "Standard"}</span>}{" "}
                      {p.ownerId === v.id && p.managerId && p.managerId !== v.id ? <span className="acc-badge">Shared with you</span> : null}
                    </div>
                    <div className="acc-item__sub">{[p.jobTitle, p.companyName].filter(Boolean).join(" · ") || " "}</div>
                  </div>
                </div>
                <div className="acc-item__actions">
                  {!p.archived ? (
                    <>
                      <a className="acc-btn acc-btn--small" href={`/mecard-profile/${p.slug}/`} target="_blank" rel="noopener">
                        View <NewTab />
                      </a>
                      <Link className="acc-btn acc-btn--small acc-btn--primary" href={editHref(p.id)} scroll={false}>
                        Edit
                      </Link>
                      {proPending.get(p.id)?.payHref ? (
                        <Link className="acc-btn acc-btn--small acc-btn--cta" href={proPending.get(p.id)!.payHref!}>
                          Pay now
                        </Link>
                      ) : !isPro(p) && !proPending.has(p.id) && !u.journey && !u.upgradesReady && !unassignedPending ? (
                        <UpgradeButton profileId={p.id} />
                      ) : null}
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
          <div className="acc-empty">{sp.q ? "No profiles match your search." : archived ? "No archived profiles." : "You don't have a profile yet. Use Add new profile to create one."}</div>
        )}
        <Pager page={list.page} total={list.total} size={PAGE_SIZE} href={(n) => backUrl({ page: n > 1 ? n : undefined }) + "#profiles"} />

      </section>

      {totalActive >= 2 && !companies.length && !archived && !welcome && !jar.has(teamPromptCookie(v.id)) ? <TeamPrompt userId={v.id} /> : null}

      {mv.canGoIndividual ? (
        <form action={backToIndividualAction} className="acc__muted acc-individual-switch">
          Just managing your own card?{" "}
          <button type="submit" className="acc-link">
            Back to individual view
          </button>
        </form>
      ) : null}
    </div>
  );
}
