/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures are plain JSON rows */
// jh-forms/tests/averages.test.ts - versions (the 24 h rule), the average submission, the two groups, the comparison.
// Run: npm run test:forms
import { compareSummaries, filledWithoutTyping, fingerprintOf, isUnusual, MAX_VERSIONS_PER_FORM, median, MIN_UNUSUAL_GAP_MS, placeInVersion, quantile, spreadOf, summarizeVersion, unusualIn, versionLabel, type FormVersion, type VersionSummary } from "../averages";
import { buildFormTimeline, type EngagementRow, type FormFieldDef } from "../timeline";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};
const H = 3600_000;
const T0 = Date.parse("2026-10-01T10:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const A: FormFieldDef[] = [{ key: "name", type: "text", required: true }, { key: "email", type: "email", required: true }, { key: "custom:budget", type: "select", required: false }];
const B: FormFieldDef[] = [{ key: "name", type: "text", required: true }, { key: "email", type: "email", required: true }];
const C: FormFieldDef[] = [{ key: "email", type: "email", required: true }, { key: "name", type: "text", required: true }];

// ---------- fingerprints ----------
ok(fingerprintOf(A) === fingerprintOf(A.map((f) => ({ ...f }))), "same field list, same fingerprint");
ok(fingerprintOf(B) !== fingerprintOf(C), "field order counts");
ok(fingerprintOf(B) !== fingerprintOf([B[0], { ...B[1], required: false }]), "required counts");
ok(fingerprintOf(A).length === 16, "16 hex chars");

// ---------- the 24 h rule ----------
let n = 0;
const id = () => "v" + ++n;
let vs: FormVersion[] = [];
const place = (f: FormFieldDef[], at: number) => {
  const r = placeInVersion(vs, f, at, id);
  vs = r.versions;
  return r;
};
place(A, T0);
ok(vs.length === 1 && vs[0].endedAt === null, "the first row starts version 1");
ok(place(A, T0 + 30 * H).versionId === "v1", "the same layout days later: still version 1");
const changed = place(B, T0 + 48 * H);
ok(changed.created && vs.length === 2 && vs[0].endedAt === T0 + 48 * H, "a change after the first day starts version 2 at once and ends version 1 at that moment");
const sameDay = place(C, T0 + 50 * H);
ok(!sameDay.created && sameDay.versionId === "v2" && vs[1].fingerprints.length === 2 && fingerprintOf(vs[1].fields) === fingerprintOf(C), "another change 2 h later joins version 2, which takes the newer field list");
ok(place(B, T0 + 80 * H).versionId === "v2", "after the first day, a layout already in version 2 stays in version 2 (two live variants do not flip)");
ok(place(A, T0 + 100 * H).created && vs.length === 3, "a layout not in the current version, after its first day: version 3");
ok(versionLabel(vs[0]) === "10/01 - 10/03" && versionLabel(vs[2]).endsWith("today"), "labels: " + vs.map(versionLabel).join(", "));

vs = [];
for (let i = 0; i < MAX_VERSIONS_PER_FORM + 5; i++) place([{ key: "f" + i, type: "text", required: false }], T0 + i * 48 * H);
ok(vs.length === MAX_VERSIONS_PER_FORM, "at most " + MAX_VERSIONS_PER_FORM + " versions per form; later layouts join the last one");

// ---------- average submission ----------
// a field visit: [start, end, typed]; k = first key delay (null = nothing typed)
type V = { key: string; start: number; end: number; k: number | null; filled?: boolean };
let s = 0;
function row(status: string, visits: V[], opts: { fields?: FormFieldDef[]; endExtraMs?: number } = {}): EngagementRow {
  s++;
  const ft: Record<string, any> = {};
  visits.forEach((v, i) => {
    const t = ft[v.key] ?? { order: Object.keys(ft).length + 1, totalFocusedMs: 0, visits: [], firstFocusAt: iso(T0 + v.start), filled: v.filled ?? true, firstKeydownAt: null };
    t.totalFocusedMs += v.end - v.start;
    t.visits.push([iso(T0 + v.start), iso(T0 + v.end), v.k === null ? 0 : 1]);
    t.lastUnfocusAt = iso(T0 + v.end);
    if (v.k !== null && !t.firstKeydownAt) t.firstKeydownAt = iso(T0 + v.start + v.k);
    ft[v.key] = t;
    void i;
  });
  const first = visits.length ? T0 + visits[0].start : null;
  const last = visits.length ? T0 + Math.max(...visits.map((v) => v.end)) + (opts.endExtraMs ?? 0) : null;
  return {
    session_id: "s" + s, page_path: "/contact", status, viewed_at: iso(T0 - 5000),
    first_input_at: first === null ? null : iso(first), ended_at: status === "submitted" || status === "abandoned" ? (last === null ? null : iso(last)) : null,
    field_timings: ft, form_fields: opts.fields ?? A, onscreen_before_start_ms: 2000,
  };
}
const sec = 1000;
const rows: EngagementRow[] = [
  // typed: name 4 s (1 s before typing), pause 3 s, email 6 s
  row("submitted", [{ key: "name", start: 0, end: 4 * sec, k: sec }, { key: "email", start: 7 * sec, end: 13 * sec, k: 2 * sec }]),
  // typed: name 6 s, straight on, email 10 s, budget select 2 s
  row("submitted", [{ key: "name", start: 0, end: 6 * sec, k: sec }, { key: "email", start: 6.2 * sec, end: 16.2 * sec, k: 2 * sec }, { key: "custom:budget", start: 17 * sec, end: 19 * sec, k: null }]),
  // typed: name 8 s, pause 5 s, email 4 s, back to name 2 s
  row("submitted", [{ key: "name", start: 0, end: 8 * sec, k: 3 * sec }, { key: "email", start: 13 * sec, end: 17 * sec, k: sec }, { key: "name", start: 17.5 * sec, end: 19.5 * sec, k: 0 }]),
  // filled without typing: name and email autofilled (no key press), very short
  row("submitted", [{ key: "name", start: 0, end: 300, k: null }, { key: "email", start: 400, end: 700, k: null }]),
  row("abandoned", [{ key: "name", start: 0, end: 5 * sec, k: sec }]),
  row("started", [{ key: "name", start: 0, end: 2 * sec, k: sec }]),
  row("viewed", []),
];
ok(median([3, 1, 2]) === 2 && median([1, 2, 3, 10]) === 2.5 && median([]) === null, "median: middle value, mean of the two middles, null when empty");
ok(filledWithoutTyping(rows[3]).join() === "name,email", "autofill stand-in: text fields filled with no key press");
ok(filledWithoutTyping(rows[1]).length === 0, "a select chosen without typing is NOT counted as autofill");

const sum = summarizeVersion(rows, A, []);
ok(sum.started === 6 && sum.submitted === 4 && Math.abs(sum.completionRate! - 4 / 6) < 1e-9, "completion uses everyone: 4 submitted of 6 started (the only-seen row is not started)");
ok(sum.typed === 3 && sum.withoutTyping === 1, "groups: 3 typed, 1 filled without typing");
const f = (k: string) => sum.fields.find((x) => x.key === k)!;
ok(f("name").inFieldMs === 6 * sec, "name: median time in field of the typed group = 6 s (4, 6, 8+2=10 -> 6); the autofilled 0.3 s is left out");
ok(f("name").hesitationMs === sec, "name: median before typing 1 s (1, 1, 3)");
ok(f("email").inFieldMs === 6 * sec && f("email").hesitationMs === 2 * sec, "email: median 6 s in field (6, 10, 4), 2 s before typing");
ok(f("name").pauseAfterMs === 4 * sec && Math.abs(f("name").pausedShare! - 2 / 3) < 1e-9, "pause after name: 3 s, straight on, 5 s -> 2 of 3 paused, median of those who paused 4 s");
ok(f("custom:budget").pauseAfterMs === null && f("custom:budget").pausedShare === 0, "nobody paused after budget: no pause time, 0%");
ok(Math.abs(f("name").cameBackShare! - 1 / 3) < 1e-9, "came back to name: 1 of 3");
ok(f("custom:budget").used === 1 && Math.abs(f("custom:budget").skippedShare! - 2 / 3) < 1e-9, "budget: used in 1 typed submission, skipped by 2 of 3");
ok(f("name").filledWithoutTyping === 1 && f("email").filledWithoutTyping === 1, "filled without typing counted per field");
ok(sum.form.fillMs === 19 * sec, "median total time of the typed group: 13, 19, 19.5 s -> 19 s");
ok(sum.form.beforeTypingMs === 2000, "before typing: the on-screen time");
ok(sum.withoutTypingFillMs === 700, "the other group's median total is reported on its own: 0.7 s");
ok(sum.fields.map((x) => x.key).join() === "name,email,custom:budget", "fields in the version's order");
ok(summarizeVersion(rows, A, [], 2).sampled === 2, "only the newest N submissions are used when there are more");
const mixed = summarizeVersion([row("submitted", [{ key: "name", start: 0, end: 4000, k: 500 }], { fields: B }), row("submitted", [{ key: "name", start: 0, end: 4000, k: 500 }], { fields: A })], A, []);
ok(mixed.fields.find((x) => x.key === "custom:budget")!.skippedShare === 1, "skipped counts only forms that had the field: 1 of 1 (the form without budget is not a skip)");

// ---------- unusual ----------
ok(quantile([1, 2, 3, 4], 0.25) === 1.75 && quantile([5], 0.75) === 5, "quantiles interpolate like Postgres percentile_cont");
const sp = spreadOf(Array.from({ length: 40 }, (_, i) => 5000 + i * 100))!; // 5.0 .. 8.9 s
ok(sp.n === 40 && Math.abs(sp.median - 6950) < 1e-6 && sp.limit === sp.median + MIN_UNUSUAL_GAP_MS, "a tight spread: the limit is median + 10 s, not just Tukey's fence");
ok(!isUnusual(16_000, sp) && isUnusual(17_000, sp), "16 s is not unusual against a 7 s median (under +10 s), 17 s is");
ok(!isUnusual(60_000, spreadOf([5000, 6000, 7000])), "under 30 people in the reference: nothing is ever unusual");
ok(!isUnusual(1, sp), "being fast is never unusual");
const wide = spreadOf(Array.from({ length: 40 }, (_, i) => 1000 + i * 2000))!; // 1 .. 79 s
ok(wide.limit === wide.q3 + 1.5 * (wide.q3 - wide.q1), "a wide spread: Tukey's fence (q3 + 1.5 x IQR) is the limit");

// a reference of 40 typed submissions, then one slow person
const refRows = Array.from({ length: 40 }, (_, i) => row("submitted", [{ key: "name", start: 0, end: 4000 + (i % 5) * 200, k: 500 }, { key: "email", start: 5000, end: 11_000 + (i % 7) * 300, k: 800 }]));
const ref = summarizeVersion(refRows, B, []);
ok(ref.spread.fields.name!.n === 40 && ref.spread.totals.span!.n === 40, "the reference keeps the spread of every field and total");
const slow = buildFormTimeline(row("abandoned", [{ key: "name", start: 0, end: 4000, k: 500 }, { key: "email", start: 5000, end: 60_000, k: 800 }]), []);
const u = unusualIn(slow, ref);
ok(u.fields.has("email") && !u.fields.has("name"), "55 s in email is unusual (typical about 6.9 s), 4 s in name is not");
ok(u.totals.has("span") && u.totals.has("inFields") && !u.totals.has("pauses"), "and so is the total, and the time in fields; pausing is not");
ok(unusualIn(slow, null).fields.size === 0, "no reference (no comparison selected): nothing is unusual");

// ---------- comparison ----------
const fake = (started: number, submitted: number, fillMs: number, nameMs: number): VersionSummary => ({
  ...sum, started, submitted, completionRate: submitted / started, form: { ...sum.form, fillMs }, fields: [{ ...f("name"), inFieldMs: nameMs }],
});
ok(compareSummaries(fake(40, 10, 50_000, 5000), null).state === "noPrevious", "no previous version: no comparison");
const few = compareSummaries(fake(12, 4, 50_000, 5000), fake(200, 50, 60_000, 6000));
ok(few.state === "tooFew" && few.currentStarted === 12, "under 30 started in either version: too few to compare");
const cmp = compareSummaries(fake(150, 48, 50_000, 5000), fake(300, 81, 62_000, 7000));
ok(cmp.state === "ok" && cmp.completionPoints === 5 && cmp.fillMs === -12_000 && cmp.fields.name === -2000, "32% vs 27%: +5 points; 12 s faster in total; name 2 s faster");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
