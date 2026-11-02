import { GoogleTag } from "@/components/GoogleTag";
import { CardShell } from "@/components/card/CardShell";
import { SiteFooter, SiteHeader } from "@/components/card/SiteChrome";
import "./site.css";

// The public site pages, in the same Astra shell as the card and account pages.
// They are static (built from src/content/pages), so the header works out the
// logged-in menu in the browser.

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CardShell>
      <SiteHeader detect tagline />
      {children}
      <SiteFooter />
      <GoogleTag />
    </CardShell>
  );
}
