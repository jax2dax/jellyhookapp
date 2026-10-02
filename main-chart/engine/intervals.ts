// main-chart/engine/intervals.ts
import type { IntervalDef } from "../types";

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const INTERVALS: IntervalDef[] = [
  { key: "5s", label: "5s", ms: 5 * SEC },
  { key: "10s", label: "10s", ms: 10 * SEC },
  { key: "30s", label: "30s", ms: 30 * SEC },
  { key: "1m", label: "1m", ms: MIN },
  { key: "5m", label: "5m", ms: 5 * MIN },
  { key: "15m", label: "15m", ms: 15 * MIN },
  { key: "30m", label: "30m", ms: 30 * MIN },
  { key: "1h", label: "1h", ms: HOUR },
  { key: "4h", label: "4h", ms: 4 * HOUR },
  { key: "1d", label: "1d", ms: DAY },
];

export const DEFAULT_INTERVAL_KEY = "10s";

export function intervalByKey(key: string): IntervalDef {
  return INTERVALS.find((i) => i.key === key) ?? INTERVALS[1];
}

/**
 * Sub-hour buckets line up with the clock as-is (10:40:00, 10:40:10, ...)
 * in every timezone. Hour-and-longer buckets are shifted so they start on
 * the viewer's LOCAL hour/midnight instead of UTC's — a "1d" bucket should
 * mean the viewer's day. Computed from one reference time, so a DST change
 * inside the visible window shifts later day buckets by an hour.
 */
export function bucketOffsetMs(intervalMs: number, referenceTime: number): number {
  if (intervalMs < HOUR) return 0;
  const localOffsetMs = -new Date(referenceTime).getTimezoneOffset() * MIN;
  return (((-localOffsetMs) % intervalMs) + intervalMs) % intervalMs;
}

export function alignDown(t: number, intervalMs: number, offsetMs: number): number {
  return Math.floor((t - offsetMs) / intervalMs) * intervalMs + offsetMs;
}

export function alignUp(t: number, intervalMs: number, offsetMs: number): number {
  return Math.ceil((t - offsetMs) / intervalMs) * intervalMs + offsetMs;
}
