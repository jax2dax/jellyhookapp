// main-chart/engine/computeSeries.ts
//
// The core rule (see main-chart/overview.md): a bucket's value is the PEAK
// number of visitors actively online (a page view open, see OnlineSpan) at
// any instant inside that bucket. Nothing is averaged, and a visit shorter
// than the interval still shows up.
//
// When there are more buckets than pixel columns (e.g. 5s buckets across
// five months), each point becomes one pixel column and carries the
// highest and lowest bucket value inside it. The bucket values themselves
// never change with the window size; only how many share a pixel does.
//
// Runs in O(events in view + points), not O(buckets): runs of buckets with
// no events in them are skipped in one step, since every one of them has
// the same value. That's what keeps a 2.6-million-bucket view cheap enough
// to recompute on every pan/zoom frame.
import type { ComputedSeries, EventTimeline } from "../types";
import { alignDown, alignUp, bucketOffsetMs } from "./intervals";
import { lowerBound } from "./buildTimeline";

export interface ComputeOptions {
  from: number;
  to: number;
  now: number;
  /** earliest time the loaded data is complete for; nothing before it is computed */
  dataFrom: number;
  intervalMs: number;
  /** usually the plot's width in CSS px — one point per column at most */
  maxPoints: number;
}

export function computeSeries(tl: EventTimeline, opts: ComputeOptions): ComputedSeries {
  const { from, to, now, dataFrom, intervalMs: I } = opts;
  const offset = bucketOffsetMs(I, from);
  const drawTo = Math.min(to, now);
  const empty: ComputedSeries = { mode: "bucket", xs: [], peak: [], low: [], bucketsPerPoint: 1, intervalMs: I, offsetMs: offset };

  let B0 = alignDown(from, I, offset);
  // A bucket that starts before the loaded data would be missing every
  // span that began in its unloaded part, and read too low.
  if (B0 < dataFrom) B0 = alignUp(dataFrom, I, offset);
  if (!(B0 < drawTo)) return empty;

  const N = Math.ceil((drawTo - B0) / I);
  const C = Math.max(1, Math.min(N, Math.floor(opts.maxPoints)));
  const { times, cum } = tl;
  const E = times.length;

  let ei = lowerBound(times, B0);
  let count = ei > 0 ? cum[ei - 1] : 0;

  const xs: number[] = new Array(C);
  const peak: number[] = new Array(C);
  const low: number[] = new Array(C);

  for (let k = 0; k < C; k++) {
    const js = Math.floor((k * N) / C);
    const je = Math.floor(((k + 1) * N) / C);
    const colEnd = B0 + je * I;
    let mn = Infinity;
    let mx = -Infinity;
    let j = js;

    while (j < je) {
      const bStart = B0 + j * I;
      const bEnd = bStart + I;
      const nextT = ei < E ? times[ei] : Infinity;

      if (nextT >= colEnd) {
        // No event anywhere in the rest of this column: every remaining bucket equals `count`.
        if (count < mn) mn = count;
        if (count > mx) mx = count;
        break;
      }
      if (nextT >= bEnd) {
        // Buckets j up to the one holding nextT are event-free: same value, one step.
        if (count < mn) mn = count;
        if (count > mx) mx = count;
        j = Math.floor((nextT - B0) / I);
        continue;
      }

      // Bucket j contains events. Its value at its first instant counts only
      // if no event lands exactly on that instant (events at bStart apply first).
      let pk = nextT > bStart ? count : -Infinity;
      while (ei < E && times[ei] < bEnd) {
        const t = times[ei];
        while (ei < E && times[ei] === t) ei++;
        count = cum[ei - 1];
        if (count > pk) pk = count;
      }
      if (pk < mn) mn = pk;
      if (pk > mx) mx = pk;
      j++;
    }

    xs[k] = B0 + js * I;
    peak[k] = Math.max(0, mx);
    low[k] = Math.max(0, mn);
  }

  // Closing point so the last step runs all the way to the right edge ("now").
  xs.push(drawTo);
  peak.push(peak[C - 1]);
  low.push(low[C - 1]);

  return { mode: N > C ? "envelope" : "bucket", xs, peak, low, bucketsPerPoint: N / C, intervalMs: I, offsetMs: offset };
}

/** Visitors actively online at the exact instant t (every event at or before t applied). */
export function valueAt(tl: EventTimeline, t: number): number {
  const { times, cum } = tl;
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (times[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? Math.max(0, cum[lo - 1]) : 0;
}
