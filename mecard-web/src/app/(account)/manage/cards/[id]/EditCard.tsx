import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CARD_TYPES, ConfirmButton, NewTab } from "@/components/account/Bits";
import { CardDesigner } from "@/components/account/CardDesigner";
import { canEditProfile, canManageCard, viewer } from "@/lib/access";
import { cardForDesign, QR_DEFAULTS } from "@/lib/card-design";
import { cardsListHref, isCardTab } from "@/lib/card-tabs";
import { cardTabOf, profileChoices } from "@/lib/manage";
import { requireUserId } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { cardSettingsAction, linkCardAction, unlinkCardAction } from "../../actions";

/**
 * One card or tag: which profile it opens, its settings and (cards) its design.
 * The page and the My Cards modal both show it. `tab` is the My Cards tab it was
 * opened from (?tab=): closing goes back there, or to the card's new tab when a
 * save moved it (cardsListHref).
 */
export async function loadCardEditor(id: string, tab?: string) {
  const cardId = Number(id);
  if (!Number.isInteger(cardId) || cardId <= 0) notFound();
  const v = await viewer(await requireUserId(`/manage/cards/${cardId}/`));
  if (!(await canManageCard(v, cardId))) redirect("/manage/cards/?done=denied");
  const data = await cardForDesign(cardId);
  if (!data || data.card.archived) notFound();
  const choices = await profileChoices(v);
  const current = data.card.profileId && (await canEditProfile(v, data.card.profileId)) ? (choices.find((p) => p.id === data.card.profileId) ?? null) : null;
  const type = CARD_TYPES[data.card.type] ?? "Card";
  const design = data.card.type === "contactcard" ? "custom" : data.card.type === "classiccard" ? "classic" : null;
  const from = isCardTab(tab) ? tab : null;
  return { ...data, choices, current, type, design, from, back: cardsListHref(from, await cardTabOf(cardId)) } as const;
}

const nameOf = (p: { firstName: string; lastName: string; slug: string }) => `${p.firstName} ${p.lastName}`.trim() || p.slug;

export function EditCard({ data }: { data: Awaited<ReturnType<typeof loadCardEditor>> }) {
  const { card: c, defaults, choices, current, type, design, from } = data;
  return (
    <>
      <p className="acc__lead">
        {type} · <span className="acc-mono">/t/{c.slug}/</span>
        {c.profileId ? (
          <>
            {" "}
            · <a href={`/t/${c.slug}/`} target="_blank" rel="noopener">Open card <NewTab /></a>
          </>
        ) : null}
      </p>

      <section className="acc-panel acc-panel--white" id="activate">
        <h2>{c.profileId ? "Profile on this card" : `Link this ${type.toLowerCase()} to a profile`}</h2>
        <p className="acc__muted">
          Tapping the card or scanning its QR code opens this profile.{current ? ` It now opens ${nameOf(current)}.` : ""}
        </p>
        {choices.length ? (
          <form action={linkCardAction} className="acc-inline-form">
            <input type="hidden" name="card_id" value={c.id} />
            <input type="hidden" name="back" value="/manage/cards/" />
          <input type="hidden" name="from_tab" value={from ?? ""} />
            <select name="profile_id" defaultValue={c.profileId ?? choices[0].id} aria-label="Profile to open when the card is tapped">
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameOf(p)}
                  {p.companyName ? ` — ${p.companyName}` : ""}
                </option>
              ))}
            </select>
            <ConfirmButton className="acc-btn acc-btn--primary">{c.profileId ? "Change profile" : "Link card"}</ConfirmButton>
          </form>
        ) : (
          <p style={{ marginBottom: 0 }}>
            <Link href="/manage/profile/new/">Add a profile</Link> first, then link this card to it.
          </p>
        )}
        {c.profileId ? (
          <form action={unlinkCardAction} style={{ marginTop: 12 }}>
            <input type="hidden" name="card_id" value={c.id} />
            <input type="hidden" name="back" value="/manage/cards/" />
          <input type="hidden" name="from_tab" value={from ?? ""} />
            <ConfirmButton className="acc-btn acc-btn--small acc-btn--danger" confirm="Unlink this card? Tapping it will show “not set up yet” until you link it again.">
              Unlink
            </ConfirmButton>
          </form>
        ) : null}
      </section>

      <section className="acc-panel acc-panel--white">
        <h2>Card settings</h2>
        <form action={cardSettingsAction} className="acc-form">
          <input type="hidden" name="card_id" value={c.id} />
          <input type="hidden" name="back" value="/manage/cards/" />
          <input type="hidden" name="from_tab" value={from ?? ""} />
          <div className="acc-field">
            <label htmlFor={`label-${c.id}`}>Label</label>
            <input id={`label-${c.id}`} type="text" name="label" defaultValue={c.label} maxLength={255} placeholder="Only you see this" />
          </div>
          <span className="acc-check">
            <input type="checkbox" id={`ad-${c.id}`} name="auto_download" value="1" defaultChecked={c.autoDownloadVcard} />
            <label htmlFor={`ad-${c.id}`}>Save the contact automatically on the first tap</label>
          </span>
          <div>
            <ConfirmButton>Save settings</ConfirmButton>
          </div>
        </form>
      </section>

      {design ? (
        <section className="acc-panel acc-panel--white">
          <h2>Design</h2>
          <CardDesigner
            cardId={c.id}
            kind={design}
            cardUrl={siteUrl(`/t/${c.slug}/`)}
            locked={c.designReceived}
            submitted={c.designSubmitted}
            custom={{
              frontPath: c.frontPath,
              backPath: c.backPath,
              qrX: Number(c.qrX) || QR_DEFAULTS.x,
              qrY: Number(c.qrY) || QR_DEFAULTS.y,
              qrWidth: Number(c.qrWidth) || QR_DEFAULTS.width,
              qrCodeColour: c.qrCodeColour || QR_DEFAULTS.code,
              qrFillColour: c.qrFillColour || QR_DEFAULTS.fill,
            }}
            classic={{ frontPath: c.frontPath, nameOnCard: c.nameOnCard, jobTitleOnCard: c.jobTitleOnCard }}
            defaults={defaults}
          />
        </section>
      ) : null}
    </>
  );
}
