import Link from "next/link";
import { imageUrl } from "@/lib/images/paths";
import type { ProPending } from "@/lib/manage";
import { manageViewFor } from "@/lib/manage-view";
import { ConfirmButton } from "./ConfirmButton";

// Small pieces shared by the /manage/ screens.

// Orders live under My Account; new cards are bought from My Cards.
const TABS = [
  ["home", "Profiles", "/manage/"],
  ["cards", "My Cards", "/manage/cards/"],
  ["companies", "Companies", "/manage/companies/"],
] as const;

/**
 * The /manage/ tabs. The single view (one profile of your own, manageViewFor)
 * has WordPress's single subnav instead: Home, Edit Profile and My Cards.
 */
export async function Subnav({ active }: { active: (typeof TABS)[number][0] | "profile" | "" }) {
  const { view, profileId } = await manageViewFor();
  if (view === "single") {
    const links = [
      ["home", "Home", "/manage/"],
      ["profile", "Edit Profile", `/manage/profile/${profileId}/`],
      ["cards", "My Cards", "/manage/cards/"],
    ] as const;
    return (
      <nav className="acc-subnav" aria-label="My MeCard">
        {links.map(([key, label, href]) => (
          <Link key={key} href={href} aria-current={active === key ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="acc-subnav" aria-label="Manage MeCard">
      {TABS.map(([key, label, href]) => (
        <Link key={key} href={href} aria-current={active === key || (active === "profile" && key === "home") ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

const DONE: Record<string, [string, "ok" | "error"]> = {
  "card-linked": ["The card is linked. Tapping it now opens the profile.", "ok"],
  "card-unlinked": ["The card is unlinked. It shows “not set up yet” until you link it again.", "ok"],
  "card-saved": ["Card settings saved.", "ok"],
  "bundle-removed": ["The bundle is out of your basket.", "ok"],
  "bundle-added": ["Bundle added to your basket. Set up your Pro profile next, then confirm the bundle items and check out.", "ok"],
  "card-added": ["Added to your basket. Your new card is below: design it now or after checkout, and check out from the basket when you're ready.", "ok"],
  "profile-archived": ["Profile archived. Its page and cards stop working until you restore it.", "ok"],
  "profile-restored": ["Profile restored.", "ok"],
  "profile-created": ["Profile created. Fill in the details below.", "ok"],
  "profile-invalid": ["Enter at least a first name (and a valid email address, if you add one).", "error"],
  "profile-saved": ["Profile saved.", "ok"],
  "company-created": ["Company created. Add its details and branding below.", "ok"],
  "company-invalid": ["Enter a company name.", "error"],
  "invite-accepted": ["Invite accepted. The profile is now yours.", "ok"],
  "invite-failed": ["That invite couldn't be accepted. It may have been withdrawn or sent to a different email address.", "error"],
  "invite-sent": ["Invite sent.", "ok"],
  "invite-invalid": ["Enter a valid email address to send the invite to.", "error"],
  "company-saved": ["Company saved.", "ok"],
  "invite-cancelled": ["Invite withdrawn.", "ok"],
  "upgrade-applied": ["Your Pro upgrade is applied. Your profile is now Pro.", "ok"],
  "pro-pending": ["Pro is unlocked for this profile. Set it up below and pay when you're ready.", "ok"],
  "already-pro": ["This profile is already Pro.", "ok"],
  "upgrade-unavailable": ["The Pro upgrade can't be ordered right now. Please try again later.", "error"],
  "upgrade-none": ["There is no unused Pro upgrade on your account.", "error"],
  denied: ["You don't have permission to do that.", "error"],
};

const PENDING_VIA: Record<ProPending["via"], string> = {
  basket: "The upgrade is in your basket.",
  payfast: "Your order is waiting for payment.",
  eft: "We're waiting for your EFT payment to clear.",
};

/** The "Pro pending payment" badge on a profile in a list. */
export function ProPendingBadge() {
  return <span className="acc-badge acc-badge--wait">Pro pending payment</span>;
}

/** Pro is unlocked in the editor, but the public card stays standard until the upgrade is paid. */
export function ProPendingNote({ pending, editing }: { pending: ProPending; editing?: boolean }) {
  return (
    <div className="acc-panel acc-panel--notice acc-pending" role="status">
      <p style={{ marginTop: 0 }}>
        {editing ? <strong>Pro pending payment.</strong> : <ProPendingBadge />} {PENDING_VIA[pending.via]} {editing ? "You can set up your Pro profile now." : "Pro editing is already unlocked."} Your public card shows the standard version
        until payment is received, then switches to Pro automatically.
      </p>
      {pending.payHref ? (
        <Link className="acc-btn acc-btn--small acc-btn--cta" href={pending.payHref}>
          Pay now
        </Link>
      ) : (
        <p className="acc__muted" style={{ marginBottom: 0 }}>
          The person who ordered the upgrade pays for it.
        </p>
      )}
    </div>
  );
}

export function DoneNotice({ done }: { done?: string }) {
  const m = done ? DONE[done] : undefined;
  if (!m) return null;
  return (
    <div className={`acc-panel acc-panel--${m[1] === "ok" ? "ok" : "error"}`} role="status">
      {m[0]}
    </div>
  );
}

export function Pager({ page, total, size, href }: { page: number; total: number; size: number; href: (page: number) => string }) {
  const pages = Math.ceil(total / size);
  if (pages <= 1) return null;
  return (
    <div className="acc-actions" style={{ justifyContent: "center" }}>
      {page > 1 ? (
        <Link className="acc-btn acc-btn--small" href={href(page - 1)}>
          ← Previous
        </Link>
      ) : null}
      <span className="acc__muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link className="acc-btn acc-btn--small" href={href(page + 1)}>
          Next →
        </Link>
      ) : null}
    </div>
  );
}

export function Avatar({ path, alt = "" }: { path: string | null; alt?: string }) {
  const src = imageUrl(path, 160);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="acc-avatar" src={src} alt={alt} loading="lazy" /> : <span className="acc-avatar" aria-hidden="true" />;
}

export function Thumb({ path }: { path: string | null }) {
  const src = imageUrl(path, 160);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="acc-thumb" src={src} alt="" loading="lazy" /> : <span className="acc-thumb" aria-hidden="true" />;
}

export { ConfirmButton };

export const CARD_TYPES: Record<string, string> = {
  classiccard: "Classic card",
  contactcard: "Custom card",
  keyring: "Key ring",
  phonetag: "Phone tag",
  iotag: "Tag",
};

/** Where a new card is in production (the print workflow flags, in order). */
export function cardStage(c: { designSubmitted: boolean; printed: boolean; shipped: boolean }): [string, "live" | "wait" | "off"] {
  if (c.shipped) return ["Shipped", "live"];
  if (c.printed) return ["Printed", "wait"];
  if (c.designSubmitted) return ["In production", "wait"];
  return ["Awaiting design", "off"];
}

/** After a link that opens a public card or profile in a new tab. */
export function NewTab() {
  return (
    <>
      <i className="fa-solid fa-arrow-up-right-from-square acc-newtab" aria-hidden="true" />
      <span className="screen-reader-text">(opens in a new tab)</span>
    </>
  );
}
