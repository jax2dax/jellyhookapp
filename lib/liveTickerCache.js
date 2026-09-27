// lib/liveTickerCache.js
// Cross-tab coordination for components/dashboard/LiveTicker.tsx.
//
// Polling is per-component, so opening the same dashboard in N browser tabs
// used to mean N independent timers hitting getRecentActivity() on the same
// site, all at once, all on their own schedule. localStorage is shared
// synchronously across tabs of the same origin, so it doubles here as a
// lightweight "who polled last, and what did they get" cache: whichever
// tab's timer fires once the shared gap has elapsed does the one real
// network request and writes the result here; every other tab just reads
// it instead of firing its own. Sibling tabs additionally get notified
// immediately via the browser's "storage" event (which fires in every OTHER
// tab, never the one that wrote it) — see LiveTicker.tsx's listener — so an
// idle tab reflects a new visitor the instant ANY tab's poll lands, not
// only whenever its own timer next happens to fire.
const KEY_PREFIX = "jh_liveticker_";

export function liveTickerCacheKey(siteId) {
  return KEY_PREFIX + siteId;
}

export function getCachedActivity(siteId) {
  try {
    const raw = localStorage.getItem(liveTickerCacheKey(siteId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("[liveTickerCache] read error:", err);
    return null;
  }
}

export function setCachedActivity(siteId, rows) {
  try {
    localStorage.setItem(liveTickerCacheKey(siteId), JSON.stringify({ fetchedAt: Date.now(), rows }));
  } catch (err) {
    console.error("[liveTickerCache] write error:", err);
  }
}
