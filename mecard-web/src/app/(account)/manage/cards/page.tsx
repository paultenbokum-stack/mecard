import type { Metadata } from "next";
import Link from "next/link";
import { CARD_TYPES, cardStage, DoneNotice, Pager, Subnav, Thumb } from "@/components/account/Bits";
import { viewer } from "@/lib/access";
import { listCards, PAGE_SIZE } from "@/lib/manage";
import { requireUserId } from "@/lib/session";
import { Activate } from "./Activate";

export const metadata: Metadata = { title: "My Cards" };

// Cards and tags: the team console's "Live cards and tags" (configured-tags-2
// with the edit-card form) and "New cards and tags" (tag-admin-ajax) views.
// Editing a card (its profile, settings and design) and buying a new one open
// in a modal over the list (@modal/(.)cards/…). Activating a card from its
// "not set up yet" page lands here too (?activate=slug).

type SP = { tab?: string; q?: string; page?: string; done?: string; activate?: string };

export default async function CardsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const v = await viewer(await requireUserId(`/manage/cards/${sp.activate ? `?activate=${encodeURIComponent(sp.activate)}` : ""}`));
  const tab = sp.tab === "new" ? "new" : "live";
  const page = Math.max(1, Number(sp.page) || 1);
  const [list, other] = await Promise.all([
    listCards(v, { linked: tab === "live", q: sp.q, page }),
    listCards(v, { linked: tab !== "live", page: 1 }),
  ]);
  const counts = tab === "live" ? { live: list.total, new: other.total } : { live: other.total, new: list.total };

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
        <Link href="/manage/cards/" aria-current={tab === "live" ? "page" : undefined}>
          Live ({counts.live})
        </Link>
        <Link href="/manage/cards/?tab=new" aria-current={tab === "new" ? "page" : undefined}>
          Not linked yet ({counts.new})
        </Link>
      </nav>

      <section className="acc-panel">
        {counts.live + counts.new > 8 || sp.q ? (
          <form className="acc-toolbar" action="/manage/cards/">
            {tab === "new" ? <input type="hidden" name="tab" value="new" /> : null}
            <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Search by label, name or card address" aria-label="Search cards" />
            <button className="acc-btn" type="submit">
              Search
            </button>
            {sp.q ? (
              <Link className="acc-btn" href={tab === "new" ? "/manage/cards/?tab=new" : "/manage/cards/"}>
                Clear
              </Link>
            ) : null}
          </form>
        ) : null}

        {list.rows.length ? (
          <ul className="acc-list">
            {list.rows.map((c) => {
              const type = CARD_TYPES[c.type] ?? "Card";
              const [stage, tone] = cardStage(c);
              const designable = c.type === "contactcard" || c.type === "classiccard";
              const needsDesign = designable && !c.designSubmitted && !c.shipped;
              return (
                <li className="acc-item" key={c.id}>
                  <div className="acc-item__main">
                    <Thumb path={c.frontPath} />
                    <div className="acc-item__text">
                      <div className="acc-item__title">
                        {c.label || c.profileName || c.nameOnCard || type} {tab === "new" ? <span className={`acc-badge acc-badge--${tone}`}>{stage}</span> : null}
                      </div>
                      <div className="acc-item__sub">
                        {[type, c.profileName ? `opens ${c.profileName}` : "not linked to a profile", c.companyName, c.orderId ? `order #${c.orderId}` : "", `/t/${c.slug}/`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  <div className="acc-item__actions">
                    {c.profileId ? (
                      <a className="acc-btn acc-btn--small" href={`/t/${c.slug}/`}>
                        Open
                      </a>
                    ) : null}
                    <Link className={`acc-btn acc-btn--small ${needsDesign ? "acc-btn--cta" : "acc-btn--primary"}`} href={`/manage/cards/${c.id}/`} scroll={false}>
                      {needsDesign ? "Design card" : c.profileId ? "Edit" : "Link to profile"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="acc-empty">
            {sp.q ? "No cards match your search." : tab === "live" ? "None of your cards are linked to a profile yet." : "Every card you have is linked to a profile."}{" "}
            {!sp.q ? (
              <Link href="/manage/cards/new/" scroll={false}>
                Buy a new card
              </Link>
            ) : null}
          </div>
        )}
        <Pager page={list.page} total={list.total} size={PAGE_SIZE} href={(n) => `/manage/cards/?${new URLSearchParams({ ...(tab === "new" ? { tab } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(n) })}`} />
      </section>
    </div>
  );
}
