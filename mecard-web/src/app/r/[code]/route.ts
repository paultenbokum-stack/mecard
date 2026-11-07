import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { salesLinkClicks, users } from "@/db/schema";
import { salesCookieSecret, salesUserByCode } from "@/lib/sales";
import { LINK_LANDINGS } from "@/lib/sales-link-landings";
import { decodeClick, encodeClick, isBot, keepsExistingClick, SALES_REF_COOKIE, SALES_VISITOR_COOKIE, SIGNUP_DAYS } from "@/lib/sales-rules";

// A salesperson's link, /r/<code>/ or /r/<code>/?to=teams. Counts the click once per
// visitor, remembers it for 7 days in a signed cookie, and sends the visitor on.
// Link previews and signed-in staff go straight through without counting, so this
// GET writes nothing for staff, including during view-as.
type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { code } = await params;
  const to = new URL(req.url).searchParams.get("to") ?? "home";
  const landing = Object.hasOwn(LINK_LANDINGS, to) ? to : "home";
  const res = new NextResponse(null, { status: 307, headers: { Location: LINK_LANDINGS[landing].path, "Cache-Control": "no-store" } });

  const sales = await salesUserByCode(code.toLowerCase()).catch(() => null);
  if (!sales || isBot(req.headers.get("user-agent"))) return res;

  const session = await auth();
  if (session?.user?.id) {
    const [u] = await db.select({ isAdmin: users.isAdmin, isSales: users.isSales }).from(users).where(eq(users.id, Number(session.user.id))).limit(1);
    if (u?.isAdmin || u?.isSales) return res;
  }

  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const known = jar.get(SALES_VISITOR_COOKIE)?.value ?? "";
  const visitorId = /^[0-9a-f-]{36}$/.test(known) ? known : randomUUID();
  res.cookies.set(SALES_VISITOR_COOKIE, visitorId, { path: "/", maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "lax", secure });
  await db
    .insert(salesLinkClicks)
    .values({ salesUserId: sales.id, visitorId, landing })
    .onConflictDoNothing()
    .catch((e) => console.error("[sales] click", e));

  const now = new Date();
  const existing = decodeClick(jar.get(SALES_REF_COOKIE)?.value, salesCookieSecret());
  if (!keepsExistingClick(existing, sales.id, now)) {
    res.cookies.set(SALES_REF_COOKIE, encodeClick({ salesUserId: sales.id, clickedAt: now }, salesCookieSecret()), {
      path: "/",
      maxAge: 60 * 60 * 24 * SIGNUP_DAYS,
      httpOnly: true,
      sameSite: "lax",
      secure,
    });
  }
  return res;
}
