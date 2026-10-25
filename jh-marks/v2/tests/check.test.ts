// jh-marks/v2/tests/check.test.ts. Run: npx jiti jh-marks/v2/tests/check.test.ts (part of npm run test:marks)
// Hand-built leads, one per idea, checked against v2 marks. Every expected answer is worked out by hand in the comment.
import { checkLead, type JPage, type JSession, type Journey } from "../check";
import { describeRuleV2, RuleV2Error, validateRuleV2, type MarkRuleV2 } from "../rule";
import { keyOfText } from "../../../lib/tracking/headingTime.js";

let passes = 0;
let fails = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) passes++;
  else fails++;
  console.log((cond ? "ok: " : "FAIL: ") + msg);
};

const T0 = Date.parse("2026-10-01T10:00:00Z");
const H = (text: string) => ({ key: keyOfText(text), text });
const page = (path: string, sec: number, extra: Partial<JPage> = {}): JPage => ({ path, enteredAt: 0, ms: sec * 1000, seenPct: 80, headings: null, headingTotalMs: 0, ...extra });
const withHeadings = (path: string, sec: number, h: Record<string, number>): JPage => {
  const m = new Map(Object.entries(h).map(([t, s]) => [keyOfText(t), s * 1000]));
  return page(path, sec, { headings: m, headingTotalMs: [...m.values()].reduce((a, b) => a + b, 0) });
};
const visit = (number: number, pages: JPage[], extra: Partial<JSession> = {}): JSession => ({ id: "s" + number, number, startedAt: T0 + number * 86_400_000, ms: pages.reduce((n, p) => n + (p.ms ?? 0), 0), referrer: null, utmSource: null, pages, ...extra });
const lead = (sessions: JSession[], extra: Partial<Journey> = {}): Journey => ({ leadId: "L", submittedAt: T0 + 30 * 86_400_000, convertingSessionId: sessions[sessions.length - 1]?.id ?? null, sessions, device: "desktop", answers: {}, form: null, ...extra });
const rule = (x: Partial<MarkRuleV2>): MarkRuleV2 => validateRuleV2({ v: 2, blocks: [], answers: [], form: [], ...x });
const is = (r: MarkRuleV2, j: Journey) => checkLead(r, j).match;

// ── answers ──
const budgetOpts = [{ v: "tier_1", l: "Under $1k" }, { v: "tier_2", l: "$1k-$5k" }, { v: "tier_3", l: "$5k+" }];
const ans = (a: Record<string, unknown>) => lead([visit(1, [page("/", 5)])], { answers: a });
const budget = (op: string, a: number) => rule({ answers: [{ id: "a", field: "custom:budget", name: "Budget", kind: "number", n: { op: op as ">=", a }, options: budgetOpts }] });
ok(is(budget(">=", 3000), ans({ budget: "tier_2" })), "radio tier_2 = $1k-$5k meets Budget >= 3000 (any part: 5,000)");
ok(!is(budget(">=", 6000), ans({ budget: "tier_2" })), "$1k-$5k does not meet >= 6000");
ok(is(budget(">", 30), ans({ budget: "$3,000" })), "typed $3,000 meets > 30");
ok(!is(budget(">", 30), ans({ budget: "not sure" })) && !is(budget(">", 30), ans({})), "no number, or no answer: no match");
ok(checkLead(budget(">=", 3000), ans({ budget: "tier_2" })).parts[0] === "Budget: $1k-$5k", "the evidence shows the option's text: " + checkLead(budget(">=", 3000), ans({ budget: "tier_2" })).parts[0]);
const svc = (op: "is" | "isNot") => rule({ answers: [{ id: "a", field: "custom:service", name: "Service", kind: "choice", op, values: ["Web design"], options: [{ v: "web", l: "Web design" }, { v: "seo", l: "SEO" }] }] });
ok(is(svc("is"), ans({ service: "web" })) && !is(svc("is"), ans({ service: "seo" })), "choice by its visible text");
ok(is(svc("isNot"), ans({ service: "seo" })) && !is(svc("isNot"), ans({})), "is not: another choice matches, no answer does not");
const consent = (checked: boolean) => rule({ answers: [{ id: "a", field: "custom:consent", name: "Consent", kind: "yesno", checked }] });
ok(is(consent(true), ans({ consent: "yes" })) && is(consent(false), ans({})) && !is(consent(true), ans({})), "yes / no");
const notes = rule({ answers: [{ id: "a", field: "custom:message", name: "Message", kind: "text", op: "contains", value: "urgent" }] });
ok(is(notes, ans({ message: "This is URGENT please" })) && !is(notes, ans({ message: "hello" })), "text contains, any case");

// ── form activity ──
const form = (f: Partial<Journey["form"]> & object) => lead([visit(1, [page("/contact", 60)])], { form: { viewedAt: 0, firstInputAt: 10_000, endedAt: 25_000, fieldKeys: ["email", "custom:budget", "custom:message"], timings: {}, leftWhileFilling: false, ...f }, answers: { budget: "5k" } });
const quick = rule({ form: [{ id: "f", kind: "fillTime", n: { op: "<", a: 20 } }] });
ok(is(quick, form({})) && !is(quick, form({ endedAt: 40_000 })), "filled in under 20 s (15 s yes, 30 s no)");
ok(!is(quick, lead([visit(1, [page("/", 5)])])), "no form activity recorded: a form condition cannot be true");
const hesitation = rule({ form: [{ id: "f", kind: "fieldHesitation", field: "custom:budget", name: "Budget", n: { op: "<=", a: 3 } }] });
ok(is(hesitation, form({ timings: { "custom:budget": { firstFocusAt: 12_000, firstKeyAt: 14_000, focusedMs: 4000, edits: 1, errors: 0, filled: true } } })), "no hesitation on Budget: 2 s before typing <= 3 s");
ok(!is(hesitation, form({ timings: { "custom:budget": { firstFocusAt: 12_000, firstKeyAt: 19_000, focusedMs: 9000, edits: 1, errors: 0, filled: true } } })), "7 s before typing is hesitation");
ok(!is(hesitation, form({ timings: {} })), "never clicked into Budget: unknown, no match");
ok(is(rule({ form: [{ id: "f", kind: "leftWhileFilling", value: true }] }), form({ leftWhileFilling: true })) && !is(rule({ form: [{ id: "f", kind: "leftWhileFilling", value: true }] }), form({ leftWhileFilling: null })), "left while filling (unknown never matches)");
ok(is(rule({ form: [{ id: "f", kind: "fieldEmpty", field: "custom:message", name: "Message", value: true }] }), form({})), "Message left empty (read from the answers)");
ok(is(rule({ form: [{ id: "f", kind: "emptyFields", n: { op: ">=", a: 2 } }] }), form({ timings: { "custom:budget": { firstFocusAt: 1, firstKeyAt: 2, focusedMs: 1, edits: 1, errors: 0, filled: true } } })), "2 of 3 fields not filled");
ok(is(rule({ form: [{ id: "f", kind: "errors", n: { op: ">=", a: 1 } }] }), form({ timings: { email: { firstFocusAt: 1, firstKeyAt: 2, focusedMs: 1, edits: 1, errors: 2, filled: true } } })), "form errors counted across fields");

// ── which visit ──
// visit 1: / and /blog; visit 2: /pricing 40 s; visit 3 (sent the form): /contact
const three = lead([visit(1, [page("/", 10), page("/blog", 30)]), visit(2, [page("/pricing", 40)]), visit(3, [page("/contact", 20)])]);
const pricing = (which: object) => rule({ blocks: [{ id: "b", which, session: [], pages: { order: "any", steps: [{ id: "s", path: "/pricing", match: "exact", conds: [{ id: "c", kind: "time", n: { op: ">=", a: 30 } }], link: "later" }] }, then: [] }] as never });
ok(!is(pricing({ kind: "converting" }), three), "default: the converting visit (3) had no /pricing");
ok(is(pricing({ kind: "any" }), three), "any visit: visit 2 had /pricing for 40 s");
ok(!is(pricing({ kind: "first" }), three) && is(pricing({ kind: "nth", n: { op: "=", a: 2 } }), three), "first visit no, 2nd visit yes");
ok(is(pricing({ kind: "nth", n: { op: "between", a: 2, b: 3 } }), three) && !is(pricing({ kind: "nth", n: { op: ">", a: 2 } }), three), "between 2nd and 3rd yes, after the 2nd no");
ok(is(rule({ blocks: [{ id: "b", which: { kind: "last" }, session: [], pages: { order: "any", steps: [{ id: "s", path: "/contact", match: "exact", conds: [], link: "later" }] }, then: [] }] as never }), three), "last visit = the converting one");
const everyLong = rule({ blocks: [{ id: "b", which: { kind: "every" }, session: [{ id: "c", kind: "duration", n: { op: ">=", a: 20 } }], pages: null, then: [] }] as never });
ok(is(everyLong, three) && !is(everyLong, lead([visit(1, [page("/", 5)]), visit(2, [page("/", 30)])])), "every visit at least 20 s");

// ── then: later visits ──
// blog in some visit, THEN pricing in a later one, THEN contact in a later one
const chain = rule({
  blocks: [
    {
      id: "b1", which: { kind: "any" }, session: [], pages: { order: "any", steps: [{ id: "s", path: "/blog", match: "exact", conds: [], link: "later" }] },
      then: [{ id: "b2", which: { kind: "later" }, session: [], pages: { order: "any", steps: [{ id: "s", path: "/pricing", match: "exact", conds: [], link: "later" }] }, then: [{ id: "b3", which: { kind: "later" }, session: [], pages: { order: "any", steps: [{ id: "s", path: "/contact", match: "exact", conds: [], link: "later" }] }, then: [] }] }],
    },
  ] as never,
});
ok(is(chain, three), "blog (1) then pricing (2) then contact (3)");
ok(!is(chain, lead([visit(1, [page("/pricing", 40)]), visit(2, [page("/blog", 10)]), visit(3, [page("/contact", 10)])])), "pricing BEFORE blog: no");
// backtracking: blog in visit 1 and 3, pricing in 2 and 4, contact only in 3.
// blog(1) -> pricing(2) -> contact(3) works; the checker must not give up after trying blog(1) -> pricing(4).
const bt = lead([visit(1, [page("/blog", 5)]), visit(2, [page("/pricing", 5)]), visit(3, [page("/blog", 5), page("/contact", 5)]), visit(4, [page("/pricing", 5)])]);
ok(is(chain, bt), "a chain across four visits with repeated pages is found");
const absolute = rule({ blocks: [{ id: "b1", which: { kind: "first" }, pages: null, then: [{ id: "b2", which: { kind: "nth", n: { op: "=", a: 3 } }, session: [{ id: "c", kind: "pages", n: { op: ">=", a: 1 } }], pages: { order: "any", steps: [{ id: "s", path: "/contact", match: "exact", conds: [], link: "later" }] }, then: [] }], session: [{ id: "c0", kind: "duration", n: { op: ">=", a: 1 } }] }] as never });
ok(is(absolute, three), "then the 3rd visit (counted from the first ever): /contact in visit 3");
const two = rule({ blocks: [{ id: "b1", which: { kind: "first" }, session: [{ id: "c", kind: "duration", n: { op: ">=", a: 1 } }], pages: null, then: [
  { id: "b2", which: { kind: "later" }, session: [], pages: { order: "any", steps: [{ id: "s", path: "/pricing", match: "exact", conds: [], link: "later" }] }, then: [] },
  { id: "b3", which: { kind: "later" }, session: [], pages: { order: "any", steps: [{ id: "s", path: "/contact", match: "exact", conds: [], link: "later" }] }, then: [] },
] }] as never });
ok(is(two, three) && !is(two, lead([visit(1, [page("/", 5)]), visit(2, [page("/pricing", 5)])])), "two separate 'then' blocks under one visit: both must happen later");

// ── page sequences in one visit ──
const reviewVisit = (pages: JPage[]) => lead([visit(1, pages)]);
const seq = (link: "next" | "later") => rule({ blocks: [{ id: "b", which: { kind: "converting" }, session: [], pages: { order: "sequence", steps: [{ id: "a", path: "/blogs", match: "exact", conds: [], link: "later" }, { id: "b", path: "/review", match: "exact", conds: [], link }] }, then: [] }] as never });
ok(is(seq("next"), reviewVisit([page("/", 5), page("/blogs", 20), page("/review", 10)])), "/blogs then right after /review");
ok(!is(seq("next"), reviewVisit([page("/blogs", 20), page("/about", 5), page("/review", 10)])) && is(seq("later"), reviewVisit([page("/blogs", 20), page("/about", 5), page("/review", 10)])), "a page in between: 'next' no, 'later' yes");
ok(!is(seq("later"), reviewVisit([page("/review", 10), page("/blogs", 20)])), "wrong order: no");
ok(is(seq("next"), reviewVisit([page("/blogs", 2), page("/x", 1), page("/blogs", 20), page("/review", 10)])), "the second /blogs view is followed by /review: found");
const views = rule({ blocks: [{ id: "b", which: { kind: "any" }, session: [], pages: { order: "any", steps: [{ id: "a", path: "/blog/", match: "startsWith", conds: [{ id: "v", kind: "views", n: { op: ">=", a: 3 } }], link: "later" }] }, then: [] }] as never });
ok(is(views, reviewVisit([page("/blog/a", 5), page("/blog/b", 5), page("/blog/c", 5)])) && !is(views, reviewVisit([page("/blog/a", 5), page("/blog/b", 5)])), "3 blog posts in one visit");

// ── headings ──
// home: "What we do" 25 s, "Hero" 5 s; pricing: "Offers" 22 s, "FAQ" 2 s
const reading = lead([visit(1, [withHeadings("/", 30, { "What we do": 25, Hero: 5 }), withHeadings("/pricing", 24, { Offers: 22, FAQ: 2 })])]);
const founderExample = rule({
  blocks: [{ id: "b", which: { kind: "converting" }, session: [], pages: { order: "sequence", steps: [
    { id: "a", path: "/", match: "exact", conds: [{ id: "h", kind: "heading", heading: H("What we do"), state: "seen", n: { op: ">", a: 20 } }], link: "later" },
    { id: "b", path: "/pricing", match: "exact", conds: [{ id: "h", kind: "heading", heading: H("Offers"), state: "seen", n: { op: ">=", a: 20 } }], link: "next" },
  ] }, then: [] }] as never,
  answers: [{ id: "x", field: "custom:budget", name: "Budget", kind: "number", n: { op: ">", a: 30 } }],
});
ok(is(founderExample, { ...reading, answers: { budget: "$500" } }), "the founder's example: home 'What we do' > 20 s, straight to pricing 'Offers' >= 20 s, budget > $30");
ok(!is(founderExample, { ...reading, answers: { budget: "$20" } }), "same visit, budget $20: no");
const notRead = rule({ blocks: [{ id: "b", which: { kind: "converting" }, session: [], pages: { order: "any", steps: [{ id: "a", path: "/pricing", match: "exact", conds: [{ id: "h", kind: "heading", heading: H("Enterprise"), state: "notSeen" }], link: "later" }] }, then: [] }] as never });
ok(is(notRead, reading), "never read 'Enterprise' on /pricing");
ok(!is(notRead, lead([visit(1, [page("/pricing", 30)])])), "no heading time recorded for that view: cannot prove 'not seen'");
const share = rule({ blocks: [{ id: "b", which: { kind: "any" }, session: [{ id: "s", kind: "headingShare", heading: H("Offers"), n: { op: ">=", a: 40 } }], pages: null, then: [] }] as never });
ok(is(share, reading), "'Offers' got 22 of 54 s of reading in the visit (41%) >= 40%");
const acrossVisit = rule({ blocks: [{ id: "b", which: { kind: "any" }, session: [{ id: "s", kind: "heading", heading: H("FAQ"), state: "seen", n: { op: ">=", a: 2 } }], pages: null, then: [] }] as never });
ok(is(acrossVisit, reading), "a heading across the whole visit");

// ── visit conditions ──
ok(is(rule({ blocks: [{ id: "b", which: { kind: "any" }, session: [{ id: "s", kind: "source", value: "google" }], pages: null, then: [] }] as never }), lead([visit(1, [page("/", 5)], { referrer: "https://www.google.com/" })])), "came from google");
ok(!is(rule({ blocks: [{ id: "b", which: { kind: "any" }, session: [{ id: "s", kind: "device", value: "mobile" }], pages: null, then: [] }] as never }), three), "device mobile: no (desktop)");

// ── came from an ad (lib/acquisition/channel.ts) ──
// visit 1 from a Meta ad (Spring sale, video-1), visit 2 direct: converted
const adJourney = lead([
  visit(1, [page("/offer", 20)], { src: { referrer: null, utm_source: "facebook", utm_medium: "cpc", utm_campaign: "Spring sale", utm_content: "video-1", landing_path: "/offer" } }),
  visit(2, [page("/contact", 30)], { src: { referrer: null, utm_source: null, utm_medium: null, utm_campaign: null } }),
]);
const cameFrom = (which: object, cond: object) => rule({ blocks: [{ id: "b", which, session: [{ id: "c", kind: "channel", ...cond }], pages: null, then: [] }] as never });
ok(is(cameFrom({ kind: "first" }, { platform: "Meta", paid: "paid" }), adJourney), "first visit came from a Meta ad");
ok(is(cameFrom({ kind: "any" }, { platform: "Meta", paid: "paid", campaign: "spring", ad: "video" }), adJourney), "any visit: campaign 'spring' and ad 'video' (any case, contains)");
ok(!is(cameFrom({ kind: "converting" }, { platform: "Meta", paid: "paid" }), adJourney), "the converting visit was direct: not a Meta ad (the ad does not take the credit for a direct visit)");
ok(is(cameFrom({ kind: "converting" }, { platform: "Direct", paid: "any" }), adJourney), "the converting visit was Direct");
ok(!is(cameFrom({ kind: "any" }, { platform: "Meta", paid: "free" }), adJourney), "Meta but free (social): no, it was an ad");
ok(!is(cameFrom({ kind: "any" }, { platform: "Google", paid: "paid" }), adJourney), "no Google ad in the journey");
let chErr = "";
try {
  validateRuleV2({ v: 2, blocks: [{ which: { kind: "any" }, session: [{ kind: "channel", platform: "", paid: "any" }] }] });
} catch (e) {
  chErr = e instanceof RuleV2Error ? e.message : "";
}
ok(chErr.startsWith("Say where they came from"), "an empty 'came from' is refused");

// ── validation and description ──
let threw = "";
try {
  validateRuleV2({ v: 2, blocks: [], answers: [], form: [] });
} catch (e) {
  threw = e instanceof RuleV2Error ? e.message : "";
}
ok(threw === "Add at least one condition.", "an empty mark is refused");
try {
  validateRuleV2({ v: 2, blocks: [{ which: { kind: "any" }, session: [{ kind: "duration", n: { op: ">=", a: -5 } }] }] });
  threw = "";
} catch (e) {
  threw = e instanceof RuleV2Error ? e.message : "";
}
ok(threw.startsWith("Visit length"), "a negative number is refused with a readable message: " + threw);
const defaulted = validateRuleV2({ v: 2, blocks: [{ session: [{ kind: "pages", n: { op: ">=", a: 2 } }] }] });
ok(defaulted.blocks[0].which.kind === "converting", "a block without 'which' is about the converting visit");
const text = describeRuleV2(founderExample);
console.log(text.join("\n"));
ok(text[0].includes('reading "What we do" for more than 20 s') && text[0].includes("then right after /pricing") && text[1] === "Answered: Budget more than 30.", "plain English");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
