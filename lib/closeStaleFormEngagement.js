// lib/closeStaleFormEngagement.js
//
// Safety net for the case /api/track's session_end sweep can't cover: the
// tab is killed outright (crash, force-quit, OS kill) and no session_end
// event ever arrives at all — mirrors lib/closeStaleSessions.js exactly.
//
// A form is stale once last_activity_at (falling back to viewed_at if
// somehow never set) is older than the same idle threshold the tracker
// uses client-side for session splitting (SESSION_IDLE_TIMEOUT_MS in
// public/tracker.js — keep these in sync). Finalized as abandoned with
// ended_at set to that same real last-known moment, never "now" — "now" is
// just whenever this sweep happens to run, which has no relationship to
// when the visitor actually stopped.
const FORM_STALE_TIMEOUT_MS = 30 * 60 * 1000;
const BATCH_SIZE = 20;

export async function closeStaleFormEngagement(supabase) {
  const staleThreshold = new Date(Date.now() - FORM_STALE_TIMEOUT_MS).toISOString();

  const { data: staleForms, error } = await supabase
    .from("form_engagement")
    .select("id, last_activity_at, viewed_at")
    .in("status", ["viewed", "started"])
    .or(`last_activity_at.lt.${staleThreshold},and(last_activity_at.is.null,viewed_at.lt.${staleThreshold})`)
    .order("viewed_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[close-stale-form-engagement] failed to fetch stale forms:", error.message);
    return;
  }
  if (!staleForms || staleForms.length === 0) return;

  for (const form of staleForms) {
    const endedAt = form.last_activity_at || form.viewed_at;
    const { error: updateError } = await supabase.from("form_engagement").update({ status: "abandoned", ended_at: endedAt }).eq("id", form.id);
    if (updateError) {
      console.error(`[close-stale-form-engagement] failed to close form=${form.id}:`, updateError.message);
    } else {
      console.log(`[close-stale-form-engagement] closed form=${form.id} ended_at=${endedAt}`);
    }
  }
}
