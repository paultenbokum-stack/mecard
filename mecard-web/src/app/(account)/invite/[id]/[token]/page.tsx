import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/account/Bits";
import { LOGOUT } from "@/lib/auth-paths";
import { acceptInvite, inviteById, verifyInviteToken } from "@/lib/invites";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Your MeCard invite" };

// The link in an invite email: sign in (or sign up), then accept to take over
// the profile — the `request` page with its Accept button on WordPress.

type Props = { params: Promise<{ id: string; token: string }> };

export default async function InvitePage({ params }: Props) {
  const { id, token } = await params;
  const inviteId = Number(id);
  const invite = Number.isInteger(inviteId) && inviteId > 0 ? await inviteById(inviteId) : null;
  const valid = !!invite && verifyInviteToken(inviteId, invite.email, token);
  await requireUserId(`/invite/${id}/${token}/`);

  if (!valid || invite.archived)
    return (
      <Box title="This invite isn't valid">
        <p>The link may be incomplete, or the invite was withdrawn or replaced by a newer one. Ask whoever invited you to send it again.</p>
      </Box>
    );
  if (invite.status === "accepted")
    return (
      <Box title="Invite already accepted">
        <p>This profile has already been taken over.</p>
        <Link className="acc-btn acc-btn--primary" href="/manage/">
          Go to My MeCard Home
        </Link>
      </Box>
    );

  async function accept() {
    "use server";
    const uid = await requireUserId(`/invite/${id}/${token}/`);
    const inv = await inviteById(inviteId);
    if (!inv || !verifyInviteToken(inviteId, inv.email, token)) redirect("/manage/?done=invite-failed");
    const res = await acceptInvite(inviteId, uid, { requireEmailMatch: false });
    redirect(res.ok ? `/manage/profile/${res.profileId}/?done=invite-accepted` : "/manage/?done=invite-failed");
  }

  const name = `${invite.firstName} ${invite.lastName}`.trim() || "a MeCard profile";
  return (
    <Box title="You've been invited to MeCard">
      <p>
        You have been invited to take over <strong>{name}</strong>
        {invite.companyName ? ` at ${invite.companyName}` : ""}. Once you accept, the profile is yours: you can keep it up to date and link your cards to it.
      </p>
      <form action={accept}>
        <ConfirmButton className="acc-btn acc-btn--primary">Accept</ConfirmButton>
      </form>
      <p className="acc__muted" style={{ marginTop: 16, marginBottom: 0 }}>
        The invite went to {invite.email}. Not you, or signed in with the wrong account? <Link href={LOGOUT}>Log out</Link> first.
      </p>
    </Box>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="acc__wrap acc__wrap--narrow">
      <h1>{title}</h1>
      <div className="acc-panel acc-panel--white">{children}</div>
    </div>
  );
}
