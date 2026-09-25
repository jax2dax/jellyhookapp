// framePlate/format.ts
// Duration label formatting for the ribbon, matching the assets' style:
// "40 sec", "5 MIN", falling back to a compact "Xm Ys" for non-round minutes.
export function formatFrameDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} sec`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes} MIN`;
  return `${minutes}m ${seconds}s`;
}

import type { VisitGeometry } from "./types";

export interface SeenBreakdown {
  seenOncePct: number;
  seenTwicePct: number;
  notSeenPct: number;
}

/**
 * The full page height is 100%. Everything from the topmost-ever-visible
 * point down to seenBottom (the deepest viewport's BOTTOM edge, not just its
 * top) was on screen at least once; the "seen 2x+" band is the part of that
 * range revisited; "not seen" is whatever falls above or below.
 *
 * Shared between the hover tooltip (Frame.tsx) and the click-to-select
 * details panel (SelectedFrameDetails) so the two can never disagree about
 * what the plate is actually showing.
 */
export function computeSeenBreakdown(item: VisitGeometry): SeenBreakdown {
  const { seenOnceTop, seenTwiceTop, seenBottom } = item;
  const seenTwicePct = seenTwiceTop !== null ? Math.max(0, seenBottom - seenTwiceTop) : 0;
  const seenOncePct = Math.max(0, (seenTwiceTop ?? seenBottom) - seenOnceTop);
  const notSeenPct = Math.max(0, 1 - seenOncePct - seenTwicePct);
  return { seenOncePct, seenTwicePct, notSeenPct };
}
