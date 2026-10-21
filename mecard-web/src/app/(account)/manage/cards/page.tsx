import type { Metadata } from "next";
import Link from "next/link";
import { CARD_TYPES, cardStage, ConfirmButton, DoneNotice, Pager, Subnav, Thumb } from "@/components/account/Bits";
import { viewer } from "@/lib/access";
import { listCards, PAGE_SIZE } from "@/lib/manage";
import { requireUserId } from "@/lib/session";
import { cardSettingsAction, unlinkCardAction } from "../actions";

export const metadata: Metadata = { title: "My Cards" };

// Cards and tags: the team console's "Live cards and tags" (configured-tags-2
// with the edit-card form) and "New cards and tags" (tag-admin-ajax) views,
// and the single-profile /manage/cards/ page. Ordering new cards and uploading
// their artwork comes with the shop.

type SP = { tab?: string; q?: string; page?: string; done?: string };

export default async function CardsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const v = await viewer(await requireUserId("/manage/cards/"));
  const tab = sp.tab === "new" ? "new" : "live";
  const page = Math.max(1, Number(sp.page) || 1);
  const [list, other] = await Promise.all([
    listCards(v, { linked: tab === "live", q: sp.q, page }),
    listCards(v, { linked: tab !== "live", page: 1 }),
  ]);
  const counts = tab === "live" ? { live: list.total, new: other.total } : { live: other.total, new: list.total };
  const url = (extra: Record<string, string | number | undefined> = {}) => {
    const u = new URLSearchParams();
    for (const [k, val] of Object.entries({ tab: tab === "new" ? "new" : undefined, q: sp.q, page: page > 1 ? page : undefined, ...extra })) if (val) u.set(k, String(val));
    return `/manage/cards/${u.size ? `?${u}` : ""}`;
  };

  return (
    <div className="acc__wrap">
      <Subnav active="cards" />
      <p className="acc__eyebrow">My Cards</p>
      <h1>Cards and tags</h1>
      <p className="acc__lead">Each card or tag opens the profile it is linked to when someone taps it or scans its QR code.</p>
      <DoneNotice done={sp.done} />

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
              return (
                <li className="acc-item" key={c.id}>
                  <div className="acc-item__main">
                    <Thumb path={c.frontPath} />
                    <div className="acc-item__text">
                      <div className="acc-item__title">
                        {c.label || c.profileName || c.nameOnCard || type} {tab === "new" ? <span className={`acc-badge acc-badge--${tone}`}>{stage}</span> : null}
                      </div>
                      <div className="acc-item__sub">
                        {[type, c.profileName ? `opens ${c.profileName}` : "", c.companyName, c.orderId ? `order #${c.orderId}` : "", `/t/${c.slug}/`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  <div className="acc-item__actions">
                    {c.type === "contactcard" || c.type === "classiccard" ? (
                      <Link className={`acc-btn acc-btn--small${!c.designSubmitted && !c.shipped ? " acc-btn--cta" : ""}`} href={`/manage/cards/${c.id}/`}>
                        {c.designReceived || c.shipped ? "View design" : c.designSubmitted ? "Edit design" : "Design card"}
                      </Link>
                    ) : null}
                    {c.profileId ? (
                      <a className="acc-btn acc-btn--small" href={`/t/${c.slug}/`}>
                        Open
                      </a>
                    ) : null}
                    <Link className="acc-btn acc-btn--small acc-btn--primary" href={`/manage/?activate=${encodeURIComponent(c.slug)}#activate`}>
                      {c.profileId ? "Change profile" : "Link to profile"}
                    </Link>
                    {c.profileId ? (
                      <form action={unlinkCardAction}>
                        <input type="hidden" name="card_id" value={c.id} />
                        <input type="hidden" name="back" value={url()} />
                        <ConfirmButton className="acc-btn acc-btn--small acc-btn--danger" confirm="Unlink this card? Tapping it will show “not set up yet” until you link it again.">
                          Unlink
                        </ConfirmButton>
                      </form>
                    ) : null}
                  </div>
                  <details className="acc-details">
                    <summary className="acc-link" style={{ fontSize: 14 }}>
                      Card settings
                    </summary>
                    <form action={cardSettingsAction} className="acc-inline-form">
                      <input type="hidden" name="card_id" value={c.id} />
                      <input type="hidden" name="back" value={url()} />
                      <input type="text" name="label" defaultValue={c.label} maxLength={255} placeholder="Label (only you see this)" aria-label="Card label" />
                      <span className="acc-check">
                        <input type="checkbox" id={`ad-${c.id}`} name="auto_download" value="1" defaultChecked={c.autoDownloadVcard} />
                        <label htmlFor={`ad-${c.id}`}>Save the contact automatically on the first tap</label>
                      </span>
                      <ConfirmButton>Save</ConfirmButton>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="acc-empty">
            {sp.q ? "No cards match your search." : tab === "live" ? "None of your cards are linked to a profile yet." : "Every card you have is linked to a profile."}
          </div>
        )}
        <Pager page={list.page} total={list.total} size={PAGE_SIZE} href={(n) => url({ page: n > 1 ? n : undefined })} />
      </section>

      <section className="acc-panel">
        <h2>Need more cards?</h2>
        <p>Order classic or custom cards, phone tags and key rings for yourself or your team.</p>
        <div className="acc-actions">
          <Link className="acc-btn acc-btn--cta" href="/shop/">
            Order cards
          </Link>
        </div>
      </section>
    </div>
  );
}
