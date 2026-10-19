import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { currentUserId } from "@/lib/session";
import { clientInfo, eventRow, newSessionId, SESSION_COOKIE } from "@/lib/tracking";

// POST /api/track — the browser side of the event store (was
// /wp-json/mecard/v1/track, which next.config.ts rewrites here).

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? null;
  const row = eventRow({ body, sessionCookie: cookie, userId: await currentUserId(), ...clientInfo(req.headers) });
  if (!row) return NextResponse.json({ error: "invalid_event" }, { status: 400 });

  // First event from this browser: give it the long-lived session id WordPress
  // set on page load. A client-made "cs-…" id stands in for this one event.
  const sid = cookie && cookie.length >= 16 ? null : newSessionId();
  if (!row.sessionId) row.sessionId = sid!;

  try {
    await db.insert(events).values(row);
  } catch (e) {
    console.error(JSON.stringify({ severity: "ERROR", message: "track_insert_failed", error: String(e) }));
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  if (sid) {
    res.cookies.set(SESSION_COOKIE, sid, {
      path: "/",
      maxAge: 365 * 24 * 3600,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      httpOnly: false, // the page script reads it
    });
  }
  return res;
}
