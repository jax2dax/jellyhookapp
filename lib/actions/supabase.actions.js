// actions.js
"use server";
import { revalidatePath } from "next/cache";
import { auth } from '@clerk/nextjs/server'
import { createSupabaseClient } from "@/lib/supabase";

/////////////////////////////////////////////
//Debug Dashboard asked
export async function getUserSites() {
  const { userId } = await auth();
  const supabase = createSupabaseClient();

  return await supabase
    .from("sites")
    .select("*")
    .eq("user_id", userId);
}

export async function getAnalytics(siteId) {
  const supabase = createSupabaseClient();

  const { data: pageViews } = await supabase
    .from("page_views")
    .select("*")
    .eq("site_id", siteId);

  return pageViews;
}
//////////////////////////////////////////////////////
//dashboard reload asked 
export async function createSite({ name, domain }) {
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
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

//////////////////////////////////////////////////////////


// ─────────────────────────────────────────
// OVERVIEW / DASHBOARD
// ─────────────────────────────────────────

// getActiveVisitors — visitors active in last 30 seconds
// Used for: live active users card on Overview
export async function getActiveVisitors(siteId) {
  console.log(`[supabase] getActiveVisitors: siteId=${siteId}`);
  const supabase = createSupabaseClient();
  const threshold = new Date(Date.now() - 30000).toISOString();

  const { data, error } = await supabase
    .from("sessions")
    .select("session_id")
    .eq("site_id", siteId)
    .gte("last_activity_at", threshold);

  if (error) console.error("[supabase] getActiveVisitors error:", error.message);
  console.log(`[supabase] getActiveVisitors result: ${data?.length ?? 0} active`);
  return data?.length ?? 0;
}

// getPageViewsLast24h — total page views in last 24 hours
// Used for: page views card on Overview
export async function getPageViewsLast24h(siteId) {
  console.log(`[supabase] getPageViewsLast24h: siteId=${siteId}`);
  const supabase = createSupabaseClient();
  const threshold = new Date(Date.now() - 86400000).toISOString();

  const { data, error } = await supabase
    .from("page_views")
    .select("id")
    .eq("site_id", siteId)
    .gte("entered_at", threshold);

  if (error) console.error("[supabase] getPageViewsLast24h error:", error.message);
  console.log(`[supabase] getPageViewsLast24h result: ${data?.length ?? 0}`);
  return data?.length ?? 0;
}

// getTopPages — most visited pages, last 7 days
// Used for: top pages table on Overview
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

  // Count client-side — avoids complex supabase group-by syntax
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

// getRecentActivity — latest page view events for live feed
// Used for: live activity feed on Overview
export async function getRecentActivity(siteId, limit = 20) {
  console.log(`[supabase] getRecentActivity: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("page_views")
    .select("id, page_path, visitor_id, entered_at, left_at, time_on_page, scroll_depth")
    .eq("site_id", siteId)
    .order("entered_at", { ascending: false })
    .limit(limit);

  if (error) console.error("[supabase] getRecentActivity error:", error.message);
  console.log(`[supabase] getRecentActivity result: ${data?.length ?? 0} rows`);
  return data || [];
}

// getTotalSessions — total unique sessions all time
// Used for: sessions card on Overview
export async function getTotalSessions(siteId) {
  console.log(`[supabase] getTotalSessions: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("site_id", siteId);

  if (error) console.error("[supabase] getTotalSessions error:", error.message);
  return data?.length ?? 0;
}

// ─────────────────────────────────────────
// VISITOR JOURNEYS (pro)
// ─────────────────────────────────────────

// getPageBehavior — avg time, avg scroll, views per page
// Used for: Visitor Journeys table
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

  // Group client-side for flexibility
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

// getLeads — all form submissions for a site
// Used for: Leads list page (pro)
export async function getLeads(siteId) {
  console.log(`[supabase] getLeads: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("site_id", siteId)
    .order("submitted_at", { ascending: false });

  if (error) console.error("[supabase] getLeads error:", error.message);
  console.log(`[supabase] getLeads result: ${data?.length ?? 0} leads`);
  return data || [];
}

// getLeadTimeline — all page views for a specific visitor
// Used for: Lead detail page /leads/[visitor_id] (elite)
export async function getLeadTimeline(siteId, visitorId) {
  console.log(`[supabase] getLeadTimeline: siteId=${siteId} visitorId=${visitorId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("page_views")
    .select("page_path, page_title, entered_at, left_at, time_on_page, scroll_depth")
    .eq("site_id", siteId)
    .eq("visitor_id", visitorId)
    .order("entered_at", { ascending: true });

  if (error) console.error("[supabase] getLeadTimeline error:", error.message);
  console.log(`[supabase] getLeadTimeline result: ${data?.length ?? 0} page views`);
  return data || [];
}

// getLeadScore — computes hot lead score for a visitor
// Formula: (pages * 2) + (total_time_seconds / 10) + (avg_scroll * 10)
// Used for: hot lead detection (elite)
export async function computeLeadScore(pageViews) {
  const pages = pageViews.length;
  const totalTimeSec = pageViews.reduce((sum, p) => sum + (p.time_on_page || 0), 0) / 1000;
  const avgScroll = pageViews.reduce((sum, p) => sum + (p.scroll_depth || 0), 0) / (pages || 1);
  const score = Math.round((pages * 2) + (totalTimeSec / 10) + (avgScroll * 10));
  console.log(`[supabase] computeLeadScore: pages=${pages} timeSec=${totalTimeSec} avgScroll=${avgScroll} score=${score}`);
  return score;
}

// ─────────────────────────────────────────
// ACQUISITION (pro)
// ─────────────────────────────────────────

// getAcquisitionSources — traffic grouped by referrer
// Used for: Acquisition Intelligence page
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

// getConversionPaths — top paths that ended in form submission
// Used for: Conversion Paths page
export async function getConversionPaths(siteId) {
  console.log(`[supabase] getConversionPaths: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  // Get all visitors who submitted a form
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

  // Get their page paths in order
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

  // Build path per visitor
  const pathsByVisitor = {};
  for (const view of views) {
    if (!pathsByVisitor[view.visitor_id]) pathsByVisitor[view.visitor_id] = [];
    pathsByVisitor[view.visitor_id].push(view.page_path);
  }

  // Count path frequencies
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

// ─────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────

// getSiteSettings — full site record for settings page
export async function getSiteSettings(userId) {
  console.log(`[supabase] getSiteSettings: userId=${userId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (error) console.error("[supabase] getSiteSettings error:", error.message);
  return data || null;
}
