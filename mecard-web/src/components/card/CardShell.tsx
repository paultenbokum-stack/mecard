import "@fortawesome/fontawesome-free/css/all.min.css";
import "@/app/(card)/card.css";
import { fontVariables } from "@/app/(card)/fonts";

// Wrapper for every page in the WordPress look: card pages and the 404.
export function CardShell({ children }: { children: React.ReactNode }) {
  return <div className={`mecard-site ${fontVariables}`}>{children}</div>;
}
