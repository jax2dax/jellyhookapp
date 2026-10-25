// app/dev/lead-sessions-demo/page.tsx
// DEMO with FAKE data: a lead's Session History (components/leads/LeadSessionExplorer.tsx) with the plain-words
// stories. 12 visits over a week; the 10th sends the form. Page structure and form rows are not loaded here (those
// fetches need a signed-in site and fail quietly).
import { Suspense } from "react";
import { LeadSessionExplorer, type PageStructureRow, type PageViewRow, type SessionRow, type SubmissionRow } from "@/components/leads/LeadSessionExplorer";
import { keyOfText } from "@/lib/tracking/headingTime";
import { InfoTip } from "@/components/forms/InfoTip";

const T0 = Date.parse("2026-10-07T09:00:00Z");
const PLAN: [number, [string, number, number][]][] = [
  [0, [["/", 0, 0.3]]],
  [0.1, [["/", 20, 0.9], ["/pricing", 95, 1], ["/about", 30, 0.5], ["/case-studies", 60, 0.8], ["/pricing", 25, 0.6], ["/blog/forms", 10, 0.2], ["/contact", 5, 0.1], ["/", 5, 0.1]]],
  [5, [["/", 10, 0.4], ["/pricing", 30, 0.7]]],
  [5.1, [["/case-studies", 80, 0.9], ["/pricing", 50, 1], ["/demo", 28, 0.6]]],
  [5.2, [["/", 30, 0.5], ["/pricing", 300, 1], ["/case-studies", 240, 1], ["/demo", 120, 0.9], ["/about", 60, 0.6], ["/pricing", 200, 1], ["/blog/forms", 110, 0.8]]],
  [5.3, [["/", 15, 0.4], ["/blog/forms", 400, 1], ["/pricing", 500, 1], ["/case-studies", 300, 1], ["/demo", 200, 0.9]]],
  [7, [["/", 20, 0.5], ["/pricing", 420, 1], ["/case-studies", 200, 0.9], ["/contact", 60, 0.7]]],
  [7.1, [["/pricing", 30, 0.6], ["/demo", 21, 0.5]]],
  [7.2, [["/", 5, 0.2]]],
  [7.3, [["/pricing", 40, 0.9], ["/contact", 95, 1]]],
];

// the headings of each page (h1 = a section, h2 = inside it) and a made-up share of the page's time for each
const HEADINGS: Record<string, [string, "h1" | "h2", number][]> = {
  "/": [["Hi, we build websites that bring leads", "h1", 0.35], ["What we do", "h2", 0.15], ["Our work", "h1", 0.3], ["Results", "h2", 0.2]],
  "/pricing": [["Pricing", "h1", 0.1], ["Starter", "h2", 0.15], ["Business", "h2", 0.35], ["Questions people ask", "h1", 0.25], ["Can I cancel?", "h2", 0.15]],
  "/case-studies": [["Case studies", "h1", 0.3], ["A dentist in Austin", "h2", 0.45], ["A law firm", "h2", 0.25]],
  "/contact": [["Contact us", "h1", 0.6], ["Where we are", "h2", 0.4]],
};
const structure: PageStructureRow[] = Object.entries(HEADINGS).flatMap(([path, hs]) => hs.map(([text, tag], i) => ({ page_path: path, header_index: i, header_text: text, header_tag: tag, position_y: 300 + i * 600, page_height: 3200 })));
const headingTime = (path: string, secs: number) => {
  const hs = HEADINGS[path];
  if (!hs) return null;
  return { t: 1, h: hs.map(([text, tag, share], i) => [keyOfText(text), tag === "h1" ? 1 : 2, i, Math.round(secs * share * 10), i === 0 ? 1 : 1 + (i % 2)]) };
};

const sessions: SessionRow[] = [];
const pageViews: PageViewRow[] = [];
const submissions: SubmissionRow[] = [];
PLAN.forEach(([dayOffset, pages], i) => {
  const sid = "s" + i;
  let t = T0 + dayOffset * 86_400_000;
  const start = t;
  pages.forEach(([path, secs, depth], k) => {
    const left = t + secs * 1000;
    pageViews.push({ id: sid + "p" + k, page_view_id: sid + "p" + k, session_id: sid, visitor_id: "v1", page_path: path, entered_at: new Date(t).toISOString(), left_at: new Date(left).toISOString(), page_height: 3200, entry_scroll_depth: 0, max_scroll_depth: depth, revisit_start_scroll_depth: k % 3 === 1 ? 0.2 : null, scroll_depth: depth * 0.8, heading_time: headingTime(path, secs) });
    t = left + 1500;
  });
  sessions.push({ id: sid, session_id: sid, visitor_id: "v1", started_at: new Date(start).toISOString(), ended_at: new Date(t).toISOString() });
  if (i === PLAN.length - 1) submissions.push({ id: "lead1", session_id: sid, page_path: "/contact", submitted_at: new Date(t - 3000).toISOString() });
});

export default function LeadSessionsDemoPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="text-xs font-medium uppercase tracking-wide text-amber-600">Demo, fake data</div>
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          Session history <InfoTip>Every visit made from this browser. Pick a visit on the left; click a page in the chart.</InfoTip>
        </h2>
        <Suspense>
          <LeadSessionExplorer siteId="demo" visitorId="v1" deviceType="desktop" initialSessionRows={sessions} initialPageViewRows={pageViews} initialSubmissionRows={submissions} initialStructureRows={structure} initialFormEngagementRows={[]} readOnly />
        </Suspense>
      </div>
    </div>
  );
}
