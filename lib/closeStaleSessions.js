// lib/closeStaleSessions.js
//
// Safety net for sessions the client never closes itself — a tab that's
// killed outright, a crash, a browser that doesn't fire visibilitychange
// reliably. Without this, such a session stays "live" (ended_at null)
// forever, which is how sessions days long were showing up as still going.
//
// A session is stale once last_activity_at is older than the same idle
// threshold the tracker uses client-side (see SESSION_IDLE_TIMEOUT_MS in
// public/tracker.js — keep these in sync). When one is found, it's closed
// with ended_at set to the LEFT_AT of its last page_view (the real moment
// they stopped looking at anything), not "now" — "now" is just whenever
// this sweep happens to run, which has no relationship to when the visitor
// actually left.
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const BATCH_SIZE = 20;

export async function closeStaleSessions(supabase) {
  const staleThreshold = new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS).toISOString();

  const { data: staleSessions, error } = await supabase
    .from("sessions")
    .select("id, session_id, last_activity_at")
    .is("ended_at", null)
    .lt("last_activity_at", staleThreshold)
    .order("last_activity_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[close-stale-sessions] failed to fetch stale sessions:", error.message);
    return;
  }
  if (!staleSessions || staleSessions.length === 0) return;

  for (const session of staleSessions) {
    // The last page this visitor actually looked at in this session — its
    // left_at is the true "when did they stop" moment. Falls back to
    // entered_at (page never closed either) and then to last_activity_at
    // (no page_view at all) if left_at was never recorded.
    const { data: lastPageView } = await supabase
      .from("page_views")
      .select("left_at, entered_at")
      .eq("session_id", session.session_id)
      .order("entered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const endedAt = lastPageView?.left_at || lastPageView?.entered_at || session.last_activity_at;

    const { error: updateError } = await supabase
      .from("sessions")
      .update({ ended_at: endedAt, last_activity_at: endedAt })
      .eq("id", session.id);

    if (updateError) {
      console.error(`[close-stale-sessions] failed to close session=${session.id}:`, updateError.message);
    } else {
      console.log(`[close-stale-sessions] closed session=${session.session_id} ended_at=${endedAt}`);
    }

    // Closing the SESSION is not enough on its own — any page_view still
    // sitting at left_at = null (the client never got to send
    // page_view_end, same underlying cause as the session itself going
    // stale) keeps recomputing its own duration against "now" forever,
    // every single time anyone opens that lead's session replay chart,
    // regardless of the session being closed. This is what produced
    // frames showing tens of thousands of minutes. Every open page_view
    // for this session gets closed here too, dated to the same endedAt.
    const { data: openPageViews, error: openPvError } = await supabase
      .from("page_views")
      .select("id, entered_at")
      .eq("session_id", session.session_id)
      .is("left_at", null);

    if (openPvError) {
      console.error(`[close-stale-sessions] failed to fetch open page_views for session=${session.session_id}:`, openPvError.message);
    } else {
      for (const pv of openPageViews ?? []) {
        const timeOnPage = Math.max(0, new Date(endedAt).getTime() - new Date(pv.entered_at).getTime());
        const { error: pvUpdateError } = await supabase.from("page_views").update({ left_at: endedAt, time_on_page: timeOnPage }).eq("id", pv.id);
        if (pvUpdateError) {
          console.error(`[close-stale-sessions] failed to close page_view=${pv.id}:`, pvUpdateError.message);
        }
      }
    }
  }
}
