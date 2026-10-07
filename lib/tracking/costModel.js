// lib/tracking/costModel.js
// What a tracked event costs the database, and what that means for limits.
// Pure. Feeds /dev/usage. The numbers it uses are MEASURED where possible
// (table sizes from jh_storage_report(), event counts from site_usage_daily);
// the only modelled parts are labelled as such.
//
// The unit here is an "event" as the tracker sends it: one entry in the
// array POSTed to /api/track (plus form / structure posts). A page view is
// two events (start and end), a visit adds a session_start, and so on. See
// mds/developers/usage-and-limits.md.

/**
 * Per event kind: the rows it CREATES (storage) and the queries it runs
 * (compute). Queries count what the route really does, including the shared
 * per-request work (site lookup, usage counter) listed separately below.
 * `modelled` marks numbers that are not measured.
 */
export const EVENT_KINDS = {
  session_starts: { label: "Session start", rows: { sessions: 1 }, queries: 4, note: "visitor upsert + touch, session lookup, session insert" },
  page_view_starts: { label: "Page view start", rows: { page_views: 1 }, queries: 3, note: "session activity update, structure lookup (cached 60 s), page view insert" },
  page_view_ends: { label: "Page view end", rows: {}, queries: 2, note: "page view update, session activity update. No new row" },
  clicks: { label: "Click (data-track-click)", rows: { click_events: 1 }, queries: 3, note: "click insert + tracking-health stamp" },
  forms: { label: "Form submission (lead)", rows: { form_submissions: 1 }, queries: 3, note: "duplicate check, insert, health stamp" },
  engagement: { label: "Form engagement", rows: { form_engagement: 0.15 }, queries: 3, modelled: true, note: "one row per form per session, updated by many events: 0.15 new rows per event is a modelled average" },
  structure: { label: "Page structure", rows: { page_structure_versions: 0.02 }, queries: 4, modelled: true, note: "mostly an update of an existing version; a new row only when the page changed (modelled 2%)" },
};

/** Queries every request pays once, whatever it carries. */
export const PER_REQUEST_QUERIES = 2; // site lookup + usage counter (the throttled sites update is extra, about one per minute)

/**
 * @param {Array<{ table_name: string, approx_rows: number | string, total_bytes: number | string }>} storage jh_storage_report()
 * @returns {Record<string, number>} bytes per row, whole table including its indexes
 */
export function bytesPerRow(storage) {
  const out = {};
  for (const r of storage || []) {
    const rows = Number(r.approx_rows);
    const bytes = Number(r.total_bytes);
    if (rows > 0 && bytes > 0) out[r.table_name] = bytes / rows;
  }
  return out;
}

/** Visitor rows created per session, from the table sizes (new visitors only: a returning one adds nothing). */
export function visitorsPerSession(storage) {
  const rows = (name) => Number((storage || []).find((r) => r.table_name === name)?.approx_rows || 0);
  const s = rows("sessions");
  return s > 0 ? Math.min(1, rows("visitors") / s) : 0.6;
}

/**
 * The stored bytes one average event costs, for a mix of event counts.
 * @param {Record<string, number>} totals counts per EVENT_KINDS key (site_usage_daily columns summed)
 * @param {Record<string, number>} perRow bytes per row by table
 * @param {number} visitorsPerSess
 */
export function storagePerEvent(totals, perRow, visitorsPerSess = 0.6) {
  const events = Object.keys(EVENT_KINDS).reduce((n, k) => n + (totals[k] || 0), 0);
  /** @type {Record<string, { count: number, bytesEach: number, bytesTotal: number, queriesEach: number }>} */
  const byKind = {};
  let totalBytes = 0;
  for (const [kind, def] of Object.entries(EVENT_KINDS)) {
    const count = totals[kind] || 0;
    let bytes = 0;
    for (const [table, rows] of Object.entries(def.rows)) bytes += rows * (perRow[table] || 0);
    if (kind === "session_starts") bytes += visitorsPerSess * (perRow.visitors || 0);
    byKind[kind] = { count, bytesEach: bytes, bytesTotal: bytes * count, queriesEach: def.queries + 0 };
    totalBytes += bytes * count;
  }
  return { events, totalBytes, bytesPerEvent: events > 0 ? totalBytes / events : 0, byKind };
}

/** Average queries per event, including the shared per-request work (requests <= events, batches share it). */
export function queriesPerEvent(totals) {
  const events = Object.keys(EVENT_KINDS).reduce((n, k) => n + (totals[k] || 0), 0);
  if (events === 0) return 0;
  const kindQueries = Object.entries(EVENT_KINDS).reduce((n, [k, d]) => n + (totals[k] || 0) * d.queries, 0);
  return (kindQueries + (totals.requests || 0) * PER_REQUEST_QUERIES) / events;
}

/**
 * How many events per month fit a storage budget.
 * @param {{ storageBudgetBytes: number, retentionMonths: number, headroom: number, sites: number, bytesPerEvent: number }} p
 *   headroom: share of the budget kept free (0.3 = keep 30% free)
 * @returns {{ eventsPerMonthTotal: number, eventsPerMonthPerSite: number }}
 */
export function planCapacity({ storageBudgetBytes, retentionMonths, headroom, sites, bytesPerEvent }) {
  if (!(bytesPerEvent > 0) || !(retentionMonths > 0) || !(sites > 0)) return { eventsPerMonthTotal: 0, eventsPerMonthPerSite: 0 };
  const usable = storageBudgetBytes * Math.max(0, 1 - headroom);
  const total = usable / (bytesPerEvent * retentionMonths);
  return { eventsPerMonthTotal: Math.floor(total), eventsPerMonthPerSite: Math.floor(total / sites) };
}

/** Sum site_usage_daily rows into counters per EVENT_KINDS key (+ requests, dropped, bytes_in). */
export function sumUsage(days) {
  const t = { session_starts: 0, page_view_starts: 0, page_view_ends: 0, clicks: 0, forms: 0, engagement: 0, structure: 0, requests: 0, dropped: 0, bytes_in: 0, events: 0 };
  for (const d of days || []) {
    t.session_starts += d.session_starts || 0;
    t.page_view_starts += d.page_view_starts || 0;
    t.page_view_ends += d.page_view_ends || 0;
    t.clicks += d.clicks || 0;
    t.forms += d.forms || 0;
    t.engagement += d.engagement || 0;
    t.structure += d.structure || 0;
    t.requests += d.requests || 0;
    t.dropped += d.dropped || 0;
    t.bytes_in += Number(d.bytes_in || 0);
    t.events += d.events || 0;
  }
  return t;
}
