// lib/actions/leadQualify.action.js
// Sales's manual "is this lead real or junk" flag — separate from
// form_submissions.confidence, which is an automatic email-presence
// heuristic, not a human judgment. null = not reviewed yet, true =
// qualified/real, false = junk. See mds/database.md's form_submissions
// section.
//
// Security note (fixed 2026-09-30): this used to update by leadId alone,
// with no auth() check and no verification the lead belonged to a site the
// caller had access to at all. With RLS off on every table, that made this
// an unauthenticated cross-tenant write — anyone who knew (or guessed) a
// form_submissions UUID could qualify/junk any customer's lead, signed in
// or not. Now requires siteId, requires a real session, and requires that
// session to have an active site_members row for that exact site before
// touching anything — and the update itself is still scoped by site_id as
// a second check, not just the membership lookup.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase";

async function hasSiteAccess(supabase, siteId, userId) {
  const { data } = await supabase
    .from("site_members")
    .select("id")
    .eq("site_id", siteId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (data) return true;

  // Legacy fallback — same pattern as settings.actions.js's verifyOwner.
  const { data: siteRow } = await supabase.from("sites").select("user_id").eq("id", siteId).maybeSingle();
  return siteRow?.user_id === userId;
}

export async function setLeadQualified(siteId, leadId, qualified) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");

  const supabase = await createSupabaseClient();

  const allowed = await hasSiteAccess(supabase, siteId, userId);
  if (!allowed) throw new Error("You don't have access to this site");

  const { error } = await supabase.from("form_submissions").update({ qualified }).eq("site_id", siteId).eq("id", leadId);

  if (error) {
    console.error("[leadQualify] update error:", error.message);
    throw new Error(error.message);
  }
}
