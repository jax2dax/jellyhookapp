// lib/leadSessions/tests/story.test.ts - the session summary's versions and the page summary (lib/leadSessions/story.ts,
// mds/build/notifications/session-summary.md). Run: npm run test:marks
import { leftFormSentence, pageStorySentences, pageSummary, pathSequence, previousVisitsSummary, samePage, sessionStorySentences, sessionStoryVersion, type StoryVersion } from "../story";
import { buildTimeline } from "../../../framePlate/geometry/buildTimeline";
import type { PageVisitRaw, SectionTime, SessionRaw } from "../../../framePlate/types";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const T0 = Date.parse("2026-10-25T10:00:00Z");
const at = (s: number) => new Date(T0 + s * 1000).toISOString();
const sec = (text: string, s: number): SectionTime => ({ text, ms: s * 1000, entries: 1, isTop: false, subs: [] });

function view(id: string, path: string, from: number, to: number, sections: SectionTime[] = [], converted = false): PageVisitRaw {
  return {
    id,
    pagePath: path,
    enteredAt: at(from),
    leftAt: at(to),
    pageHeightPx: 3000,
    viewportHeightPx: 1000,
    scrollTrace: [{ t: 0, y: 0 }, { t: (to - from) * 1000, y: 0.5 }],
    converted,
    headers: [{ text: "Plans", y: 0.1 }, { text: "Business", y: 0.4 }, { text: "FAQ", y: 0.9 }],
    sections,
  };
}

// / 20s, /pricing 64s (55s on Business), away 15 min, / 8s with the form
const session: SessionRaw = {
  id: "s1",
  visitorId: "v1",
  startedAt: at(0),
  endedAt: at(1000),
  visits: [
    view("p1", "/", 0, 20, [sec("Plans", 5)]),
    view("p2", "/pricing", 21, 85, [sec("Business", 55), sec("FAQ", 3)]),
    view("p3", "/", 985, 993, [sec("Plans", 4)], true),
  ],
};

const text = (v: StoryVersion, n = 23) => sessionStoryVersion(session, n, v).map((s) => s.text);

// Long is the story exactly as before
ok(JSON.stringify(sessionStoryVersion(session, 23, "long")) === JSON.stringify(sessionStorySentences(session, 23)), "Long is the full story, unchanged");

// Short: the visit number and the path, with the time away
const short = text("short");
ok(short.length === 1, "Short is one line");
ok(short[0] === "Their 23rd visit: / (20s) → /pricing (1m 4s) → away 15m → / (8s).", "Short: number, pages with times, away: " + short[0]);
ok(text("short", 1)[0].startsWith("Their first visit: "), "the first visit is called the first");

// Moderate: key points, no repeats
const mod = text("moderate");
ok(mod[0] === short[0], "Moderate starts with the Short line");
ok(mod.includes("Most of the time on /pricing (1m 4s)."), "Moderate: the page with the most time");
ok(mod.some((s) => s.startsWith('Spent more than half of the whole visit looking at "Business" on /pricing (55s)')), "Moderate: the heading with half of the visit");
ok(!mod.some((s) => s.startsWith('The most on "Business"')), "Moderate: the most is left out when it is the same heading as the half-of-the-visit line");
ok(mod.some((s) => s.startsWith('The least on "FAQ" on /pricing (3s)')), "Moderate: the least");
ok(mod[mod.length - 1] === "Left the site and came back once.", "Moderate: times away, without the time");
ok(!mod.some((s) => s.startsWith("Spent time on")), "Moderate leaves out the heading count");

// a visit with one page: no "Most of the time on"
const one: SessionRaw = { ...session, visits: [view("q1", "/", 0, 30, [sec("Plans", 12), sec("FAQ", 2)])] };
const oneMod = sessionStoryVersion(one, 2, "moderate").map((s) => s.text);
ok(!oneMod.some((s) => s.startsWith("Most of the time on")), "one page: no 'Most of the time on'");
ok(oneMod.some((s) => s.startsWith('The most on "Plans"')), "one page: the most is kept when no heading took half the visit");

// the path: views of one page with no time away are one step; long paths are cut
const tabBack: SessionRaw = { ...session, visits: [view("r1", "/", 0, 10), view("r2", "/", 12, 20), view("r3", "/about", 21, 25)] };
ok(pathSequence(buildTimeline(tabBack)) === "/ (18s) → /about (4s)", "consecutive views of one page are one step");
const many: SessionRaw = { ...session, visits: Array.from({ length: 14 }, (_, i) => view("m" + i, "/p" + i, i * 10, i * 10 + 5)) };
const cut = pathSequence(buildTimeline(many));
ok(cut.includes("5 more") && cut.startsWith("/p0 (5s)") && cut.endsWith("/p13 (5s)"), "a long path keeps the first 5 and the last 4: " + cut);

// no pages recorded
ok(sessionStoryVersion({ ...session, visits: [] }, 1, "moderate")[0].text === "Opened the site but no page was recorded.", "empty visit");

// page summary
const ps = pageSummary("/pricing/", [session]);
ok(!!ps && ps.startsWith("1m 4s; read most of the page (67%), the top"), "page summary: time and what they saw: " + ps);
ok(!!ps && ps.includes('most on "Business" (55s)'), "page summary: the heading with the most time");
const home = pageSummary("/", [session]);
ok(!!home && home.startsWith("28s over 2 views; read up to 67% of the page") && home.endsWith("sent the form here"), "page summary over several views, with the form: " + home);
const other: SessionRaw = { ...session, id: "s0", visits: [view("o1", "/pricing", 0, 10)] };
ok((pageSummary("/pricing", [other, session]) ?? "").startsWith("1m 14s over 2 views in 2 visits"), "page summary across visits");
ok(pageSummary("/careers", [session]) === null, "a page not opened: null");
ok(samePage("/", "") && samePage("/a/", "/a") && !samePage("/a", "/b"), "trailing slashes do not matter");

// ── a form started and left unsent is a key event, said everywhere (2026-10-28) ──
const leftAt = (id: string, path: string, from: number, to: number, field: string | null): PageVisitRaw => ({ ...view(id, path, from, to, [sec("Plans", 30)]), abandonedForm: true, formStatus: "abandoned", formLastField: field });
const abandoned: SessionRaw = { id: "s2", visitorId: "v1", startedAt: at(0), endedAt: at(300), visits: [view("a1", "/pricing", 0, 240, [sec("Plans", 200)]), leftAt("a2", "/contact", 241, 300, "your-phone")] };
const pageLines = buildTimeline(abandoned).filter((i) => i.kind === "visit");
const contact = pageLines[1] as Parameters<typeof leftFormSentence>[0];
ok(pageStorySentences(contact).some((s) => s.text === 'Started the form and left it at the "your phone" field.'), "page summary: the form left unsent and the field");
for (const v of ["short", "moderate", "long"] as StoryVersion[])
  ok(sessionStoryVersion(abandoned, 2, v).some((s) => s.text === 'Started the form on /contact and left it at the "your phone" field.'), "visit summary (" + v + ") says the form left unsent");
ok((pageSummary("/contact", [abandoned]) ?? "").endsWith('started the form and left it at the "your phone" field'), "one-line page summary says it too");
ok(leftFormSentence({ ...contact, formLastField: null }, true) === "Started the form on /contact and left it unsent.", "no field known: left it unsent");

// ── earlier visits (hook option "Earlier visits") ──
const prev = previousVisitsSummary([abandoned, other]);
ok(prev[0].startsWith("First saw the site on ") && prev[0].includes("2 earlier visits"), "earlier visits: first seen and how many: " + prev[0]);
ok(prev.some((l) => l.includes('Spent 3m 20s on "Plans" on /pricing') && l.includes("left it at the")), "earlier visits: a long time on one heading and the form left unsent: " + prev[1]);
ok(previousVisitsSummary([]).length === 0, "no earlier visits: nothing");

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
