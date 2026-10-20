import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CardPage } from "@/components/card/CardPage";
import { UnlinkedCard } from "@/components/card/UnlinkedCard";
import { cardMetadata } from "@/lib/card-metadata";
import { getCardBySlug, getProfileView, needsCanonicalRedirect } from "@/lib/public-profile";
import { siteUrl } from "@/lib/site";

// /t/<slug>/ — the URL printed on every card, NFC chip and QR code. It must
// keep resolving as it did on WordPress (single-t.php):
//   linked to a live profile → that profile, with tag tracking (source "nfc");
//   not linked to a profile  → "this card isn't set up yet" (200; WordPress showed an empty page);
//   trashed tag, or unknown  → 404;
//   linked to an archived profile → 404, like the profile's own page.

// Five minutes until the editors (phase 4) refresh pages on save via
// revalidatePath(); a newly linked card must not stay on a cached 404 for long.
export const revalidate = 300;
export const generateStaticParams = async () => [];

// Each card's "auto download vCard" setting: the first tap on that card saves
// the contact. (WordPress read the setting from the profile instead of the
// card, so it never fired there.) MECARD_VCARD_AUTO_DOWNLOAD=off switches it
// off everywhere.
const AUTO_DOWNLOAD_ENABLED = process.env.MECARD_VCARD_AUTO_DOWNLOAD !== "off";

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

  if (!view) return <UnlinkedCard />;

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
