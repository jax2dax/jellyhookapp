// lib/tracking/usage.js
// Per-event usage counters, kept so Jellyhook can see what each site really
// costs (dev page /platform/dev/usage) and set limits from data instead of
// guesses. Pure helpers; the database write is the jh_usage_add RPC.

/** Columns of site_usage_daily the counters map to. */
export const USAGE_FIELDS = ["requests", "events", "session_starts", "session_ends", "page_view_starts", "page_view_ends", "forms", "engagement", "structure", "clicks", "dropped", "bytes_in"];

/** Start a counter bag. */
export function emptyUsage() {
  return Object.fromEntries(USAGE_FIELDS.map((f) => [f, 0]));
}

/** Add `n` to a field; unknown fields are ignored. */
export function bump(bag, field, n = 1) {
  if (USAGE_FIELDS.includes(field)) bag[field] += n;
  return bag;
}

/** Only the fields that changed, ready to send to jh_usage_add. */
export function usageDelta(bag) {
  return Object.fromEntries(Object.entries(bag).filter(([, v]) => v > 0));
}

/** UTC calendar day, "YYYY-MM-DD". */
export function usageDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** UTC calendar day `n` days before `now`, "YYYY-MM-DD". */
export function usageDaysAgo(n, now = Date.now()) {
  return usageDay(now - n * 86_400_000);
}
