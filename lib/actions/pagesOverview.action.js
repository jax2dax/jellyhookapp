// lib/actions/pagesOverview.action.js
// "How many people are looking at each page" — one row per page_path with
// both raw view count and unique-visitor count (a page can rack up many
// views from a handful of people, or vice versa; the dashboard should show
// both, not just one number pretending to be the other).
"use server";

import { createSupabaseClient } from "@/lib/supabase";

// getSitePagesOverview — all-time per-page traffic breakdown
// Returns: { page_path, views, uniqueVisitors, avgTimeMs, avgScrollPct }[]
//          sorted by views descending
// Params: siteId (string)
export async function getSitePagesOverview(siteId) {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("page_views")
    .select("page_path, visitor_id, time_on_page, scroll_depth")
    .eq("site_id", siteId);

  if (error) {
    console.error("[pagesOverview] getSitePagesOverview error:", error.message);
    return [];
  }

  const grouped = {};
  for (const row of data || []) {
    const path = row.page_path || "(unknown)";
    if (!grouped[path]) {
      grouped[path] = { views: 0, visitors: new Set(), totalTime: 0, timeSamples: 0, totalScroll: 0, scrollSamples: 0 };
    }
    const g = grouped[path];
    g.views += 1;
    if (row.visitor_id) g.visitors.add(row.visitor_id);
    if (row.time_on_page != null) {
      g.totalTime += row.time_on_page;
      g.timeSamples += 1;
    }
    if (row.scroll_depth != null) {
      g.totalScroll += row.scroll_depth;
      g.scrollSamples += 1;
    }
  }

  return Object.entries(grouped)
    .map(([page_path, g]) => ({
      page_path,
      views: g.views,
      uniqueVisitors: g.visitors.size,
      avgTimeMs: g.timeSamples ? Math.round(g.totalTime / g.timeSamples) : null,
      avgScrollPct: g.scrollSamples ? Math.round((g.totalScroll / g.scrollSamples) * 100) : null,
    }))
    .sort((a, b) => b.views - a.views);
}
