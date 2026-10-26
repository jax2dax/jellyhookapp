import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the test server (npm run dev:bench, scripts/sim/dev-bench.mjs) builds into its own folder, so it can run next to `npm run dev`
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        // The tracker is loaded on every page view of every customer site. Without this it is served as
        // "max-age=0, must-revalidate", so the browser re-asks our server on EVERY page. With it, a returning
        // visitor reuses its copy for an hour and a changed tracker reaches everyone within the hour (stale-while-revalidate
        // lets the old copy be used for a day while the new one is fetched in the background).
        source: "/tracker.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
      {
        // The visit chart opened from the Jellyhook card in HubSpot (app/embed/visit): only HubSpot may frame it.
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors https://*.hubspot.com" }],
      },
    ];
  },
};

export default nextConfig;
