import { HomePage } from "@/components/site/HomePage";
import { wpPageMetadata } from "@/components/site/WpPage";
import { HOME } from "./pages";
import "./home.css";

export const metadata = wpPageMetadata(HOME);

export default function Page() {
  return <HomePage />;
}
