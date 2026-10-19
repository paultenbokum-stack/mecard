import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the Cloud Run Docker image (same as Nextag).
  output: "standalone",
  // WordPress URLs end in a slash (mecard.co.za/t/<slug>/). Keep that shape so
  // printed card URLs are answered directly, with no extra redirect hop.
  trailingSlash: true,
};

export default nextConfig;
