// lib/actions/leadProfile.actions.js
// Data fetching for the Lead Profile page (app/platform/leads/[lead_id]).
// There is no `leads` or `conversions` table — a "lead" is one row in
// `form_submissions`. This action pulls that specific submission plus every
// other table joined on its visitor_id/session_id (not the row UUIDs) so the
// page can build a full picture: identity for THIS submission, plus that
// visitor's whole session/page-view history for context.
// "use server"

"use server";
import { createSupabaseClient } from "@/lib/supabase";

// getLeadProfileByLeadId — the full profile for one specific form_submissions row
//
// IMPORTANT: the list page (app/platform/leads/page.jsx) shows one row per
// form_submissions entry, but multiple submissions can share the same
// visitor_id (same browser/device submitting more than one test/real form —
// very common on a shared computer, or during manual testing). Keying the
// detail page by visitor_id alone made every submission from the same
// browser resolve to the same page and silently merge into one identity
// (whichever submission was most recent). Keying by the submission's own id
// fixes that: identity always reflects the exact lead that was clicked,
// while sessions/other submissions from the same visitor_id are still shown
// as supporting context.
//
// Returns: { focusSubmission, visitor, sessions, pageViews, submissions } | null
// Params: siteId (string), leadId (string) — form_submissions.id
export async function getLeadProfileByLeadId(siteId, leadId) {
  const supabase = createSupabaseClient();

  const { data: focusSubmission, error: focusError } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("site_id", siteId)
    .eq("id", leadId)
    .maybeSingle();

  if (focusError) console.error("[leadProfile] focusSubmission error:", focusError.message);
  if (!focusSubmission) return null;

  const visitorId = focusSubmission.visitor_id;

  // No visitor_id on the submission itself (shouldn't normally happen, but
  // the column is nullable) — there's nothing to join against, just return
  // this one submission on its own.
  if (!visitorId) {
    return { focusSubmission, visitor: null, sessions: [], pageViews: [], submissions: [focusSubmission] };
  }

  const [{ data: visitorRows, error: visitorError }, { data: sessions, error: sessionsError }, { data: pageViews, error: pageViewsError }, { data: submissions, error: submissionsError }] = await Promise.all([
    // .limit(1) instead of .maybeSingle(): the tracker's upsert-by-lookup can
    // race and leave duplicate visitors rows for the same visitor_id+site_id,
    // and .maybeSingle()/.single() throw ("multiple rows returned") on that —
    // this tolerates the duplicate instead of failing the whole page.
    supabase.from("visitors").select("*").eq("site_id", siteId).eq("visitor_id", visitorId).order("last_seen", { ascending: false }).limit(1),
    supabase.from("sessions").select("*").eq("site_id", siteId).eq("visitor_id", visitorId).order("started_at", { ascending: true }),
    supabase.from("page_views").select("*").eq("site_id", siteId).eq("visitor_id", visitorId).order("entered_at", { ascending: true }),
    supabase.from("form_submissions").select("*").eq("site_id", siteId).eq("visitor_id", visitorId).order("submitted_at", { ascending: true }),
  ]);

  if (visitorError) console.error("[leadProfile] visitor error:", visitorError.message);
  if (sessionsError) console.error("[leadProfile] sessions error:", sessionsError.message);
  if (pageViewsError) console.error("[leadProfile] pageViews error:", pageViewsError.message);
  if (submissionsError) console.error("[leadProfile] submissions error:", submissionsError.message);

  return {
    focusSubmission,
    visitor: visitorRows?.[0] || null,
    sessions: sessions || [],
    pageViews: pageViews || [],
    submissions: submissions || [focusSubmission],
  };
}
