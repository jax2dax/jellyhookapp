// lib/leadSessions/story.ts
// A lead's visits in plain words, for the lead page (components/leads/LeadSessionExplorer.tsx):
//   journeyStory  every visit together, at the top ("4 visits between Oct 7 and Oct 14 ... sent the form on the 4th")
//   sessionStory  one visit, under its visit chart
//   pageStory     one page of that visit, when its frame is clicked
// Pure and computed in the browser from data already loaded: no AI, no extra query. Every number comes from
// framePlate's own buildTimeline, so the words can never disagree with what the chart draws.
import { buildTimeline } from "../../framePlate/geometry/buildTimeline";
import type { SessionRaw, TimelineItem, VisitGeometry } from "../../framePlate/types";

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

/** One page of a visit. `nextPath`: the page they went to next, if any. */
export function pageStory(v: VisitGeometry, nextPath?: string | null): string {
  const parts: string[] = [];
  parts.push("Spent " + shortDuration(v.durationMs) + " on " + (v.pagePath || "this page") + " and " + whereRead(v) + (v.seenTwiceTop !== null ? ", going back over part of it" : "") + ".");
  const headers = [...(v.headers ?? [])].sort((a, b) => a.y - b.y);
  if (headers.length) {
    const seen = headers.filter((h) => h.y >= v.seenOnceTop && h.y <= v.seenBottom);
    if (seen.length === headers.length) parts.push("Reached every heading.");
    else if (!seen.length) parts.push("Did not reach any heading.");
    else parts.push("Reached " + seen.length + " of " + headers.length + " headings.");
  }
  if (v.outcome === "converted") parts.push("Sent the form here.");
  else if (v.outcome === "live") parts.push("Still on this page.");
  else if (nextPath) parts.push("Then went to " + nextPath + ".");
  else parts.push("Left the site from here.");
  return parts.join(" ");
}

/** One visit (session). `n` is its number among the lead's visits (1 = first). */
export function sessionStory(session: SessionRaw, n: number, fallbackViewportHeightPx = 0): string {
  const { visits, awayMs, awayCount } = visitsOf(session, fallbackViewportHeightPx);
  if (!visits.length) return "Opened the site but no page was recorded.";
  const total = visits.reduce((s, v) => s + v.durationMs, 0);
  const distinct = new Set(visits.map((v) => v.pagePath)).size;
  const parts: string[] = [];
  parts.push(
    (n === 1 ? "Their first visit" : "Their " + ordinal(n) + " visit") + ", on " + day(session.startedAt) + ": " + shortDuration(total) + " on " +
      (visits.length === 1 ? "one page" : visits.length + " pages" + (distinct < visits.length ? " (" + distinct + " different)" : "")) + ".",
  );
  if (visits.length > 1) {
    parts.push("Started on " + visits[0].pagePath + ".");
    const longest = [...visits].sort((a, b) => b.durationMs - a.durationMs)[0];
    parts.push("Spent the longest on " + longest.pagePath + " (" + shortDuration(longest.durationMs) + "; " + whereRead(longest) + ").");
    const counts = new Map<string, number>();
    for (const v of visits) counts.set(v.pagePath, (counts.get(v.pagePath) ?? 0) + 1);
    const repeated = [...counts].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
    if (repeated.length) parts.push("Opened " + repeated.slice(0, 2).map(([p, c]) => p + " " + times(c)).join(" and ") + ".");
  } else {
    parts.push("Only " + visits[0].pagePath + ", and " + whereRead(visits[0]) + ".");
  }
  if (awayCount > 0) parts.push("Left the site and came back " + times(awayCount) + " (" + shortDuration(awayMs) + " away" + (awayCount > 1 ? " in total" : "") + ").");
  const last = visits[visits.length - 1];
  const sentOn = visits.find((v) => v.outcome === "converted");
  if (sentOn) parts.push("Sent the form on " + sentOn.pagePath + ".");
  else if (session.endedAt === null) parts.push("Still on the site, now on " + last.pagePath + ".");
  else if (visits.length > 1) parts.push("Left from " + last.pagePath + ".");
  return parts.join(" ");
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
