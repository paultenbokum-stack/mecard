import { ConfirmButton } from "@/components/account/Bits";
import type { invitesForUser } from "@/lib/manage";
import { acceptInviteAction } from "./actions";

/** "Profiles waiting for you": pending invites to take over a profile, on both views of /manage/. */
export function InvitesPanel({ invites }: { invites: Awaited<ReturnType<typeof invitesForUser>> }) {
  if (!invites.length) return null;
  return (
    <section className="acc-panel acc-panel--notice">
      <h2>Profiles waiting for you</h2>
      <p>You have been invited to take over {invites.length === 1 ? "this profile" : "these profiles"}:</p>
      <ul className="acc-list">
        {invites.map((i) => (
          <li className="acc-item" key={i.id}>
            <div className="acc-item__main">
              <div className="acc-item__text">
                <div className="acc-item__title">{`${i.firstName} ${i.lastName}`.trim() || "Profile"}</div>
                <div className="acc-item__sub">
                  {[i.companyName, i.inviterName ? `invited by ${i.inviterName}` : ""].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
            <form action={acceptInviteAction} className="acc-item__actions">
              <input type="hidden" name="invite_id" value={i.id} />
              <ConfirmButton className="acc-btn acc-btn--small acc-btn--primary">Accept</ConfirmButton>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
