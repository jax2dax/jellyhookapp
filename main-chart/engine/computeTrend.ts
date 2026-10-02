// main-chart/engine/computeTrend.ts
//
// The "Trend" variation. Instead of one point per bucket (which holds the
// line flat for as long as nothing happens), there is one point per bucket
// in which the count CHANGED, and the line runs from one change straight to
// the next. A visitor who arrives at 2:30 am with the next change at
// 9:30 pm gives a line that slowly travels between those two moments,
// instead of sitting flat at 1 all day. Steep climbs only appear where
// many visitors come online close together.
//
// Each point's value is the AVERAGE number online across its bucket
// (time-weighted), so a visit that only covers half a 10s bucket counts as
// 0.5 there. That is what makes this view smooth; it's also why it can
// soften a short spike that the Peak views (Smooth / Steps) always show.
import type { ComputedSeries, EventTimeline } from "../types";
import type { ComputeOptions } from "./computeSeries";
import { alignDown, alignUp, bucketOffsetMs } from "./intervals";
import { lowerBound } from "./buildTimeline";

export function computeTrend(tl: EventTimeline, opts: ComputeOptions): ComputedSeries {
  const { from, to, now, dataFrom, intervalMs: I } = opts;
  const offset = bucketOffsetMs(I, from);
  const drawTo = Math.min(to, now);
  const empty: ComputedSeries = { mode: "trend", xs: [], peak: [], low: [], bucketsPerPoint: 1, intervalMs: I, offsetMs: offset };

  let B0 = alignDown(from, I, offset);
  if (B0 < dataFrom) B0 = alignUp(dataFrom, I, offset);
  if (!(B0 < drawTo)) return empty;

  const { times, cum } = tl;
  const E = times.length;
  const kx: number[] = [];
  const kv: number[] = [];

  // Both ends of the line are anchored on REAL change points, even when
  // they sit just outside the view, never on the view's own edges. The
  // edges move while panning; if a ramp started at the left edge, dragging
  // the chart would reshape the line. Anchored this way, the segment
  // between any two changes is identical however the chart is panned.
  let ei = lowerBound(times, B0);
  if (ei > 0 && times[ei - 1] >= dataFrom) {
    // Start one change early: the bucket of the last change before the view.
    ei = lowerBound(times, alignDown(times[ei - 1], I, offset));
  } else if (ei === 0 && dataFrom === -Infinity) {
    // Nothing ever happened before the view: the line is flat at 0 until the
    // bucket right before the first change, then rises into it.
    const firstChangeBucket = E > 0 ? alignDown(times[0], I, offset) : Infinity;
    kx.push(B0);
    kv.push(0);
    if (firstChangeBucket - I > B0 && firstChangeBucket !== Infinity) {
      kx.push(firstChangeBucket - I);
      kv.push(0);
    }
  } else {
    // Earlier history isn't loaded yet: the best available start is the
    // count the view opens with (only until that history arrives).
    kx.push(B0);
    kv.push(Math.max(0, ei > 0 ? cum[ei - 1] : 0));
  }
  let count = ei > 0 ? cum[ei - 1] : 0;

  // One point per bucket that contains a change, valued at that bucket's
  // average. Empty buckets get none, so the curve runs straight across them.
  // Stops one change past the right edge, for the same reason as above.
  while (ei < E && times[ei] < now) {
    const bStart = alignDown(times[ei], I, offset);
    const bEnd = Math.min(bStart + I, now);
    let area = 0;
    let prev = bStart;
    while (ei < E && times[ei] < bEnd) {
      const t = times[ei];
      area += count * (t - prev);
      while (ei < E && times[ei] === t) ei++;
      count = cum[ei - 1];
      prev = t;
    }
    area += count * (bEnd - prev);
    const avg = Math.max(0, area / (bEnd - bStart));
    // A start placeholder in this same bucket is replaced by the real value.
    if (kx.length && kx[kx.length - 1] === bStart) kv[kv.length - 1] = avg;
    else {
      kx.push(bStart);
      kv.push(avg);
    }
    if (bStart >= drawTo) break;
  }

  // No change after the right edge: the line ends at "now", on the real count.
  const last = kx[kx.length - 1];
  if (last < drawTo) {
    kx.push(now);
    kv.push(Math.max(0, count));
  }

  return decimate(kx, kv, B0, drawTo, opts.maxPoints, I, offset);
}

/**
 * More change points inside the view than pixels: average the ones sharing
 * a pixel column. The anchor points outside the view are kept as they are.
 */
function decimate(kx: number[], kv: number[], viewStart: number, viewEnd: number, maxPoints: number, I: number, offset: number): ComputedSeries {
  let i0 = 0;
  while (i0 < kx.length && kx[i0] < viewStart) i0++;
  let i1 = kx.length;
  while (i1 > i0 && kx[i1 - 1] >= viewEnd) i1--;
  const inside = i1 - i0;
  const cols = Math.max(1, Math.floor(maxPoints));
  if (inside <= cols) return { mode: "trend", xs: kx, peak: kv, low: kv, bucketsPerPoint: 1, intervalMs: I, offsetMs: offset };

  const colW = (viewEnd - viewStart) / cols;
  const xs = kx.slice(0, i0);
  const vs = kv.slice(0, i0);
  let col = -1;
  let sx = 0;
  let sv = 0;
  let n = 0;
  const flush = () => {
    if (n > 0) {
      xs.push(sx / n);
      vs.push(sv / n);
    }
  };
  for (let i = i0; i < i1; i++) {
    const c = Math.min(cols - 1, Math.floor((kx[i] - viewStart) / colW));
    if (c !== col) {
      flush();
      col = c;
      sx = sv = n = 0;
    }
    sx += kx[i];
    sv += kv[i];
    n++;
  }
  flush();
  xs.push(...kx.slice(i1));
  vs.push(...kv.slice(i1));
  return { mode: "trend", xs, peak: vs, low: vs, bucketsPerPoint: (viewEnd - viewStart) / I / Math.max(1, xs.length), intervalMs: I, offsetMs: offset };
}
