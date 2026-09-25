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

export interface SessionSummaryDrawerProps {
  session: SessionRaw;
  /** same fallback FramePlateChart resolves from deviceType — keeps "headers seen" in agreement with what the chart above is currently drawing */
  fallbackViewportHeightPx?: number;
  defaultOpen?: boolean;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}

export function SessionSummaryDrawer({ session, fallbackViewportHeightPx = 0, defaultOpen = true }: SessionSummaryDrawerProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  const summary = React.useMemo(() => buildSessionSummary(session, fallbackViewportHeightPx), [session, fallbackViewportHeightPx]);

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
            <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Fact label="Total visit time" value={<Badge variant="outline">{formatDuration(summary.totalVisitTimeMs)}</Badge>} />
                <Fact label="Total session duration" value={<Badge variant="outline">{summary.totalSessionDurationMs != null ? formatDuration(summary.totalSessionDurationMs) : "—"}</Badge>} />
                {summary.timeOutsideMs > 0 && <Fact label="Time spent outside site" value={<Badge variant="outline">{formatDuration(summary.timeOutsideMs)}</Badge>} />}
              </div>

              <div className="space-y-3">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
