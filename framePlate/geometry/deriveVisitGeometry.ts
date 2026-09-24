// framePlate/geometry/deriveVisitGeometry.ts
//
// Pure function: one page visit's raw scroll trace → plate geometry.
// This is the ONLY place that converts between the two coordinate spaces,
// and getting that conversion wrong is the single easiest way to make the
// whole chart lie about what a visitor actually saw.
//
// ── The two spaces ─────────────────────────────────────────────────────────
//   SCROLL space  (ScrollSample.y, and every *_scroll_depth DB column):
//     0 = not scrolled, 1 = scrolled as far as this page goes.
//     Denominator is the SCROLLABLE RANGE: page_height - viewport_height.
//   PAGE space    (everything in VisitGeometry):
//     0 = top of the page's content, 1 = the bottom of it.
//
// They are NOT the same number. On a page 1.25x the viewport, a visitor who
// scrolls all the way down has scroll y = 1.0, but their viewport's TOP is
// only 20% down the page — its BOTTOM is what reaches 100%.
//
// ── The formulas ───────────────────────────────────────────────────────────
//   vFrac          = viewportHeightPx / pageHeightPx      (one screen, as a page fraction)
//   scrollableFrac = 1 - vFrac                            (how far the viewport TOP can travel)
//   top(y)         = y * scrollableFrac                   SCROLL → PAGE
//   bottom(y)      = top(y) + vFrac                        (what's visible from there)
//
// Worked example (viewport 665px, page 831px → vFrac = 0.80, scrollableFrac = 0.20):
//   - Land on the page, scroll nothing: top = 0, bottom = 0.80.
//     80% of the page is seen before the visitor lifts a finger.
//   - Scroll until the viewport top is 10% down (scroll y = 0.5):
//     seen = 0 → 0.90, unseen = the last 10%. Exit bulb sits at 0.10.
//
// This conversion is entirely INDEPENDENT of plate height — plate height is
// driven by pageHeightPx alone (see scalePlateHeight.ts) and never depends
// on viewport data being present. A visit with an unmeasured viewport still
// gets a correctly-sized plate; only the seen-region math falls back to an
// estimate (see viewportEstimated).
//
// Two invariants fall out of this, both true by construction:
//   1. bottom(y) <= 1 for all y — you cannot see past the end of a page.
//   2. seenBottom - exitY >= vFrac — whatever was on screen when the visitor
//      left was, by definition, seen. So the exit bulb can never sit closer
//      than one viewport height above the bottom of the seen region.
//
// Never throws: any failure logs a clear error and returns a safe, flat
// geometry rather than breaking the chart.
import type { PageVisitRaw, VisitGeometry, FrameOutcome } from "../types";

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/**
 * One viewport height as a fraction of this visit's own page height, clamped
 * so it never reads past 1 (a page shorter than the viewport is fully
 * visible from anywhere). Falls back to `fallbackViewportHeightPx` (a
 * device-typical estimate) when the visit carries no measured viewport of
 * its own — that only affects THIS ratio, never pageHeightPx or plate size.
 */
function resolveViewportFraction(visit: Partial<PageVisitRaw> | undefined, fallbackViewportHeightPx: number): { vFrac: number; estimated: boolean } {
  const pageHeightPx = Number.isFinite(visit?.pageHeightPx) && (visit?.pageHeightPx as number) > 0 ? (visit?.pageHeightPx as number) : 0;
  const measured = Number.isFinite(visit?.viewportHeightPx) && (visit?.viewportHeightPx as number) > 0 ? (visit?.viewportHeightPx as number) : 0;
  const viewportHeightPx = measured || (Number.isFinite(fallbackViewportHeightPx) && fallbackViewportHeightPx > 0 ? fallbackViewportHeightPx : 0);

  if (pageHeightPx <= 0 || viewportHeightPx <= 0) {
    // No usable page height (pre-migration row, or a failed measurement) —
    // treat the page as exactly one screen: fully seen, nothing to convert.
    // This does NOT affect plate height (see scalePlateHeight.ts), only how
    // much of this one plate reads as seen.
    return { vFrac: 1, estimated: true };
  }
  return { vFrac: Math.min(1, viewportHeightPx / pageHeightPx), estimated: measured === 0 };
}

function fallbackGeometry(visit: Partial<PageVisitRaw> | undefined, outcome: FrameOutcome, fallbackViewportHeightPx: number): VisitGeometry {
  const enteredAt = visit?.enteredAt ? new Date(visit.enteredAt).getTime() : 0;
  const leftAt = visit?.leftAt ? new Date(visit.leftAt).getTime() : 0;
  const { vFrac, estimated } = resolveViewportFraction(visit, fallbackViewportHeightPx);
  return {
    kind: "visit",
    id: visit?.id ?? "unknown",
    pagePath: visit?.pagePath ?? "",
    durationMs: Number.isFinite(leftAt - enteredAt) ? Math.max(0, leftAt - enteredAt) : 0,
    pageHeightPx: visit?.pageHeightPx ?? 0,
    seenOnceTop: 0,
    seenTwiceTop: null,
    maxScrollY: 0,
    // Entered and saw one screenful — never a zero-height sliver.
    seenBottom: clamp01(vFrac),
    viewportFraction: vFrac,
    viewportEstimated: estimated,
    enterY: 0,
    exitY: 0,
    converted: !!visit?.converted,
    outcome,
    headers: visit?.headers,
  };
}

/**
 * @param fallbackViewportHeightPx used only when a visit carries no
 *   viewportHeightPx of its own — a device-typical estimate, resolved by the
 *   caller (see FramePlateChart). Never affects plate height.
 */
export function deriveVisitGeometry(visit: PageVisitRaw, fallbackViewportHeightPx = 0, binCount = 100): VisitGeometry {
  try {
    if (!visit || typeof visit !== "object") {
      console.error("[framePlate] deriveVisitGeometry called with an invalid visit:", visit);
      return fallbackGeometry(visit, "active", fallbackViewportHeightPx);
    }

    const durationMs = Math.max(0, new Date(visit.leftAt).getTime() - new Date(visit.enteredAt).getTime());
    const outcome: FrameOutcome = visit.converted ? "converted" : "exitedNormally";
    const trace = visit.scrollTrace;
    const { vFrac, estimated } = resolveViewportFraction(visit, fallbackViewportHeightPx);
    const scrollableFrac = Math.max(0, 1 - vFrac);

    // TEMP DEBUG — remove once the page-height investigation is done.
    console.log(
      `[JH DEBUG][deriveVisitGeometry] ${visit.pagePath} (id=${visit.id}): pageHeightPx=${visit.pageHeightPx}, ` +
        `visit.viewportHeightPx (raw, from DB)=${visit.viewportHeightPx ?? "null/undefined"}, ` +
        `fallbackViewportHeightPx (device-typical, only used if raw is missing)=${fallbackViewportHeightPx}, ` +
        `=> vFrac=${vFrac.toFixed(4)} (estimated=${estimated}), sections(page/viewport)=${(1 / vFrac).toFixed(3)}`
    );

    if (!trace || trace.length === 0) {
      return { ...fallbackGeometry(visit, outcome, fallbackViewportHeightPx), durationMs };
    }

    // SCROLL → PAGE, once, here. Everything below is page fractions.
    const toPage = (scrollY: number) => clamp01(clamp01(scrollY) * scrollableFrac);

    const tops = trace.map((s) => toPage(s.y));
    const enterY = tops[0];
    const exitY = tops[tops.length - 1];
    const seenOnceTop = Math.min(...tops);
    const maxScrollY = Math.max(...tops);
    // The bottom of what's actually visible: even standing still at
    // maxScrollY, the viewport reveals everything down to maxScrollY+vFrac.
    const seenBottom = clamp01(maxScrollY + vFrac);

    // "Seen more than once" — bins counted in PAGE space so the band lines
    // up with everything else. A band the viewport TOP swept twice means the
    // content from there down to seenBottom was on screen twice.
    let seenTwiceTop: number | null = null;
    if (tops.length > 1 && binCount > 1) {
      const bins = new Array(binCount).fill(0);
      for (let i = 0; i < tops.length - 1; i++) {
        const a = Math.min(tops[i], tops[i + 1]);
        const b = Math.max(tops[i], tops[i + 1]);
        const startBin = Math.floor(a * (binCount - 1));
        const endBin = Math.ceil(b * (binCount - 1));
        for (let bIdx = startBin; bIdx <= endBin && bIdx < binCount; bIdx++) bins[bIdx] += 1;
      }
      const revisitedBinIdx = bins.reduce<number | null>((topIdx, count, idx) => {
        if (count >= 2 && topIdx === null) return idx;
        return topIdx;
      }, null);
      if (revisitedBinIdx !== null) {
        seenTwiceTop = revisitedBinIdx / (binCount - 1);
      }
    }

    return {
      kind: "visit",
      id: visit.id,
      pagePath: visit.pagePath,
      durationMs,
      pageHeightPx: Math.max(0, visit.pageHeightPx || 0),
      seenOnceTop,
      seenTwiceTop,
      maxScrollY,
      seenBottom,
      viewportFraction: vFrac,
      viewportEstimated: estimated,
      enterY,
      exitY,
      converted: !!visit.converted,
      outcome,
      headers: visit.headers,
    };
  } catch (err) {
    console.error(`[framePlate] deriveVisitGeometry failed for visit "${visit?.id}":`, err);
    return fallbackGeometry(visit, "active", fallbackViewportHeightPx);
  }
}
