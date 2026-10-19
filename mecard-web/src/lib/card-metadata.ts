import type { Metadata } from "next";
import { imageUrl } from "./images/paths";
import { companyLabel, displayName, isPro, type ProfileView } from "./public-profile";
import { siteUrl } from "./site";

// <head> for card pages: Yoast's title and robots, the Open Graph tags from
// Me\Viral\Module::render_og_meta(), and the install manifest.

export function cardMetadata(view: ProfileView, opts: { title: string; url: string }): Metadata {
  const { profile: p } = view;
  const name = displayName(p);
  const company = companyLabel(view);
  const job = p.jobTitle;
  const free = !isPro(p);
  const ogTitle = [name, job && company ? `${job} at ${company}` : job || company].filter(Boolean).join(" — ");
  const description = free
    ? `${name}'s digital business card, powered by MeCard. Tap to save their contact details.`
    : `${name}'s digital business card. Tap to save their contact details.`;
  const photo = imageUrl(p.photoPath, 640);
  const image = photo ? siteUrl(photo) : undefined;
  const profileUrl = siteUrl(`/mecard-profile/${p.slug}/`);

  return {
    title: { absolute: `${opts.title} - MeCard` },
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: opts.url },
    manifest: `/api/manifest/?pid=${p.id}&v=${encodeURIComponent(p.updatedAt.toISOString())}`,
    icons: { icon: [{ url: "/favicon-32.png", sizes: "32x32" }, { url: "/favicon-192.png", sizes: "192x192" }], apple: "/favicon-192.png" },
    openGraph: {
      type: "profile",
      title: ogTitle,
      description,
      url: profileUrl,
      siteName: free ? "MeCard" : company || "MeCard",
      images: image ? [image] : undefined,
    },
    twitter: { card: "summary", title: ogTitle, description, images: image ? [image] : undefined },
  };
}
