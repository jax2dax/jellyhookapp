// lib/analytics/attribution.js
// Which visit gets the credit for a lead. Pure; used by lib/actions/leadOriginBreakdown.action.ts, tested in
// lib/tracking/tests/attribution.test.ts. Public explanation: /docs/concepts/referrers-attribution.
import { classifyReferrer } from "./classifyReferrer.js";

/**
 * The source of the LAST visit that was not Direct, from sessions in time order (oldest first). Direct only when
 * every visit was Direct. A bookmark or a typed-in return therefore never hides the channel that brought them back.
 * @param {{ utm_source?: string|null, referrer?: string|null }[]} sessions
 */
export function lastNonDirectLabel(sessions) {
  let label = "Direct";
  for (const s of sessions) {
    const l = classifyReferrer(s);
    if (l !== "Direct") label = l;
  }
  return label;
}

/** The source of the first visit (sessions oldest first). */
export function firstTouchLabel(sessions) {
  return sessions.length ? classifyReferrer(sessions[0]) : "Direct";
}

/**
 * The most sources the Leads Origin radar shows as spokes. A radar reads well up to about 8 axes; with more distinct
 * sources the Referrers ring (all of them, small ones grouped as "Other") is shown next to it. One number for both.
 */
export const RADAR_MAX_SOURCES = 8;
