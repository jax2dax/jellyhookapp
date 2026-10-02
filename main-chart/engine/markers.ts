// main-chart/engine/markers.ts
//
// Where marker-layer events land on the chart. Pure: takes the series
// already computed for the main chart's own line and never changes it, so
// a marker layer can't affect the line it sits on.
//
// Point markers (conversions) snap FORWARD to the next point: a form
// submitted at 10:43 on the 5s chart is marked on the 10:45 point; one at
// exactly 10:45 stays there. Its height is the line's own height at that
// x, so the dot always sits on the drawn line. Vertical lines (team joins)
// use the event's exact time; they don't touch the line at all.
import type { ComputedSeries, MarkerEvent } from "../types";
import { alignUp } from "./intervals";

export interface PlacedPoint {
  x: number;
  y: number;
  events: MarkerEvent[];
}

function firstAtOrAfter(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (xs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Height of the Trend curve at x, computed exactly the way uPlot draws it
 * (Fritsch-Carlson monotone cubic, uPlot's `_monotoneCubic`). That
 * construction commutes with the axes' linear scaling, so evaluating it in
 * data space gives the same curve uPlot draws in pixel space. Its Bézier
 * control points are evenly spaced in x, so x(t) is linear and t is exact.
 */
export function monotoneCubicAt(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  if (n === 0) return 0;
  if (n === 1 || x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  const i = Math.max(0, firstAtOrAfter(xs, x) - 1);
  const dx = xs[i + 1] - xs[i];
  const t = (x - xs[i]) / dx;
  if (n === 2) return ys[0] + (ys[1] - ys[0]) * t; // uPlot draws a straight line for two points

  const slope = (k: number) => (ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]);
  const tangent = (k: number): number => {
    if (k === 0) return slope(0);
    if (k === n - 1) return slope(n - 2);
    const d0 = slope(k - 1);
    const d1 = slope(k);
    if (d0 === 0 || d1 === 0 || d0 > 0 !== d1 > 0) return 0;
    const h0 = xs[k] - xs[k - 1];
    const h1 = xs[k + 1] - xs[k];
    const m = (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
    return Number.isFinite(m) ? m : 0;
  };
  const p0 = ys[i];
  const p1 = ys[i] + (tangent(i) * dx) / 3;
  const p2 = ys[i + 1] - (tangent(i + 1) * dx) / 3;
  const p3 = ys[i + 1];
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/**
 * Snap each event forward onto the series' points and group events that
 * land on the same point. Events after the line's end, or snapping to before
 * `from`, are left out.
 */
export function placePointMarkers(events: MarkerEvent[], s: ComputedSeries, from: number): PlacedPoint[] {
  const { xs, peak } = s;
  if (xs.length === 0) return [];
  const lastX = xs[xs.length - 1];
  const byX = new Map<number, PlacedPoint>();

  for (const e of events) {
    const target = alignUp(e.t, s.intervalMs, s.offsetMs);
    // Decided on the snapped point itself, before any lookup: otherwise an
    // event from before the view would get pulled onto its first point.
    if (target < from || e.t > lastX) continue;
    // It happened, but its next point is past the line's end (not reached
    // yet, or just outside a custom window): wait at the end.
    let x = Math.min(target, lastX);
    let y: number;
    if (s.mode === "trend") {
      y = monotoneCubicAt(xs, peak as number[], x);
    } else {
      // Bucket mode: x is a point exactly. Envelope mode: the first pixel column at or after it.
      const i = Math.min(firstAtOrAfter(xs, x), xs.length - 1);
      x = xs[i];
      y = peak[i] ?? 0;
    }
    const placed = byX.get(x);
    if (placed) placed.events.push(e);
    else byX.set(x, { x, y, events: [e] });
  }
  return [...byX.values()].sort((a, b) => a.x - b.x);
}

/** Vertical-line events inside [from, to], at their exact time. */
export function eventsInView(events: MarkerEvent[], from: number, to: number): MarkerEvent[] {
  return events.filter((e) => e.t >= from && e.t <= to);
}
