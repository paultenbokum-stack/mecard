import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CardPage } from "@/components/card/CardPage";
import { cardMetadata } from "@/lib/card-metadata";
import { displayName, getProfileBySlug, needsCanonicalRedirect } from "@/lib/public-profile";
import { getPublicProfileView } from "@/lib/public-view";
import { siteUrl } from "@/lib/site";

// /mecard-profile/<slug>/ — a profile's own page. Archived (trashed) profiles
// were 404 on WordPress and stay 404.

// Rendered on first request, then served from cache. Five minutes until the
// editors (phase 4) refresh pages on save with revalidatePath() over
// profilePaths(); a new profile must not stay on a cached 404 for long.
export const revalidate = 300;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const p = await getProfileBySlug(slug);
  if (!p || p.archived) return null;
  return getPublicProfileView(p.id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await load((await params).slug);
  if (!view) return {};
  return cardMetadata(view, { title: displayName(view.profile), url: siteUrl(`/mecard-profile/${view.profile.slug}/`) });
}

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params;
  const view = await load(slug);
  if (!view) notFound();
  if (needsCanonicalRedirect(slug)) permanentRedirect(`/mecard-profile/${view.profile.slug}/`);
  return (
    <CardPage
      view={view}
      context={{ type: "profile", id: view.profile.id, tagType: null, pageUrl: siteUrl(`/mecard-profile/${view.profile.slug}/`), autoDownload: false }}
    />
  );
}
