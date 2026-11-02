import type { Metadata } from "next";
import { CardShell } from "@/components/card/CardShell";
import { SiteFooter, SiteHeader } from "@/components/card/SiteChrome";
import { GoogleTag } from "@/components/GoogleTag";
import { currentUserId } from "@/lib/session";
import "./account.css";
import "./shop.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Login, /manage/ and the editors, inside the same Astra page shell as the card pages.
// The Google tag is here too, for the basket and the purchase conversion.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const loggedIn = !!(await currentUserId());
  return (
    <CardShell>
      <SiteHeader loggedIn={loggedIn} detect />
      <main id="content" className="acc">
        {children}
      </main>
      <SiteFooter />
      <GoogleTag />
    </CardShell>
  );
}
