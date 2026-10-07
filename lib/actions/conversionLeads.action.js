// lib/actions/conversionLeads.action.js
// Raw data for /platform/conversions' per-lead "start of session → the
// conversion" cards. Replaces the old "Top paths to conversion" list
// (supabase.actions.js's getConversionPaths, removed — see
// mds/progress_timeline.md). Returns RAW rows only, same pattern as
// lib/actions/leadSessions.action.js — the actual SessionRaw build +
// truncation happens client-side (lib/leadSessions/transform.js), never
// here.
"use server";

import { createSupabaseClient } from "@/lib/supabase/server";
import { requireSiteAccess } from "@/lib/actions/siteAccess";
import { fetchStructureRows } from "@/lib/leadSessions/structureRows";

/**
 * @param {string} siteId
 * @param {string | null} [startIso] null/undefined = all time
 * @param {string | null} [endIso] null/undefined = now
 * @returns {Promise<{ submissions: any[], sessions: any[], pageViews: any[], pageStructure: any[], formEngagement: any[] }>}
 */
export async function getConvertedLeadSessions(siteId, startIso, endIso) {
  await requireSiteAccess(siteId);
  const supabase = await createSupabaseClient();

  let subQuery = supabase
    .from("form_submissions")
    .select("id, visitor_id, session_id, name, email, page_path, submitted_at, qualified")
    .eq("site_id", siteId)
    .order("submitted_at", { ascending: false });
  if (startIso) subQuery = subQuery.gte("submitted_at", startIso);
  if (endIso) subQuery = subQuery.lte("submitted_at", endIso);

  const { data: submissions, error: subError } = await subQuery;
  if (subError) {
    console.error("[conversionLeads] submissions fetch error:", subError.message);
    return { submissions: [], sessions: [], pageViews: [], pageStructure: [], formEngagement: [] };
  }
  if (!submissions || submissions.length === 0) {
    return { submissions: [], sessions: [], pageViews: [], pageStructure: [], formEngagement: [] };
  }

  const sessionIds = Array.from(new Set(submissions.map((s) => s.session_id).filter(Boolean)));
  if (sessionIds.length === 0) {
    return { submissions, sessions: [], pageViews: [], pageStructure: [], formEngagement: [] };
  }

  const [{ data: sessions, error: sessError }, { data: pageViews, error: pvError }] = await Promise.all([
    supabase.from("sessions").select("*").eq("site_id", siteId).in("session_id", sessionIds),
    supabase.from("page_views").select("*").eq("site_id", siteId).in("session_id", sessionIds).order("entered_at", { ascending: true }),
  ]);
  if (sessError) console.error("[conversionLeads] sessions fetch error:", sessError.message);
  if (pvError) console.error("[conversionLeads] page_views fetch error:", pvError.message);

  const pagePaths = Array.from(new Set((pageViews || []).map((pv) => pv.page_path).filter(Boolean)));
  const pageViewIds = (pageViews || []).map((pv) => pv.page_view_id).filter(Boolean);

  const [pageStructure, { data: formEngagement, error: feError }] = await Promise.all([
    fetchStructureRows(supabase, siteId, pagePaths),
    pageViewIds.length ? supabase.from("form_engagement").select("*").eq("site_id", siteId).in("page_view_id", pageViewIds) : Promise.resolve({ data: [] }),
  ]);
  if (feError) console.error("[conversionLeads] form_engagement fetch error:", feError.message);

  return {
    submissions,
    sessions: sessions || [],
    pageViews: pageViews || [],
    pageStructure,
    formEngagement: formEngagement || [],
  };
}
