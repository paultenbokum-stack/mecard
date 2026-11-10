import type { Metadata } from "next";
import { CardShell } from "@/components/card/CardShell";
import { SiteFooter, SiteHeader } from "@/components/card/SiteChrome";
import { GoogleTag } from "@/components/GoogleTag";
import { SignupConversion } from "@/components/SignupConversion";
import { currentUserId, isViewingAs } from "@/lib/session";
import "./account.css";
import "./shop.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Login, /manage/ and the editors, inside the same Astra page shell as the card pages.
// The Google tag is here too, for the basket and the signup and purchase conversions.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const loggedIn = !!(await currentUserId());
  // Staff viewing as a customer aren't that customer's page views or conversions.
  const viewingAs = await isViewingAs();
  return (
    <CardShell>
      <SiteHeader loggedIn={loggedIn} detect query />
      <main id="content" className="acc">
        {children}
      </main>
      <SiteFooter />
      {viewingAs ? null : <GoogleTag />}
      {viewingAs ? null : <SignupConversion />}
    </CardShell>
  );
}
