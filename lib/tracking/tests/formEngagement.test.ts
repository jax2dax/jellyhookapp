// lib/tracking/tests/formEngagement.test.ts - offline. Run: npm run test:forms
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { cleanDelta, cleanErrors, cleanFormFields, mergeFieldTimings, MAX_VISITS } from "../formEngagement.js";

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

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
