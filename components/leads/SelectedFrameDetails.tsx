// components/leads/SelectedFrameDetails.tsx
//
// Shown when the user CLICKS a frame in the chart (separate from the
// existing hover tooltip, which stays as a quick glance-over). This panel
// pins the info open until another frame is clicked or this one is clicked
// again, and translates everything that one plate is drawing visually
// (seen/seen-twice/not-seen bands, header zigzag marks, outcome color) into
// text and numbers for that ONE page visit — never a session-wide rollup,
// that's SessionSummaryDrawer's job.
"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/leadFormat";
import { computeSeenBreakdown, type TimelineItem, type VisitGeometry } from "@/framePlate";

export interface SelectedFrameDetailsProps {
  item: TimelineItem;
  /** the page this visit's timeline actually ends on (session ended here, not converted, not live) — see SessionStrip's onSelectItem */
  isLastVisit: boolean;
  onClose: () => void;
}

function pct(v: number): string {
  return `${(Math.max(0, v) * 100).toFixed(0)}%`;
}

type Status = "converted" | "live" | "ended" | "visited";

function resolveStatus(visit: VisitGeometry, isLastVisit: boolean): Status {
  if (visit.outcome === "converted") return "converted";
  if (visit.outcome === "live") return "live";
  if (isLastVisit) return "ended"; // this is the page the session's timeline actually ends on
  return "visited"; // a normal page the visitor navigated away from mid-session
}

const STATUS_STYLE: Record<Status, { label: string; border: string; badgeClass: string }> = {
  converted: { label: "Converted", border: "border-amber-500/60", badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  live: { label: "Live", border: "border-blue-500/60", badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  ended: { label: "Session ended here", border: "border-destructive/60", badgeClass: "bg-destructive/15 text-destructive" },
  visited: { label: "Visited", border: "border-border", badgeClass: "" },
};

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}

export function SelectedFrameDetails({ item, isLastVisit, onClose }: SelectedFrameDetailsProps) {
  if (item.kind !== "visit") return null; // "away" gap frames aren't selectable — SessionStrip never calls onSelectItem for them
  const visit = item;

  const status = resolveStatus(visit, isLastVisit);
  const style = STATUS_STYLE[status];
  const { seenOncePct, seenTwicePct, notSeenPct } = computeSeenBreakdown(visit);

  // Headers ordered top-to-bottom exactly as they sit on the real page
  // (y is already a 0-1 fraction of page height — see PageVisitRaw.headers),
  // not in whatever order the tracker happened to record them.
  const headers = [...(visit.headers || [])].sort((a, b) => a.y - b.y);

  return (
    <div className={`rounded-md border-2 bg-card/50 p-4 ${style.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{visit.pagePath || "(unknown)"}</span>
            <Badge className={style.badgeClass} variant={style.badgeClass ? undefined : "outline"}>
              {style.label}
            </Badge>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">Selected page details</div>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close selected page details">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Fact label="Time on page" value={<span className="font-medium">{formatDuration(visit.durationMs)}</span>} />
          <Fact label="Page height" value={<span className="font-medium">{Math.round(visit.pageHeightPx)}px</span>} />
          <Fact label="Seen once" value={<Badge variant="outline">{pct(seenOncePct)}</Badge>} />
          <Fact label="Seen 2x+" value={<Badge variant="outline">{pct(seenTwicePct)}</Badge>} />
          <Fact label="Not seen" value={<Badge variant="outline">{pct(notSeenPct)}</Badge>} />
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Headers on this page</div>
          {headers.length === 0 ? (
            <div className="text-sm text-muted-foreground">No headers recorded for this page.</div>
          ) : (
            <ol className="space-y-1">
              {headers.map((h, i) => {
                const seen = h.y >= visit.seenOnceTop && h.y <= visit.seenBottom;
                return (
                  <li key={`${h.text}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className={seen ? "" : "text-muted-foreground"}>{h.text}</span>
                    <Badge variant={seen ? "default" : "outline"} className={seen ? "" : "text-muted-foreground"}>
                      {seen ? "Seen" : "Not seen"}
                    </Badge>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
