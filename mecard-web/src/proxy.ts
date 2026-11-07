import { NextResponse, type NextRequest } from "next/server";
import { legacyLoginRedirect } from "@/lib/auth-paths";
import { readOnlyReturnPath, VIEW_AS_COOKIE, viewAsBlocks } from "@/lib/view-as-rules";

// A test deploy (SITE_NOINDEX=1, on its *.run.app address) asks search engines to stay away.
export function proxy(req: NextRequest) {
  const res = refuseViewAsWrite(req) ?? route(req);
  if (process.env.SITE_NOINDEX === "1") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

// Staff view-as is read-only: the one place every write passes through. A view-as
// cookie without a login proves nothing and must not get in the way of logging in.
function refuseViewAsWrite(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!viewAsBlocks(req.method, pathname) || !req.cookies.has(VIEW_AS_COOKIE)) return null;
  if (!req.cookies.getAll().some((c) => c.name.includes("authjs.session-token"))) return null;
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "read_only", message: "This view is read-only." }, { status: 403 });
  const back = readOnlyReturnPath(req.headers.get("referer"), pathname);
  // A server action follows this header, as it does for redirect() in an action, so
  // the page stays up rather than failing on an answer that isn't a Flight response.
  if (req.headers.has("next-action")) return new NextResponse(null, { status: 303, headers: { "x-action-redirect": `${back};replace` } });
  return NextResponse.redirect(new URL(back, req.nextUrl), 303);
}

function route(req: NextRequest) {
  const { pathname, searchParams, origin } = req.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // WooCommerce's PayFast notify URL, still on orders paid during the switch-over.
  if (searchParams.get("wc-api") === "WC_Gateway_PayFast") return NextResponse.rewrite(new URL("/api/payfast/itn/", req.nextUrl));

  // Old WordPress login URLs (wp-login.php, the Toolset /login/ page).
  const login = legacyLoginRedirect(pathname, searchParams, origin);
  if (login) return NextResponse.redirect(new URL(login, req.nextUrl), 302);

  // WordPress answered /T/<slug>/ and /Mecard-Profile/<slug>/ too (case-insensitive
  // rewrite rules). Next.js routes are case-sensitive, so send those to the
  // lowercase path; the page itself then canonicalises the slug.
  const m = pathname.match(/^\/(t|mecard-profile)(\/.*)?$/i);
  if (!m || m[1] === m[1].toLowerCase()) {
    // The admin layout sends signed-out staff to the login page and back here.
    if (!pathname.startsWith("/admin/")) return NextResponse.next();
    const headers = new Headers(req.headers);
    headers.set("x-admin-path", pathname + req.nextUrl.search);
    return NextResponse.next({ request: { headers } });
  }
  const url = req.nextUrl.clone();
  url.pathname = `/${m[1].toLowerCase()}${m[2] ?? "/"}`;
  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: ["/((?!_next/|wp-content/|vcard/).*)"],
};
