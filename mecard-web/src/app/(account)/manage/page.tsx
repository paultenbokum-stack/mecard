import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, CARD_TYPES, ConfirmButton, DoneNotice, Pager, ProPendingBadge, Subnav } from "@/components/account/Bits";
import { LinkedCards, ProfileMenu, QrIcon } from "@/components/account/ProfileMenu";
import { imageUrl } from "@/lib/images/paths";
import { invitesForProfiles } from "@/lib/invites";
import { viewer } from "@/lib/access";
import {
  invitesForUser,
  listCards,
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
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, profiles, users } from "@/db/schema";
import { manageViewFor } from "@/lib/manage-view";
import { SingleHome } from "./SingleHome";
import { addMyselfAction, archiveProfileAction, backToIndividualAction } from "./actions";
import { TeamEmpty } from "@/components/account/TeamEmpty";
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
  const ownerIds = [...new Set(list.rows.map((p) => p.ownerId).filter((o): o is number => !!o && o !== v.id))];
  const [proPending, unassignedPending, inviteRows, ownerRows, unlinked, linkedRows] = await Promise.all([
    pendingProUpgrades(list.rows.filter((p) => !isPro(p)).map((p) => p.id), v.id),
    hasPendingUpgrade(v.id, { unassignedOnly: true }),
    invitesForProfiles(list.rows.map((p) => p.id)),
    ownerIds.length ? db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, ownerIds)) : Promise.resolve([]),
    archived ? Promise.resolve({ rows: [] }) : listCards(v, { tab: "unassigned", page: 1 }),
    list.rows.length
      ? db
          .select({ id: cards.id, slug: cards.slug, type: cards.type, label: cards.label, frontPath: cards.frontPath, profileId: cards.profileId })
          .from(cards)
          .where(and(inArray(cards.profileId, list.rows.map((p) => p.id)), eq(cards.archived, false)))
          .orderBy(asc(cards.id))
      : Promise.resolve([]),
  ]);
  const linkedCards = Map.groupBy(linkedRows, (c) => c.profileId!);
  // For each profile's menu (WordPress's dropdown): who owns it, its open invite, and cards to assign.
  const owners = new Map(ownerRows.map((o) => [o.id, o.email]));
  const openInvite = (profileId: number) => {
    const i = inviteRows.find((r) => r.profileId === profileId && r.status === "pending");
    return i ? { id: i.id, email: i.email, sent: i.createdAt.toLocaleDateString("en-ZA") } : null;
  };
  const freeCards = unlinked.rows.map((c) => ({ id: c.id, label: `${c.label || CARD_TYPES[c.type] || "Card"} (/t/${c.slug}/)` }));
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
              <li className="acc-item" key={p.id} id={`p${p.id}`}>
                <div className="acc-item__main">
                  <Avatar path={p.photoPath} />
                  <div className="acc-item__text">
                    <div className="acc-item__title">
                      {`${p.firstName} ${p.lastName}`.trim() || p.slug} {proPending.has(p.id) ? <ProPendingBadge /> : <span className={`acc-badge${isPro(p) ? " acc-badge--pro" : ""}`}>{isPro(p) ? "Pro" : "Standard"}</span>}{" "}
                      {p.ownerId === v.id && p.managerId && p.managerId !== v.id ? <span className="acc-badge">Shared with you</span> : null}
                    </div>
                    {/* WordPress's profile card: email, mobile and the linked company. */}
                    <div className="acc-item__sub">{p.email}</div>
                    <div className="acc-item__sub">{p.mobile}</div>
                    <div className="acc-item__sub">{p.companyId && p.companyRecord ? p.companyRecord : <i>No linked company</i>}</div>
                  </div>
                </div>
                <div className="acc-item__actions">
                  {!p.archived ? (
                    <>
                      {proPending.get(p.id)?.payHref ? (
                        <Link className="acc-btn acc-btn--small acc-btn--cta" href={proPending.get(p.id)!.payHref!}>
                          Pay now
                        </Link>
                      ) : !isPro(p) && !proPending.has(p.id) && !u.journey && !u.upgradesReady && !unassignedPending ? (
                        <UpgradeButton profileId={p.id} />
                      ) : null}
                      <ProfileMenu
                        profile={{ id: p.id, slug: p.slug, name: `${p.firstName} ${p.lastName}`.trim() || p.slug, email: p.email }}
                        editHref={editHref(p.id)}
                        back={backUrl()}
                        ownerEmail={p.ownerId === v.id ? "you" : p.ownerId ? (owners.get(p.ownerId) ?? null) : null}
                        invite={openInvite(p.id)}
                        cards={freeCards}
                      />
                      <QrIcon profile={{ slug: p.slug, name: `${p.firstName} ${p.lastName}`.trim() || p.slug }} />
                    </>
                  ) : (
                    <form action={archiveProfileAction}>
                      <input type="hidden" name="profile_id" value={p.id} />
                      <input type="hidden" name="archive" value="0" />
                      <input type="hidden" name="back" value={backUrl()} />
                      <input type="hidden" name="anchor" value="profiles" />
                      <ConfirmButton>Restore</ConfirmButton>
                    </form>
                  )}
                </div>
                {!p.archived ? (
                  <LinkedCards
                    profile={{ id: p.id, name: `${p.firstName} ${p.lastName}`.trim() || p.slug }}
                    back={backUrl()}
                    linked={(linkedCards.get(p.id) ?? []).map((c) => ({
                      id: c.id,
                      type: c.type,
                      label: `${CARD_TYPES[c.type] ?? "Card"}: ${c.label || c.slug}`,
                      front: imageUrl(c.frontPath, 160),
                    }))}
                    cards={freeCards}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : !sp.q && !archived ? (
          <TeamEmpty
            active="profiles"
            title="Add your people"
            actions={
              <>
                <Link className="acc-btn acc-btn--primary" href="/manage/profile/new/" scroll={false}>
                  Add a profile
                </Link>
                <form action={addMyselfAction}>
                  <ConfirmButton className="acc-btn">Add myself</ConfirmButton>
                </form>
                {!companies.length ? (
                  <Link className="acc-btn" href="/manage/companies/">
                    Set up your company first
                  </Link>
                ) : null}
              </>
            }
          >
            A profile is one person&rsquo;s digital business card, with their name, contact details and links at their own web address. Add one for each person, linked to
            your company so it picks up the branding.
          </TeamEmpty>
        ) : (
          <div className="acc-empty">{sp.q ? "No profiles match your search." : "No archived profiles."}</div>
        )}
        <Pager page={list.page} total={list.total} size={PAGE_SIZE} href={(n) => backUrl({ page: n > 1 ? n : undefined }) + "#profiles"} />

      </section>

      {progress ? <TeamWelcome userId={v.id} progress={progress} /> : null}

      <InvitesPanel invites={invites} />

      <BundleJourney u={u} />
      {u.eftPending && !proPending.size ? <div className="acc-panel acc-panel--notice">Your Pro upgrade is pending &mdash; we&rsquo;re just waiting for EFT confirmation.</div> : null}

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
