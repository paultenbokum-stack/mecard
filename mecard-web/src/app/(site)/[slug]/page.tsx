import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WpPage, wpPageMetadata } from "@/components/site/WpPage";
import { PAGES } from "../pages";

// /how-it-works/, /for-teams/, /cards/, /free/, /gallery/, /contact-us/.
// No `dynamicParams = false`: after a revalidation Next rebuilds these at runtime, and with it
// the rebuilt pages came back as 404. Unknown slugs still get notFound() below.
export const generateStaticParams = () => Object.keys(PAGES).map((slug) => ({ slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = PAGES[(await params).slug];
  return page ? wpPageMetadata(page) : {};
}

export default async function SitePage({ params }: Props) {
  const page = PAGES[(await params).slug];
  if (!page) notFound();
  return <WpPage page={page} />;
}
