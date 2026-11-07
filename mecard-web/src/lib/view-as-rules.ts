// Staff "view as customer": the parts the request proxy and the browser banner share.
// While the view-as cookie is set, every write is refused in the proxy, so a code
// path nobody thought about still can't change a customer's account.

export const VIEW_AS_COOKIE = "mecard_view_as";
/** Who is being viewed, for the banner. Holds no rights: identity comes from VIEW_AS_COOKIE. */
export const VIEW_AS_LABEL_COOKIE = "mecard_view_as_label";
export const VIEW_AS_TTL_SECONDS = 60 * 60;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Staff screens stay usable as staff (requireAdmin ignores view-as), sign-in keeps
// working, and leaving view-as is itself a POST.
const NEVER_BLOCKED = /^\/(admin|sales|api\/auth|api\/view-as)(\/|$)/;

export function viewAsBlocks(method: string, pathname: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase()) && !NEVER_BLOCKED.test(pathname);
}

/** Where a refused form goes: the page it came from, flagged so the banner can say it wasn't saved. */
export function readOnlyReturnPath(referer: string | null, fallback: string): string {
  let path = fallback;
  let search = "";
  try {
    if (referer) {
      const url = new URL(referer);
      path = url.pathname;
      search = url.search;
    }
  } catch {
    // Not a URL: use the fallback.
  }
  const params = new URLSearchParams(search);
  params.set("read_only", "1");
  return `${path}?${params}`;
}
