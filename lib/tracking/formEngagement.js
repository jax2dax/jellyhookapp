// lib/tracking/formEngagement.js
// The pure half of /api/track-form-engagement: cleaning what the tracker sends and merging it into the stored row.
// Lives here (not in the route file) so it is testable offline: lib/tracking/tests/formEngagement.test.ts.
//
// What one field's entry in form_engagement.field_timings holds (keyed by "email" | "name" | "phone" | "custom:<key>"):
//   order            1 = the first field ever focused (assigned once, server-side)
//   firstFocusAt     first focus ever
//   firstKeydownAt   first key ever pressed in it (a TIME, never which key)
//   lastUnfocusAt    most recent time it was left
//   totalFocusedMs   summed over every visit
//   visits           [[start, end, typed], ...] each visit's focus interval, oldest first, at most MAX_VISITS (added
//                    2026-10-14). typed = 1 when a key was pressed or the value changed during that visit, 0 when the
//                    field was only focused. Visits stored before the flag existed are [start, end].
//   filled           was the field non-empty when last left (true/false, never the value) (added 2026-10-14)
//   edits            visits that changed the value (a refill/correction count, never the value) (added 2026-10-14)
//   errors           times the browser reported it invalid on a submit attempt (added 2026-10-14)
// No value, length or keystroke is ever stored. See mds/build/form-study/tracker-changes.md.
import { cleanNum } from "./server.js";

export const MAX_FIELDS = 60;
export const MAX_VISITS = 12;
const FIELD_TYPES = new Set(["text", "email", "tel", "number", "url", "search", "date", "datetime-local", "month", "week", "time", "textarea", "select", "checkbox", "radio", "file", "range", "color", "other"]);

const iso = (v) => (typeof v === "string" ? v.slice(0, 40) : null);
const bool = (v) => (v === true ? true : v === false ? false : undefined);

/** field_timings_delta from the tracker, reduced to the known keys with sane values. */
export function cleanDelta(delta) {
  if (!delta || typeof delta !== "object" || Array.isArray(delta)) return undefined;
  const out = {};
  for (const [k, d] of Object.entries(delta).slice(0, MAX_FIELDS)) {
    if (!d || typeof d !== "object") continue;
    out[String(k).slice(0, 100)] = {
      firstFocusAt: iso(d.firstFocusAt),
      firstKeydownAt: iso(d.firstKeydownAt),
      lastUnfocusAt: iso(d.lastUnfocusAt),
      totalFocusedMsDelta: cleanNum(d.totalFocusedMsDelta, 0, 24 * 3600_000) ?? 0,
      filled: bool(d.filled),
      edited: bool(d.edited),
    };
  }
  return out;
}

/** field_errors_delta: { fieldKey: count } from the browser's "invalid" events. */
export function cleanErrors(errors) {
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return undefined;
  const out = {};
  for (const [k, n] of Object.entries(errors).slice(0, MAX_FIELDS)) {
    const c = cleanNum(n, 1, 100);
    if (c !== null) out[String(k).slice(0, 100)] = Math.floor(c);
  }
  return Object.keys(out).length ? out : undefined;
}

/** The form's field list, sent once when it is seen: keys, types and the required flag only. Never values. */
export function cleanFormFields(list) {
  if (!Array.isArray(list)) return undefined;
  const out = [];
  const seen = new Set();
  for (const f of list.slice(0, MAX_FIELDS)) {
    if (!f || typeof f !== "object" || typeof f.key !== "string" || !f.key) continue;
    const key = f.key.slice(0, 100);
    if (seen.has(key)) continue;
    seen.add(key);
    const field = { key, type: FIELD_TYPES.has(f.type) ? f.type : "other", required: f.required === true };
    // 2026-10-24: the visible label, a dropdown's / group's choices, a number's limits (never a value). Not part of the
    // form version fingerprint (key, type, required only), so they never create a new version.
    const text = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
    const label = text(f.label, 120);
    if (label) field.label = label;
    if (Array.isArray(f.options)) {
      const options = f.options
        .slice(0, 50)
        .map((o) => ({ v: text(o?.v, 80), l: text(o?.l, 80) }))
        .filter((o) => o.v || o.l);
      if (options.length) field.options = options;
    }
    for (const k of ["min", "max", "step"]) if (typeof f[k] === "number" && Number.isFinite(f[k])) field[k] = f[k];
    out.push(field);
  }
  return out.length ? out : undefined;
}

/**
 * Merges one request's field deltas and error counts into the stored field_timings. `order` is assigned once, the
 * first time a key appears; totals and counts are additive; each delta is one visit, appended to `visits`.
 */
export function mergeFieldTimings(existingTimings, delta, errors) {
  const merged = { ...(existingTimings || {}) };
  for (const [key, d] of Object.entries(delta || {})) {
    const prev = merged[key];
    const visits = Array.isArray(prev?.visits) ? prev.visits.slice() : [];
    // the delta is ONE visit: its firstKeydownAt is this visit's first key press (the tracker resets it per visit)
    if (d.firstFocusAt && d.lastUnfocusAt && visits.length < MAX_VISITS) visits.push([d.firstFocusAt, d.lastUnfocusAt, d.firstKeydownAt || d.edited === true ? 1 : 0]);
    merged[key] = {
      order: prev?.order ?? Object.keys(merged).length + 1,
      firstFocusAt: prev?.firstFocusAt || d.firstFocusAt || null,
      firstKeydownAt: prev?.firstKeydownAt || d.firstKeydownAt || null, // first-ever keystroke time, never overwritten once set
      lastUnfocusAt: d.lastUnfocusAt || prev?.lastUnfocusAt || null, // most recent leave always wins
      totalFocusedMs: (prev?.totalFocusedMs || 0) + (d.totalFocusedMsDelta || 0), // additive: the client only sends one visit
      visits,
      ...(d.filled !== undefined ? { filled: d.filled } : prev?.filled !== undefined ? { filled: prev.filled } : {}),
      edits: (prev?.edits || 0) + (d.edited ? 1 : 0),
      ...(prev?.errors ? { errors: prev.errors } : {}),
    };
  }
  for (const [key, n] of Object.entries(errors || {})) {
    const prev = merged[key];
    // an error on a field never focused still counts (submit with it left empty): give it an entry
    merged[key] = { ...(prev || { order: Object.keys(merged).length + 1, firstFocusAt: null, firstKeydownAt: null, lastUnfocusAt: null, totalFocusedMs: 0, visits: [], edits: 0 }), errors: (prev?.errors || 0) + n };
  }
  return merged;
}
