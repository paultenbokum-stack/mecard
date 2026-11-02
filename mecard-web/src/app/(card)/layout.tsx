import type { Viewport } from "next";
import { CardShell } from "@/components/card/CardShell";
import { GoogleTag } from "@/components/GoogleTag";

export const viewport: Viewport = { themeColor: "#ffffff" };

// GA4 (gtag.js, no GTM) as on WordPress. CardBehaviour sends the profile events.

export default function CardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CardShell>
      {children}
      <GoogleTag />
    </CardShell>
  );
}
