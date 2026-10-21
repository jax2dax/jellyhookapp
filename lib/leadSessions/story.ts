// lib/leadSessions/story.ts
// A lead's visits in plain words, for the lead page (components/leads/LeadSessionExplorer.tsx):
//   journeyStory  every visit together, at the top ("4 visits between Oct 7 and Oct 14 ... sent the form on the 4th")
//   sessionStory  one visit, under its visit chart
//   pageStory     one page of that visit, when its frame is clicked
// Pure and computed in the browser from data already loaded: no AI, no extra query. Every number comes from
// framePlate's own buildTimeline, so the words can never disagree with what the chart draws.
import { buildTimeline } from "../../framePlate/geometry/buildTimeline";
import type { SectionTime, SessionRaw, TimelineItem, VisitGeometry } from "../../framePlate/types";

type Visit = Extract<TimelineItem, { kind: "visit" }> & VisitGeometry;

/** "8m", "3m 10s", "45s", "1h 13m" */
export function shortDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m" + (s % 60 && m < 10 ? " " + (s % 60) + "s" : "");
  return Math.floor(m / 60) + "h " + (m % 60) + "m";
}
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : n + " times");
const pct = (x: number) => Math.round(x * 100) + "%";

function visitsOf(session: SessionRaw, fallbackViewportHeightPx: number): { visits: Visit[]; awayMs: number; awayCount: number } {
  const t = buildTimeline(session, undefined, undefined, fallbackViewportHeightPx);
  const visits = t.filter((i): i is Visit => i.kind === "visit");
  // a gap is a real departure (buildTimeline only makes one when they were away long enough), not a page loading
  const gaps = t.filter((i) => i.kind === "gap");
  const awayMs = gaps.reduce((n, g) => n + ((g as { durationMs?: number }).durationMs ?? 0), 0);
  return { visits, awayMs, awayCount: gaps.length };
}

/**
 * Which part of the page they saw, in words. A share alone misleads (14% can be the bottom of the page, not the top),
 * so it says WHERE: by the headings inside or next to the part they saw, else by position on the page.
 *   "read nearly all of it"
 *   "saw 14% of the page, near the bottom, around "Contact us""
 *   "saw 30% of the page, the top, down to "Pricing""
 *   "saw 22% of the page, the middle, just below "How it works""
 */
export function whereRead(v: VisitGeometry): string {
  const top = Math.max(0, v.seenOnceTop);
  const bottom = Math.min(1, v.seenBottom);
  const share = Math.max(0, bottom - top);
  if (share >= 0.9) return "read nearly all of it";
  const mid = (top + bottom) / 2;
  const zone = top < 0.05 ? "the top" : bottom > 0.95 ? "the bottom" : mid < 0.4 ? "the upper part" : mid > 0.6 ? "near the bottom" : "the middle";
  const headers = [...(v.headers ?? [])].sort((x, y) => x.y - y.y);
  const inside = headers.filter((h) => h.y >= top && h.y <= bottom);
  let ref = "";
  if (inside.length === 1) ref = ', around "' + inside[0].text + '"';
  else if (inside.length > 1) ref = top < 0.05 ? ', down to "' + inside[inside.length - 1].text + '"' : ', from "' + inside[0].text + '" to "' + inside[inside.length - 1].text + '"';
  else if (headers.length) {
    // no heading inside what they saw: the closest one above it or below it, whichever is nearer
    const above = [...headers].reverse().find((h) => h.y < top);
    const below = headers.find((h) => h.y > bottom);
    const dAbove = above ? top - above.y : Infinity;
    const dBelow = below ? below.y - bottom : Infinity;
    if (above && dAbove <= dBelow) ref = ', just below "' + above.text + '"';
    else if (below) ref = ', just above "' + below.text + '"';
  }
  const verb = share >= 0.6 ? "read most of the page (" + pct(share) + ")" : "saw " + pct(share) + " of the page";
  return verb + ", " + zone + ref;
}

const quote = (t: string | null) => (t ? '"' + (t.length > 60 ? t.slice(0, 57).trimEnd() + "..." : t) + '"' : "a heading no longer on the page");

/**
 * A story as sentences, so the page can show it as one paragraph or one sentence per line. `more` is the detail a
 * sentence can open on demand (the smaller headings of a section): shown as "…" after `text`, the sentence ends with ".".
 */
export type StorySentence = { text: string; more?: string };
const joinSentences = (list: StorySentence[]) => list.map((x) => (x.more !== undefined ? x.text + "." : x.text)).join(" ");

/** Under this, time on a heading is a glance, not reading: said as "skimmed". (Shown as "2s" or less.) */
export const SKIM_MS = 2500;
/** Less than this is not counted at all (a heading scrolled straight past). */
const MIN_MS = 500;

/**
 * One sentence per main section with time (page_views.heading_time), longest first, at most 4:
 *   'Spent 4m 12s in total on the "Pricing" section' + more '2m 27s on "Business", skimmed "Starter" (1s)'
 *   'Spent 2m 48s on "Questions people ask".'
 *   'Skimmed through "FAQ" (1s) and "Contact" (2s).'      (the main sections under 2.5 s, together)
 * "in total" only when the section has smaller headings with time (then its parts can be opened).
 */
export function sectionSentences(sections: SectionTime[] | null | undefined): StorySentence[] {
  const all = (sections ?? []).filter((s) => !s.isTop && s.ms >= MIN_MS);
  const read = all.filter((s) => s.ms >= SKIM_MS).sort((a, b) => b.ms - a.ms).slice(0, 4);
  const skimmed = all.filter((s) => s.ms < SKIM_MS);
  const out: StorySentence[] = read.map((s) => {
    const subs = s.subs.filter((x) => x.ms >= MIN_MS).sort((a, b) => b.ms - a.ms);
    if (!subs.length) return { text: "Spent " + shortDuration(s.ms) + " on " + quote(s.text) + "." };
    return {
      text: "Spent " + shortDuration(s.ms) + " in total on the " + quote(s.text) + " section",
      more: subs.map((x) => (x.ms < SKIM_MS ? "skimmed " + quote(x.text) + " (" + shortDuration(x.ms) + ")" : shortDuration(x.ms) + " on " + quote(x.text))).join(", "),
    };
  });
  if (skimmed.length) out.push({ text: "Skimmed through " + andList(skimmed.slice(0, 4).map((s) => quote(s.text) + " (" + shortDuration(s.ms) + ")")) + (skimmed.length > 4 ? " and " + (skimmed.length - 4) + " more" : "") + "." });
  return out;
}

const andList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);

/**
 * The places time was really spent: each smaller heading, and each main heading's own part (its time minus its smaller
 * headings'). Used to notice one heading taking most of the time.
 */
function timeUnits(sections: SectionTime[] | null | undefined): { text: string | null; ms: number }[] {
  const out: { text: string | null; ms: number }[] = [];
  for (const s of sections ?? []) {
    if (s.isTop) continue;
    const subsMs = s.subs.reduce((n, x) => n + x.ms, 0);
    out.push({ text: s.text, ms: Math.max(0, s.ms - subsMs) });
    for (const x of s.subs) out.push({ text: x.text, ms: x.ms });
  }
  return out;
}

/** The section sentences as plain text (no detail): 'Spent 16s in total on the "Pricing" section. Spent 5s on ...' */
export function sectionTimeStory(sections: SectionTime[] | null | undefined): string {
  return joinSentences(sectionSentences(sections));
}

/** One page view longer than this, with one heading at this share or more of it, says so (10:10:80, 20:80...). */
const DOMINANT_PAGE_MS = 10_000;
const DOMINANT_PAGE_SHARE = 0.8;
/** A page view shorter than this is "left almost immediately": no reading is described. */
const BRIEF_MS = 3000;

/** One page of a visit, as sentences. `nextPath`: the page they went to next, if any. */
export function pageStorySentences(v: VisitGeometry, nextPath?: string | null): StorySentence[] {
  const out: StorySentence[] = [];
  const headers = [...(v.headers ?? [])].sort((a, b) => a.y - b.y);
  const seen = headers.filter((h) => h.y >= v.seenOnceTop && h.y <= v.seenBottom);
  const ending = (): StorySentence =>
    v.outcome === "converted" ? { text: "Sent the form here." } : v.outcome === "live" ? { text: "Still on this page." } : nextPath ? { text: "Then went to the " + nextPath + " page." } : { text: "Left the site from here." };

  if (v.durationMs < BRIEF_MS && v.outcome !== "live") {
    // a glance: what was on screen, nothing about reading
    out.push({ text: "Spent only " + shortDuration(v.durationMs) + " on the " + (v.pagePath || "this") + " page and left almost immediately." });
    if (seen.length) out.push({ text: andList(seen.slice(0, 3).map((h) => quote(h.text))) + (seen.length > 3 ? " and " + (seen.length - 3) + " more" : "") + (seen.length === 1 ? " was" : " were") + " on screen." });
    out.push(ending());
    return out;
  }

  out.push({ text: "Spent " + shortDuration(v.durationMs) + " on the " + (v.pagePath || "this") + " page and " + whereRead(v) + (v.seenTwiceTop !== null ? ", going back over part of it" : "") + "." });
  if (v.durationMs > DOMINANT_PAGE_MS) {
    const top = timeUnits(v.sections).sort((a, b) => b.ms - a.ms)[0];
    if (top && top.ms >= DOMINANT_PAGE_SHARE * v.durationMs) out.push({ text: "Spent most of their time on the " + quote(top.text) + " part (" + shortDuration(top.ms) + ")." });
  }
  out.push(...sectionSentences(v.sections));
  if (headers.length) {
    if (seen.length === headers.length) out.push({ text: "Reached every heading." });
    else if (!seen.length) out.push({ text: "Did not reach any heading." });
    else out.push({ text: "Reached " + seen.length + " of " + headers.length + " headings." });
  }
  out.push(ending());
  return out;
}

/** One page of a visit, as one string. */
export function pageStory(v: VisitGeometry, nextPath?: string | null): string {
  return joinSentences(pageStorySentences(v, nextPath));
}

/** A visit longer than this, with one heading at this share or more of it, says so. */
const DOMINANT_VISIT_MS = 10_000;
const DOMINANT_VISIT_SHARE = 0.5;

/** Headings across every page of a visit: how many got time, and where the most and the least went (main sections). */
function headingsAcross(visits: Visit[]): StorySentence[] {
  const byHeading = new Map<string, { text: string | null; page: string; ms: number; views: number }>();
  let seen = 0;
  const counted = new Set<string>();
  for (const v of visits) {
    for (const s of v.sections ?? []) {
      if (s.isTop) continue;
      const k = v.pagePath + "|" + s.text;
      if (s.ms >= 1000) {
        const e = byHeading.get(k) ?? { text: s.text, page: v.pagePath, ms: 0, views: 0 };
        e.ms += s.ms;
        e.views += 1;
        byHeading.set(k, e);
        if (!counted.has(k)) { counted.add(k); seen += 1; }
      }
      for (const x of s.subs) {
        const sk = v.pagePath + "|" + s.text + "|" + x.text;
        if (x.ms >= 1000 && !counted.has(sk)) { counted.add(sk); seen += 1; }
      }
    }
  }
  const list = [...byHeading.values()].sort((a, b) => b.ms - a.ms);
  if (!list.length) return [];
  const pages = new Set(list.map((x) => x.page)).size;
  const where = (x: { text: string | null; page: string; ms: number; views: number }) =>
    quote(x.text) + " on " + x.page + " (" + shortDuration(x.ms) + (x.views > 1 ? " over " + x.views + " views" : "") + ")";
  const out: StorySentence[] = [];
  // one heading with half of the whole visit or more (10:30:10:50 ...) is the headline
  const visitMs = visits.reduce((n, v) => n + v.durationMs, 0);
  const units = new Map<string, { text: string | null; page: string; ms: number }>();
  for (const v of visits) for (const u of timeUnits(v.sections)) {
    const k = v.pagePath + "|" + u.text;
    const e = units.get(k) ?? { text: u.text, page: v.pagePath, ms: 0 };
    e.ms += u.ms;
    units.set(k, e);
  }
  const big = [...units.values()].sort((a, b) => b.ms - a.ms)[0];
  if (visitMs > DOMINANT_VISIT_MS && big && big.ms >= DOMINANT_VISIT_SHARE * visitMs) {
    out.push({ text: "Spent more than half of the whole visit looking at " + quote(big.text) + " on " + big.page + " (" + shortDuration(big.ms) + ")." });
  }
  out.push({ text: "Spent time on " + seen + (seen === 1 ? " heading" : " headings") + (pages > 1 ? " across " + pages + " pages" : "") + "." });
  out.push({ text: "The most on " + where(list[0]) + "." });
  if (list.length > 1) out.push({ text: "The least on " + where(list[list.length - 1]) + "." });
  return out;
}

/** One visit (session), as sentences. `n` is its number among the lead's visits (1 = first). */
export function sessionStorySentences(session: SessionRaw, n: number, fallbackViewportHeightPx = 0): StorySentence[] {
  const { visits, awayMs, awayCount } = visitsOf(session, fallbackViewportHeightPx);
  if (!visits.length) return [{ text: "Opened the site but no page was recorded." }];
  const total = visits.reduce((s, v) => s + v.durationMs, 0);
  const distinct = new Set(visits.map((v) => v.pagePath)).size;
  const last = visits[visits.length - 1];
  const sentOn = visits.find((v) => v.outcome === "converted");
  const out: StorySentence[] = [];
  const head = (n === 1 ? "Their first visit" : "Their " + ordinal(n) + " visit") + ", on " + day(session.startedAt) + ": " + shortDuration(total);
  if (visits.length === 1) {
    out.push({ text: head + " on the " + visits[0].pagePath + " page, and " + whereRead(visits[0]) + "." });
  } else {
    const pagesWord = visits.length + " pages" + (distinct < visits.length ? " (" + distinct + " different)" : "");
    const ends = sentOn ? "" : session.endedAt === null ? ", now on " + last.pagePath : ", leaving from " + last.pagePath;
    out.push({ text: head + " across " + pagesWord + ", starting on " + visits[0].pagePath + ends + "." });
    const longest = [...visits].sort((a, b) => b.durationMs - a.durationMs)[0];
    out.push({ text: "Most of the time on " + longest.pagePath + " (" + shortDuration(longest.durationMs) + ", " + whereRead(longest) + ")." });
    const counts = new Map<string, number>();
    for (const v of visits) counts.set(v.pagePath, (counts.get(v.pagePath) ?? 0) + 1);
    const repeated = [...counts].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
    if (repeated.length) out.push({ text: "Opened " + repeated.slice(0, 2).map(([p, c]) => p + " " + times(c)).join(" and ") + "." });
  }
  out.push(...headingsAcross(visits));
  if (awayCount > 0) out.push({ text: "Left the site and came back " + times(awayCount) + " (" + shortDuration(awayMs) + " away" + (awayCount > 1 ? " in total" : "") + ")." });
  if (sentOn) out.push({ text: "Sent the form on " + sentOn.pagePath + "." });
  return out;
}

/** One visit (session), as one string. */
export function sessionStory(session: SessionRaw, n: number, fallbackViewportHeightPx = 0): string {
  return joinSentences(sessionStorySentences(session, n, fallbackViewportHeightPx));
}

/** Every visit of the lead, in one paragraph: what they came back for, and when they contacted you. */
export function journeyStory(sessions: SessionRaw[], fallbackViewportHeightPx = 0): string {
  if (!sessions.length) return "";
  const all = sessions.map((s) => ({ s, ...visitsOf(s, fallbackViewportHeightPx) }));
  const pages = all.flatMap((x) => x.visits);
  const total = pages.reduce((n, v) => n + v.durationMs, 0);
  const first = sessions[0].startedAt;
  const last = sessions[sessions.length - 1].startedAt;
  const spanDays = Math.round((Date.parse(last) - Date.parse(first)) / 86_400_000);
  const parts: string[] = [];
  parts.push(
    (sessions.length === 1 ? "One visit, on " + day(first) : sessions.length + " visits between " + day(first) + " and " + day(last) + (spanDays > 0 ? " (" + spanDays + (spanDays === 1 ? " day" : " days") + ")" : "")) +
      ": " + pages.length + (pages.length === 1 ? " page" : " pages") + " and " + shortDuration(total) + " on the site.",
  );
  // where their time went: the pages with the most time, across every visit
  const byPage = new Map<string, { ms: number; views: number; visits: Set<string> }>();
  for (const x of all) for (const v of x.visits) {
    const e = byPage.get(v.pagePath) ?? { ms: 0, views: 0, visits: new Set<string>() };
    e.ms += v.durationMs;
    e.views += 1;
    e.visits.add(x.s.id);
    byPage.set(v.pagePath, e);
  }
  const top = [...byPage].sort((a, b) => b[1].ms - a[1].ms).filter(([, e]) => e.ms >= 5000).slice(0, 3);
  if (top.length) parts.push("Most of their time went to " + top.map(([p, e]) => p + " (" + shortDuration(e.ms) + (e.views > 1 ? ", " + e.views + " views" : "") + ")").join(", ") + ".");
  const comeback = [...byPage].filter(([, e]) => e.visits.size > 1).sort((a, b) => b[1].visits.size - a[1].visits.size)[0];
  if (comeback && sessions.length > 1) parts.push("They came back to " + comeback[0] + " in " + comeback[1].visits.size + " different visits.");
  const sentIndex = all.findIndex((x) => x.visits.some((v) => v.outcome === "converted"));
  if (sentIndex >= 0) {
    const sent = all[sentIndex];
    const daysAfter = Math.round((Date.parse(sent.s.startedAt) - Date.parse(first)) / 86_400_000);
    parts.push(
      "They sent the form on " + day(sent.s.startedAt) + (sessions.length > 1 ? ", on their " + ordinal(sentIndex + 1) + " visit" + (daysAfter > 0 ? ", " + daysAfter + (daysAfter === 1 ? " day" : " days") + " after the first" : "") : "") + ".",
    );
    const after = sessions.length - 1 - sentIndex;
    if (after > 0) parts.push("They came back " + times(after) + " since.");
  }
  return parts.join(" ");
}
