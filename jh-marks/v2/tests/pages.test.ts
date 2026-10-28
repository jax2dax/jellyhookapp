// jh-marks/v2/tests/pages.test.ts. Run: npx jiti jh-marks/v2/tests/pages.test.ts (part of npm run test:marks)
// Reading less must never change an answer. lib/marks/journey.ts reads a lead's visits and the page views of the visit
// the form was sent in, asks pagesToRead which other visits' page views can matter, reads only those, and checks.
// Here that is replayed on generated leads and marks (fixed seed, so a failure repeats) and compared with checking the
// full journey: same match, same evidence, and "cannot match" only when the full check says no.
import { checkLead, pagesToRead, type JPage, type JSession, type Journey } from "../check";
import type { Block, MarkRuleV2, NumCond, PageCond, SessionCond } from "../rule";

let passes = 0;
let fails = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) passes++;
  else {
    fails++;
    console.log("FAIL: " + msg);
  }
};

// mulberry32: a small seeded random generator
let seed = 20261027;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
const maybe = (p: number) => rnd() < p;

const PATHS = ["/", "/pricing", "/pricing/team", "/blog", "/contact"];
const HEADS = ["h1", "h2", "h3"];
const T0 = Date.parse("2026-10-01T10:00:00Z");

const num = (max: number): NumCond => {
  const op = pick([">=", ">", "<=", "<", "=", "between"] as const);
  const a = int(0, max);
  return op === "between" ? { op, a, b: a + int(0, max) } : { op, a };
};

function genPage(i: number): JPage {
  const headings = maybe(0.6) ? new Map(HEADS.filter(() => maybe(0.5)).map((h) => [h, int(0, 30) * 1000])) : null;
  return {
    path: pick(PATHS),
    enteredAt: T0 + i * 1000,
    ms: maybe(0.9) ? int(0, 90) * 1000 : null,
    seenPct: maybe(0.8) ? int(0, 100) : null,
    headings,
    headingTotalMs: headings ? [...headings.values()].reduce((a, b) => a + b, 0) : 0,
  };
}

function genJourney(): Journey {
  const first = maybe(0.3) ? int(2, 4) : 1; // visits before the ones kept do not exist: numbering starts at 1 in the data
  const n = int(1, 5);
  const sessions: JSession[] = [];
  for (let k = 0; k < n; k++) {
    const referrer = pick([null, "https://www.google.com/", "https://facebook.com/", "https://news.ycombinator.com/"]);
    const utmSource = pick([null, "google", "newsletter", "facebook"]);
    const medium = pick([null, "cpc", "email"]);
    sessions.push({
      id: "s" + (k + first),
      number: k + 1,
      startedAt: T0 + k * 86_400_000,
      ms: maybe(0.85) ? int(0, 600) * 1000 : null,
      referrer,
      utmSource,
      src: { referrer, utm_source: utmSource, utm_medium: medium, utm_campaign: maybe(0.3) ? "spring" : null, utm_content: maybe(0.2) ? "ad7" : null },
      pages: Array.from({ length: int(0, 5) }, (_, i) => genPage(i)),
    });
  }
  const sent = pick(["last", "last", "last", "middle", "none", "unknown"]);
  const convertingSessionId = sent === "last" ? sessions[n - 1].id : sent === "middle" ? sessions[int(0, n - 1)].id : sent === "unknown" ? "gone" : null;
  return {
    leadId: "L",
    submittedAt: T0 + 30 * 86_400_000,
    convertingSessionId,
    sessions,
    device: pick(["desktop", "mobile", null]),
    answers: {},
    form: maybe(0.6) ? { viewedAt: 0, firstInputAt: 5000, endedAt: 5000 + int(1, 60) * 1000, fieldKeys: ["email"], timings: {}, leftWhileFilling: pick([true, false, null]) } : null,
  };
}

let ids = 0;
const id = () => "x" + ++ids;
const head = () => {
  const h = pick(HEADS);
  return { key: h, text: h.toUpperCase() };
};

function genSessionCond(): SessionCond {
  switch (pick(["duration", "pages", "heading", "headingShare", "source", "channel", "device"] as const)) {
    case "duration":
      return { id: id(), kind: "duration", n: num(400) };
    case "pages":
      return { id: id(), kind: "pages", n: num(4) };
    case "heading":
      return { id: id(), kind: "heading", heading: head(), state: pick(["seen", "notSeen"] as const), n: maybe(0.5) ? num(30) : undefined };
    case "headingShare":
      return { id: id(), kind: "headingShare", heading: head(), n: num(100) };
    case "source":
      return { id: id(), kind: "source", value: pick(["google", "facebook", "news"]) };
    case "channel":
      return { id: id(), kind: "channel", platform: pick(["", "Google", "Facebook"]), paid: pick(["any", "paid", "free"] as const), campaign: maybe(0.3) ? "spring" : undefined };
    case "device":
      return { id: id(), kind: "device", value: pick(["desktop", "mobile"] as const) };
  }
}

function genPageCond(): PageCond {
  switch (pick(["time", "seen", "views", "heading", "headingShare"] as const)) {
    case "time":
      return { id: id(), kind: "time", n: num(60) };
    case "seen":
      return { id: id(), kind: "seen", n: num(100) };
    case "views":
      return { id: id(), kind: "views", n: num(3) };
    case "heading":
      return { id: id(), kind: "heading", heading: head(), state: pick(["seen", "notSeen"] as const) };
    case "headingShare":
      return { id: id(), kind: "headingShare", heading: head(), n: num(100) };
  }
}

function genBlock(depth: number, root: boolean): Block {
  const which = root
    ? pick([{ kind: "converting" }, { kind: "converting" }, { kind: "last" }, { kind: "any" }, { kind: "first" }, { kind: "nth", n: num(4) }, { kind: "every" }] as Block["which"][])
    : pick([{ kind: "later" }, { kind: "nth", n: num(4) }] as Block["which"][]);
  const order = pick(["any", "sequence"] as const);
  return {
    id: id(),
    which,
    session: Array.from({ length: int(0, 2) }, genSessionCond),
    pages: maybe(0.7) ? { order, steps: Array.from({ length: int(1, 2) }, () => ({ id: id(), path: pick(PATHS), match: pick(["exact", "startsWith"] as const), conds: Array.from({ length: int(0, 1) }, genPageCond).filter((c) => order === "any" || c.kind !== "views"), link: pick(["next", "later"] as const) })) } : null,
    then: depth < 2 && maybe(0.3) ? [genBlock(depth + 1, false)] : [],
  };
}

function genRule(): MarkRuleV2 {
  const form: MarkRuleV2["form"] = [];
  if (maybe(0.2)) form.push({ id: id(), kind: "leftWhileFilling", value: maybe(0.5) });
  if (maybe(0.15)) form.push({ id: id(), kind: "fillTime", n: num(60) });
  return { v: 2, answers: [], form, blocks: Array.from({ length: int(maybe(0.1) ? 0 : 1, 2) }, () => genBlock(0, true)) };
}

/** The journey with page views only for these visits: what the server holds after reading them. */
const only = (j: Journey, read: Set<string>): Journey => ({ ...j, sessions: j.sessions.map((s) => ({ ...s, pages: read.has(s.id) ? s.pages : [] })) });

const RUNS = 20_000;
const seen = { ruledOut: 0, sentVisitOnly: 0, readMore: 0, matched: 0, pagesSkipped: 0, pagesTotal: 0 };
for (let i = 0; i < RUNS; i++) {
  const j = genJourney();
  const rule = genRule();
  const full = checkLead(rule, j);
  // the server reads the page views of the visit the form was sent in together with the visits (lead.session_id)
  const read = new Set(j.convertingSessionId ? [j.convertingSessionId] : []);
  const need = pagesToRead(rule, only(j, read));
  const total = j.sessions.reduce((n, s) => n + s.pages.length, 0);
  seen.pagesTotal += total;
  if (full.match) seen.matched++;
  if (!need) {
    seen.ruledOut++;
    seen.pagesSkipped += j.sessions.filter((s) => !read.has(s.id)).reduce((n, s) => n + s.pages.length, 0);
    ok(!full.match, `run ${i}: ruled out without its pages, but the full check matches`);
    continue;
  }
  const missing = [...need].filter((s) => !read.has(s));
  if (missing.length) seen.readMore++;
  else seen.sentVisitOnly++;
  missing.forEach((s) => read.add(s));
  seen.pagesSkipped += j.sessions.filter((s) => !read.has(s.id)).reduce((n, s) => n + s.pages.length, 0);
  const got = checkLead(rule, only(j, read));
  ok(got.match === full.match && JSON.stringify(got.parts) === JSON.stringify(full.parts), `run ${i}: reading ${[...read].join(",")} gives ${got.match} ${JSON.stringify(got.parts)}, the full journey ${full.match} ${JSON.stringify(full.parts)}`);
}

// every path was exercised, not only the easy one
ok(seen.ruledOut > 1000 && seen.sentVisitOnly > 1000 && seen.readMore > 1000 && seen.matched > 500, "every path is tested: " + JSON.stringify(seen));
console.log(`page views not read: ${seen.pagesSkipped} of ${seen.pagesTotal} (${Math.round((100 * seen.pagesSkipped) / seen.pagesTotal)}%) on generated leads with 1 to 5 visits`);

// hand-made: a mark on the sent visit never reads earlier visits
const twenty: Journey = { leadId: "L", submittedAt: T0 + 40 * 86_400_000, convertingSessionId: "s20", device: "desktop", answers: {}, form: null, sessions: Array.from({ length: 20 }, (_, k) => ({ id: "s" + (k + 1), number: k + 1, startedAt: T0 + k * 86_400_000, ms: 60_000, referrer: null, utmSource: null, pages: [genPage(0), genPage(1)] })) };
const pricingNow: MarkRuleV2 = { v: 2, answers: [], form: [], blocks: [{ id: "b", which: { kind: "converting" }, session: [], pages: { order: "any", steps: [{ id: "s", path: "/pricing", match: "exact", conds: [], link: "later" }] }, then: [] }] };
ok([...(pagesToRead(pricingNow, only(twenty, new Set(["s20"])))) ?? []].join() === "s20", "the 20th visit: only the sent visit's page views are needed");
const fromAds: MarkRuleV2 = { v: 2, answers: [], form: [], blocks: [{ id: "b", which: { kind: "any" }, session: [{ id: "c", kind: "source", value: "google" }], pages: { order: "any", steps: [{ id: "s", path: "/pricing", match: "exact", conds: [], link: "later" }] }, then: [] }] };
ok(pagesToRead(fromAds, only(twenty, new Set(["s20"]))) === null, "no visit came from google: ruled out before any other page view is read");
const fromAds3 = { ...twenty, sessions: twenty.sessions.map((s) => (s.number === 3 ? { ...s, referrer: "https://www.google.com/" } : s)) };
ok([...(pagesToRead(fromAds, only(fromAds3, new Set(["s20"]))) ?? [])].join() === "s3", "only visit 3 came from google: only visit 3's page views are needed");

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
