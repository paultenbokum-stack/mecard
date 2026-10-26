import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the Cloud Run Docker image (same as Nextag).
  output: "standalone",
  // WordPress URLs end in a slash (mecard.co.za/t/<slug>/). Keep that shape so
  // printed card URLs are answered directly, with no extra redirect hop.
  trailingSlash: true,
  // The old logged-in pages: the team console (Toolset views) and invite links.
  async redirects() {
    const to = (source: string, destination: string) => ({ source, destination, permanent: true });
    return [
      to("/manage-mecard-profiles/", "/manage/"),
      to("/manage-mecard-profiles/dashboard/", "/manage/"),
      to("/manage-mecard-profiles/profiles/", "/manage/"),
      to("/manage-mecard-profiles/live-cards-and-tags/", "/manage/cards/"),
      to("/manage-mecard-profiles/new-cards-and-tags/", "/manage/cards/?tab=new"),
      to("/manage-mecard-profiles/companies/", "/manage/companies/"),
      to("/invite-user/", "/manage/companies/"),
      to("/test-profile-admin/", "/manage/"),
      // Invites sent from WordPress pointed at the request post; open invites
      // for the signed-in email are listed on /manage/.
      to("/request/:slug/", "/manage/"),
      // Some printed QR codes carry an extra segment (/t/<slug>/12345678/);
      // card pages have no sub-pages, so anything after the slug goes to the card.
      to("/t/:slug/:rest+/", "/t/:slug/"),
      // Site pages: copies and old pages that are dropped, and links on the
      // live pages that already led nowhere (get-started, teams).
      to("/home-page/", "/"),
      to("/home-page-2/", "/"),
      to("/how-it-works-2/", "/how-it-works/"),
      to("/order-the-classic-mecard/", "/cards/"),
      to("/get-mecard/", "/cards/"),
      to("/get-started/", "/sign-up/"),
      to("/get-started-teams/", "/sign-up/?for=teams"),
      to("/teams/", "/for-teams/"),
      to("/contact/", "/contact-us/"),
      to("/communication-preferences/", "/"),
      to("/temporarily-unavailable/", "/"),
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Old WordPress endpoints still referenced by cached pages and installed
        // home-screen apps during the switch-over.
        { source: "/wp-json/mecard/v1/track", destination: "/api/track/" },
        { source: "/wp-json/mecard/v1/manifest", destination: "/api/manifest/" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
