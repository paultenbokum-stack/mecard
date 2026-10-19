import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the Cloud Run Docker image (same as Nextag).
  output: "standalone",
  // WordPress URLs end in a slash (mecard.co.za/t/<slug>/). Keep that shape so
  // printed card URLs are answered directly, with no extra redirect hop.
  trailingSlash: true,
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
