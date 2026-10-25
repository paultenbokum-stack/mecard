"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addProfileLinkAction, cancelInviteAction, inviteAction } from "@/app/(account)/manage/editor-actions";
import { archiveProfileAction, linkCardAction } from "@/app/(account)/manage/actions";
import { ConfirmButton } from "./ConfirmButton";

// A profile's actions on the Profiles list: WordPress's team console split
// button (loop-item-in-profile-admin-ajax): Edit, and a menu with Edit
// profile, Invite others to edit, Assign a card/tag, Add a website link,
// Download QR Code, Archive profile and View Profile, in that order.

type Invite = { id: number; email: string; sent: string };

export type ProfileMenuProps = {
  profile: { id: number; slug: string; name: string; email: string };
  editHref: string;
  /** The list as it is now, to come back to after a form. */
  back: string;
  /** Who owns the profile: an email address, "you", or null when nobody has claimed it. */
  ownerEmail: string | null;
  invite: Invite | null;
  /** Live cards not linked to a profile yet, for Assign a card/tag. */
  cards: { id: number; label: string }[];
};

type Panel = "invite" | "card" | "link" | null;

export function ProfileMenu({ profile, editHref, back, ownerEmail, invite, cards }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const url = `/mecard-profile/${profile.slug}/`;

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  useEffect(() => {
    if (panel) dialog.current?.showModal();
  }, [panel]);

  const show = (p: Panel) => {
    setOpen(false);
    setPanel(p);
  };

  // The QR code of the profile's address as a PNG, like WordPress's QR modal download.
  const downloadQr = async () => {
    setOpen(false);
    const QR = await import("qrcode");
    const href = await QR.toDataURL(new URL(url, window.location.origin).href, { width: 1000, margin: 2, errorCorrectionLevel: "H" });
    const a = document.createElement("a");
    a.href = href;
    a.download = `${profile.name || profile.slug} QR code.png`;
    a.click();
  };

  const hidden = (
    <>
      <input type="hidden" name="profile_id" value={profile.id} />
      <input type="hidden" name="back" value={back} />
    </>
  );

  return (
    <div className="acc-split" ref={wrap}>
      <Link className="acc-btn acc-btn--small acc-btn--primary" href={editHref} scroll={false}>
        Edit
      </Link>
      <button type="button" className="acc-btn acc-btn--small acc-btn--primary acc-split__toggle" aria-haspopup="menu" aria-expanded={open} aria-label={`More actions for ${profile.name}`} onClick={() => setOpen((o) => !o)}>
        <i className="fa-solid fa-caret-down" aria-hidden="true" />
      </button>
      {open ? (
        <div className="acc-menu" role="menu">
          <Link role="menuitem" href={editHref} scroll={false} onClick={() => setOpen(false)}>
            Edit profile
          </Link>
          <button type="button" role="menuitem" onClick={() => show("invite")}>
            Invite others to edit
          </button>
          <button type="button" role="menuitem" onClick={() => show("card")}>
            Assign a card/tag
          </button>
          <button type="button" role="menuitem" onClick={() => show("link")}>
            Add a website link
          </button>
          <button type="button" role="menuitem" onClick={downloadQr}>
            Download QR Code
          </button>
          <form action={archiveProfileAction}>
            {hidden}
            <input type="hidden" name="archive" value="1" />
            <input type="hidden" name="anchor" value="profiles" />
            <ConfirmButton className="acc-menu__danger" confirm="Archive this profile? Its page and any cards linked to it stop working until you restore it.">
              Archive profile
            </ConfirmButton>
          </form>
          <hr />
          <a role="menuitem" href={url} target="_blank" rel="noopener">
            View Profile <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
          </a>
        </div>
      ) : null}

      {panel ? (
        <dialog ref={dialog} className="acc-dialog" onClose={() => setPanel(null)} aria-labelledby={`pm-${profile.id}-title`}>
          <form method="dialog" className="acc-dialog__close">
            <button type="submit" className="acc-btn acc-btn--small" aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </form>

          {panel === "invite" ? (
            <>
              <h2 id={`pm-${profile.id}-title`}>Invite others to edit</h2>
              <p className="acc__muted">
                {ownerEmail
                  ? `${profile.name} is owned by ${ownerEmail}. Invite someone else to take it over.`
                  : invite
                    ? `Waiting for ${invite.email} to accept (sent ${invite.sent}).`
                    : `${profile.name} isn't claimed yet. Once the person accepts, the profile is theirs to keep up to date, and you can still manage it.`}
              </p>
              {invite ? (
                <form action={cancelInviteAction} className="acc-inline-form">
                  {hidden}
                  <input type="hidden" name="invite_id" value={invite.id} />
                  <ConfirmButton className="acc-btn acc-btn--small acc-btn--danger">Withdraw the invite</ConfirmButton>
                </form>
              ) : null}
              <form action={inviteAction} className="acc-inline-form">
                {hidden}
                <input type="email" name="email" required defaultValue={invite?.email ?? (ownerEmail ? "" : profile.email)} placeholder="Their email address" aria-label="Email address to invite" />
                <ConfirmButton className="acc-btn acc-btn--small acc-btn--primary">{invite ? "Send again" : "Send invite"}</ConfirmButton>
              </form>
            </>
          ) : null}

          {panel === "card" ? (
            <>
              <h2 id={`pm-${profile.id}-title`}>Assign a card/tag</h2>
              {cards.length ? (
                <>
                  <p className="acc__muted">Choose a card or tag to open {profile.name}&rsquo;s profile.</p>
                  <form action={linkCardAction} className="acc-inline-form">
                    {hidden}
                    <input type="hidden" name="from" value="profiles" />
                    <select name="card_id" required aria-label="Card or tag" defaultValue="">
                      <option value="" disabled>
                        Select a card or tag
                      </option>
                      {cards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <ConfirmButton className="acc-btn acc-btn--small acc-btn--primary">Assign</ConfirmButton>
                  </form>
                </>
              ) : (
                <p className="acc__muted">
                  You have no cards or tags waiting for a profile. <Link href="/manage/cards/new/">Buy a new card</Link>, or move a card to this profile from{" "}
                  <Link href="/manage/cards/">My Cards</Link>.
                </p>
              )}
            </>
          ) : null}

          {panel === "link" ? (
            <>
              <h2 id={`pm-${profile.id}-title`}>Add a website link</h2>
              <p className="acc__muted">A button on {profile.name}&rsquo;s profile, after their other links.</p>
              <form action={addProfileLinkAction} className="acc-form">
                {hidden}
                <div className="acc-field">
                  <label htmlFor={`pm-${profile.id}-label`}>Button text</label>
                  <input id={`pm-${profile.id}-label`} name="label" type="text" required maxLength={255} placeholder="e.g. Book a meeting" />
                </div>
                <div className="acc-field">
                  <label htmlFor={`pm-${profile.id}-url`}>Web address</label>
                  <input id={`pm-${profile.id}-url`} name="url" type="text" inputMode="url" required placeholder="https://" />
                </div>
                <div>
                  <ConfirmButton className="acc-btn acc-btn--primary">Add link</ConfirmButton>
                </div>
              </form>
            </>
          ) : null}
        </dialog>
      ) : null}
    </div>
  );
}
