import type { Metadata } from "next";
import { FirstTouch } from "@/components/FirstTouch";
import "./design-tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MeCard", template: "%s – MeCard" },
  description: "Smart business cards and digital profiles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        {children}
        <FirstTouch />
      </body>
    </html>
  );
}
