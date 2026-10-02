// components/leads/ConvertedLeadCard.tsx
// One card per converted lead on /platform/conversions — identity, a
// truncated "start of session → conversion" FramePlate chart (anything the
// visitor did AFTER converting is deliberately cut, even if the real
// session kept going — see lib/leadSessions/transform.js's
// truncateSessionToSubmission), and a link to the full, untruncated
// session on /platform/leads/[lead_id]. Self-contained: clicking a frame
// in THIS card's chart shows SelectedFrameDetails right here, independent
// of every other card on the page.
//
// Collapsed by default — only the identity row shows until clicked. The
// expand/collapse itself animates via the .jh-collapsible CSS classes
// (app/globals.css) — content stays mounted either way, so there's no
// chart remount/flash, just its grid row growing from 0fr to 1fr.
//
// Uses the compactFrameHeight variety (framePlate/theme/variants.ts): these
// charts are reliably short, single-page paths-to-conversion, where the
// ordinary fixed frame height would otherwise leave a large empty gap
// below every plate.
"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronDown, ChevronRight, Globe, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FramePlateChart, compactFrameHeight, type SessionRaw, type TimelineItem } from "@/framePlate";
import { formatDate } from "@/lib/leadFormat";
import { SelectedFrameDetails } from "./SelectedFrameDetails";

export interface ConvertedSubmission {
  id: string;
  session_id: string | null;
  name: string | null;
  email: string | null;
  page_path: string | null;
  submitted_at: string | null;
}

// Same yellow FramePlate itself uses for "converted" everywhere else
// (framePlate/theme/defaultTheme.ts's bulbs.converted.color) — a
// deliberate, meaningful color choice tying this card's identity line
// back to the chart's own converted-outcome color, not an arbitrary pick.
const CONVERTED_YELLOW = "#eab308";

export function ConvertedLeadCard({
  submission,
  session,
  deviceType,
}: {
  submission: ConvertedSubmission;
  session: SessionRaw | null;
  deviceType?: string | null;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [selectedFrame, setSelectedFrame] = React.useState<{ item: TimelineItem; isLastVisit: boolean } | null>(null);

  return (
    <Card className="gap-0 py-0">
      <CardContent className={expanded ? "px-4 py-2 pb-3" : "px-4 py-1.5"}>
        <div
          className="flex flex-nowrap items-center justify-between gap-3 cursor-pointer"
          onClick={() => setExpanded((e) => !e)}
          role="button"
          aria-expanded={expanded}
        >
          <div className="flex min-w-0 items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: CONVERTED_YELLOW }} />
            <div className="flex min-w-0 items-center gap-x-3 whitespace-nowrap">
              <span className="shrink-0 font-semibold" style={{ color: CONVERTED_YELLOW }}>
                {submission.name || submission.email || "Unknown"}
              </span>
              <div className="flex min-w-0 items-center gap-x-3 overflow-hidden text-xs text-muted-foreground">
                {submission.name && submission.email && <span className="truncate">{submission.email}</span>}
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {submission.page_path || "—"}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(submission.submitted_at)}
                </span>
              </div>
            </div>
          </div>
          {/* stopPropagation — this link navigates, it must never also toggle the expand/collapse */}
          <Button asChild variant="outline" size="sm" className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <Link href={`/platform/leads/${submission.id}`}>
              View full information
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className={`jh-collapsible ${expanded ? "jh-collapsible-open" : ""}`}>
          <div>
            {session ? (
              // Same min-w-0/overflow-hidden backstop LeadSessionExplorer uses —
              // without it, a long path-to-conversion drags the whole page into
              // horizontal scroll instead of clipping/scrolling right here.
              <div className="mt-3 w-full min-w-0 overflow-hidden rounded-md border bg-card/50 p-3">
                <FramePlateChart
                  session={session}
                  theme={compactFrameHeight}
                  deviceType={deviceType}
                  onSelectItem={(item, meta) => setSelectedFrame(item ? { item, isLastVisit: meta.isLastVisit } : null)}
                  className="w-full min-w-0"
                />
              </div>
            ) : (
              <div className="mt-3 py-4 text-center text-sm text-muted-foreground">No session data recorded for this conversion.</div>
            )}

            {selectedFrame && (
              <div className="mt-3">
                <SelectedFrameDetails item={selectedFrame.item} isLastVisit={selectedFrame.isLastVisit} onClose={() => setSelectedFrame(null)} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
