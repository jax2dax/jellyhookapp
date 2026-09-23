// framePlate/geometry/buildTimeline.ts
//
// Orchestrates a SessionRaw into the ordered TimelineItem[] the strip
// renders: derives each visit's geometry, inserts a "gap" (away) frame
// wherever the visitor left the site and came back within the same
// session, and applies the optional domainEnd cutoff for bounded variants
// (e.g. stop the chart exactly at the conversion moment).
import { deriveVisitGeometry } from "./deriveVisitGeometry";
import type { PageVisitRaw, SessionRaw, TimelineItem } from "../types";

const DEFAULT_MIN_GAP_MS = 15_000; // gaps shorter than this are just normal page-to-page navigation time, not an "away" frame

export function buildTimeline(session: SessionRaw, domainEnd?: string, minGapMs: number = DEFAULT_MIN_GAP_MS): TimelineItem[] {
  try {
    if (!session || !Array.isArray(session.visits)) {
      console.error("[framePlate] buildTimeline called with an invalid session:", session);
      return [];
    }

    const domainEndMs = domainEnd ? new Date(domainEnd).getTime() : Infinity;

    const visits: PageVisitRaw[] = [...session.visits]
      .filter((v) => v && v.enteredAt && new Date(v.enteredAt).getTime() < domainEndMs)
      .sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime());

    const timeline: TimelineItem[] = [];

    for (let i = 0; i < visits.length; i++) {
      const visit = visits[i];
      timeline.push(deriveVisitGeometry(visit));

      const next = visits[i + 1];
      if (next) {
        const gapMs = new Date(next.enteredAt).getTime() - new Date(visit.leftAt).getTime();
        if (Number.isFinite(gapMs) && gapMs > minGapMs) {
          timeline.push({ kind: "gap", id: `gap-${visit.id}-${next.id}`, durationMs: gapMs, outcome: "away" });
        }
      }
    }

    // A session with no endedAt is still open right now — the visitor may
    // be on the site this instant. Only the LAST item can be "live" (every
    // earlier visit already has a real leftAt from navigating away). Don't
    // clobber "converted", though — if they converted and just haven't left
    // yet, that's the more important signal to keep showing.
    const lastItem = timeline[timeline.length - 1];
    if (!session.endedAt && lastItem?.kind === "visit" && lastItem.outcome !== "converted") {
      lastItem.outcome = "live";
    }

    return timeline;
  } catch (err) {
    console.error("[framePlate] buildTimeline failed — rendering an empty session.", err);
    return [];
  }
}
