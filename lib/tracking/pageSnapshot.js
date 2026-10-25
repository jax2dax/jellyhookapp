// lib/tracking/pageSnapshot.js
// The form page "so far", sent by the tracker with a form submission (public/tracker.js jhPageSnapshot). A hook fires
// the moment the form arrives, but a page reports its heading times and scroll only when the visitor leaves it
// (page_view_end), so without this the page the form is on would have no headings in the hook's visit summary or in
// the marks checked at that moment. Written only into a page view that is still open; page_view_end later replaces it.
// Plan: mds/build/notifications/session-summary.md.
import { cleanId, cleanNum, cleanTime } from "./server.js";
import { cleanHeadingTime } from "./headingTime.js";

const MAX_DURATION_MS = 24 * 3600_000;

/**
 * Validates a snapshot from the tracker. Returns { pageViewId, update } (the page_views columns to write) or null.
 * @param {unknown} raw
 * @param {number} [now]
 */
export function cleanPageSnapshot(raw, now = Date.now()) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const pageViewId = cleanId(raw.page_view_id);
  const duration = cleanNum(raw.duration, 0, MAX_DURATION_MS);
  if (!pageViewId || duration === null) return null;
  const update = {};
  const headingTime = cleanHeadingTime(raw.heading_time, duration);
  if (headingTime) update.heading_time = headingTime;
  const scroll = cleanNum(raw.scroll_depth, 0, 1);
  if (scroll !== null) update.scroll_depth = scroll;
  const maxScroll = cleanNum(raw.max_scroll_depth, 0, 1);
  if (maxScroll !== null) update.max_scroll_depth = maxScroll;
  const maxAt = cleanTime(raw.max_scroll_reached_at, now);
  if (maxAt) update.max_scroll_reached_at = maxAt.toISOString();
  // null means "never revisited": a real value, so it is written as null, not left out
  if (raw.revisit_start_scroll !== undefined) update.revisit_start_scroll_depth = cleanNum(raw.revisit_start_scroll, 0, 1);
  const vh = cleanNum(raw.viewport_height, 0, 100000);
  if (vh !== null) update.viewport_height = vh;
  return Object.keys(update).length ? { pageViewId, update } : null;
}

/**
 * Writes a snapshot into its page view, only while that page view is open (left_at is null): a page that has already
 * ended keeps its final values. Never throws: a failure here must never cost the lead or its notifications.
 * @returns {Promise<boolean>} whether a row was written
 */
export async function applyPageSnapshot(supabase, siteId, raw, now = Date.now()) {
  try {
    const snap = cleanPageSnapshot(raw, now);
    if (!snap) return false;
    const write = (update) => supabase.from("page_views").update(update).eq("page_view_id", snap.pageViewId).eq("site_id", siteId).is("left_at", null).select("id");
    let { data, error } = await write(snap.update);
    if (error && /heading_time/.test(error.message || "") && "heading_time" in snap.update) {
      // before 19-heading-time.sql: the scroll alone
      const { heading_time: _drop, ...rest } = snap.update;
      void _drop;
      ({ data, error } = await write(rest));
    }
    if (error) {
      console.error("[track-form] page snapshot not written:", error.message);
      return false;
    }
    return !!data?.length;
  } catch (e) {
    console.error("[track-form] page snapshot failed:", e instanceof Error ? e.message : String(e));
    return false;
  }
}
