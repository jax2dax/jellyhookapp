// lib/leadSessionsCache.js
// Client-side localStorage cache for the FramePlate session-explorer data.
// Same {fetchedAt, data} shape as lib/intentCache.ts, but split into two
// independently-timed tiers instead of one blob-level timeout — see the
// tier comments below for why each interval is what it is. Import only in
// client components.

const SESSIONS_KEY_PREFIX = "jh_leadsess_";
const STRUCTURE_KEY_PREFIX = "jh_leadstruct_";

// ── Tier: sessions (sessions + page_views + form_submissions for one visitor) ─
// This is the volatile, crucial tier: a brand new session can start, or the
// currently-open (live) session's page_views can keep changing, at any
// moment while a SaaS user has this lead page open. Closed sessions, once
// ended_at is set, are immutable — nothing about them will ever change again.
//
// The TTL is therefore a function of whether the MOST RECENT session for
// this visitor is still open, not a single fixed number:
//   - a live session in play        → refresh often, it's actively changing
//   - everything fully closed       → refresh rarely, nothing will move
// Tune these two numbers freely; they're not wired to plan tier yet, but are
// kept as named constants specifically so that can be layered in later
// without touching call sites.
export const SESSIONS_TTL_LIVE_MS = 15 * 1000; // 15s — a live session's current page_view is changing in real time
export const SESSIONS_TTL_CLOSED_MS = 5 * 60 * 1000; // 5min — nothing here can change once every session is closed

// ── Tier: page_structure (headers + page height per page_path) ─────────────
// Practically static — a page's header layout doesn't change moment to
// moment, so this is cached long and only ever grows (new paths get added
// to what's fetched, existing ones are trusted as-is).
export const STRUCTURE_TTL_MS = 30 * 60 * 1000; // 30min

// This module's own lazy-initializer calls (see LeadSessionExplorer's
// useState(() => readInitialPageStructureCache(...))) run during SSR, where
// there is no `localStorage` at all — not a private-browsing edge case, a
// guaranteed absence. Checking `typeof localStorage === "undefined"` avoids
// throwing (and logging a scary but harmless error) on literally every
// server render.
function readCache(key) {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("[leadSessionsCache] read error:", err);
    return null;
  }
}

function writeCache(key, data) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ fetchedAt: Date.now(), data }));
  } catch (err) {
    console.error("[leadSessionsCache] write error:", err);
  }
}

/**
 * Sessions tier — visitorId-keyed. Returns { data, fetchedAt, isStale } | null.
 * `data` is expected to carry its own `hasLiveSession` flag (set by the
 * caller) so staleness can be judged against the right TTL — live sessions
 * go stale fast (SESSIONS_TTL_LIVE_MS), fully-closed ones almost never
 * (SESSIONS_TTL_CLOSED_MS). No single ttlMs is passed in here on purpose:
 * that's the "don't put one timeout on the whole blob" requirement applied
 * at the read site, not just across tiers but within this one tier too.
 */
export function getCachedSessionRows(visitorId) {
  const parsed = readCache(SESSIONS_KEY_PREFIX + visitorId);
  if (!parsed) return null;
  const ttlMs = parsed.data?.hasLiveSession ? SESSIONS_TTL_LIVE_MS : SESSIONS_TTL_CLOSED_MS;
  const isStale = Date.now() - parsed.fetchedAt > ttlMs;
  return { data: parsed.data, fetchedAt: parsed.fetchedAt, isStale };
}

export function setCachedSessionRows(visitorId, data) {
  writeCache(SESSIONS_KEY_PREFIX + visitorId, data);
}

export function clearCachedSessionRows(visitorId) {
  try {
    localStorage.removeItem(SESSIONS_KEY_PREFIX + visitorId);
  } catch (err) {
    console.error("[leadSessionsCache] clear error:", err);
  }
}

/** Structure tier — siteId-keyed (page_structure is shared across every lead on a site, not per-visitor). */
export function getCachedPageStructure(siteId) {
  const parsed = readCache(STRUCTURE_KEY_PREFIX + siteId);
  if (!parsed) return null;
  const isStale = Date.now() - parsed.fetchedAt > STRUCTURE_TTL_MS;
  return { data: parsed.data, fetchedAt: parsed.fetchedAt, isStale };
}

export function setCachedPageStructure(siteId, data) {
  writeCache(STRUCTURE_KEY_PREFIX + siteId, data);
}
