// lib/actions/leadQualify.action.js
// Sales's manual "is this lead real or junk" flag — separate from
// form_submissions.confidence, which is an automatic email-presence
// heuristic, not a human judgment. null = not reviewed yet, true =
// qualified/real, false = junk. See mds/database.md's form_submissions
// section.
"use server";

import { createSupabaseClient } from "@/lib/supabase";

export async function setLeadQualified(leadId, qualified) {
  const supabase = createSupabaseClient();

  const { error } = await supabase.from("form_submissions").update({ qualified }).eq("id", leadId);

  if (error) {
    console.error("[leadQualify] update error:", error.message);
    throw new Error(error.message);
  }
}
