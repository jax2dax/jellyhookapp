// app/sitemap.ts
// Generates /sitemap.xml. Replaces the hand-written public/sitemap.xml, which went stale every
// time a docs page was added. Docs pages come from DOCS_NAV (the sidebar list), so adding a page
// there puts it in the sitemap too; nothing else to remember.
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { DOCS_NAV } from "./docs/docsNav";
import { DOCS_REVIEWED } from "./docs/docsSync";

/** When the public pages last changed meaningfully. Update it with a redesign or a copy change, so crawlers come back. */
const MARKETING_UPDATED = "2026-10-28";

export default function sitemap(): MetadataRoute.Sitemap {
  const marketing: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: MARKETING_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/demo`, lastModified: MARKETING_UPDATED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/pricing`, lastModified: MARKETING_UPDATED, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: MARKETING_UPDATED, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/privacy`, lastModified: MARKETING_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: MARKETING_UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];

  const seen = new Set<string>();
  const docs: MetadataRoute.Sitemap = [];
  for (const section of DOCS_NAV) {
    for (const item of section.items) {
      const url = item.slug ? `${SITE_URL}/docs/${item.slug}` : `${SITE_URL}/docs`;
      if (seen.has(url)) continue;
      seen.add(url);
      docs.push({ url, lastModified: DOCS_REVIEWED.reviewedOn, changeFrequency: "monthly", priority: item.slug === "" ? 0.9 : 0.6 });
    }
  }
  return [...marketing, ...docs];
}
