import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CardPage } from "@/components/card/CardPage";
import { SiteFooter, SiteHeader } from "@/components/card/SiteChrome";
import { cardMetadata } from "@/lib/card-metadata";
import { getCardBySlug, getProfileView, needsCanonicalRedirect } from "@/lib/public-profile";
import { siteUrl } from "@/lib/site";

// /t/<slug>/ — the URL printed on every card, NFC chip and QR code. It must
// keep answering exactly as WordPress did (single-t.php):
//   linked to a live profile → that profile, with tag tracking (source "nfc");
//   not linked to a profile  → the empty site page (200), as WordPress showed;
//   trashed tag, or unknown  → 404;
//   linked to an archived profile → 404, like the profile's own page.

// Five minutes until the editors (phase 4) refresh pages on save via
// revalidatePath(); a newly linked card must not stay on a cached 404 for long.
export const revalidate = 300;
export const generateStaticParams = async () => [];

// Cards carry an "auto download vCard" setting, but WordPress read it from the
// profile instead of the card, so it has never fired. Off unless
// MECARD_VCARD_AUTO_DOWNLOAD=on.
const AUTO_DOWNLOAD_ENABLED = process.env.MECARD_VCARD_AUTO_DOWNLOAD === "on";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const card = await getCardBySlug(slug);
  if (!card || card.archived) return null;
  const view = card.profileId ? await getProfileView(card.profileId) : null;
  if (view?.profile.archived) return null;
  return { card, view };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load((await params).slug);
  if (!found) return {};
  const { card, view } = found;
  const title = card.title || card.slug;
  if (!view) return { title: { absolute: `${title} - MeCard` }, robots: { index: false, follow: true } };
  return cardMetadata(view, { title, url: siteUrl(`/t/${card.slug}/`) });
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const { card, view } = found;
  if (needsCanonicalRedirect(slug)) permanentRedirect(`/t/${card.slug}/`);

  if (!view) {
    return (
      <>
        <SiteHeader />
        <main id="content" />
        <SiteFooter />
      </>
    );
  }

  return (
    <CardPage
      view={view}
      context={{
        type: "tag",
        id: card.id,
        tagType: card.type || null,
        pageUrl: siteUrl(`/t/${card.slug}/`),
        autoDownload: AUTO_DOWNLOAD_ENABLED && card.autoDownloadVcard,
      }}
    />
  );
}
