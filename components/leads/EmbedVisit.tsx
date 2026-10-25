"use client";
// components/leads/EmbedVisit.tsx
// The lead page's visit chart (LeadSessionExplorer) read-only, for the chart opened from HubSpot (app/embed/visit):
// every row is given by the server, nothing is fetched, nothing refreshes. Opens on the visit in the address
// (?session=, set by the card to the visit with the form).
import * as React from "react";
import { ExternalLink } from "lucide-react";
import { LeadSessionExplorer, type FormEngagementRow, type PageStructureRow, type PageViewRow, type SessionRow, type SubmissionRow } from "./LeadSessionExplorer";

export function EmbedVisit(p: {
  siteId: string;
  visitorId: string;
  domain: string | null;
  sentAt: string | null;
  jellyhookUrl: string;
  sessions: unknown[];
  pageViews: unknown[];
  submissions: unknown[];
  structure: unknown[];
  forms: unknown[];
}) {
  return (
    <div className="min-h-screen bg-background p-4 text-foreground">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/jellyhook-nobg.png" alt="" className="size-5 object-contain" />
        <span className="text-sm font-semibold">Visits{p.domain ? " on " + p.domain : ""}</span>
        {p.sentAt && <span className="text-xs text-muted-foreground">Form sent {new Date(p.sentAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
        <a href={p.jellyhookUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          Open in Jellyhook <ExternalLink className="size-3" />
        </a>
      </div>
      <React.Suspense fallback={null}>
        <LeadSessionExplorer
          siteId={p.siteId}
          visitorId={p.visitorId}
          initialSessionRows={p.sessions as SessionRow[]}
          initialPageViewRows={p.pageViews as PageViewRow[]}
          initialSubmissionRows={p.submissions as SubmissionRow[]}
          initialStructureRows={p.structure as PageStructureRow[]}
          initialFormEngagementRows={p.forms as FormEngagementRow[]}
          readOnly
        />
      </React.Suspense>
    </div>
  );
}
