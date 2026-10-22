import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db/client";
import { cards, companies, orders, profiles, users } from "@/db/schema";
import { CARD_TYPES } from "@/components/account/Bits";
import { AdminLogList } from "@/components/admin/AdminLogList";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { AdminHeader, type AdminSearchParams, Badge, Breadcrumbs, Card, Flash } from "@/components/admin/ui";
import {
  archiveCardAction,
  assignCardAction,
  restoreCardAction,
  saveCardFlagsAction,
  saveCardLabelAction,
  setTagCodeAction,
  unassignCardAction,
} from "@/lib/admin-card-actions";
import { cardArchiveGuard } from "@/lib/admin-guards";
import { CARD_FLAGS, CARD_STAGES, cardStage } from "@/lib/admin-cards";
import { QR_DEFAULTS } from "@/lib/card-design";
import { imageUrl } from "@/lib/images/paths";
import { formatDate, ORDER_STATUS_LABEL } from "@/lib/money";
import { siteUrl } from "@/lib/site";

export const metadata = { title: "Card" };

// The card's "View info" modal on Card Processing, as a page.
export default async function AdminCard({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const [row] = Number.isInteger(id)
    ? await db
        .select({ c: cards, o: orders, p: profiles, owner: users, company: { id: companies.id, name: companies.name } })
        .from(cards)
        .leftJoin(companies, eq(companies.id, cards.companyId))
        .leftJoin(orders, eq(orders.id, cards.orderId))
        .leftJoin(profiles, eq(profiles.id, cards.profileId))
        .leftJoin(users, eq(users.id, cards.ownerId))
        .where(eq(cards.id, id))
    : [];
  if (!row) notFound();
  const { c, o, p, owner, company } = row;
  const archiveGuard = cardArchiveGuard({ orderStatus: o?.status ?? null, profileId: c.profileId });
  const url = siteUrl(`/t/${c.slug}/`);
  const qr = {
    x: Number(c.qrX) || QR_DEFAULTS.x,
    y: Number(c.qrY) || QR_DEFAULTS.y,
    w: Number(c.qrWidth) || QR_DEFAULTS.width,
    dark: c.qrCodeColour || QR_DEFAULTS.code,
    light: c.qrFillColour || QR_DEFAULTS.fill,
  };
  const qrSrc =
    c.type === "contactcard"
      ? await QRCode.toDataURL(url, { margin: 0, width: 400, errorCorrectionLevel: "H", color: { dark: `${qr.dark}ff`.slice(0, 9), light: `${qr.light}ff`.slice(0, 9) } }).catch(() => "")
      : "";
  const here = `/admin/cards/${c.id}/`;
  const front = imageUrl(c.frontPath, 960);
  const back = imageUrl(c.backPath, 960);
  const name = `${p?.firstName ?? ""} ${p?.lastName ?? ""}`.trim();

  return (
    <>
      <Breadcrumbs
        items={[
          { href: "/admin/", label: "Admin" },
          { href: "/admin/tags/", label: "Tags" },
          ...(p ? [{ href: `/admin/profiles/${p.id}/`, label: `${p.firstName} ${p.lastName}`.trim() || `Profile ${p.id}` }] : []),
          { label: `${CARD_TYPES[c.type] ?? "Card"} #${c.id}` },
        ]}
      />
      <AdminHeader title={`${CARD_TYPES[c.type] ?? "Card"} #${c.id}`}>
        <Badge status={c.shipped ? "completed" : "processing"}>{CARD_STAGES[cardStage(c, o?.status)]}</Badge>
      </AdminHeader>
      <Flash saved={sp.saved} error={sp.error} />
      <p className="adm-muted">
        <a href={url} target="_blank" rel="noopener">
          {url}
        </a>
        {c.archived ? " · archived" : ""}
        {c.cartItemKey ? " · still in the customer's basket" : ""} · created {formatDate(c.createdAt)}
      </p>

      <div className="adm-grid">
        <div>
          <Card title="Design">
            {c.type === "contactcard" ? (
              <div className="adm-cardview">
                <figure>
                  <div className="adm-cardface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {front ? <img src={front} alt="Card front" /> : <span className="adm-cardface__empty">No front yet</span>}
                  </div>
                  <figcaption>
                    Front{c.frontPath ? <> · <a href={`/admin/encoding/artwork/${c.id}/front/`}>original</a></> : null}
                  </figcaption>
                </figure>
                <figure>
                  <div className="adm-cardface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {back ? <img src={back} alt="Card back" /> : <span className="adm-cardface__empty">No back yet</span>}
                    {qrSrc ? (
                      <div className="adm-cardface__qr" style={{ left: qr.x, top: qr.y, width: qr.w, height: qr.w, background: qr.light }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrSrc} alt="QR code" />
                      </div>
                    ) : null}
                  </div>
                  <figcaption>
                    Back, with the QR code at {qr.x}, {qr.y} ({qr.w}px, {qr.dark} on {qr.light})
                    {c.backPath ? <> · <a href={`/admin/encoding/artwork/${c.id}/back/`}>original</a></> : null}
                  </figcaption>
                </figure>
              </div>
            ) : c.type === "classiccard" ? (
              <div className="adm-cardview">
                <figure>
                  <div className="adm-cardface adm-cardface--classic">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {front ? <img src={front} alt="Logo" /> : <span className="adm-muted">No logo</span>}
                    <p>{c.nameOnCard || name}</p>
                    <span className="adm-small">{c.jobTitleOnCard || p?.jobTitle}</span>
                  </div>
                  <figcaption>
                    Classic card front{c.frontPath ? <> · <a href={`/admin/encoding/artwork/${c.id}/front/`}>original logo</a></> : null}
                  </figcaption>
                </figure>
              </div>
            ) : (
              <p className="adm-muted">Nothing to design on a {CARD_TYPES[c.type]?.toLowerCase() ?? "tag"}.</p>
            )}
            {c.type === "contactcard" || c.type === "classiccard" ? (
              <p className="adm-small" style={{ marginBottom: 0 }}>
                <Link href={`/manage/cards/${c.id}/`}>Open the customer&apos;s design page</Link> (it locks once Design received is ticked).
              </p>
            ) : null}
          </Card>

          <Card title="Profile">
            {p ? (
              <p className="adm-small" style={{ margin: 0 }}>
                <Link href={`/admin/profiles/${p.id}/`}>
                  <strong>{name || "(no name)"}</strong>
                </Link>
                {p.jobTitle ? ` · ${p.jobTitle}` : ""}
                {p.companyName ? ` · ${p.companyName}` : ""}
                <br />
                <a href={`/mecard-profile/${p.slug}/`} target="_blank" rel="noopener">
                  /mecard-profile/{p.slug}/
                </a>{" "}
                · {p.type === "pro" ? "Pro" : "Standard"} profile
              </p>
            ) : (
              <p className="adm-muted" style={{ margin: 0 }}>
                Not linked to a profile yet.
              </p>
            )}
            {!c.archived ? (
              <form action={assignCardAction} className="adm-inline" style={{ marginTop: 10, width: "100%" }}>
                <input type="hidden" name="card_id" value={c.id} />
                <input type="hidden" name="back" value={here} />
                <input name="profile" placeholder="Profile number or address" aria-label="Profile number or address" className="adm-input" style={{ flex: 1 }} />
                <SubmitButton busy="Saving…">{p ? "Move to this profile" : "Assign"}</SubmitButton>
              </form>
            ) : null}
            {p && !c.archived ? (
              <form action={unassignCardAction} style={{ marginTop: 6 }}>
                <input type="hidden" name="card_id" value={c.id} />
                <input type="hidden" name="back" value={here} />
                <SubmitButton className="adm-link adm-link--danger adm-small" confirm="Unassign this tag? Tapping it will show the activate page until it is assigned again.">
                  Unassign from this profile
                </SubmitButton>
              </form>
            ) : null}
            <h3>Company</h3>
            <p className="adm-small" style={{ margin: 0 }}>
              {company?.id ? <Link href={`/admin/companies/${company.id}/`}>{company.name}</Link> : <span className="adm-muted">None.</span>}
            </p>
            <h3>Owner</h3>
            <p className="adm-small" style={{ margin: 0 }}>
              {owner ? (
                <>
                  <Link href={`/admin/users/${owner.id}/`}>{owner.displayName || owner.email}</Link> <span className="adm-muted">{owner.email}</span> ·{" "}
                  <Link href={`/admin/tags/?q=${encodeURIComponent(owner.email)}`}>Their tags</Link>
                </>
              ) : (
                "—"
              )}
            </p>
            <h3>Order</h3>
            <p className="adm-small" style={{ margin: 0 }}>
              {o ? (
                <>
                  <Link href={`/admin/orders/${o.id}/`}>#{o.id}</Link> <Badge status={o.status}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge> · {formatDate(o.createdAt)}
                </>
              ) : (
                <span className="adm-muted">No order.</span>
              )}
            </p>
          </Card>
        </div>

        <div>
          <Card title="Production">
            <form action={saveCardFlagsAction}>
              <input type="hidden" name="card_id" value={c.id} />
              <input type="hidden" name="back" value={here} />
              {CARD_FLAGS.map(([k, label]) => (
                <div key={k} className="adm-checkrow" style={{ marginBottom: 6 }}>
                  <input type="checkbox" id={k} name={k} defaultChecked={c[k]} className="adm-check" />
                  <label htmlFor={k}>{label}</label>
                </div>
              ))}
              <SubmitButton className="adm-btn adm-btn--primary" busy="Saving…">
                Save steps
              </SubmitButton>
            </form>
          </Card>
          <Card title="Label">
            <form action={saveCardLabelAction} className="adm-inline" style={{ width: "100%" }}>
              <input type="hidden" name="card_id" value={c.id} />
              <input type="hidden" name="back" value={here} />
              <input name="label" defaultValue={c.label} className="adm-input" style={{ flex: 1 }} aria-label="Label" />
              <SubmitButton>Save</SubmitButton>
            </form>
            <p className="adm-help">Printed on the packaging and in the encoding file&apos;s notes.</p>
          </Card>
          {c.type === "keyring" ? (
            <Card title="Key ring code">
              <form action={setTagCodeAction} className="adm-inline" style={{ width: "100%" }}>
                <input type="hidden" name="card_id" value={c.id} />
                <input type="hidden" name="back" value={here} />
                <input name="code" defaultValue={c.slug} className="adm-input" style={{ flex: 1 }} aria-label="Key ring code" />
                <SubmitButton>Set code</SubmitButton>
              </form>
              <p className="adm-help">The code printed on the key ring. It becomes the card&apos;s address, /t/&lt;code&gt;/.</p>
            </Card>
          ) : null}
          <Card title={c.archived ? "Archived" : "Archive tag"} className="adm-card--danger">
            {c.archived ? (
              <form action={restoreCardAction}>
                <input type="hidden" name="card_id" value={c.id} />
                <input type="hidden" name="back" value={here} />
                <p className="adm-small" style={{ marginTop: 0 }}>
                  This tag is archived: it is hidden from the customer and staff lists.
                </p>
                <SubmitButton busy="Restoring…">Restore tag</SubmitButton>
              </form>
            ) : archiveGuard.ok ? (
              <form action={archiveCardAction}>
                <input type="hidden" name="card_id" value={c.id} />
                <input type="hidden" name="back" value={here} />
                <p className="adm-small" style={{ marginTop: 0 }}>
                  Hides the tag from its owner and the staff lists; its address keeps working. Type <strong>{c.slug}</strong> to confirm.
                </p>
                <input name="confirm" className="adm-input" aria-label="Type the tag code to confirm" style={{ width: "100%", marginBottom: 8 }} autoComplete="off" />
                <SubmitButton className="adm-btn adm-btn--danger" busy="Archiving…">
                  Archive tag
                </SubmitButton>
              </form>
            ) : (
              <ul className="adm-blockers">
                {archiveGuard.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </Card>
          <AdminLogList entity="card" id={c.id} />
        </div>
      </div>
    </>
  );
}
