import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LOGIN } from "@/lib/auth-paths";
import { currentUserId } from "@/lib/session";
import { logoutAction } from "../actions";

export const metadata: Metadata = { title: "Log out" };

// WooCommerce's customer-logout endpoint asked for confirmation too; signing
// out takes a POST so a link elsewhere can't log people out.
export default async function LogoutPage() {
  if (!(await currentUserId())) redirect(LOGIN);
  return (
    <div className="acc__wrap acc__wrap--narrow">
      <h1>Log out</h1>
      <div className="acc-panel acc-panel--white">
        <p>Are you sure you want to log out?</p>
        <form action={logoutAction}>
          <button type="submit" className="acc-btn acc-btn--primary">
            Confirm and log out
          </button>
        </form>
      </div>
    </div>
  );
}
