import type { Metadata } from "next";
import { NotFoundContent } from "@/components/card/NotFoundContent";

export const metadata: Metadata = { title: { absolute: "Page not found - MeCard" }, robots: { index: false } };

export default function NotFound() {
  return <NotFoundContent />;
}
