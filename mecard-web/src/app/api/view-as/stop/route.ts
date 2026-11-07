import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { logAdmin } from "@/lib/admin-log";
import { VIEW_AS_COOKIE, VIEW_AS_LABEL_COOKIE } from "@/lib/view-as-rules";
import { readViewAsToken } from "@/lib/view-as-token";

// POST /api/view-as/stop/ — the banner's Exit button. A plain route, not a server
// action, so it works from any page and always clears the cookies, even expired ones.
export async function POST(req: NextRequest) {
  const raw = req.cookies.get(VIEW_AS_COOKIE)?.value;
  const token = raw ? readViewAsToken(raw, process.env.AUTH_SECRET ?? "") : null;
  const session = await auth();
  const isActor = !!token && Number(session?.user?.id) === token.actorId;
  if (isActor) await logAdmin(token.actorId, "user", token.targetId, "stopped viewing as customer");

  const res = new NextResponse(null, { status: 303, headers: { Location: isActor ? `/admin/users/${token.targetId}/` : "/my-account/" } });
  res.cookies.delete(VIEW_AS_COOKIE);
  res.cookies.delete(VIEW_AS_LABEL_COOKIE);
  return res;
}
