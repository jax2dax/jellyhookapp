// lib/convertedLeadsCache.ts
// Client-side localStorage cache for /platform/conversions' per-lead cards
// (components/leads/ConvertedLeadsExplorer.tsx). Same pattern as
// lib/chartRangeCache.ts (keyed by siteId + the exact date range requested,
// since a different range is genuinely different data) — kept as its OWN
// module rather than folded into that one specifically so this TTL can be
// tuned independently of the reach/conversions/merged charts that share
// chartRangeCache.ts's own constant. See mds/local_cache_schema.md for the
// documented shape — update that file whenever this one changes.
// Import only in client components.

// ─── THE REFRESH INTERVAL ───────────────────────────────────────────────
// How long a fetched conversions list is trusted before the next view of
// that same date range re-hits the database instead of using the cached
// copy. Change this one number — nothing else needs to change to adjust it.
export const CONVERTED_LEADS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
// ─────────────────────────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = "jh_convleads_";

export interface CachedConvertedLeads<T> {
  fetchedAt: number;
  data: T;
}

function buildKey(siteId: string, startIso: string | null, endIso: string | null): string {
  return `${CACHE_KEY_PREFIX}${siteId}_${startIso ?? "all"}_${endIso ?? "now"}`;
}

export function getCachedConvertedLeads<T>(siteId: string, startIso: string | null, endIso: string | null): { data: T; isStale: boolean } | null {
  try {
    const raw = localStorage.getItem(buildKey(siteId, startIso, endIso));
    if (!raw) return null;
    const parsed: CachedConvertedLeads<T> = JSON.parse(raw);
    const isStale = Date.now() - parsed.fetchedAt > CONVERTED_LEADS_CACHE_TTL_MS;
    return { data: parsed.data, isStale };
  } catch (err) {
    console.error("[convertedLeadsCache] read error:", err);
    return null;
  }
}

export function setCachedConvertedLeads<T>(siteId: string, startIso: string | null, endIso: string | null, data: T): void {
  try {
    const payload: CachedConvertedLeads<T> = { fetchedAt: Date.now(), data };
    localStorage.setItem(buildKey(siteId, startIso, endIso), JSON.stringify(payload));
  } catch (err) {
    console.error("[convertedLeadsCache] write error:", err);
  }
}
