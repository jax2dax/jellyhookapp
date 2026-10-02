// main-chart/engine/buildTimeline.ts
// Spans -> one sorted +1/-1 event list. Rebuilt only when the loaded data
// changes (a poll or a history load), never per frame.
import type { EventTimeline, OnlineSpan } from "../types";

export function buildTimeline(spans: Iterable<OnlineSpan>): EventTimeline {
  const raw: number[] = [];
  for (const s of spans) {
    // A span always counts for at least 1ms, so it can never be invisible
    // just because its recorded end equals (or precedes) its start.
    raw.push(s.start, 1);
    if (s.end !== null) raw.push(Math.max(s.end, s.start + 1), -1);
    // A still-open span gets no end event: it stays counted through "now".
  }

  const n = raw.length / 2;
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  // Ends before starts at the same instant: [start, end) means a span
  // ending at t is no longer online at t.
  order.sort((a, b) => raw[a * 2] - raw[b * 2] || raw[a * 2 + 1] - raw[b * 2 + 1]);

  const times = new Float64Array(n);
  const deltas = new Int8Array(n);
  const cum = new Int32Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const k = order[i];
    times[i] = raw[k * 2];
    deltas[i] = raw[k * 2 + 1];
    count += deltas[i];
    cum[i] = count;
  }
  return { times, deltas, cum };
}

/** Index of the first event with time >= t. */
export function lowerBound(times: Float64Array, t: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (times[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
