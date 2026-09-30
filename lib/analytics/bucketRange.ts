// lib/analytics/bucketRange.ts
//
// Shared bucketing for any arbitrary [start, end] range — not tied to a
// fixed preset like rateConversion.action.ts's WindowPreset. The New Reach
// and Conversions charts both take a free-form custom date range (down to
// the minute), so bucket size has to auto-scale to whatever span the caller
// actually picked, the same way the existing 'all' preset already does.
export interface Bucket {
  bucketStart: string; // ISO
  bucketEnd: string; // ISO
  label: string;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;
const TARGET_BUCKET_COUNT = 16;

function formatLabel(start: Date, bucketMs: number): string {
  if (bucketMs <= HOUR) {
    return start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (bucketMs <= DAY) {
    return start.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (bucketMs <= DAY * 2) {
    return start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (bucketMs <= DAY * 8) {
    const end = new Date(start.getTime() + bucketMs - 1);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.toLocaleDateString("en-US", { day: "numeric" })}`;
  }
  return start.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/** Picks a bucket size that lands close to TARGET_BUCKET_COUNT buckets across the range, snapped to a human-sensible unit (hour/day/week/month-ish). */
function resolveBucketMs(rangeMs: number): number {
  const rough = rangeMs / TARGET_BUCKET_COUNT;
  if (rough <= HOUR) return HOUR;
  if (rough <= DAY) return DAY;
  const weekMs = DAY * 7;
  if (rough <= weekMs) return DAY * Math.max(1, Math.round(rough / DAY));
  const monthMs = DAY * 30;
  if (rough <= monthMs) return weekMs * Math.max(1, Math.round(rough / weekMs));
  return monthMs * Math.max(1, Math.round(rough / monthMs));
}

/**
 * Builds empty buckets spanning [startDate, endDate]. Caller fills in the
 * counts by finding the bucket index for each row's timestamp.
 */
export function buildBuckets(startDate: Date, endDate: Date): Bucket[] {
  const rangeMs = Math.max(endDate.getTime() - startDate.getTime(), HOUR);
  const bucketMs = resolveBucketMs(rangeMs);
  const bucketCount = Math.max(1, Math.ceil(rangeMs / bucketMs));

  const buckets: Bucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = new Date(startDate.getTime() + i * bucketMs);
    const bucketEnd = new Date(Math.min(bucketStart.getTime() + bucketMs, endDate.getTime()));
    buckets.push({ bucketStart: bucketStart.toISOString(), bucketEnd: bucketEnd.toISOString(), label: formatLabel(bucketStart, bucketMs) });
  }
  return buckets;
}

/** Index of the bucket a timestamp falls into, or -1 if out of range. */
export function bucketIndexFor(ts: number, startDate: Date, buckets: Bucket[]): number {
  if (buckets.length === 0) return -1;
  const bucketMs = new Date(buckets[0].bucketEnd).getTime() - new Date(buckets[0].bucketStart).getTime() || HOUR;
  const idx = Math.floor((ts - startDate.getTime()) / bucketMs);
  return Math.min(Math.max(idx, 0), buckets.length - 1);
}
