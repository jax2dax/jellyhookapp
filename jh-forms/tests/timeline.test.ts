// jh-forms/tests/timeline.test.ts - offline. Run: npm run test:forms
import { buildFormTimeline, PAUSE_MIN_MS, type EngagementRow, type PageViewRow } from "../timeline";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);
const at = (s: number) => new Date(T0 + s * 1000).toISOString();

// A person sees the form at 0 s, starts at 10 s: email 10-14 (typed at 11), moves straight to name (Tab, 5 ms later),
// name 14.005-18, pauses 6 s on the page, phone 24-27, leaves the tab 27-87 (60 s away), comes back and submits at 90.
const row: EngagementRow = {
  session_id: "s1",
  page_path: "/contact",
  status: "submitted",
  viewed_at: at(0),
  first_input_at: at(10),
  ended_at: at(90),
  last_field_type: "phone",
  field_timings: {
    email: { order: 1, firstFocusAt: at(10), firstKeydownAt: at(11), lastUnfocusAt: at(14), totalFocusedMs: 4000 },
    name: { order: 2, firstFocusAt: at(14.005), firstKeydownAt: at(14.5), lastUnfocusAt: at(18), totalFocusedMs: 3995 },
    phone: { order: 3, firstFocusAt: at(24), firstKeydownAt: null, lastUnfocusAt: at(27), totalFocusedMs: 3000 },
  },
};
const views: PageViewRow[] = [
  { page_view_id: "a", session_id: "s1", page_path: "/contact", entered_at: at(-30), left_at: at(27) },
  { page_view_id: "b", session_id: "s1", page_path: "/contact", entered_at: at(87), left_at: at(95) },
];
const t = buildFormTimeline(row, views);

ok(t.ended === "submitted" && t.fields.length === 3, "three fields, submitted");
ok(JSON.stringify(t.fields.map((f) => f.label)) === JSON.stringify(["email", "name", "phone"]), "fields in the order used");
ok(t.totals.toStartMs === 10_000, "time from seeing the form to the first input: 10 s");
ok(t.totals.spanMs === 80_000, "first input to submit: 80 s");
ok(t.totals.inFieldsMs === 10_995, "time in fields: the sum of focused time");
ok(t.segments.some((s) => s.kind === "move" && s.ms === 5), "a 5 ms gap (Tab) is a straight move, not a pause");
ok(t.totals.pausesMs === 6000 && t.segments.filter((s) => s.kind === "pause").length === 1, "the 6 s gap on the page is a pause");
ok(t.totals.awayMs === 60_000 && t.segments.some((s) => s.kind === "away" && s.ms === 60_000), "the 60 s with the tab hidden is away, not a pause");
ok(t.fields[0].hesitationMs === 1000 && t.fields[2].hesitationMs === null && t.fields[2].typed === false, "hesitation = focus to first key; a field never typed in has none");
ok(t.fields.find((f) => f.label === "phone")!.last === true, "the field they were on at the end is marked");
ok(t.exact === true && t.fields.every((f) => !f.revisited), "every field visited once: exact");
const sum = t.totals.inFieldsMs + t.totals.pausesMs + t.totals.awayMs + t.totals.otherPagesMs + t.totals.unaccountedMs;
ok(sum === t.totals.spanMs, "in fields + pauses + away + other pages + unaccounted = the whole span (" + sum + ")");

// a gap that is partly away: 20 s gap, 15 s of it with the tab hidden -> 5 s pause + 15 s away
const r2: EngagementRow = { ...row, field_timings: { email: { order: 1, firstFocusAt: at(10), lastUnfocusAt: at(14), totalFocusedMs: 4000 }, name: { order: 2, firstFocusAt: at(34), lastUnfocusAt: at(36), totalFocusedMs: 2000 } }, ended_at: at(36) };
const v2: PageViewRow[] = [
  { page_view_id: "a", session_id: "s1", page_path: "/contact", entered_at: at(-5), left_at: at(16) },
  { page_view_id: "b", session_id: "s1", page_path: "/contact", entered_at: at(31), left_at: at(40) },
];
const t2 = buildFormTimeline(r2, v2);
ok(t2.totals.awayMs === 15_000 && t2.totals.pausesMs === 5000, "a gap split into the part away (15 s) and the pause on the page (5 s)");

// another page in the middle
const v3: PageViewRow[] = [
  { page_view_id: "a", session_id: "s1", page_path: "/contact", entered_at: at(-5), left_at: at(16) },
  { page_view_id: "x", session_id: "s1", page_path: "/pricing", entered_at: at(16), left_at: at(31) },
  { page_view_id: "b", session_id: "s1", page_path: "/contact", entered_at: at(31), left_at: at(40) },
];
const t3 = buildFormTimeline(r2, v3);
ok(t3.totals.otherPagesMs === 15_000 && t3.totals.awayMs === 0 && t3.segments.some((s) => s.kind === "otherPage" && s.path === "/pricing"), "time on another page of the site is 'other page', with its path");

// revisited field: span 10-30 but only 8 s focused -> approximate
const r4: EngagementRow = { ...row, status: "abandoned", ended_at: at(30), field_timings: { email: { order: 1, firstFocusAt: at(10), lastUnfocusAt: at(30), totalFocusedMs: 8000 } } };
const t4 = buildFormTimeline(r4, views);
ok(t4.fields[0].revisited === true && t4.exact === false && t4.segments.some((s) => s.kind === "field" && s.approx), "a field left and come back to is marked approximate, not given invented intervals");
ok(t4.ended === "abandoned" && t4.fields[0].last === true, "abandoned: the last field is marked");

// only seen, never started
const t5 = buildFormTimeline({ session_id: "s1", page_path: "/contact", status: "viewed", viewed_at: at(0), first_input_at: null, ended_at: null, field_timings: {} }, views);
ok(t5.ended === "notStarted" && t5.fields.length === 0 && t5.totals.spanMs === null && t5.totals.toStartMs === null, "a form only seen: not started, no span");

// threshold is one constant
ok(PAUSE_MIN_MS === 1500, "pause threshold is 1.5 s");
const t6 = buildFormTimeline(row, views, 10_000);
ok(t6.totals.pausesMs === 0, "with a 10 s threshold the 6 s gap is a move");

// ── rows recorded after 2026-10-14: per-visit intervals, field list, signals ──
const r7: EngagementRow = {
  session_id: "s1",
  page_path: "/contact",
  status: "submitted",
  viewed_at: at(0),
  first_input_at: at(5),
  ended_at: at(40),
  onscreen_before_start_ms: 3200,
  last_field_type: "email",
  form_fields: [
    { key: "email", type: "email", required: true },
    { key: "name", type: "text", required: true },
    { key: "phone", type: "tel", required: false },
    { key: "custom:company", type: "text", required: false },
  ],
  field_timings: {
    // email: 5-9, then back 30-34 (two visits, exact), edited twice, one validation error
    email: { order: 1, firstFocusAt: at(5), firstKeydownAt: at(6), lastUnfocusAt: at(34), totalFocusedMs: 8000, visits: [[at(5), at(9)], [at(30), at(34)]], filled: true, edits: 2, errors: 1 },
    name: { order: 2, firstFocusAt: at(9.01), firstKeydownAt: at(9.5), lastUnfocusAt: at(15), totalFocusedMs: 5990, visits: [[at(9.01), at(15)]], filled: true, edits: 1 },
    phone: { order: 3, firstFocusAt: null, lastUnfocusAt: null, totalFocusedMs: 0, visits: [], edits: 0, errors: 2 }, // only ever failed validation
  },
};
const t7 = buildFormTimeline(r7, [{ page_view_id: "a", session_id: "s1", page_path: "/contact", entered_at: at(-10), left_at: at(45) }]);
const email7 = t7.fields.find((f) => f.key === "email")!;
ok(email7.visits.length === 2 && email7.revisited === true && email7.approx === false && t7.exact === true, "two stored visits: revisited but EXACT (no approximation)");
ok(t7.segments.filter((s) => s.kind === "field" && s.key === "email").length === 2, "one segment per visit");
ok(t7.segments.some((s) => s.kind === "pause" && s.from === T0 + 15_000 && s.to === T0 + 30_000), "the pause is measured between the real visits (name left at 15 s, email again at 30 s)");
ok(email7.filled === true && email7.edits === 2 && email7.errors === 1 && email7.required === true, "filled, edits, errors and required come through");
ok(t7.untouched.length === 2 && t7.untouched.some((u) => u.key === "phone" && u.errors === 2) && t7.untouched.some((u) => u.label === "company" && !u.required), "untouched fields: phone (failed validation twice, never focused) and company");
ok(t7.formFieldCount === 4 && t7.totals.onscreenBeforeStartMs === 3200, "field count from the field list; on-screen time before starting");
const old7 = buildFormTimeline(row, views);
ok(old7.untouched.length === 0 && old7.formFieldCount === null && old7.totals.onscreenBeforeStartMs === null, "an old row: no field list, no untouched, no on-screen time (shown as unknown, not zero)");

// pauses never overlap the time away: gap 60 s -> 470 s with another page 70-120 and the site left 120-280
const r8: EngagementRow = {
  session_id: "s1", page_path: "/contact", status: "abandoned", viewed_at: at(0), first_input_at: at(1), ended_at: at(480), form_fields: [],
  field_timings: { email: { order: 1, firstFocusAt: at(1), lastUnfocusAt: at(480), totalFocusedMs: 30000, visits: [[at(1), at(60)], [at(470), at(480)]] } },
};
const v8: PageViewRow[] = [
  { page_view_id: "a", session_id: "s1", page_path: "/contact", entered_at: at(-5), left_at: at(70) },
  { page_view_id: "b", session_id: "s1", page_path: "/pricing", entered_at: at(70), left_at: at(120) },
  { page_view_id: "c", session_id: "s1", page_path: "/contact", entered_at: at(280), left_at: at(500) },
];
const t8 = buildFormTimeline(r8, v8);
const pauses8 = t8.segments.filter((s) => s.kind === "pause");
ok(pauses8.length === 2 && t8.totals.pausesMs === 200_000, "a gap with another page and time away inside it gives two pauses of 10 s and 190 s (the on-page pieces only)");
const sorted8 = [...t8.segments].sort((a, b) => a.from - b.from);
ok(sorted8.every((s, i) => i === 0 || s.from >= sorted8[i - 1].to - 1), "no two segments overlap: a pause is never drawn over the time away");
ok(t8.totals.awayMs === 160_000 && t8.totals.otherPagesMs === 50_000, "away 160 s and the other page 50 s stay separate");

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
