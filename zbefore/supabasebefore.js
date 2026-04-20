// lib/actions/supabase.actions.js
// All data fetching for the platform dashboard
// "use server" — these run server-side only, never exposed to client
// Import individual functions as needed per page

"use server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase";

// ─────────────────────────────────────────
// SITE MANAGEMENT
// ─────────────────────────────────────────

// createSite — inserts a new site for the current user
// Returns: site object with api_key
// Params: { name: string, domain: string }
///CREATE SITE FUNCTION
// Replace only the createSite function in lib/actions/supabase.actions.js
// Everything else in that file stays the same.

// createSite — inserts a new site for the current user
// Returns: site object with api_key
// Params: { name: string, domain: string, specify_form: boolean }
export async function createSite({ name, domain, specify_form = false }) {
  const { userId } = await auth();
  const supabase = createSupabaseClient();
  const api_key = crypto.randomUUID();

  const { data, error } = await supabase
    .from("sites")
    .insert({
      name,
      domain,
      api_key,
      user_id: userId,
      plan: "free",
      monthly_event_limit: 10000,
      specify_form: specify_form ?? false, // ← NEW: store the user's choice
    })
    .select()
    .single();

  if (error) {
    console.error("[supabase] createSite error:", error.message);
    throw error;
  }

  console.log(`[supabase] createSite: created siteId=${data.id} domain=${domain} specify_form=${specify_form}`);
  return data;
}

// getSiteSettings — full site row for settings page
// Returns: site object | null
// Params: userId (string) — Clerk userId
export async function getSiteSettings(userId) {
  console.log(`[supabase] getSiteSettings: userId=${userId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[supabase] getSiteSettings error:", error.message);
    return null;
  }

  const site = data?.[0] ?? null;
  console.log(`[supabase] getSiteSettings: ${site ? `siteId=${site.id}` : "not found"}`);
  return site;
}

// ─────────────────────────────────────────
// OVERVIEW / DASHBOARD
// ─────────────────────────────────────────

// getActiveVisitors — count of sessions active in the last 30 seconds
// Use for: "Active Now" stat card
// Returns: number
// Params: siteId (string)
export async function getActiveVisitors(siteId) {
  console.log(`[supabase] getActiveVisitors: siteId=${siteId}`);
  const supabase = createSupabaseClient();
  const threshold = new Date(Date.now() - 30000).toISOString();

  const { data, error } = await supabase
    .from("sessions")
    .select("session_id")
    .eq("site_id", siteId)
    .gte("last_activity_at", threshold);

  if (error) {
    console.error("[supabase] getActiveVisitors error:", error.message);
    return 0;
  }

  console.log(`[supabase] getActiveVisitors result: ${data?.length ?? 0} active`);
  return data?.length ?? 0;
}

// getPageViewsLast24h — total page_views rows entered in last 24 hours
// Use for: "Page Views (24h)" stat card
// Returns: number
// Params: siteId (string)
export async function getPageViewsLast24h(siteId) {
  console.log(`[supabase] getPageViewsLast24h: siteId=${siteId}`);
  const supabase = createSupabaseClient();
  const threshold = new Date(Date.now() - 86400000).toISOString();

  const { data, error } = await supabase
    .from("page_views")
    .select("id")
    .eq("site_id", siteId)
    .gte("entered_at", threshold);

  if (error) {
    console.error("[supabase] getPageViewsLast24h error:", error.message);
    return 0;
  }

  console.log(`[supabase] getPageViewsLast24h result: ${data?.length ?? 0}`);
  return data?.length ?? 0;
}

// getTotalSessions — all-time session count for this site
// Use for: "Total Sessions" stat card
// Returns: number
// Params: siteId (string)
export async function getTotalSessions(siteId) {
  console.log(`[supabase] getTotalSessions: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("site_id", siteId);

  if (error) {
    console.error("[supabase] getTotalSessions error:", error.message);
    return 0;
  }

  console.log(`[supabase] getTotalSessions result: ${data?.length ?? 0}`);
  return data?.length ?? 0;
}

// getTopPages — most visited pages in last 7 days, client-side grouped
// Use for: top pages table on Overview
// Returns: { page_path: string, views: number }[]
// Params: siteId (string), limit (number, default 5)
export async function getTopPages(siteId, limit = 5) {
  console.log(`[supabase] getTopPages: siteId=${siteId}`);
  const supabase = createSupabaseClient();
  const threshold = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data, error } = await supabase
    .from("page_views")
    .select("page_path")
    .eq("site_id", siteId)
    .gte("entered_at", threshold);

  if (error) {
    console.error("[supabase] getTopPages error:", error.message);
    return [];
  }

  const counts = {};
  for (const row of data) {
    counts[row.page_path] = (counts[row.page_path] || 0) + 1;
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([page_path, views]) => ({ page_path, views }));

  console.log(`[supabase] getTopPages result:`, sorted);
  return sorted;
}

// getRecentActivity — latest page_views for live feed table
// Use for: live activity feed on Overview
// Returns: page_view row[]
// Params: siteId (string), limit (number, default 20)
export async function getRecentActivity(siteId, limit = 20) {
  console.log(`[supabase] getRecentActivity: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("page_views")
    .select("id, page_path, visitor_id, entered_at, left_at, time_on_page, scroll_depth")
    .eq("site_id", siteId)
    .order("entered_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[supabase] getRecentActivity error:", error.message);
    return [];
  }

  console.log(`[supabase] getRecentActivity result: ${data?.length ?? 0} rows`);
  return data || [];
}

// ─────────────────────────────────────────
// SECTION 2 — Flexible queries for charts and tables
// ─────────────────────────────────────────

// getAllPageViewsForSite — every page_view row for a site, ordered by entered_at
// Use for: raw data export, full history charts
// Returns: page_view row[]
// Params: siteId (string), limit (number | null — null = no limit)
export async function getAllPageViewsForSite(siteId, limit = null) {
  console.log(`[supabase] getAllPageViewsForSite: siteId=${siteId} limit=${limit}`);
  const supabase = createSupabaseClient();

  let query = supabase
    .from("page_views")
    .select("*")
    .eq("site_id", siteId)
    .order("entered_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("[supabase] getAllPageViewsForSite error:", error.message);
    return [];
  }

  console.log(`[supabase] getAllPageViewsForSite result: ${data?.length ?? 0} rows`);
  return data || [];
}

// getPageViewsInTimeRange — page_views entered between startDate and endDate
// Use for: date-range traffic charts
// Returns: page_view row[]
// Params: siteId (string), startDate (Date | string), endDate (Date | string)
export async function getPageViewsInTimeRange(siteId, startDate, endDate) {
  console.log(`[supabase] getPageViewsInTimeRange: siteId=${siteId} from=${startDate} to=${endDate}`);
  const supabase = createSupabaseClient();

  const startISO = new Date(startDate).toISOString();
  const endISO = new Date(endDate).toISOString();

  const { data, error } = await supabase
    .from("page_views")
    .select("*")
    .eq("site_id", siteId)
    .gte("entered_at", startISO)
    .lte("entered_at", endISO)
    .order("entered_at", { ascending: true });

  if (error) {
    console.error("[supabase] getPageViewsInTimeRange error:", error.message);
    return [];
  }

  console.log(`[supabase] getPageViewsInTimeRange result: ${data?.length ?? 0} rows`);
  return data || [];
}

// getSessionsInTimeRange — sessions started between startDate and endDate
// Use for: session volume charts with date filter
// Returns: session row[]
// Params: siteId (string), startDate (Date | string), endDate (Date | string)
export async function getSessionsInTimeRange(siteId, startDate, endDate) {
  console.log(`[supabase] getSessionsInTimeRange: siteId=${siteId} from=${startDate} to=${endDate}`);
  const supabase = createSupabaseClient();

  const startISO = new Date(startDate).toISOString();
  const endISO = new Date(endDate).toISOString();

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("site_id", siteId)
    .gte("started_at", startISO)
    .lte("started_at", endISO)
    .order("started_at", { ascending: true });

  if (error) {
    console.error("[supabase] getSessionsInTimeRange error:", error.message);
    return [];
  }

  console.log(`[supabase] getSessionsInTimeRange result: ${data?.length ?? 0} rows`);
  return data || [];
}

// getTimeSpentOnPages — page_views with time_on_page, optionally filtered by min duration
// Use for: engagement heatmaps, page quality analysis
// Returns: { page_path, page_title, time_on_page }[]
// Params: siteId (string), minDurationMs (number, default 0 = all)
export async function getTimeSpentOnPages(siteId, minDurationMs = 0) {
  console.log(`[supabase] getTimeSpentOnPages: siteId=${siteId} minDurationMs=${minDurationMs}`);
  const supabase = createSupabaseClient();

  let query = supabase
    .from("page_views")
    .select("page_path, page_title, time_on_page, scroll_depth")
    .eq("site_id", siteId)
    .not("time_on_page", "is", null);

  if (minDurationMs > 0) {
    query = query.gte("time_on_page", minDurationMs);
  }

  const { data, error } = await query.order("time_on_page", { ascending: false });

  if (error) {
    console.error("[supabase] getTimeSpentOnPages error:", error.message);
    return [];
  }

  console.log(`[supabase] getTimeSpentOnPages result: ${data?.length ?? 0} rows`);
  return data || [];
}

// getAllVisitors — all visitor rows for a site
// Use for: unique visitor count, visitor list
// Returns: visitor row[]
// Params: siteId (string), order ("asc" | "desc", default "desc")
export async function getAllVisitors(siteId, order = "desc") {
  console.log(`[supabase] getAllVisitors: siteId=${siteId} order=${order}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("visitors")
    .select("*")
    .eq("site_id", siteId)
    .order("first_seen", { ascending: order === "asc" });

  if (error) {
    console.error("[supabase] getAllVisitors error:", error.message);
    return [];
  }

  console.log(`[supabase] getAllVisitors result: ${data?.length ?? 0} visitors`);
  return data || [];
}

// getVisitorById — single visitor row by visitor_id string
// Use for: visitor detail panel, lead enrichment
// Returns: visitor row | null
// Params: siteId (string), visitorId (string) — the UUID string from localStorage
export async function getVisitorById(siteId, visitorId) {
  console.log(`[supabase] getVisitorById: siteId=${siteId} visitorId=${visitorId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("visitors")
    .select("*")
    .eq("site_id", siteId)
    .eq("visitor_id", visitorId)
    .maybeSingle();

  if (error) {
    console.error("[supabase] getVisitorById error:", error.message);
    return null;
  }

  console.log(`[supabase] getVisitorById: ${data ? "found" : "not found"}`);
  return data ?? null;
}

// getScrollDepthByPage — avg scroll depth grouped by page_path
// Use for: scroll depth heatmap, content engagement
// Returns: { page_path: string, avg_scroll: number, views: number }[]
// Params: siteId (string)
export async function getScrollDepthByPage(siteId) {
  console.log(`[supabase] getScrollDepthByPage: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("page_views")
    .select("page_path, scroll_depth")
    .eq("site_id", siteId)
    .not("scroll_depth", "is", null);

  if (error) {
    console.error("[supabase] getScrollDepthByPage error:", error.message);
    return [];
  }

  const grouped = {};
  for (const row of data) {
    if (!grouped[row.page_path]) grouped[row.page_path] = { total: 0, count: 0 };
    grouped[row.page_path].total += row.scroll_depth;
    grouped[row.page_path].count++;
  }

  const result = Object.entries(grouped).map(([page_path, stats]) => ({
    page_path,
    avg_scroll: Math.round((stats.total / stats.count) * 100),
    views: stats.count,
  })).sort((a, b) => b.views - a.views);

  console.log(`[supabase] getScrollDepthByPage result: ${result.length} pages`);
  return result;
}

// getDeviceBreakdown — count of mobile vs desktop from page_views
// Use for: device type pie/bar chart
// Returns: { device_type: string, count: number }[]
// Params: siteId (string) — NOTE: device_type is on visitors table, not page_views
export async function getDeviceBreakdown(siteId) {
  console.log(`[supabase] getDeviceBreakdown: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("visitors")
    .select("device_type")
    .eq("site_id", siteId)
    .not("device_type", "is", null);

  if (error) {
    console.error("[supabase] getDeviceBreakdown error:", error.message);
    return [];
  }

  const counts = {};
  for (const row of data) {
    const key = row.device_type || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }

  const result = Object.entries(counts).map(([device_type, count]) => ({ device_type, count }));
  console.log(`[supabase] getDeviceBreakdown result:`, result);
  return result;
}

// getCountryBreakdown — session count grouped by country
// Use for: geo chart, country breakdown table
// Returns: { country: string, sessions: number }[]
// Params: siteId (string)
export async function getCountryBreakdown(siteId) {
  console.log(`[supabase] getCountryBreakdown: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("country")
    .eq("site_id", siteId)
    .not("country", "is", null);

  if (error) {
    console.error("[supabase] getCountryBreakdown error:", error.message);
    return [];
  }

  const counts = {};
  for (const row of data) {
    counts[row.country] = (counts[row.country] || 0) + 1;
  }

  const result = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([country, sessions]) => ({ country, sessions }));

  console.log(`[supabase] getCountryBreakdown result: ${result.length} countries`);
  return result;
}

// ─────────────────────────────────────────
// VISITOR JOURNEYS (pro)
// ─────────────────────────────────────────

// getPageBehavior — avg time, scroll, dropoff per page
// Use for: Visitor Journeys table
// Returns: { page_path, views, avg_time_ms, avg_scroll, drop_off }[]
// Params: siteId (string)
export async function getPageBehavior(siteId) {
  console.log(`[supabase] getPageBehavior: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("page_views")
    .select("page_path, time_on_page, scroll_depth, left_at")
    .eq("site_id", siteId)
    .not("time_on_page", "is", null);

  if (error) {
    console.error("[supabase] getPageBehavior error:", error.message);
    return [];
  }

  const grouped = {};
  for (const row of data) {
    if (!grouped[row.page_path]) {
      grouped[row.page_path] = { views: 0, totalTime: 0, totalScroll: 0, exits: 0 };
    }
    grouped[row.page_path].views++;
    grouped[row.page_path].totalTime += row.time_on_page || 0;
    grouped[row.page_path].totalScroll += row.scroll_depth || 0;
    if (row.left_at) grouped[row.page_path].exits++;
  }

  const result = Object.entries(grouped).map(([page_path, stats]) => ({
    page_path,
    views: stats.views,
    avg_time_ms: Math.round(stats.totalTime / stats.views),
    avg_scroll: Math.round((stats.totalScroll / stats.views) * 100),
    drop_off: Math.round((stats.exits / stats.views) * 100),
  }));

  console.log(`[supabase] getPageBehavior result: ${result.length} pages`);
  return result;
}

// ─────────────────────────────────────────
// LEADS (pro + elite)
// ─────────────────────────────────────────

// getLeads — all form_submissions for a site, newest first
// Use for: Leads list page
// Returns: form_submission row[]
// Params: siteId (string)
export async function getLeads(siteId) {
  console.log(`[supabase] getLeads: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("site_id", siteId)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("[supabase] getLeads error:", error.message);
    return [];
  }

  console.log(`[supabase] getLeads result: ${data?.length ?? 0} leads`);
  return data || [];
}

// getLeadTimeline — all page_views for a specific visitor, chronological
// Use for: Lead detail timeline page
// Returns: page_view row[]
// Params: siteId (string), visitorId (string)
export async function getLeadTimeline(siteId, visitorId) {
  console.log(`[supabase] getLeadTimeline: siteId=${siteId} visitorId=${visitorId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("page_views")
    .select("page_path, page_title, entered_at, left_at, time_on_page, scroll_depth")
    .eq("site_id", siteId)
    .eq("visitor_id", visitorId)
    .order("entered_at", { ascending: true });

  if (error) {
    console.error("[supabase] getLeadTimeline error:", error.message);
    return [];
  }

  console.log(`[supabase] getLeadTimeline result: ${data?.length ?? 0} page views`);
  return data || [];
}

// computeLeadScore — pure function, no DB call
// Formula: (pages * 2) + (total_time_sec / 10) + (avg_scroll * 10)
// Use for: hot lead badge on lead detail page
// Returns: number
// Params: pageViews (page_view row[] — output of getLeadTimeline)
export async function computeLeadScore(pageViews) {
  const pages = pageViews.length;
  const totalTimeSec = pageViews.reduce((sum, p) => sum + (p.time_on_page || 0), 0) / 1000;
  const avgScroll = pageViews.reduce((sum, p) => sum + (p.scroll_depth || 0), 0) / (pages || 1);
  const score = Math.round((pages * 2) + (totalTimeSec / 10) + (avgScroll * 10));
  console.log(`[supabase] computeLeadScore: pages=${pages} timeSec=${totalTimeSec.toFixed(1)} avgScroll=${avgScroll.toFixed(2)} score=${score}`);
  return score;
}

// ─────────────────────────────────────────
// ACQUISITION (pro)
// ─────────────────────────────────────────

// getAcquisitionSources — sessions grouped by referrer
// Use for: Acquisition Intelligence page
// Returns: { source: string, sessions: number }[]
// Params: siteId (string)
export async function getAcquisitionSources(siteId) {
  console.log(`[supabase] getAcquisitionSources: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("referrer, session_id")
    .eq("site_id", siteId);

  if (error) {
    console.error("[supabase] getAcquisitionSources error:", error.message);
    return [];
  }

  const counts = {};
  for (const row of data) {
    const source = row.referrer || "direct";
    counts[source] = (counts[source] || 0) + 1;
  }

  const result = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([source, sessions]) => ({ source, sessions }));

  console.log(`[supabase] getAcquisitionSources result: ${result.length} sources`);
  return result;
}

// ─────────────────────────────────────────
// CONVERSIONS (pro)
// ─────────────────────────────────────────

// getConversionPaths — page paths of visitors who submitted a form
// Use for: Conversion Paths page
// Returns: { path: string, conversions: number }[]
// Params: siteId (string)
export async function getConversionPaths(siteId) {
  console.log(`[supabase] getConversionPaths: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data: submissions, error: subError } = await supabase
    .from("form_submissions")
    .select("visitor_id")
    .eq("site_id", siteId);

  if (subError) {
    console.error("[supabase] getConversionPaths submissions error:", subError.message);
    return [];
  }

  const convertedVisitors = [...new Set(submissions.map((s) => s.visitor_id))];
  console.log(`[supabase] getConversionPaths: ${convertedVisitors.length} converted visitors`);
  if (convertedVisitors.length === 0) return [];

  const { data: views, error: viewError } = await supabase
    .from("page_views")
    .select("visitor_id, page_path, entered_at")
    .eq("site_id", siteId)
    .in("visitor_id", convertedVisitors)
    .order("entered_at", { ascending: true });

  if (viewError) {
    console.error("[supabase] getConversionPaths views error:", viewError.message);
    return [];
  }

  const pathsByVisitor = {};
  for (const view of views) {
    if (!pathsByVisitor[view.visitor_id]) pathsByVisitor[view.visitor_id] = [];
    pathsByVisitor[view.visitor_id].push(view.page_path);
  }

  const pathCounts = {};
  for (const paths of Object.values(pathsByVisitor)) {
    const key = paths.join(" → ");
    pathCounts[key] = (pathCounts[key] || 0) + 1;
  }

  const result = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, conversions]) => ({ path, conversions }));

  console.log(`[supabase] getConversionPaths result: ${result.length} paths`);
  return result;
}