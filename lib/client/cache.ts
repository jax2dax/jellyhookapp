// lib/client/cache.ts
// A small localStorage cache for AGGREGATE views (form dashboard, origin radar, conversions charts): the page shows the
// saved copy at once and refreshes it in the background when it is older than its ttl. Founder decision 2026-10-15.
//
// Rules:
//  - Only aggregates. Never lead names, emails, values or lists of people: the browser may be a shared computer.
//  - Every key starts with "jh:v1:<siteId>:" so sites never mix, and a format change bumps v1.
//  - Every read and write is in try/catch: private windows and blocked storage just mean no cache.
//  - At most MAX_ENTRIES entries; the oldest are dropped first. Values over MAX_BYTES are not saved.
//  - clearJhCache() on sign-out.

const PREFIX = "jh:v1:";
const MAX_ENTRIES = 40;
const MAX_BYTES = 400_000;

type Entry<T> = { at: number; value: T };

export const cacheKey = (siteId: string, what: string, params: Record<string, unknown> = {}) =>
  PREFIX + siteId + ":" + what + ":" + JSON.stringify(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "").sort(([a], [b]) => a.localeCompare(b)));

export function readCache<T>(key: string): Entry<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry<T>;
    return typeof e?.at === "number" ? e : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  try {
    const raw = JSON.stringify({ at: Date.now(), value });
    if (raw.length > MAX_BYTES) return;
    window.localStorage.setItem(key, raw);
    // keep the cache small: drop the oldest of our entries
    const ours: { k: string; at: number }[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      ours.push({ k, at: readCache(k)?.at ?? 0 });
    }
    ours.sort((a, b) => a.at - b.at).slice(0, Math.max(0, ours.length - MAX_ENTRIES)).forEach((e) => window.localStorage.removeItem(e.k));
  } catch {
    /* storage full or blocked: no cache */
  }
}

export function clearJhCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* nothing to clear */
  }
}
