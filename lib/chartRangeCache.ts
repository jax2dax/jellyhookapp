// lib/chartRangeCache.ts
// Client-side localStorage cache for the New Reach / Conversions / Merged
// chart data — same pattern as lib/intentCache.ts, generalized over a
// "kind" (which chart) and the exact range requested, since different
// ranges are genuinely different data and must not share a cache entry.
// See mds/local_cache_schema.md for the documented shape — update that file
// whenever this one changes.
// Import only in client components.

export const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes — change here to adjust

const CACHE_KEY_PREFIX = "jh_chart_";

export interface CachedChartRange<T> {
  fetchedAt: number;
  data: T;
}

function buildKey(kind: string, siteId: string, startIso: string | null, endIso: string | null): string {
  return `${CACHE_KEY_PREFIX}${kind}_${siteId}_${startIso ?? "all"}_${endIso ?? "now"}`;
}

export function getCachedChartRange<T>(kind: string, siteId: string, startIso: string | null, endIso: string | null): { data: T; isStale: boolean } | null {
  try {
    const raw = localStorage.getItem(buildKey(kind, siteId, startIso, endIso));
    if (!raw) return null;
    const parsed: CachedChartRange<T> = JSON.parse(raw);
    const isStale = Date.now() - parsed.fetchedAt > CACHE_TTL_MS;
    return { data: parsed.data, isStale };
  } catch (err) {
    console.error("[chartRangeCache] read error:", err);
    return null;
  }
}

export function setCachedChartRange<T>(kind: string, siteId: string, startIso: string | null, endIso: string | null, data: T): void {
  try {
    const payload: CachedChartRange<T> = { fetchedAt: Date.now(), data };
    localStorage.setItem(buildKey(kind, siteId, startIso, endIso), JSON.stringify(payload));
  } catch (err) {
    console.error("[chartRangeCache] write error:", err);
  }
}

// Mini dashboard charts always request "the last 3 days as of now," but
// computing that start bound from Date.now() at every mount would produce a
// different millisecond — and therefore a different cache key — on every
// single page load, defeating caching entirely. Rounding down to a 15-
// minute step means every mount within the same 15-minute window asks for
// the exact same range and hits the same cache entry.
const MINI_ROUND_MS = 15 * 60 * 1000;

export function miniRangeStart(spanDays: number): string {
  const now = Date.now();
  const rounded = Math.floor(now / MINI_ROUND_MS) * MINI_ROUND_MS;
  return new Date(rounded - spanDays * 86_400_000).toISOString();
}
