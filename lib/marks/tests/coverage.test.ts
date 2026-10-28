// lib/marks/tests/coverage.test.ts - which leads a mark has checked (v3): the past-leads choice, off, and a background
// check still on its way. Run: npm run test:marks
import { checkedLead, checkTime, markStatus, pastFrom, type MarkCheck } from "../coverage";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const NOW = Date.parse("2026-10-27T12:00:00Z");
const day = 86_400_000;
const at = (daysAgo: number) => new Date(NOW - daysAgo * day).toISOString();
const base: MarkCheck = { from: null, offSince: null, state: "done", until: at(0), cursorAt: null, total: 10, done: 10, error: null };

// the choice
ok(pastFrom("all", NOW) === null, "all leads: no lower bound");
ok(pastFrom("30d", NOW) === at(30), "last 30 days starts 30 days ago");
ok(pastFrom("90d", NOW) === at(90), "last 90 days starts 90 days ago");
ok(pastFrom("none", NOW) === at(0), "none: from now on");

// before migration 33 (no checks recorded): every lead counts as checked
ok(checkedLead(null, at(400)), "no check info: checked");
ok(checkedLead(base, null), "a lead without a sending time is never called unchecked by guess");

// the past-leads choice
const d30 = { ...base, from: at(30) };
ok(checkedLead(d30, at(10)), "last 30 days: a lead of 10 days ago is checked");
ok(!checkedLead(d30, at(45)), "last 30 days: a lead of 45 days ago is not checked");
ok(checkedLead({ ...base, from: null }, at(900)), "all leads: a lead of 900 days ago is checked");

// off
const off = { ...d30, offSince: at(5) };
ok(checkedLead(off, at(6)), "off since 5 days: a lead of 6 days ago was checked");
ok(!checkedLead(off, at(2)), "off since 5 days: a lead of 2 days ago was not");

// the background check, newest first: until = now, reached down to 10 days ago so far
const running: MarkCheck = { ...d30, state: "running", until: at(0.5), cursorAt: at(10), total: 300, done: 120 };
ok(checkedLead(running, at(3)), "running: a lead newer than the cursor is checked");
ok(checkedLead(running, at(10)), "running: the cursor's own lead is checked");
ok(!checkedLead(running, at(20)), "running: a lead older than the cursor is not checked yet");
ok(checkedLead(running, at(0.1)), "running: a lead newer than the check's start is checked by the lead lane");
ok(!checkedLead({ ...running, cursorAt: null }, at(3)), "running, first chunk not done: nothing in its range is checked yet");
ok(!checkedLead({ ...running, state: "failed" }, at(20)), "failed: what it did not reach is not checked");
ok(checkedLead({ ...running, state: "done" }, at(20)), "done: everything in the range is checked");

// the status line
ok(markStatus({ active: false, matchCount: 4, check: base }) === "off", "off reads off");
ok(markStatus({ active: true, matchCount: 1, check: base }) === "1 lead", "one lead");
ok(markStatus({ active: true, matchCount: 7, check: running }) === "checking 120 of 300, 7 leads so far", "progress: " + markStatus({ active: true, matchCount: 7, check: running }));
ok(markStatus({ active: true, matchCount: 0, check: running }) === "checking 120 of 300", "progress with no match yet");
ok(markStatus({ active: true, matchCount: 3, check: { ...running, state: "failed" } }).includes("Re-check"), "failed says to re-check");

// the time shown at save (8 ms per lead, the slow end of variant 7)
ok(checkTime(1000) === "under a minute", "1,000 leads: under a minute");
ok(checkTime(20_000) === "about 3 minutes", "20,000 leads: " + checkTime(20_000));

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
