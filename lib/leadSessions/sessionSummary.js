// lib/leadSessions/sessionSummary.js
//
// Pure aggregation: one SessionRaw → the facts the session-detail drawer
// shows. Session-level only (per-page breakdowns are a later feature) —
// deliberately doesn't compare this session to any other, just states what
// happened in it.
//
// Reuses framePlate's own buildTimeline() rather than re-deriving durations/
// gaps/seen-ranges by hand — the drawer's numbers must never be able to
// disagree with what the chart above it is drawing. This is the one place
// outside framePlate/ that's allowed to import its geometry functions
// directly (not just the chart component) — see framePlate/architecture.md
// §7 for the fetch → parse → cache → render boundary this still respects
// (no DB access here, just aggregation of already-parsed SessionRaw data).
import { buildTimeline } from "@/framePlate";

/**
 * @param {import("@/framePlate").SessionRaw} session
 * @param {number} [fallbackViewportHeightPx] same fallback FramePlateChart
 *   resolves from deviceType — passed through so "headers seen" agrees with
 *   whatever the chart itself is currently rendering as seen/unseen.
 */
export function buildSessionSummary(session, fallbackViewportHeightPx = 0) {
  try {
    if (!session || !Array.isArray(session.visits)) {
      console.error("[sessionSummary] buildSessionSummary called with an invalid session:", session);
      return null;
    }

    const timeline = buildTimeline(session, undefined, undefined, fallbackViewportHeightPx);
    const visitItems = timeline.filter((i) => i.kind === "visit");
    const gapItems = timeline.filter((i) => i.kind === "gap");

    const totalVisitTimeMs = visitItems.reduce((sum, v) => sum + (v.durationMs || 0), 0);
    // "Outside the site" — only counts gaps long enough that buildTimeline
    // treated them as a real departure (see its minGapMs), not the few
    // seconds between clicking one page and the next loading.
    const timeOutsideMs = gapItems.reduce((sum, g) => sum + (g.durationMs || 0), 0);

    const startedAtMs = session.startedAt ? new Date(session.startedAt).getTime() : null;
    const isLive = !session.endedAt;
    const endedAtMs = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    const totalSessionDurationMs = startedAtMs != null && Number.isFinite(endedAtMs - startedAtMs) ? Math.max(0, endedAtMs - startedAtMs) : null;

    // Headers seen across the WHOLE session — deduped by text, since the
    // same heading text showing up more than once (rare, but possible
    // across pages) should read as one fact, not two rows. "Seen" means it
    // fell inside this visit's own seen range — the same definition the
    // plate's green bands render, computed identically (see
    // framePlate/geometry/deriveVisitGeometry.ts).
    const headerSeenByText = new Map();
    for (const visit of visitItems) {
      if (!visit.headers) continue;
      for (const h of visit.headers) {
        const seen = h.y >= visit.seenOnceTop && h.y <= visit.seenBottom;
        headerSeenByText.set(h.text, headerSeenByText.get(h.text) || seen);
      }
    }
    const headers = Array.from(headerSeenByText.entries()).map(([text, seen]) => ({ text, seen }));

    return {
      totalVisitTimeMs,
      timeOutsideMs,
      totalSessionDurationMs,
      pagesVisited: visitItems.length,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      isLive,
      headers,
    };
  } catch (err) {
    console.error("[sessionSummary] buildSessionSummary failed:", err);
    return null;
  }
}
