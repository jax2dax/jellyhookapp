// app/robots.ts
// Next.js metadata route — generates /robots.txt at build/request time.
// Disallows everything that requires a signed-in session (Google can't
// render it anyway, since middleware redirects an unauthenticated crawler to
// /sign-in) plus the handful of internal/placeholder pages that aren't
// meant to be public search results: the site's real public surface is the
// marketing pages (/, /about, /pricing, /docs, /terms, /privacy).
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/platform",
        "/platform/",
        "/api/",
        "/sign-in",
        "/dashboard",
        "/dev/",
        "/test",
        "/subscriptions",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
