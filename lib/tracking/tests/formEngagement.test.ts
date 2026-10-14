// lib/tracking/tests/formEngagement.test.ts - offline. Run: npm run test:forms
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { cleanDelta, cleanErrors, cleanFormFields, mergeFieldTimings, MAX_VISITS } from "../formEngagement.js";
import { formFieldsForPageView } from "../../leadSessions/transform.js";

let fails = 0;
let passes = 0;
const ok = (c, m) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const d = cleanDelta({ email: { firstFocusAt: "2026-10-14T12:00:00Z", lastUnfocusAt: "2026-10-14T12:00:04Z", totalFocusedMsDelta: 4000, filled: true, edited: true, value: "SECRET" } });
ok(d.email.filled === true && d.email.edited === true && !("value" in d.email) && !JSON.stringify(d).includes("SECRET"), "cleanDelta keeps the two booleans and drops anything else (a value never passes)");
ok(cleanDelta({ x: { filled: "yes", edited: 1 } }).x.filled === undefined && cleanDelta({ x: { filled: "yes", edited: 1 } }).x.edited === undefined, "only real true/false are kept");

let t = mergeFieldTimings(null, d);
t = mergeFieldTimings(t, cleanDelta({ email: { firstFocusAt: "2026-10-14T12:00:10Z", lastUnfocusAt: "2026-10-14T12:00:12Z", totalFocusedMsDelta: 2000, filled: true, edited: false } }));
ok(t.email.totalFocusedMs === 6000 && t.email.visits.length === 2 && t.email.visits[1][0] === "2026-10-14T12:00:10Z", "each delta is one visit: appended, totals added");
ok(t.email.edits === 1 && t.email.filled === true && t.email.firstFocusAt === "2026-10-14T12:00:00Z" && t.email.lastUnfocusAt === "2026-10-14T12:00:12Z", "edits count, latest filled state, first focus kept, last leave updated");
for (let i = 0; i < 30; i++) t = mergeFieldTimings(t, cleanDelta({ email: { firstFocusAt: "2026-10-14T13:00:00Z", lastUnfocusAt: "2026-10-14T13:00:01Z", totalFocusedMsDelta: 1000 } }));
ok(t.email.visits.length === MAX_VISITS && t.email.totalFocusedMs === 36000, "visits are capped at " + MAX_VISITS + " but the total keeps adding");

t = mergeFieldTimings(t, undefined, cleanErrors({ email: 1, name: 2 }));
ok(t.email.errors === 1 && t.name.errors === 2 && t.name.totalFocusedMs === 0 && t.name.order === 2, "errors add up; a field that only ever failed validation gets an entry (never focused)");
t = mergeFieldTimings(t, undefined, cleanErrors({ email: 1 }));
ok(t.email.errors === 2, "errors are additive");
ok(cleanErrors({ a: 0, b: -1, c: "x" }) === undefined && JSON.stringify(cleanErrors({ a: 3 })) === '{"a":3}', "cleanErrors keeps positive counts only");

const old = mergeFieldTimings({ email: { order: 1, firstFocusAt: "a", lastUnfocusAt: "b", totalFocusedMs: 5 } }, cleanDelta({ email: { firstFocusAt: "c", lastUnfocusAt: "d", totalFocusedMsDelta: 5 } }));
ok(old.email.visits.length === 1 && old.email.totalFocusedMs === 10, "an old row without visits keeps working (gets its first visit from now on)");

const ff = cleanFormFields([{ key: "email", type: "email", required: true }, { key: "email", type: "email" }, { key: "custom:q", type: "weird", required: "yes", value: "SECRET" }, { nokey: 1 }]);
ok(ff.length === 2 && ff[1].type === "other" && ff[1].required === false && !JSON.stringify(ff).includes("SECRET"), "cleanFormFields: unique keys, known types, real booleans, nothing else");
ok(cleanFormFields("x") === undefined && cleanFormFields([]) === undefined, "cleanFormFields: junk gives nothing");

// ── per-visit typed flag, and the stripes of ONE page view ──
const tv = mergeFieldTimings(null, cleanDelta({ email: { firstFocusAt: "2026-10-14T12:00:00Z", firstKeydownAt: "2026-10-14T12:00:01Z", lastUnfocusAt: "2026-10-14T12:00:04Z", totalFocusedMsDelta: 4000 } }));
const tv2 = mergeFieldTimings(tv, cleanDelta({ name: { firstFocusAt: "2026-10-14T12:00:05Z", firstKeydownAt: null, lastUnfocusAt: "2026-10-14T12:00:06Z", totalFocusedMsDelta: 1000, edited: false } }));
ok(tv2.email.visits[0][2] === 1 && tv2.name.visits[0][2] === 0, "each stored visit says typed (1) or only focused (0)");

// founder's case: email + name filled on page view 1, they leave the page, come back (page view 2) and fill only phone
const row = {
  form_fields: [{ key: "email" }, { key: "name" }, { key: "phone" }],
  field_timings: {
    email: { order: 1, firstKeydownAt: "2026-10-14T12:00:01Z", visits: [["2026-10-14T12:00:00Z", "2026-10-14T12:00:04Z", 1]] },
    name: { order: 2, firstKeydownAt: "2026-10-14T12:00:06Z", visits: [["2026-10-14T12:00:05Z", "2026-10-14T12:00:09Z", 1]] },
    phone: { order: 3, firstKeydownAt: "2026-10-14T12:05:02Z", visits: [["2026-10-14T12:05:00Z", "2026-10-14T12:05:05Z", 1]] },
  },
};
const pv1 = formFieldsForPageView(row, "2026-10-14T11:59:00Z", "2026-10-14T12:01:00Z");
const pv2 = formFieldsForPageView(row, "2026-10-14T12:04:30Z", "2026-10-14T12:06:00Z");
ok(pv1.slots === 3 && JSON.stringify(pv1.touched.map((t) => t.slot)) === "[0,1]", "page view 1: stripes for email and name only (slots 1 and 2 of 3)");
ok(pv2.slots === 3 && pv2.touched.length === 1 && pv2.touched[0].slot === 2 && pv2.touched[0].state === "typed", "page view 2: ONLY phone, in its own place (third slot) - not all three");
const focusOnly = formFieldsForPageView({ field_timings: { email: { order: 1, firstKeydownAt: null, visits: [["2026-10-14T12:00:00Z", "2026-10-14T12:00:02Z", 0]] } } }, "2026-10-14T11:59:00Z", "2026-10-14T12:01:00Z");
ok(focusOnly.touched[0].state === "focused", "clicked into but nothing typed: drawn as focused (dim, dotted)");
const oldVisits = formFieldsForPageView({ field_timings: { email: { order: 1, firstKeydownAt: "2026-10-14T12:00:01Z", visits: [["2026-10-14T12:00:00Z", "2026-10-14T12:00:02Z"], ["2026-10-14T12:00:30Z", "2026-10-14T12:00:32Z"]] } } }, "2026-10-14T12:00:20Z", "2026-10-14T12:01:00Z");
ok(oldVisits.touched[0].state === "focused", "a visit stored before the flag: typed only if the first key press falls inside it");
ok(formFieldsForPageView({ field_timings: { email: { order: 1, totalFocusedMs: 5 } } }, "2026-10-14T11:00:00Z", "2026-10-14T13:00:00Z") === null, "a row with no stored visits (older): null, the old count is used instead");

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
