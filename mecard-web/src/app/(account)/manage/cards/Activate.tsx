import Link from "next/link";
import { CARD_TYPES, ConfirmButton, Thumb } from "@/components/account/Bits";
import { canEditProfile, canManageCard } from "@/lib/access";
import { LOGOUT } from "@/lib/auth-paths";
import { cardForActivation, maskEmail, profileChoices } from "@/lib/manage";
import { normalizeSlug } from "@/lib/profile-format";
import { linkCardAction } from "../actions";

/** "Activate this card": the unlinked-card page sends people here with the card's slug. */
export async function Activate({ slug, userId, isAdmin }: { slug: string; userId: number; isAdmin: boolean }) {
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
        <p style={{ marginBottom: 0 }}><Link href="/manage/profile/new/">Add a profile</Link> first, then come back to this card&rsquo;s link to activate it.</p>
      )}
    </section>
  );
}
