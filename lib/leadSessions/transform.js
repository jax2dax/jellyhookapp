// lib/leadSessions/transform.js
//
// Pure parser: raw Supabase rows (sessions / page_views / form_submissions /
// page_structure) → framePlate's SessionRaw[] / PageVisitRaw[] shape
// (see framePlate/types.ts). No Supabase calls happen here — see
// lib/actions/leadSessions.action.js for the fetching side. This file is the
// ONLY place that knows how our specific DB columns map onto framePlate's
// generic chart-data contract.
//
// Never throws: a malformed row is skipped with a console.error, everything
// else still renders — mirrors framePlate's own "UI errors are bad" rule,
// applied here to "a bad row shouldn't blank the whole chart."
//
// ── Field-by-field sourcing (ask was: "tell me where each of this data is
//    coming from") ──────────────────────────────────────────────────────
// SessionRaw.id          ← sessions.session_id (string id, not sessions.id uuid)
// SessionRaw.visitorId   ← sessions.visitor_id
// SessionRaw.startedAt   ← sessions.started_at
// SessionRaw.endedAt     ← sessions.ended_at (null = session still open/live)
// SessionRaw.visits[]    ← page_views rows sharing that session_id, ordered by entered_at
//
// PageVisitRaw.id          ← page_views.page_view_id
// PageVisitRaw.pagePath    ← page_views.page_path
// PageVisitRaw.enteredAt   ← page_views.entered_at
// PageVisitRaw.leftAt      ← page_views.left_at, OR "now" (wall-clock) if null —
//                            a null left_at means this exact page_view is still
//                            open (page_view_end hasn't fired yet). That only
//                            happens on the single most-recent visit of a live
//                            session. This is the one place this parser isn't a
//                            pure function of stored data on purpose: refetching
//                            a live visit is meant to show its frame growing.
// PageVisitRaw.pageHeightPx ← page_views.page_height, falling back to
//                            page_structure.page_height for the same page_path
//                            (page_structure rows carry the page's height too,
//                            captured independently by the header-tracking
//                            beacon) if the page_view itself predates the
//                            page_height column, else 0.
// PageVisitRaw.viewportHeightPx ← page_views.viewport_height. Mandatory for
//                            correctness, nullable in practice: every
//                            scroll_depth value is a fraction of
//                            (page_height - viewport_height), so this is what
//                            converts one into a position on the page.
// PageVisitRaw.scrollTrace  ← synthesized 3-4 point trace from
//                            entry_scroll_depth / max_scroll_depth /
//                            revisit_start_scroll_depth / scroll_depth (see
//                            buildScrollTrace below) — real data gives us the
//                            exact checkpoints directly, so this trace only
//                            exists to reuse framePlate's existing
//                            deriveVisitGeometry (bin-counting) unchanged
//                            rather than duplicating its logic here.
// PageVisitRaw.converted    ← true for the page_view that was open at the
//                            moment of a form_submissions row in the same
//                            session_id (see attachConversions below) —
//                            mirrors the exact heuristic lib/algorithms/
//                            leadProfile.js already uses for preConversionPath.
// PageVisitRaw.headers      ← page_structure rows for that page_path:
//                            { text: header_text, y: position_y / page_height },
//                            ordered by header_index. Optional — chart renders
//                            fine without it, just skips the header zigzag.

function toMs(ts) {
  return ts ? new Date(ts).getTime() : null;
}

function clamp01(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(1, Math.max(0, v));
}

/**
 * Reconstructs a minimal SCROLL-space trace (see ScrollSample.y — these are
 * fractions of the scrollable range, not of the page) from the 4 checkpoint
 * columns, which are recorded in that same space by the tracker. Feeding
 * this through framePlate's deriveVisitGeometry (which does the SCROLL→PAGE
 * conversion) reproduces the exact "seen once" / "seen more than once"
 * geometry — see framePlate/geometry/deriveVisitGeometry.ts. Traced by hand
 * against several multi-phase scroll patterns; the shallowest 2x-crossed bin
 * this produces always matches revisitStartDepth's own documented definition.
 */
// Below this, two scroll values are treated as "the same point" — rounding
// (tracker.js rounds to 2 decimals) can otherwise leave revisit_start_scroll_depth
// a hair below max_scroll_depth even when no real backtrack happened.
const SAME_POINT_EPSILON = 0.01;

export function buildScrollTrace(pageViewRow) {
  const entry = clamp01(pageViewRow.entry_scroll_depth) ?? 0;
  const exit = clamp01(pageViewRow.scroll_depth) ?? entry;
  let max = clamp01(pageViewRow.max_scroll_depth);
  if (max === null) max = Math.max(entry, exit);
  // Defensive: guard against stale/pre-fix rows where max could be recorded
  // lower than entry or exit due to the now-fixed maxScrollDepth-starts-at-0 bug.
  max = Math.max(max, entry, exit);
  const revisit = clamp01(pageViewRow.revisit_start_scroll_depth);

  const waypoints = [{ t: 0, y: entry }, { t: 1, y: max }];
  // Only a genuine backtrack if it's meaningfully shallower than max — a
  // revisit value equal (or rounding-close) to max means no real climb-back
  // happened. This matters even when it's a real value: pushing a waypoint
  // identical to its neighbor makes deriveVisitGeometry's bin-counting see
  // that same page-position "crossed" by both the zero-length segment into
  // it AND out of it, which reads as a genuine revisit when it isn't one.
  if (revisit !== null && revisit < max - SAME_POINT_EPSILON) waypoints.push({ t: 2, y: revisit });
  waypoints.push({ t: 3, y: exit });

  // Collapse consecutive points that land on (or within epsilon of) the same
  // value — most commonly entry === max === exit when the visitor never
  // scrolled at all. Each waypoint here is a checkpoint, not a real sampled
  // trace, so a repeated value is redundant, never a second "visit" to that
  // spot; left in, the bin-counting step above counts it as one anyway and
  // falsely renders a "seen more than once" band with zero real revisiting.
  const trace = [];
  for (const p of waypoints) {
    const prev = trace[trace.length - 1];
    if (!prev || Math.abs(prev.y - p.y) > SAME_POINT_EPSILON) trace.push(p);
  }
  return trace;
}

/**
 * page_height fallback chain: the page_view's own recorded height, else the
 * height page_structure recorded for that same page_path, else 0 (framePlate
 * renders a minimal-height plate rather than erroring on 0).
 */
function resolvePageHeight(pageViewRow, pageStructureByPath) {
  if (typeof pageViewRow.page_height === "number" && pageViewRow.page_height > 0) {
    return pageViewRow.page_height;
  }
  const fallback = pageStructureByPath?.get(pageViewRow.page_path)?.[0]?.page_height;
  return typeof fallback === "number" && fallback > 0 ? fallback : 0;
}

function buildHeaders(pagePath, pageStructureByPath) {
  const rows = pageStructureByPath?.get(pagePath);
  if (!rows || rows.length === 0) return undefined;
  try {
    const pageHeight = rows[0].page_height;
    if (!pageHeight || pageHeight <= 0) return undefined;
    return [...rows]
      .sort((a, b) => a.header_index - b.header_index)
      .map((r) => ({ text: r.header_text, y: clamp01(r.position_y / pageHeight) ?? 0 }));
  } catch (err) {
    console.error("[leadSessions/transform] buildHeaders failed for", pagePath, err);
    return undefined;
  }
}

function pageViewRowToVisitRaw(pv, { pageStructureByPath, convertedPageViewIds, nowMs }) {
  try {
    if (!pv || !pv.page_view_id || !pv.entered_at) {
      console.error("[leadSessions/transform] skipping malformed page_view row:", pv);
      return null;
    }
    const leftAt = pv.left_at || new Date(nowMs).toISOString();
    return {
      id: pv.page_view_id,
      pagePath: pv.page_path || "",
      enteredAt: pv.entered_at,
      leftAt,
      pageHeightPx: resolvePageHeight(pv, pageStructureByPath),
      // Without this every scroll_depth on the row is uninterpretable — they
      // are fractions of (page_height - viewport_height). Null on rows
      // predating the viewport_height column; framePlate falls back to a
      // device-typical estimate and flags the visit as estimated.
      viewportHeightPx: typeof pv.viewport_height === "number" && pv.viewport_height > 0 ? pv.viewport_height : null,
      scrollTrace: buildScrollTrace(pv),
      converted: convertedPageViewIds.has(pv.page_view_id),
      headers: buildHeaders(pv.page_path, pageStructureByPath),
    };
  } catch (err) {
    console.error("[leadSessions/transform] pageViewRowToVisitRaw failed:", err);
    return null;
  }
}

/**
 * For every form_submissions row, finds the page_view in the same session
 * that was open at the moment of submission (the last one entered at or
 * before submitted_at; falls back to the session's last page_view if none
 * qualify) and marks it. Same heuristic as leadProfile.js's
 * preConversionPath/isConversionPage, scoped per-session instead of across
 * the whole visitor.
 */
function findConvertedPageViewIds(pageViewsBySession, submissions) {
  const converted = new Set();
  for (const sub of submissions) {
    if (!sub.session_id) continue;
    const views = pageViewsBySession.get(sub.session_id);
    if (!views || views.length === 0) continue;
    const subTs = toMs(sub.submitted_at);
    let candidate = null;
    for (const pv of views) {
      const enteredTs = toMs(pv.entered_at);
      if (subTs === null || (enteredTs !== null && enteredTs <= subTs)) {
        candidate = pv; // views are pre-sorted ascending, so this ends up the last qualifying one
      }
    }
    if (!candidate) candidate = views[views.length - 1];
    if (candidate?.page_view_id) converted.add(candidate.page_view_id);
  }
  return converted;
}

/**
 * Raw sessions/page_views/form_submissions/page_structure rows (exactly what
 * getLeadProfileByLeadId already returns, plus page_structure) → SessionRaw[]
 * ready for FramePlateChart. Pure — no DB calls. Includes the same
 * orphan-session robustness as lib/algorithms/leadProfile.js: a page_view
 * whose session_id has no matching `sessions` row still gets a session
 * stitched together from its own timestamps rather than being dropped.
 * @param {{ sessions?: any[], pageViews?: any[], submissions?: any[], pageStructure?: any[] }} [args]
 * @returns {any[]}
 */
export function buildSessionsRaw({ sessions = [], pageViews = [], submissions = [], pageStructure = [] } = {}) {
  try {
    const nowMs = Date.now();

    const pageStructureByPath = new Map();
    for (const row of pageStructure) {
      if (!row?.page_path) continue;
      if (!pageStructureByPath.has(row.page_path)) pageStructureByPath.set(row.page_path, []);
      pageStructureByPath.get(row.page_path).push(row);
    }

    const pageViewsBySession = new Map();
    for (const pv of pageViews) {
      const key = pv?.session_id || "unassigned";
      if (!pageViewsBySession.has(key)) pageViewsBySession.set(key, []);
      pageViewsBySession.get(key).push(pv);
    }
    for (const views of pageViewsBySession.values()) {
      views.sort((a, b) => (toMs(a.entered_at) ?? 0) - (toMs(b.entered_at) ?? 0));
    }

    const convertedPageViewIds = findConvertedPageViewIds(pageViewsBySession, submissions);

    function visitsFor(sessionId) {
      const rows = pageViewsBySession.get(sessionId) || [];
      return rows
        .map((pv) => pageViewRowToVisitRaw(pv, { pageStructureByPath, convertedPageViewIds, nowMs }))
        .filter(Boolean);
    }

    const knownSessionIds = new Set();
    const result = [];

    for (const s of sessions) {
      if (!s?.session_id) {
        console.error("[leadSessions/transform] skipping session row with no session_id:", s);
        continue;
      }
      knownSessionIds.add(s.session_id);
      const visits = visitsFor(s.session_id);
      if (visits.length === 0) continue; // nothing to plot — empty session
      result.push({
        id: s.session_id,
        visitorId: s.visitor_id || "",
        startedAt: s.started_at || visits[0].enteredAt,
        endedAt: s.ended_at || null,
        visits,
      });
    }

    // Orphan sessions: page_views with a session_id that has no `sessions`
    // row (insert race — see leadProfile.js for the same pattern). No
    // sessions row means no reliable ended_at, so these render as closed
    // (never "live") using their own last page_view's leftAt.
    for (const [sessionId, rows] of pageViewsBySession.entries()) {
      if (sessionId === "unassigned" || knownSessionIds.has(sessionId)) continue;
      const visits = visitsFor(sessionId);
      if (visits.length === 0) continue;
      result.push({
        id: sessionId,
        visitorId: rows[0]?.visitor_id || "",
        startedAt: visits[0].enteredAt,
        endedAt: visits[visits.length - 1].leftAt,
        visits,
      });
    }

    result.sort((a, b) => (toMs(a.startedAt) ?? 0) - (toMs(b.startedAt) ?? 0));
    return result;
  } catch (err) {
    console.error("[leadSessions/transform] buildSessionsRaw failed:", err);
    return [];
  }
}
