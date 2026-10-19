import { NextResponse, type NextRequest } from "next/server";

// WordPress answered /T/<slug>/ and /Mecard-Profile/<slug>/ too (case-insensitive
// rewrite rules). Next.js routes are case-sensitive, so send those to the
// lowercase path; the page itself then canonicalises the slug.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const m = pathname.match(/^\/(t|mecard-profile)(\/.*)?$/i);
  if (!m || m[1] === m[1].toLowerCase()) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/${m[1].toLowerCase()}${m[2] ?? "/"}`;
  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: ["/((?!_next/|api/|wp-content/|vcard/).*)"],
};
