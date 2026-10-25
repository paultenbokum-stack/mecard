import { NextResponse, type NextRequest } from "next/server";
import { legacyLoginRedirect } from "@/lib/auth-paths";

// A test deploy (SITE_NOINDEX=1, on its *.run.app address) asks search engines to stay away.
export function proxy(req: NextRequest) {
  const res = route(req);
  if (process.env.SITE_NOINDEX === "1") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

function route(req: NextRequest) {
  const { pathname, searchParams, origin } = req.nextUrl;

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
  matcher: ["/((?!_next/|api/|wp-content/|vcard/).*)"],
};
