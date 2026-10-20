import { NextResponse, type NextRequest } from "next/server";
import { canEditProfile, isProfileOwner, viewer } from "@/lib/access";
import { currentUserId } from "@/lib/session";

// GET /api/me/card/?profile_id=… — what the signed-in visitor may do on a card
// page. The pages are cached and the same for everyone, so the owner extras
// (edit bar, Pro upsell in the share panel, not counting their own views) are
// switched on in the browser from this answer.

export async function GET(req: NextRequest) {
  const profileId = Number(req.nextUrl.searchParams.get("profile_id"));
  const headers = { "Cache-Control": "private, no-store" };
  const userId = await currentUserId();
  if (!userId || !Number.isInteger(profileId) || profileId <= 0) return NextResponse.json({ canEdit: false, isOwner: false }, { headers });
  const [canEdit, isOwner] = await Promise.all([canEditProfile(await viewer(userId), profileId), isProfileOwner(userId, profileId)]);
  return NextResponse.json({ canEdit, isOwner, editUrl: canEdit ? `/manage/profile/${profileId}/` : null }, { headers });
}
