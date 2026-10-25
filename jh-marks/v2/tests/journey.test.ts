// jh-marks/v2/tests/journey.test.ts. Run: npx jiti jh-marks/v2/tests/journey.test.ts (part of npm run test:marks)
// buildJourney with rows shaped like the database's (sessions, page_views, form_engagement, form_submissions).
import { buildJourney, headingMap } from "../journey";
import { checkLead } from "../check";
import { validateRuleV2 } from "../rule";
import { keyOfText } from "../../../lib/tracking/headingTime.js";

let passes = 0;
let fails = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) passes++;
  else fails++;
  console.log((cond ? "ok: " : "FAIL: ") + msg);
};
const at = (s: string) => "2026-10-0" + s + "Z"; // "1T10:00:00" -> 2026-10-01T10:00:00Z

// visitor V: visit A (Oct 1), visit B (Oct 2, the form was sent at 10:05), visit C (Oct 3, AFTER sending)
const sessions = [
  { session_id: "C", started_at: at("3T09:00:00"), ended_at: at("3T09:10:00"), referrer: null, utm_source: null },
  { session_id: "A", started_at: at("1T10:00:00"), ended_at: null, last_activity_at: at("1T10:03:00"), referrer: "https://google.com/", utm_source: null },
  { session_id: "B", started_at: at("2T10:00:00"), ended_at: at("2T10:20:00"), referrer: null, utm_source: "linkedin" },
];
const hours = { t: 1, h: [[keyOfText("Pricing plans"), 1, 0, 300, 1], ["^", 0, -1, 20, 1], ["~", 0, -2, 15, 0], [keyOfText("FAQ"), 2, 1, 100, 2]] };
const pages = new Map<string, Record<string, unknown>[]>([
  ["A", [{ session_id: "A", page_path: "/", entered_at: at("1T10:00:00"), left_at: at("1T10:01:00"), page_height: 2000, viewport_height: 1000, entry_scroll_depth: 0, max_scroll_depth: 1, revisit_start_scroll_depth: null, heading_time: null }]],
  [
    "B",
    [
      { session_id: "B", page_path: "/contact", entered_at: at("2T10:03:00"), left_at: at("2T10:05:30"), heading_time: null },
      { session_id: "B", page_path: "/pricing", entered_at: at("2T10:00:00"), left_at: at("2T10:02:00"), heading_time: hours },
      // opened after sending (10:05): never counts
      { session_id: "B", page_path: "/thanks", entered_at: at("2T10:06:00"), left_at: at("2T10:07:00"), heading_time: null },
    ],
  ],
  ["C", [{ session_id: "C", page_path: "/pricing", entered_at: at("3T09:00:00"), left_at: at("3T09:05:00"), heading_time: null }]],
]);
const lead = { id: "L1", visitor_id: "V", session_id: "B", submitted_at: at("2T10:05:00"), raw_data: { budget: "$4,000" } };
const sentForm = {
  session_id: "B",
  page_path: "/contact",
  viewed_at: at("2T10:03:05"),
  first_input_at: at("2T10:03:20"),
  ended_at: at("2T10:05:00"),
  form_fields: [{ key: "email" }, { key: "custom:budget" }],
  field_timings: { "custom:budget": { firstFocusAt: at("2T10:03:30"), firstKeydownAt: at("2T10:03:36"), totalFocusedMs: 9000, edits: 2, filled: true } },
};
const j = buildJourney(lead, sessions, pages, "desktop", [sentForm]);

ok(j.sessions.map((s) => s.id).join(",") === "A,B", "visits up to sending, oldest first (C was after sending)");
ok(j.sessions[0].number === 1 && j.sessions[1].number === 2, "numbered from the first visit ever");
ok(j.sessions[0].ms === 180_000, "an earlier visit lasts to its last activity when it never ended (3 min)");
ok(j.sessions[1].ms === 300_000, "the sending visit lasts up to sending (5 min, not 20)");
ok(j.sessions[1].pages.map((p) => p.path).join(",") === "/pricing,/contact", "its pages in order, without the one opened after sending");
ok(j.sessions[1].pages[0].ms === 120_000, "time on a page = left minus entered");
ok(j.sessions[0].pages[0].seenPct === 100, "share seen as Hook computes it (scrolled to the bottom: 100%)");
const pricing = j.sessions[1].pages[0];
ok(pricing.headings?.get(keyOfText("Pricing plans")) === 30_000 && pricing.headings?.get(keyOfText("FAQ")) === 10_000, "time per heading in ms");
ok(pricing.headingTotalMs === 40_000, "heading total leaves out above-the-first-heading and passing through");
ok(headingMap(null).map === null, "no heading time recorded: null (conditions on headings cannot be proven)");
ok(j.form?.firstInputAt === Date.parse(at("2T10:03:20")) && j.form?.fieldKeys?.length === 2, "the sent form");
const bt = j.form?.timings["custom:budget"];
ok(!!bt && bt.firstKeyAt !== null && bt.firstFocusAt !== null && bt.firstKeyAt - bt.firstFocusAt === 6000, "time before typing in Budget: 6 s");
ok(j.form?.leftWhileFilling === false, "filled without leaving: false");
ok(j.answers.budget === "$4,000" && j.device === "desktop" && j.convertingSessionId === "B", "answers, device, the converting visit");

// left while filling: between the first key (10:03:20) and sending (10:05:00), /pricing opened at 10:04
const pages2 = new Map(pages);
pages2.set("B", [...pages.get("B")!, { session_id: "B", page_path: "/pricing", entered_at: at("2T10:04:00"), left_at: at("2T10:04:20"), heading_time: null }]);
ok(buildJourney(lead, sessions, pages2, null, [sentForm]).form?.leftWhileFilling === true, "another page opened while filling: true");
// away 30 s: /contact left 10:03:40, next page (/contact again) opened 10:04:10
const pages3 = new Map(pages);
pages3.set("B", [
  { session_id: "B", page_path: "/contact", entered_at: at("2T10:03:00"), left_at: at("2T10:03:40"), heading_time: null },
  { session_id: "B", page_path: "/contact", entered_at: at("2T10:04:10"), left_at: at("2T10:04:50"), heading_time: null },
]);
ok(buildJourney(lead, sessions, pages3, null, [sentForm]).form?.leftWhileFilling === true, "away 30 s while filling: true");

// end to end: the journey through a v2 mark
const rule = validateRuleV2({
  v: 2,
  blocks: [
    { which: { kind: "first" }, session: [{ kind: "source", value: "google" }], then: [{ which: { kind: "later" }, pages: { order: "sequence", steps: [{ path: "/pricing", conds: [{ kind: "heading", heading: { key: keyOfText("Pricing plans"), text: "Pricing plans" }, state: "seen", n: { op: ">=", a: 20 } }] }, { path: "/contact", link: "next", conds: [] }] } }] },
  ],
  answers: [{ field: "custom:budget", name: "Budget", kind: "number", n: { op: ">=", a: 3000 } }],
  form: [{ kind: "fieldHesitation", field: "custom:budget", name: "Budget", n: { op: "<=", a: 10 } }],
});
const r = checkLead(rule, j);
ok(r.match, "found via google first, later read 'Pricing plans' 30 s then straight to /contact, budget $4,000, 6 s before typing it");
console.log("evidence:", r.parts.join(" | "));
ok(r.parts.includes("Budget: $4,000") && r.parts.some((p) => p.startsWith("visit 2: /pricing 2 min > /contact")), "the evidence names the answer and the visit");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
