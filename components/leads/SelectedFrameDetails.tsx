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
import { computeSeenBreakdown, sectionDuration, type TimelineItem, type VisitGeometry } from "@/framePlate";
import { pageStorySentences } from "@/lib/leadSessions/story";
import { StorySentences, StoryFormatToggle, useStoryLines } from "./StoryText";
import { Collapse } from "./Collapse";

export interface SelectedFrameDetailsProps {
  item: TimelineItem;
  /** the page this visit's timeline actually ends on (session ended here, not converted, not live) — see SessionStrip's onSelectItem */
  isLastVisit: boolean;
  /** the page they opened next, for the story ("Then went to /contact") */
  nextPath?: string | null;
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
      <span className="whitespace-nowrap text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}

/** A thin bar filled to `share` (0-1) of its width: the part of the page's time a heading got. */
function TimeBar({ share, main }: { share: number; main: boolean }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className={"block h-full rounded-full " + (main ? "bg-emerald-600" : "bg-emerald-400/70")} style={{ width: Math.round(Math.min(1, Math.max(0, share)) * 100) + "%" }} />
    </span>
  );
}

/** One heading in the details list: name (main headings blue, smaller ones indented), its time bar, its time. */
export function HeadingRow({ name, ms, pageMs, main, muted }: { name: string; ms: number; pageMs: number; main: boolean; muted?: boolean }) {
  const share = pageMs > 0 ? ms / pageMs : 0;
  return (
    <li className={"grid grid-cols-[minmax(0,1fr)_4.5rem_3.25rem] items-center gap-2 " + (main ? "pt-1.5 text-sm" : "pl-4 text-xs")} title={ms > 0 ? sectionDuration(ms) + ", " + Math.round(share * 100) + "% of the time on this page" : "Never on screen long enough to count"}>
      <span className={"truncate " + (muted ? "italic text-muted-foreground" : main ? "font-medium text-blue-600 dark:text-blue-400" : "text-foreground/85")}>{name}</span>
      <TimeBar share={share} main={main} />
      <span className={"text-right tabular-nums " + (ms > 0 ? (main ? "font-medium text-blue-600 dark:text-blue-400" : "text-foreground/85") : "text-muted-foreground")}>{ms > 0 ? sectionDuration(ms) : "-"}</span>
    </li>
  );
}

export function SelectedFrameDetails({ item, isLastVisit, nextPath, onClose }: SelectedFrameDetailsProps) {
  const [details, setDetails] = React.useState(false);
  const [lines, setLines] = useStoryLines();
  if (item.kind !== "visit") return null; // "away" gap frames aren't selectable — SessionStrip never calls onSelectItem for them
  const visit = item;

  const status = resolveStatus(visit, isLastVisit);
  const style = STATUS_STYLE[status];
  const { seenOncePct, seenTwicePct, notSeenPct } = computeSeenBreakdown(visit);

  // Headers ordered top-to-bottom exactly as they sit on the real page
  // (y is already a 0-1 fraction of page height — see PageVisitRaw.headers),
  // not in whatever order the tracker happened to record them.
  const headers = [...(visit.headers || [])].sort((a, b) => a.y - b.y);
  // time per section (in page order), when it was recorded
  const sections = visit.sections ?? [];
  const screens = visit.viewportFraction > 0 && visit.viewportFraction < 1 ? 1 / visit.viewportFraction : null;

  return (
    <div className={`rounded-md border-2 bg-card/50 p-3.5 ${style.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Page summary</span>
            {/* only the outcomes worth a badge: the plain "Visited" is not shown */}
            {status !== "visited" && (
              <Badge className={style.badgeClass} variant={style.badgeClass ? undefined : "outline"}>
                {style.label}
              </Badge>
            )}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close selected page details">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex items-start gap-3">
        <StorySentences sentences={pageStorySentences(visit, isLastVisit ? null : nextPath)} lines={lines} className="min-w-0 flex-1 text-sm leading-[1.9] text-foreground" />
        <StoryFormatToggle lines={lines} onChange={setLines} />
        <button type="button" onClick={() => setDetails((d) => !d)} className="shrink-0 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-expanded={details}>
          {details ? "Hide details" : "Page details"}
        </button>
      </div>

      <Collapse open={details}>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[16.5rem_1px_minmax(0,1fr)]">
          <div className="space-y-2">
            <Fact label="Time on page" value={<span className="font-medium">{formatDuration(visit.durationMs)}</span>} />
            <Fact
              label="Page height"
              value={
                <span className="whitespace-nowrap text-right font-medium">
                  {Math.round(visit.pageHeightPx)}px
                  {screens !== null && <span className="ml-1 text-xs font-normal text-muted-foreground">({screens >= 10 ? Math.round(screens) : Math.round(screens * 10) / 10}x window height)</span>}
                </span>
              }
            />
            <Fact label="Seen once" value={<Badge variant="outline">{pct(seenOncePct)}</Badge>} />
            <Fact label="Seen 2x+" value={<Badge variant="outline">{pct(seenTwicePct)}</Badge>} />
            <Fact label="Not seen" value={<Badge variant="outline">{pct(notSeenPct)}</Badge>} />
          </div>

          {/* a thin line between the two halves, so a fact and a heading never read as one row */}
          <div className="hidden bg-border sm:block" aria-hidden />

          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Headings on this page</span>
              {sections.length > 0 && <span className="normal-case tracking-normal">time on screen</span>}
            </div>
            {sections.length > 0 ? (
              <ol className="space-y-1">
                {/* every part of the page time once: a section's row is its OWN time (its sub-headings have their rows),
                    plus the top of the page, passing through and headings not found, so the column adds up to the page time */}
                {sections.map((s, i) => {
                  const subsMs = s.subs.reduce((n, x) => n + x.ms, 0);
                  if (s.isTop && s.ms <= 0) return null;
                  return (
                    <React.Fragment key={i}>
                      <HeadingRow name={s.isTop ? "Above the first heading" : (s.text ?? "a heading no longer on the page")} ms={Math.max(0, s.ms - subsMs)} pageMs={visit.durationMs} main muted={s.isTop} />
                      {s.subs.map((x, j) => (
                        <HeadingRow key={j} name={x.text ?? "a heading no longer on the page"} ms={x.ms} pageMs={visit.durationMs} main={false} />
                      ))}
                    </React.Fragment>
                  );
                })}
                {(visit.sectionExtras?.passingMs ?? 0) > 0 && <HeadingRow name="Passing through (stays under 1s)" ms={visit.sectionExtras!.passingMs} pageMs={visit.durationMs} main muted />}
                {(visit.sectionExtras?.unplacedMs ?? 0) > 0 && <HeadingRow name="Headings not found on the page now" ms={visit.sectionExtras!.unplacedMs} pageMs={visit.durationMs} main muted />}
              </ol>
            ) : headers.length === 0 ? (
              <div className="text-sm text-muted-foreground">No headers recorded for this page.</div>
            ) : (
              <ol className="space-y-1">
                <li className="pb-1 text-xs text-muted-foreground">No time per heading was recorded for this page view. Seen is from scrolling only.</li>
                {headers.map((h, i) => {
                  const seen = h.y >= visit.seenOnceTop && h.y <= visit.seenBottom;
                  return (
                    <li key={`${h.text}-${i}`} className="flex items-center gap-2 text-sm">
                      <span className={"min-w-0 flex-1 truncate " + (seen ? "" : "text-muted-foreground")}>{h.text}</span>
                      <span className={"shrink-0 text-xs " + (seen ? "text-foreground" : "text-muted-foreground")}>{seen ? "Seen" : "Not seen"}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </Collapse>
    </div>
  );
}
