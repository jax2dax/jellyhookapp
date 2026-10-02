// main-chart/types.ts
// All times are epoch milliseconds. See main-chart/overview.md for what the
// x and y values mean.

/** One session as the chart sees it: [start, end). end null = still open. */
export interface SessionSpan {
  start: number;
  end: number | null;
}

/**
 * Columnar wire format returned by lib/actions/mainChart.action.ts —
 * three parallel arrays instead of an array of objects, so repeated key
 * names aren't sent once per row.
 */
export interface SpanPayload {
  ids: string[];
  starts: number[];
  ends: (number | null)[];
}

export interface IntervalDef {
  key: string;
  label: string;
  ms: number;
}

export interface ViewWindow {
  from: number;
  to: number;
}

/**
 * Sorted +1/-1 timeline built from every loaded span. cum[i] is the number
 * of sessions open right after event i (and every event sharing its time)
 * has been applied.
 */
export interface EventTimeline {
  times: Float64Array;
  deltas: Int8Array;
  cum: Int32Array;
}

/**
 * Marker layers: events from OTHER tables drawn on top of the session line,
 * never changing it. "point": a dot on the line, snapped forward to the
 * next point. "vline": a full-height vertical line at the exact moment.
 */
export type MarkerLayer = "conversions" | "teamJoins";

export interface MarkerEvent {
  id: string;
  t: number;
  /** shown on hover, e.g. the lead's name or the teammate's email */
  label: string | null;
}

/** Columnar wire format for marker events, same idea as SpanPayload. */
export interface MarkerPayload {
  ids: string[];
  times: number[];
  labels: (string | null)[];
}

export interface ComputedSeries {
  /**
   * "bucket": one point per interval bucket. "envelope": one point per pixel
   * column, many buckets each. "trend": one point per bucket where the count
   * changed, valued at that bucket's average (see engine/computeTrend.ts).
   */
  mode: "bucket" | "envelope" | "trend";
  xs: number[];
  /** highest bucket value in each point (in bucket mode: the bucket's own peak) */
  peak: (number | null)[];
  /** lowest bucket value in each point (in bucket mode: equal to peak) */
  low: (number | null)[];
  bucketsPerPoint: number;
  intervalMs: number;
  /** the bucket grid's offset (see engine/intervals.ts); markers snap onto the same grid */
  offsetMs: number;
}
