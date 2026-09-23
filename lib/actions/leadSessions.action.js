// lib/actions/leadSessions.action.js
// Data fetching for the FramePlate session-explorer on the Lead Profile page.
// Deliberately separate from lib/actions/leadProfile.actions.js (which powers
// the identity header / stats / Path-to-Conversion sections and is left
// untouched) so this new subsystem can't regress anything already working.
//
// Returns RAW rows only — never framePlate shapes. Parsing into
// SessionRaw[]/PageVisitRaw[] happens client-side via
// lib/leadSessions/transform.js#buildSessionsRaw, which is a pure function
// cheap enough to re-run on every render. That split is what lets the two
// fetches below have independent cache TTLs (see lib/leadSessionsCache.js)
// without the parser caring which tier changed.
"use server";
import { createSupabaseClient } from "@/lib/supabase";

// getLeadSessionRows — sessions + page_views + form_submissions for one
// visitor. This is the volatile tier: a brand new session can start, or the
// current live session's page_views can change, at any moment while a SaaS
// user has this lead page open.
//
// Returns: { sessions, pageViews, submissions } | null
export async function getLeadSessionRows(siteId, visitorId) {
  if (!siteId || !visitorId) return null;
  const supabase = createSupabaseClient();

  const [{ data: sessions, error: sessionsError }, { data: pageViews, error: pageViewsError }, { data: submissions, error: submissionsError }] = await Promise.all([
    supabase.from("sessions").select("*").eq("site_id", siteId).eq("visitor_id", visitorId).order("started_at", { ascending: true }),
    supabase.from("page_views").select("*").eq("site_id", siteId).eq("visitor_id", visitorId).order("entered_at", { ascending: true }),
    supabase.from("form_submissions").select("*").eq("site_id", siteId).eq("visitor_id", visitorId).order("submitted_at", { ascending: true }),
  ]);

  if (sessionsError) console.error("[leadSessions.action] sessions error:", sessionsError.message);
  if (pageViewsError) console.error("[leadSessions.action] pageViews error:", pageViewsError.message);
  if (submissionsError) console.error("[leadSessions.action] submissions error:", submissionsError.message);

  return {
    sessions: sessions || [],
    pageViews: pageViews || [],
    submissions: submissions || [],
  };
}

// getLeadPageStructureRows — header/page-height rows for a set of page_paths.
// This is the static tier: page content structure essentially never changes
// once tracked, so it's fetched once per set of known paths and cached long.
//
// Params: siteId, pagePaths (string[])
// Returns: page_structure rows | []
export async function getLeadPageStructureRows(siteId, pagePaths) {
  if (!siteId || !Array.isArray(pagePaths) || pagePaths.length === 0) return [];
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.from("page_structure").select("*").eq("site_id", siteId).in("page_path", pagePaths);

  if (error) console.error("[leadSessions.action] page_structure error:", error.message);
  return data || [];
}
