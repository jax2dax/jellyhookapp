// app/dev/section-plate-demo/page.tsx
// DEMO with FAKE data: the "By section" heat map of the visit chart on pages with awkward heading layouts, so each case
// can be checked by eye. One visit, one page per case (page height 3200 px; 1 screen = 800 px = a quarter of the page).
//   /normal      main headings well apart, with smaller headings inside
//   /close-h1s   main headings closer than one screen (and some closer than 120 px): small bands
//   /no-h1       no h1 at all: the h2s are the main sections, the h3s are inside them
//   /two-columns two h1 on the same row (side by side), then one below
//   /late-h1     nothing but text for the first two screens, then the first h1: a big "Top of page" band
// Time per heading is made up. Open the chart, press "By section", try the Sub-headings box.
import { Suspense } from "react";
import { LeadSessionExplorer, type PageStructureRow, type PageViewRow, type SessionRow, type SubmissionRow } from "@/components/leads/LeadSessionExplorer";
import { InfoTip } from "@/components/forms/InfoTip";
import { keyOfText } from "@/lib/tracking/headingTime";

type Case = {
  path: string;
  /** [heading text, tag, y in px] */
  rows: [string, "h1" | "h2" | "h3", number][];
  /** seconds on each heading by text; the others get none */
  secs: Record<string, number>;
  above?: number;
};
const CASES: Case[] = [
  {
    path: "/normal",
    rows: [["Hero", "h1", 300], ["Why us", "h2", 700], ["How it works", "h2", 1100], ["Pricing", "h1", 1500], ["Plans", "h2", 1900], ["Questions", "h1", 2500]],
    secs: { Hero: 4, "Why us": 12, "How it works": 6, Pricing: 8, Plans: 30, Questions: 3 },
    above: 2,
  },
  {
    path: "/close-h1s",
    rows: [["Intro", "h1", 300], ["Features", "h1", 420], ["Security", "h1", 560], ["Integrations", "h1", 900], ["Pricing", "h1", 1500], ["Contact", "h1", 2400]],
    secs: { Intro: 2, Features: 5, Security: 14, Integrations: 9, Pricing: 25, Contact: 6 },
    above: 1,
  },
  {
    path: "/no-h1",
    rows: [["What we do", "h2", 400], ["Web design", "h3", 800], ["Branding", "h3", 1200], ["Our process", "h2", 1700], ["Get in touch", "h2", 2500]],
    secs: { "What we do": 5, "Web design": 20, Branding: 8, "Our process": 15, "Get in touch": 10 },
    above: 3,
  },
  {
    path: "/two-columns",
    rows: [["For agencies", "h1", 700], ["For shops", "h1", 710], ["Pricing", "h1", 1900]],
    secs: { "For agencies": 18, "For shops": 18, Pricing: 12 },
    above: 4,
  },
  {
    path: "/late-h1",
    rows: [["Our story", "h1", 1700], ["The team", "h2", 2100], ["Join us", "h1", 2700]],
    secs: { "Our story": 10, "The team": 14, "Join us": 5 },
    above: 22,
  },
];

const PAGE_HEIGHT = 3200;
const T0 = Date.parse("2026-10-19T09:00:00Z");
const structure: PageStructureRow[] = CASES.flatMap((c) => c.rows.map(([text, tag, y], i) => ({ page_path: c.path, header_index: i, header_text: text, header_tag: tag, position_y: y, page_height: PAGE_HEIGHT })));
const headingTime = (c: Case) => {
  const top = Math.min(...c.rows.map((r) => Number(r[1].slice(1))));
  const sorted = [...c.rows].sort((a, b) => a[2] - b[2]);
  const h: unknown[] = [];
  if (c.above) h.push(["^", 0, -1, c.above * 10, 1]);
  sorted.forEach(([text, tag], order) => {
    const s = c.secs[text];
    if (s) h.push([keyOfText(text), Number(tag.slice(1)), order, s * 10, 1]);
  });
  return { t: top, h };
};

const sessions: SessionRow[] = [{ id: "s1", session_id: "s1", visitor_id: "v1", started_at: new Date(T0).toISOString(), ended_at: new Date(T0 + 600_000).toISOString() }];
const pageViews: PageViewRow[] = [];
let t = T0;
CASES.forEach((c, i) => {
  const secs = (c.above ?? 0) + Object.values(c.secs).reduce((a, b) => a + b, 0);
  const left = t + secs * 1000;
  pageViews.push({ id: "p" + i, page_view_id: "p" + i, session_id: "s1", visitor_id: "v1", page_path: c.path, entered_at: new Date(t).toISOString(), left_at: new Date(left).toISOString(), page_height: PAGE_HEIGHT, entry_scroll_depth: 0, max_scroll_depth: 1, revisit_start_scroll_depth: null, scroll_depth: 0.9, heading_time: headingTime(c) });
  t = left + 1500;
});
const submissions: SubmissionRow[] = [];

export default function SectionPlateDemoPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="text-xs font-medium uppercase tracking-wide text-amber-600">Demo, fake data</div>
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          Section heat map, five heading layouts <InfoTip>One visit, one page per case: /normal, /close-h1s (main headings under one screen apart), /no-h1, /two-columns, /late-h1. Press By section; tick or untick Sub-headings.</InfoTip>
        </h2>
        <Suspense>
          <LeadSessionExplorer siteId="demo" visitorId="v1" deviceType="desktop" initialSessionRows={sessions} initialPageViewRows={pageViews} initialSubmissionRows={submissions} initialStructureRows={structure} />
        </Suspense>
      </div>
    </div>
  );
}
