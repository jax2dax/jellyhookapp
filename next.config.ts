import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
