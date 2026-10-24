import type { Metadata } from "next";
import Link from "next/link";
import { CARD_TYPES, DoneNotice, Pager, Subnav, Thumb, NewTab } from "@/components/account/Bits";
import { viewer } from "@/lib/access";
import { CARD_TABS, cardProgress, DESIGNED_CARD_TYPES, isCardTab, type CardTab } from "@/lib/card-tabs";
import { cardTabCounts, listCards, PAGE_SIZE } from "@/lib/manage";
import { requireUserId } from "@/lib/session";
import { Activate } from "./Activate";

export const metadata: Metadata = { title: "My Cards" };

// Cards and tags: the team console's "Live cards and tags" (configured-tags-2
// with the edit-card form) and "New cards and tags" (tag-admin-ajax) views.
// Tabs: Design pending, In progress, Live, Live unassigned and Archived (the
// rules are in lib/card-tabs.ts). Editing a card (its profile, settings and
// design) and buying a new one open in a modal over the list
// (@modal/(.)cards/…). Activating a card from its "not set up yet" page lands
// here too (?activate=slug).

const EMPTY: Record<CardTab, string> = {
  design: "Nothing waiting for a design. New cards you buy show here until their design is submitted.",
  progress: "Nothing on its way. Cards show here from checkout until they're delivered.",
  live: "None of your cards open a profile yet.",
  unassigned: "Every live card opens a profile.",
  archived: "No archived cards.",
};

type SP = { tab?: string; q?: string; page?: string; done?: string; activate?: string };

export default async function CardsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const v = await viewer(await requireUserId(`/manage/cards/${sp.activate ? `?activate=${encodeURIComponent(sp.activate)}` : ""}`));
  const page = Math.max(1, Number(sp.page) || 1);
  const counts = await cardTabCounts(v);
  // ?tab=new was the old "Not linked yet" list.
  const asked = sp.tab === "new" ? "unassigned" : sp.tab;
  const tab: CardTab = isCardTab(asked) ? asked : counts.live ? "live" : counts.design ? "design" : counts.progress ? "progress" : counts.unassigned ? "unassigned" : "live";
  const list = await listCards(v, { tab, q: sp.q, page });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const tabUrl = (t: CardTab, extra: Record<string, string> = {}) => `/manage/cards/?${new URLSearchParams({ tab: t, ...extra })}`;

  return (
    <div className="acc__wrap">
      <Subnav active="cards" />
      <div className="acc-pagehead">
        <h1>My Cards</h1>
        <Link className="acc-btn acc-btn--primary" href="/manage/cards/new/" scroll={false}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Buy a new card
        </Link>
      </div>
      <p className="acc__lead">Each card or tag opens the profile it is linked to when someone taps it or scans its QR code.</p>
      <DoneNotice done={sp.done} />

      {sp.activate ? <Activate slug={sp.activate} userId={v.id} isAdmin={v.isAdmin} /> : null}

      <nav className="acc-tabs" aria-label="Card lists">
        {CARD_TABS.map(([key, label]) => (
          <Link key={key} href={tabUrl(key)} aria-current={tab === key ? "page" : undefined}>
            {label} ({counts[key]})
          </Link>
        ))}
      </nav>

      <section className="acc-panel">
        {total > 8 || sp.q ? (
          <form className="acc-toolbar" action="/manage/cards/">
            <input type="hidden" name="tab" value={tab} />
            <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Search by label, name or card address" aria-label="Search cards" />
            <button className="acc-btn" type="submit">
              Search
            </button>
            {sp.q ? (
              <Link className="acc-btn" href={tabUrl(tab)}>
                Clear
              </Link>
            ) : null}
          </form>
        ) : null}

        {list.rows.length ? (
          <ul className="acc-list">
            {list.rows.map((c) => {
              const type = CARD_TYPES[c.type] ?? "Card";
              const stage = tab === "design" ? (c.inBasket ? "In basket" : "Awaiting design") : tab === "progress" ? cardProgress(c) : null;
              const edit = (label: string, cls: string) => (
                <Link className={`acc-btn acc-btn--small ${cls}`} href={`/manage/cards/${c.id}/`} scroll={false}>
                  {label}
                </Link>
              );
              return (
                <li className="acc-item" key={c.id}>
                  <div className="acc-item__main">
                    <Thumb path={c.frontPath} />
                    <div className="acc-item__text">
                      <div className="acc-item__title">
                        {c.label || c.profileName || c.nameOnCard || type} {stage ? <span className={`acc-badge acc-badge--${tab === "design" ? "off" : "wait"}`}>{stage}</span> : null}
                      </div>
                      <div className="acc-item__sub">
                        {[type, c.profileName ? `opens ${c.profileName}` : "not linked to a profile", c.companyName, c.orderId ? `order #${c.orderId}` : "", `/t/${c.slug}/`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  <div className="acc-item__actions">
                    {tab === "design" ? (
                      <>
                        {DESIGNED_CARD_TYPES.includes(c.type) ? edit(c.designSubmitted ? "Edit design" : "Continue design", "acc-btn--cta") : edit("Edit", "")}
                        {c.inBasket ? (
                          <Link className="acc-btn acc-btn--small" href="/basket/">
                            Go to basket
                          </Link>
                        ) : c.orderStatus === "pending" ? (
                          <Link className="acc-btn acc-btn--small" href={`/checkout/pay/${c.orderId}/`}>
                            Pay
                          </Link>
                        ) : null}
                      </>
                    ) : tab === "progress" ? (
                      <>
                        {c.orderId ? (
                          <Link className="acc-btn acc-btn--small" href={`/my-account/view-order/${c.orderId}/`}>
                            View order
                          </Link>
                        ) : null}
                        {edit(c.profileId ? "Edit" : "Link to profile", "")}
                      </>
                    ) : tab === "live" ? (
                      <>
                        <a className="acc-btn acc-btn--small" href={`/t/${c.slug}/`} target="_blank" rel="noopener">
                          Open <NewTab />
                        </a>
                        {edit("Edit", "acc-btn--primary")}
                      </>
                    ) : tab === "unassigned" ? (
                      edit("Link to profile", "acc-btn--primary")
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="acc-empty">
            {sp.q ? "No cards match your search." : EMPTY[tab]}{" "}
            {!sp.q && (tab === "design" || tab === "live") ? (
              <Link href="/manage/cards/new/" scroll={false}>
                Buy a new card
              </Link>
            ) : null}
          </div>
        )}
        <Pager page={list.page} total={list.total} size={PAGE_SIZE} href={(n) => tabUrl(tab, { ...(sp.q ? { q: sp.q } : {}), page: String(n) })} />
      </section>
    </div>
  );
}
