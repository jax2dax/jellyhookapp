// lib/tracking/health.js
// "Is my tracking installed correctly, and is it actually working?"
// Pure: turns tracking_health rows into what Settings shows.
//
// Two different facts, never merged:
//   FOUND   the tracker saw the attribute on a page (tracking_health.details,
//           reported by the tracker when a page loads)
//   WORKING a real event followed (tracking_health.last_event_at: a real
//           conversion from a marked form, real timings from a marked field,
//           a real click on a marked element)
// So "found but never working" is the misinstalled case this exists to catch,
// and "misplaced" (attribute on the wrong element) is named as such.

export const CHECKS = {
  conversion_form: {
    label: "Conversion form",
    attribute: 'data-conversion="true"',
    hint: 'Put data-conversion="true" on the <form> element itself, not on a div or a button.',
  },
  field_attr: {
    label: "Tracked fields",
    attribute: "data-track-field",
    hint: "Put data-track-field on the input (or a wrapper around it) INSIDE a <form>.",
  },
  click_attr: {
    label: "Click tracking",
    attribute: 'data-track-click="name"',
    hint: 'Put data-track-click="a-name" on the button or link you want counted.',
  },
};

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** One page's state for one check. */
function pageState(checkKey, row, specifyForm) {
  const d = row.details || {};
  const working = !!row.last_event_at;
  const problems = [];
  let found = 0;

  if (checkKey === "conversion_form") {
    found = num(d.marked);
    if (num(d.wrong_element) > 0) problems.push(`${num(d.wrong_element)} element(s) with data-conversion are not a <form>`);
    if (num(d.wrong_value) > 0) problems.push(`${num(d.wrong_value)} form(s) have data-conversion but not the value "true"`);
    if (found === 0 && num(d.forms) > 0 && specifyForm && problems.length === 0) problems.push(`${num(d.forms)} form(s) on this page, none marked data-conversion="true"`);
  } else if (checkKey === "field_attr") {
    found = num(d.in_form);
    if (num(d.outside_form) > 0) problems.push(`${num(d.outside_form)} marked field(s) are not inside a <form>`);
  } else if (checkKey === "click_attr") {
    found = num(d.marked);
  }

  const state = working ? "working" : found > 0 ? "waiting" : problems.length > 0 ? "misplaced" : "none";
  return { path: row.page_path, state, found, problems, lastEventAt: row.last_event_at || null, lastSeenAt: row.last_seen_at || null };
}

/**
 * @param {Array<{page_path: string, check_key: string, details: object, last_event_at: string | null, last_seen_at?: string}>} rows
 * @param {{ specifyForm?: boolean }} [opts]
 * @returns {Array<{ key: string, label: string, attribute: string, hint: string, state: "working" | "waiting" | "misplaced" | "none", pages: object[], summary: string }>}
 */
export function summarizeHealth(rows, { specifyForm = false } = {}) {
  return Object.keys(CHECKS).map((key) => {
    const pages = (rows || []).filter((r) => r.check_key === key).map((r) => pageState(key, r, specifyForm));
    const any = (s) => pages.some((p) => p.state === s);
    const state = any("working") ? "working" : any("waiting") ? "waiting" : any("misplaced") ? "misplaced" : "none";
    const working = pages.filter((p) => p.state === "working").length;
    const waiting = pages.filter((p) => p.state === "waiting").length;
    const misplaced = pages.filter((p) => p.problems.length > 0).length;
    const parts = [];
    if (working) parts.push(`${working} page${working === 1 ? "" : "s"} working`);
    if (waiting) parts.push(`${waiting} found, no ${key === "conversion_form" ? "conversion" : key === "click_attr" ? "click" : "field activity"} recorded yet`);
    if (misplaced) parts.push(`${misplaced} page${misplaced === 1 ? "" : "s"} with a misplaced attribute`);
    const summary = parts.length ? parts.join(", ") : "Not found on any page the tracker has seen";
    return { key, ...CHECKS[key], state, pages: pages.sort((a, b) => a.path.localeCompare(b.path)), summary };
  });
}
