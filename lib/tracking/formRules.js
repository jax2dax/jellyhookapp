// lib/tracking/formRules.js
// Which form submissions are leads (mds/build/forms/lead-forms.md). One rule, used by the tracker (an exact copy in
// public/tracker.js, jhCountsAsLead) and enforced again by the server (app/api/track-form/route.js):
//   1. data-conversion="false" on the form or a box around it: never a lead;
//   2. data-conversion="true": always a lead;
//   3. else the form's own switch in Settings, Lead forms (site_forms.counts_as_lead, true or false);
//   4. else the site's default for forms nobody has switched yet: on, except for sites created with
//      "Only forms I mark" (sites.specify_form = true), whose unswitched forms stay off as before.
// Built-in skips (login, search, password, one non-email field) happen earlier in the tracker and are not leads either.
// A submission that is not a lead is counted per form (site_forms.skipped_count); its name, email and answers are never
// sent by the tracker nor stored by the server.

/** "true", "false" or null, from the closest data-conversion value the tracker found. */
export function markOf(raw) {
  return raw === "true" || raw === true ? "true" : raw === "false" || raw === false ? "false" : null;
}

/**
 * @param {{ mark: "true" | "false" | null, rule: boolean | null | undefined, specifyForm: boolean }} p
 * @returns {boolean}
 */
export function countsAsLead({ mark, rule, specifyForm }) {
  if (mark === "false") return false;
  if (mark === "true") return true;
  if (rule === true || rule === false) return rule;
  return !specifyForm;
}

/** At most this many form switches are sent to the tracker with the site's config. */
export const MAX_RULES_IN_CONFIG = 200;
