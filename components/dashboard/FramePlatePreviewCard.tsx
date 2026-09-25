// components/dashboard/FramePlatePreviewCard.tsx
//
// A small, narrow "teaser" for the FramePlate chart, shown on the dashboard
// overview above Live Activity — NOT a second lead explorer, just a shortcut
// that makes people curious enough to click into a real lead's page. Compact
// theme (miniPlate), no "1vh" marks, no duration ribbon — see framePlate's
// miniPlate preset for why those specific two are stripped.
//
// TODO(product): the visitor shown here is picked with Math.random() out of
// this site's leads — literally arbitrary. The plan (per conversation) is to
// replace pickPreviewVisitorId with an algorithmic pick (e.g. the most
// visually interesting / highest-scroll / most-page session), cache THAT
// specific choice, and always re-serve the same cached "featured" session
// instead of re-rolling on every render. Swap the implementation of
// pickPreviewVisitorId (and how it's cached) without touching anything else
// in this file when that's ready.
"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, LineChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FramePlateChart, miniPlate, type SessionRaw } from "@/framePlate";
import { buildSessionsRaw } from "@/lib/leadSessions/transform";
import { getLeadSessionRows } from "@/lib/actions/leadSessions.action";
import { getCachedSessionRows, setCachedSessionRows } from "@/lib/leadSessionsCache";

export interface FramePlatePreviewCardProps {
  siteId: string;
  /** distinct visitor_ids pulled from this site's leads (form_submissions) — see dashboard page.jsx */
  visitorIds: string[];
}

/** Arbitrary for now — see the TODO(product) note above the imports. */
function pickPreviewVisitorId(visitorIds: string[]): string | null {
  if (visitorIds.length === 0) return null;
  return visitorIds[Math.floor(Math.random() * visitorIds.length)];
}

function pickLatestSession(rows: { sessions: unknown[]; pageViews: unknown[]; submissions: unknown[] }): SessionRaw | null {
  const sessionsRaw = buildSessionsRaw({ ...rows, pageStructure: [] }) as SessionRaw[];
  // Ascending (oldest first, per buildSessionsRaw) — the most recent session
  // reads as the most "alive" advertisement for the chart.
  return sessionsRaw[sessionsRaw.length - 1] ?? null;
}

/** Synchronous cache read for the lazy useState initializers below — same tier LeadSessionExplorer uses (jh_leadsess_<visitorId>). */
function readInitialCachedSession(visitorId: string | null): SessionRaw | null {
  if (!visitorId) return null;
  const cached = getCachedSessionRows(visitorId);
  return cached ? pickLatestSession(cached.data) : null;
}

export function FramePlatePreviewCard({ siteId, visitorIds }: FramePlatePreviewCardProps) {
  // Picked once per mount, not re-rolled on every re-render.
  const [visitorId] = React.useState(() => pickPreviewVisitorId(visitorIds));
  // Lazy initializers (not an effect) so a cache hit renders on the FIRST
  // paint instead of flashing "Loading…" for a frame first.
  const [session, setSession] = React.useState<SessionRaw | null>(() => readInitialCachedSession(visitorId));
  const [status, setStatus] = React.useState<"loading" | "ready" | "empty">(() => {
    if (!visitorId) return "empty";
    return readInitialCachedSession(visitorId) ? "ready" : "loading";
  });

  React.useEffect(() => {
    if (!visitorId) return;
    let cancelled = false;

    // This preview never needs to reflect the SECOND it's stale — only skip
    // the network round trip entirely when a cached value is already fresh.
    const cached = getCachedSessionRows(visitorId);
    if (cached && !cached.isStale) return;

    getLeadSessionRows(siteId, visitorId)
      .then((fresh) => {
        if (cancelled || !fresh) return;
        const hasLiveSession = fresh.sessions.some((s: { ended_at: string | null }) => !s.ended_at);
        setCachedSessionRows(visitorId, { ...fresh, hasLiveSession });
        const picked = pickLatestSession(fresh);
        if (picked) {
          setSession(picked);
          setStatus("ready");
        } else if (!cached) {
          setStatus("empty");
        }
      })
      .catch((err) => {
        console.error("[FramePlatePreviewCard] session fetch failed:", err);
        if (!cancelled && !cached) setStatus("empty");
      });

    return () => {
      cancelled = true;
    };
  }, [siteId, visitorId]);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-1.5">
          <LineChart className="h-4 w-4 text-muted-foreground" /> Session Playback
        </CardTitle>
        <CardDescription>See exactly how a visitor moved through your site, scroll by scroll.</CardDescription>
      </CardHeader>
      <CardContent>
        {status === "empty" && <div className="py-6 text-center text-sm text-muted-foreground">No lead sessions yet to preview.</div>}
        {status === "loading" && <div className="py-6 text-center text-sm text-muted-foreground">Loading a preview…</div>}
        {status === "ready" && session && (
          <div className="max-w-md overflow-x-auto rounded-md border bg-card/50 p-2">
            <FramePlateChart session={session} theme={miniPlate} viewportHeightPx={0} />
          </div>
        )}
        <Link href="/platform/leads" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Explore full lead sessions <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
