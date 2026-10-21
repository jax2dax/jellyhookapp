// components/leads/SessionSummaryDrawer.tsx
//
// Collapsible panel under the FramePlate chart, showing facts about
// whichever ONE session is currently selected — never a comparison against
// other sessions, and never a per-page breakdown (that's a later feature).
// Collapses by shrinking straight up from the bottom, so it reads as
// retracting into the chart above it rather than sliding off elsewhere.
"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDuration, formatTime } from "@/lib/leadFormat";
import { buildSessionSummary } from "@/lib/leadSessions/sessionSummary";
import type { SessionRaw } from "@/framePlate";
import { HeadingRow } from "./SelectedFrameDetails";

type HeadingTotal = { text: string | null; isTop: boolean; ms: number; subs: { text: string | null; ms: number }[] };

/**
 * Time per heading for the whole visit: each page's sections added up across every time that page was opened in this
 * session, pages in the order they were first opened, headings in page order. Pages with no section times are left out.
 */
function headingTotals(session: SessionRaw): { page: string; sections: HeadingTotal[] }[] {
  const pages = new Map<string, Map<string, HeadingTotal>>();
  for (const v of session.visits ?? []) {
    if (!v.sections?.length) continue;
    const byText = pages.get(v.pagePath) ?? new Map<string, HeadingTotal>();
    pages.set(v.pagePath, byText);
    for (const s of v.sections) {
      const k = s.isTop ? "^" : "h:" + s.text;
      const e = byText.get(k) ?? { text: s.text, isTop: s.isTop, ms: 0, subs: [] };
      e.ms += s.ms;
      for (const x of s.subs) {
        const sub = e.subs.find((y) => y.text === x.text);
        if (sub) sub.ms += x.ms;
        else e.subs.push({ text: x.text, ms: x.ms });
      }
      byText.set(k, e);
    }
  }
  // the part above the first heading is not a heading: left out of the list
  return [...pages].map(([page, m]) => ({ page, sections: [...m.values()].filter((s) => !s.isTop) })).filter((pg) => pg.sections.length > 0);
}

export interface SessionSummaryDrawerProps {
  session: SessionRaw;
  /** same fallback FramePlateChart resolves from deviceType — keeps "headers seen" in agreement with what the chart above is currently drawing */
  fallbackViewportHeightPx?: number;
  defaultOpen?: boolean;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="whitespace-nowrap text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}

export function SessionSummaryDrawer({ session, fallbackViewportHeightPx = 0, defaultOpen = true }: SessionSummaryDrawerProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  const summary = React.useMemo(() => buildSessionSummary(session, fallbackViewportHeightPx), [session, fallbackViewportHeightPx]);
  const headings = React.useMemo(() => headingTotals(session), [session]);

  return (
    <div className="rounded-md border bg-card/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        Session details
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>

      {/* grid-rows trick: animating a real height (not max-height) so the
          collapse doesn't need a hardcoded end value, and the content
          shrinks straight up out of view rather than jump-cutting. */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          {!summary ? (
            <div className="px-4 pb-4 text-sm text-muted-foreground">Couldn&apos;t summarize this session — see console for details.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-[16.5rem_1px_minmax(0,1fr)]">
              <div className="space-y-3">
                <Fact label="Total visit time" value={<Badge variant="outline">{formatDuration(summary.totalVisitTimeMs)}</Badge>} />
                <Fact label="Total session duration" value={<Badge variant="outline">{summary.totalSessionDurationMs != null ? formatDuration(summary.totalSessionDurationMs) : "—"}</Badge>} />
                {summary.timeOutsideMs > 0 && <Fact label="Time spent outside site" value={<Badge variant="outline">{formatDuration(summary.timeOutsideMs)}</Badge>} />}
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity</div>
                  <div className="text-sm">
                    {formatDate(summary.startedAt)}
                    <span className="ml-2 text-foreground">
                      {formatTime(summary.startedAt)} – {summary.isLive ? "now" : formatTime(summary.endedAt)}
                    </span>
                    {summary.isLive && (
                      <Badge className="ml-2" variant="outline">
                        Live
                      </Badge>
                    )}
                  </div>
                </div>
                <Fact label="# of pages visited" value={<span className="font-medium text-foreground">{summary.pagesVisited}</span>} />
              </div>

              {/* a thin line between the two halves, so a fact and a heading never read as one row */}
              <div className="hidden bg-border sm:block" aria-hidden />

              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Headings in this visit</span>
                  {headings.length > 0 && <span className="normal-case tracking-normal">time on screen, all views added up</span>}
                </div>
                {headings.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No time per heading was recorded for this visit.</div>
                ) : (
                  // a long list scrolls inside the card (no scroll bar), so the card never grows past this height
                  <div className="max-h-72 space-y-3 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {headings.map((pg) => (
                      <div key={pg.page}>
                        <code className="rounded bg-primary/15 px-1 py-px font-mono text-xs text-foreground">{pg.page}</code>
                        <ol className="mt-0.5 space-y-1">
                          {pg.sections.map((s, i) => (
                            <React.Fragment key={i}>
                              <HeadingRow name={s.isTop ? "Top of page" : (s.text ?? "a heading no longer on the page")} ms={s.ms} pageMs={summary.totalVisitTimeMs} main muted={s.isTop} />
                              {s.subs.map((x, j) => (
                                <HeadingRow key={j} name={x.text ?? "a heading no longer on the page"} ms={x.ms} pageMs={summary.totalVisitTimeMs} main={false} />
                              ))}
                            </React.Fragment>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
