// framePlate/geometry/deriveVisitGeometry.ts
//
// Pure function: raw scroll trace → plate geometry (all 0-1 fractions of
// page height). This is the ONLY place that ever looks at raw scroll
// samples — swap in real tracked data later by changing what's fed in here,
// never the renderer.
//
// Algorithm for the "seen once" vs "seen more than once" split:
//   1. enterY = first sample's y, exitY = last sample's y.
//   2. seenOnceTop = the topmost y ever visible (usually ~0, but can be > 0
//      if the visitor scrolled up past where they entered).
//   3. maxScrollY = the deepest y ever reached (the "furthest scroll" bulb).
//   4. Discretize the page into `binCount` horizontal bands and count how
//      many times the visitor's viewport crossed each band across the whole
//      trace. Bands crossed 2+ times form the "seen more than once" region.
//      Its rendered top = the shallowest such band; its bottom is treated as
//      maxScrollY (the assets only ever show a two-band light-then-dark
//      stack, never three, so this collapses to that simpler shape — worth
//      revisiting once real multi-region traces are observed).
// Never throws: any failure logs a clear error and returns a safe flat
// geometry (a single point at the top) rather than breaking the chart.
import type { PageVisitRaw, VisitGeometry, FrameOutcome } from "../types";

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function fallbackGeometry(visit: Partial<PageVisitRaw> | undefined, outcome: FrameOutcome): VisitGeometry {
  const enteredAt = visit?.enteredAt ? new Date(visit.enteredAt).getTime() : 0;
  const leftAt = visit?.leftAt ? new Date(visit.leftAt).getTime() : 0;
  return {
    kind: "visit",
    id: visit?.id ?? "unknown",
    pagePath: visit?.pagePath ?? "",
    durationMs: Number.isFinite(leftAt - enteredAt) ? Math.max(0, leftAt - enteredAt) : 0,
    pageHeightPx: visit?.pageHeightPx ?? 0,
    seenOnceTop: 0,
    seenTwiceTop: null,
    maxScrollY: 0,
    enterY: 0,
    exitY: 0,
    converted: !!visit?.converted,
    outcome,
    headers: visit?.headers,
  };
}

export function deriveVisitGeometry(visit: PageVisitRaw, binCount = 100): VisitGeometry {
  try {
    if (!visit || typeof visit !== "object") {
      console.error("[framePlate] deriveVisitGeometry called with an invalid visit:", visit);
      return fallbackGeometry(visit, "active");
    }

    const durationMs = Math.max(0, new Date(visit.leftAt).getTime() - new Date(visit.enteredAt).getTime());
    const outcome: FrameOutcome = visit.converted ? "converted" : "exitedNormally";
    const trace = visit.scrollTrace;

    if (!trace || trace.length === 0) {
      return { ...fallbackGeometry(visit, outcome), durationMs };
    }

    const ys = trace.map((s) => clamp01(s.y));
    const enterY = ys[0];
    const exitY = ys[ys.length - 1];
    const seenOnceTop = Math.min(...ys);
    const maxScrollY = Math.max(...ys);

    let seenTwiceTop: number | null = null;
    if (ys.length > 1 && binCount > 1) {
      const bins = new Array(binCount).fill(0);
      for (let i = 0; i < ys.length - 1; i++) {
        const a = Math.min(ys[i], ys[i + 1]);
        const b = Math.max(ys[i], ys[i + 1]);
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
      enterY,
      exitY,
      converted: !!visit.converted,
      outcome,
      headers: visit.headers,
    };
  } catch (err) {
    console.error(`[framePlate] deriveVisitGeometry failed for visit "${visit?.id}":`, err);
    return fallbackGeometry(visit, "active");
  }
}
