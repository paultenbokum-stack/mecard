import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { googleEnabled } from "@/auth";
import { LoginForm } from "@/components/account/AuthForms";
import { LOST_PASSWORD, safeNext } from "@/lib/auth-paths";
import { currentUserId } from "@/lib/session";
import { googleAction } from "./actions";

export const metadata: Metadata = { title: "Login" };

// WooCommerce's /my-account/ login. Logged-in customers go straight to their
// home (the shop phase brings back orders and account details here).

const ERRORS: Record<string, string> = {
  AccessDenied: "That Google account couldn't be used to sign in. Make sure its email address is verified.",
  OAuthAccountNotLinked: "Sign in with your password, then try Google again.",
  Configuration: "Sign-in isn't available right now. Please try again shortly.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await currentUserId()) redirect(next);
  const error = sp.error ? (ERRORS[sp.error] ?? "Sign-in failed. Please try again.") : null;

  return (
    <div className="acc__wrap acc__wrap--narrow">
      <h1>Login</h1>
      {sp.reset ? <div className="acc-panel acc-panel--ok">Your password has been reset. Log in with your new password.</div> : null}
      {error ? <div className="acc-panel acc-panel--error">{error}</div> : null}
      <div className="acc-panel acc-panel--white">
        {googleEnabled ? (
          <>
            <form action={googleAction}>
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="acc-google">
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                  <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                </svg>
                Continue with Google
              </button>
            </form>
            <div className="acc-divider">or</div>
          </>
        ) : null}
        <LoginForm next={next} />
        <p className="acc__muted" style={{ marginTop: 14, marginBottom: 0 }}>
          <Link href={LOST_PASSWORD}>Lost your password?</Link>
        </p>
      </div>
      <p className="acc__muted">
        New to MeCard? <a href="/sign-up/">Create your free MeCard</a>
      </p>
    </div>
  );
}
