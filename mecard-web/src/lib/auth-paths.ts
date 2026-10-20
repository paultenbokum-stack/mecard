// Login and account URLs, including the WordPress ones still in bookmarks,
// emails and old links. Pure, so the proxy and tests can use it.

/** Where logged-in customers land (WordPress: mecard_user_home_url()). */
export const HOME = "/manage/";
export const LOGIN = "/my-account/";
export const LOST_PASSWORD = "/my-account/lost-password/";
export const LOGOUT = "/my-account/customer-logout/";

/** A same-site path to continue to after login, or the logged-in home. */
export function safeNext(next: unknown): string {
  const n = typeof next === "string" ? next.trim() : "";
  return /^\/(?![\\/])/.test(n) && !/[\r\n]/.test(n) ? n : HOME;
}

export const loginUrl = (next?: string) => (next && safeNext(next) !== HOME ? `${LOGIN}?next=${encodeURIComponent(next)}` : LOGIN);

/**
 * The new URL for an old WordPress login URL, or null when the path isn't one.
 *   /wp-login.php                         → /my-account/ (redirect_to kept when it is on this site)
 *   /wp-login.php?action=lostpassword|rp  → /my-account/lost-password/
 *   /wp-login.php?action=logout           → /my-account/customer-logout/
 *   /login/, /password-recovery/          → the Toolset login and recovery pages
 */
export function legacyLoginRedirect(pathname: string, params: URLSearchParams, siteOrigin: string): string | null {
  const p = pathname.toLowerCase().replace(/\/+$/, "");
  if (p === "/login") return LOGIN;
  if (p === "/password-recovery") return LOST_PASSWORD;
  if (p !== "/wp-login.php") return null;
  const action = (params.get("action") ?? "").toLowerCase();
  if (["lostpassword", "retrievepassword", "rp", "resetpass"].includes(action)) return LOST_PASSWORD;
  if (action === "logout") return LOGOUT;
  const to = params.get("redirect_to");
  if (to) {
    let path = to;
    try {
      const u = new URL(to, siteOrigin);
      path = u.origin === new URL(siteOrigin).origin || /(^|\.)mecard\.co\.za$/i.test(u.hostname) ? u.pathname + u.search : "";
    } catch {
      path = "";
    }
    // WordPress sent people to wp-admin after login; customers never used it.
    if (path && !path.startsWith("/wp-admin")) return loginUrl(path);
  }
  return LOGIN;
}
