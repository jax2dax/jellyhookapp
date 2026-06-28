// lib/intentCache.ts
// Client-side localStorage cache for intent analysis data.
// Prevents unnecessary DB fetches. TTL configurable via CACHE_TTL_MS.
// Import only in client components.

export const CACHE_TTL_MS = 60 * 1000 // 1 minute — change here to adjust

const CACHE_KEY_PREFIX = 'jh_intent_'
const DEV_MODE_KEY = 'jh_devmode'

export interface CachedIntentData {
  fetchedAt: number
  data: unknown
}

export function getCachedIntent(siteId: string): { data: unknown; isStale: boolean } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + siteId)
    if (!raw) return null
    const parsed: CachedIntentData = JSON.parse(raw)
    const isStale = Date.now() - parsed.fetchedAt > CACHE_TTL_MS
    return { data: parsed.data, isStale }
  } catch {
    return null
  }
}

export function setCachedIntent(siteId: string, data: unknown): void {
  try {
    const payload: CachedIntentData = { fetchedAt: Date.now(), data }
    localStorage.setItem(CACHE_KEY_PREFIX + siteId, JSON.stringify(payload))
  } catch (err) {
    console.error('[intentCache] set error:', err)
  }
}

export function clearCachedIntent(siteId: string): void {
  try {
    localStorage.removeItem(CACHE_KEY_PREFIX + siteId)
  } catch {}
}

// Dev mode — persisted in localStorage
export function getDevMode(): boolean {
  try {
    return localStorage.getItem(DEV_MODE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setDevMode(val: boolean): void {
  try {
    localStorage.setItem(DEV_MODE_KEY, String(val))
  } catch {}
}