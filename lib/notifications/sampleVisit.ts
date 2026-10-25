// lib/notifications/sampleVisit.ts
// An example visit for the hook editor's Slack preview (components/notifications/Rules.tsx), put in words by the same
// functions as real hook messages (lib/leadSessions/story.ts), so the preview shows exactly how each version reads.
// "Send a test to Slack" uses the site's newest real lead instead (lib/actions/notifications.action.ts).
import { pageSummary, sessionStoryVersion } from "@/lib/leadSessions/story";
import type { PageVisitRaw, SectionTime, SessionRaw } from "@/framePlate/types";
import type { PageScope, PageSummaryLine, SummaryVersion } from "./message";

const T0 = Date.parse("2026-10-25T10:00:00Z");
const at = (s: number) => new Date(T0 + s * 1000).toISOString();
const sec = (text: string, s: number): SectionTime => ({ text, ms: s * 1000, entries: 1, isTop: false, subs: [] });
const view = (id: string, path: string, from: number, to: number, sections: SectionTime[], converted = false): PageVisitRaw => ({
  id,
  pagePath: path,
  enteredAt: at(from),
  leftAt: at(to),
  pageHeightPx: 3000,
  viewportHeightPx: 900,
  scrollTrace: [{ t: 0, y: 0 }, { t: (to - from) * 1000, y: 0.6 }],
  converted,
  headers: [{ text: "Plans", y: 0.1 }, { text: "Business", y: 0.45 }, { text: "Questions", y: 0.85 }],
  sections,
});

/** An earlier visit (for "every visit" page summaries) and the visit with the form. */
const EARLIER: SessionRaw = { id: "sample-3", visitorId: "sample", startedAt: at(-86_400), endedAt: at(-86_300), visits: [view("e1", "/pricing", -86_400, -86_330, [sec("Plans", 40), sec("Business", 20)])] };
const FORM_VISIT: SessionRaw = {
  id: "sample-4",
  visitorId: "sample",
  startedAt: at(0),
  endedAt: at(1000),
  visits: [
    view("v1", "/", 0, 20, [sec("Plans", 6)]),
    view("v2", "/pricing", 21, 85, [sec("Business", 55), sec("Questions", 3)]),
    view("v3", "/", 985, 993, [sec("Plans", 4)], true),
  ],
};

export function sampleSummary(version: SummaryVersion): { version: SummaryVersion; lines: string[] } {
  return { version, lines: sessionStoryVersion(FORM_VISIT, 4, version).map((s) => s.text) };
}

/** The example visit's summary of each page; a page the example never opened reads "Page not visited". */
export function samplePages(paths: string[], scope: PageScope): PageSummaryLine[] {
  const visits = scope === "converting" ? [FORM_VISIT] : [EARLIER, FORM_VISIT];
  return paths.map((path) => ({ path, scope, text: pageSummary(path, visits) }));
}
