// lib/algorithms/leadProfile.js
// Pure computation — no DB calls. Takes the raw rows from
// lib/actions/leadProfile.actions.js#getLeadProfile and derives everything
// the Lead Profile page renders: identity, activity stats, the "visitor
// type" (first-time vs returning convert), the pre-conversion path, and a
// per-session breakdown (including sessions that never converted).
//
// Joins mirror the rest of the codebase: visitors/sessions/page_views/
// form_submissions are linked by the client-generated `visitor_id` and
// `session_id` strings, not the tables' UUID primary keys.

function initialsOf(name, email) {
  const base = (name || "").trim();
  if (base) {
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

// Pick the most recently-submitted non-null value for a field across all submissions.
function latestField(submissions, key) {
  for (let i = submissions.length - 1; i >= 0; i--) {
    const v = submissions[i][key];
    if (v) return v;
  }
  return null;
}

function toMs(ts) {
  return ts ? new Date(ts).getTime() : null;
}

function minTs(...timestamps) {
  const vals = timestamps.map(toMs).filter((v) => v != null);
  return vals.length ? Math.min(...vals) : null;
}

function maxTs(...timestamps) {
  const vals = timestamps.map(toMs).filter((v) => v != null);
  return vals.length ? Math.max(...vals) : null;
}

// Splits a submission's raw_data into short scalar fields (rendered as
// chips) and nested object/array fields (rendered as a collapsible,
// pretty-printed block) — form-tracking payloads (HubSpot, etc.) commonly
// bury a large nested debug/context object alongside the actual field
// values, and dumping that inline as one long unformatted JSON string was
// unreadable.
function rawDataEntries(rawData) {
  if (!rawData || typeof rawData !== "object") return { scalars: [], complex: [] };
  const skipKeys = new Set(["name", "email", "phone"]);
  const scalars = [];
  const complex = [];
  for (const [key, value] of Object.entries(rawData)) {
    if (skipKeys.has(key.toLowerCase()) || value === null || value === undefined || value === "") continue;
    if (typeof value === "object") {
      complex.push({ key, value: JSON.stringify(value, null, 2) });
    } else {
      scalars.push({ key, value: String(value) });
    }
  }
  return { scalars, complex };
}

export function buildLeadProfile({ visitor, sessions, pageViews, submissions, focusSubmission }) {
  const sortedSessions = [...sessions].sort((a, b) => toMs(a.started_at) - toMs(b.started_at));
  const sortedSubmissions = [...submissions].sort((a, b) => toMs(a.submitted_at) - toMs(b.submitted_at));

  // ── Identity ────────────────────────────────────────────────────────────
  // A visitor_id can have several form_submissions (same browser used for
  // more than one real or test submission). Identity must come from the
  // specific submission the user opened (focusSubmission) — never "whichever
  // submission on this visitor_id is most recent" — or clicking two
  // different-named leads that happen to share a browser would render the
  // exact same profile.
  const name = focusSubmission ? focusSubmission.name : latestField(sortedSubmissions, "name");
  const email = focusSubmission ? focusSubmission.email : latestField(sortedSubmissions, "email");
  const phone = focusSubmission ? focusSubmission.phone : latestField(sortedSubmissions, "phone");
  const identity = { name, email, phone, initials: initialsOf(name, email) };

  // ── Conversions (every form_submissions row for this visitor) ─────────
  const conversions = sortedSubmissions.map((s) => ({
    id: s.id,
    submittedAt: s.submitted_at,
    pagePath: s.page_path,
    confidence: s.confidence,
    sessionId: s.session_id,
    fields: rawDataEntries(s.raw_data),
    isFocus: focusSubmission ? s.id === focusSubmission.id : false,
  }));
  const primaryConversion = (focusSubmission && conversions.find((c) => c.isFocus)) || conversions[0] || null;

  // ── Sessions (converted + never-converted, in visit order) ─────────────
  // Page views (and even form submissions) can carry a session_id that has
  // no matching row in `sessions` — the session insert can fail/race while
  // the page_view or form_submissions insert still succeeds. Rather than
  // silently dropping that activity, any orphaned session_id gets a
  // synthetic session stitched together from what it does have (its own
  // page views' timestamps), so nothing recorded for this lead disappears.
  const submissionSessionIds = new Set(sortedSubmissions.map((s) => s.session_id).filter(Boolean));
  const pageViewsBySession = {};
  for (const pv of pageViews) {
    const key = pv.session_id || "unassigned";
    if (!pageViewsBySession[key]) pageViewsBySession[key] = [];
    pageViewsBySession[key].push(pv);
  }
  for (const key of Object.keys(pageViewsBySession)) {
    pageViewsBySession[key].sort((a, b) => toMs(a.entered_at) - toMs(b.entered_at));
  }

  const knownSessionIds = new Set(sortedSessions.map((s) => s.session_id));
  const orphanSessionIds = Object.keys(pageViewsBySession)
    .filter((key) => key !== "unassigned" && !knownSessionIds.has(key))
    .sort((a, b) => toMs(pageViewsBySession[a][0]?.entered_at) - toMs(pageViewsBySession[b][0]?.entered_at));

  function toViewShape(pv) {
    return {
      pagePath: pv.page_path,
      pageTitle: pv.page_title,
      enteredAt: pv.entered_at,
      leftAt: pv.left_at,
      timeOnPageMs: pv.time_on_page || 0,
      scrollDepthPct: pv.scroll_depth != null ? Math.round(pv.scroll_depth * 100) : null,
    };
  }

  const realSessionEntries = sortedSessions.map((session) => {
    const views = (pageViewsBySession[session.session_id] || []).map(toViewShape);
    const endTs = toMs(session.ended_at) || toMs(session.last_activity_at) || (views.length ? toMs(views[views.length - 1].leftAt || views[views.length - 1].enteredAt) : null);
    const startTs = toMs(session.started_at) || (views.length ? toMs(views[0].enteredAt) : null);
    return {
      sessionId: session.session_id,
      sortTs: startTs,
      startedAt: session.started_at || (views.length ? views[0].enteredAt : null),
      endedAt: session.ended_at,
      durationMs: startTs && endTs && endTs > startTs ? endTs - startTs : null,
      referrer: session.referrer || "direct",
      country: session.country || null,
      converted: submissionSessionIds.has(session.session_id),
      pageViews: views,
    };
  });

  const orphanSessionEntries = orphanSessionIds.map((sessionId) => {
    const views = pageViewsBySession[sessionId].map(toViewShape);
    const startTs = toMs(views[0]?.enteredAt);
    const endTs = toMs(views[views.length - 1]?.leftAt || views[views.length - 1]?.enteredAt);
    return {
      sessionId,
      sortTs: startTs,
      startedAt: views[0]?.enteredAt || null,
      endedAt: null,
      durationMs: startTs && endTs && endTs > startTs ? endTs - startTs : null,
      referrer: "unknown",
      country: null,
      converted: submissionSessionIds.has(sessionId),
      pageViews: views,
    };
  });

  // Page views with no session_id at all can't be grouped into a real visit,
  // but they still get surfaced rather than silently dropped.
  if (pageViewsBySession["unassigned"]?.length) {
    const views = pageViewsBySession["unassigned"].map(toViewShape);
    const startTs = toMs(views[0]?.enteredAt);
    const endTs = toMs(views[views.length - 1]?.leftAt || views[views.length - 1]?.enteredAt);
    orphanSessionEntries.push({
      sessionId: "unassigned",
      sortTs: startTs,
      startedAt: views[0]?.enteredAt || null,
      endedAt: null,
      durationMs: startTs && endTs && endTs > startTs ? endTs - startTs : null,
      referrer: "unassigned activity",
      country: null,
      converted: false,
      pageViews: views,
    });
  }

  const sessionViews = [...realSessionEntries, ...orphanSessionEntries]
    .sort((a, b) => (a.sortTs ?? 0) - (b.sortTs ?? 0))
    .map((s, idx) => ({
      sessionId: s.sessionId,
      visitNumber: idx + 1,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationMs: s.durationMs,
      referrer: s.referrer,
      country: s.country,
      converted: s.converted,
      pageViews: s.pageViews,
    }));

  // ── Visitor type: did they convert on their first visit, or come back? ─
  let visitsBeforeConversion = 0;
  if (primaryConversion) {
    const convSessionIdx = sessionViews.findIndex((s) => s.sessionId === primaryConversion.sessionId);
    if (convSessionIdx >= 0) {
      visitsBeforeConversion = convSessionIdx;
    } else {
      const convTs = toMs(primaryConversion.submittedAt);
      visitsBeforeConversion = sessionViews.filter((s) => toMs(s.startedAt) < convTs).length;
    }
  }
  const visitorType = !primaryConversion ? null : visitsBeforeConversion === 0 ? "first-time" : "returning";

  // ── Pre-conversion path: every page view up through the moment they converted ─
  const convTs = primaryConversion ? toMs(primaryConversion.submittedAt) : null;
  const preConversionPath = [];
  sessionViews.forEach((session) => {
    session.pageViews.forEach((pv) => {
      if (convTs === null || toMs(pv.enteredAt) <= convTs) {
        preConversionPath.push({ ...pv, visitNumber: session.visitNumber, sessionId: session.sessionId });
      }
    });
  });
  if (preConversionPath.length) {
    preConversionPath[preConversionPath.length - 1].isConversionPage = true;
  }

  // ── Aggregate activity stats ────────────────────────────────────────────
  const totalPageViews = pageViews.length;
  const totalEngagedMs = pageViews.reduce((sum, pv) => sum + (pv.time_on_page || 0), 0);
  const scrolls = pageViews.map((pv) => pv.scroll_depth).filter((v) => v != null);
  const avgScrollPct = scrolls.length ? Math.round((scrolls.reduce((a, b) => a + b, 0) / scrolls.length) * 100) : null;

  // The `visitors` row is enrichment, not the anchor — fall back to the
  // earliest/latest timestamps we can find across sessions, page views and
  // submissions when it's missing (see getLeadProfile).
  const lastSession = sortedSessions[sortedSessions.length - 1];
  const lastPageView = pageViews[pageViews.length - 1];
  const lastSubmission = sortedSubmissions[sortedSubmissions.length - 1];

  const firstSeenTs = visitor?.first_seen ? toMs(visitor.first_seen) : minTs(sortedSessions[0]?.started_at, pageViews[0]?.entered_at, sortedSubmissions[0]?.submitted_at);
  const firstSeen = firstSeenTs ? new Date(firstSeenTs).toISOString() : null;

  const lastActivityTs = visitor?.last_seen
    ? toMs(visitor.last_seen)
    : maxTs(lastSession?.ended_at, lastSession?.last_activity_at, lastPageView?.left_at, lastPageView?.entered_at, lastSubmission?.submitted_at);
  const lastActivity = lastActivityTs ? new Date(lastActivityTs).toISOString() : null;

  const timeToConvertMs = primaryConversion && firstSeenTs ? toMs(primaryConversion.submittedAt) - firstSeenTs : null;

  // ── Engagement score (0-100 heuristic — not a prediction, just "how active") ─
  const timeMinutes = totalEngagedMs / 60000;
  const rawScore = totalPageViews * 3 + timeMinutes * 4 + (avgScrollPct || 0) * 0.3 + (sessionViews.length > 1 ? 10 : 0);
  const engagementScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    visitor,
    identity,
    lastActivity,
    firstSeen,
    device: visitor?.device_type || null,
    totalVisits: sessionViews.length,
    totalPageViews,
    totalEngagedMs,
    avgScrollPct,
    visitorType,
    visitsBeforeConversion,
    timeToConvertMs,
    engagementScore,
    conversions,
    primaryConversion,
    sessions: sessionViews,
    preConversionPath,
  };
}
