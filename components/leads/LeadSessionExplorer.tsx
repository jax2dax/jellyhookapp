// components/leads/LeadSessionExplorer.tsx
// Replaces the old Session History table with a session picker (one row per
// session, click to load) + a FramePlateChart for whichever one is selected.
//
// Data flow, end to end:
//   DB rows (sessions/page_views/form_submissions/page_structure)
//     → lib/actions/leadSessions.action.js  (fetch — server, raw rows only)
//     → lib/leadSessions/transform.js       (parse — pure, client-safe)
//     → lib/leadSessionsCache.js            (per-tier localStorage TTLs)
//     → this component                      (state + polling + picker UI)
//     → framePlate/ (FramePlateChart)       (render — knows nothing about any of the above)
//
// Two independently-timed tiers, not one blob timeout:
//   - "sessions" (sessions+page_views+submissions): refetched often while a
//     session is still live (it's actively changing), rarely once everything
//     is closed (closed sessions are immutable — see leadSessionsCache.js).
//   - "structure" (page_structure/headers): fetched once per known set of
//     page_paths and cached long — page layout doesn't change moment to moment.
//
// No blind background polling for the general case (matches the existing
// IntentPageClient pattern: cache-check-on-mount + manual refresh). The one
// exception is scoped tightly: auto-refresh only runs while the SELECTED
// session is itself still live, and only while this component is mounted —
// never for the page in general.

"use client";

import * as React from "react";
import { RefreshCw, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDuration, formatRelativeTime } from "@/lib/leadFormat";
import { FramePlateChart, type SessionRaw } from "@/framePlate";
import { buildSessionsRaw } from "@/lib/leadSessions/transform";
import { getLeadSessionRows, getLeadPageStructureRows } from "@/lib/actions/leadSessions.action";
import {
  setCachedSessionRows,
  getCachedPageStructure,
  setCachedPageStructure,
  SESSIONS_TTL_LIVE_MS,
} from "@/lib/leadSessionsCache";

// Row shapes mirror mds/database.md exactly — see lib/leadSessions/transform.js's
// header comment for the full field-by-field sourcing.
export interface SessionRow {
  id: string;
  session_id: string;
  visitor_id: string | null;
  started_at: string | null;
  ended_at: string | null;
}
export interface PageViewRow {
  id: string;
  page_view_id: string;
  session_id: string | null;
  visitor_id: string | null;
  page_path: string | null;
  entered_at: string | null;
  left_at: string | null;
  page_height: number | null;
  entry_scroll_depth: number | null;
  max_scroll_depth: number | null;
  revisit_start_scroll_depth: number | null;
  scroll_depth: number | null;
}
export interface SubmissionRow {
  id: string;
  session_id: string | null;
  page_path: string | null;
  submitted_at: string | null;
}
export interface PageStructureRow {
  page_path: string;
  header_index: number;
  header_text: string;
  position_y: number;
  page_height: number;
}

interface RawRows {
  sessions: SessionRow[];
  pageViews: PageViewRow[];
  submissions: SubmissionRow[];
}

interface LeadSessionExplorerProps {
  siteId: string;
  visitorId: string;
  deviceType?: string | null;
  initialSessionRows: SessionRow[];
  initialPageViewRows: PageViewRow[];
  initialSubmissionRows: SubmissionRow[];
}

function readInitialPageStructureCache(siteId: string): PageStructureRow[] {
  try {
    const cached = getCachedPageStructure(siteId);
    return cached && !cached.isStale ? (cached.data as PageStructureRow[]) : [];
  } catch (err) {
    console.error("[LeadSessionExplorer] initial page_structure cache read failed:", err);
    return [];
  }
}

export function LeadSessionExplorer({
  siteId,
  visitorId,
  deviceType,
  initialSessionRows,
  initialPageViewRows,
  initialSubmissionRows,
}: LeadSessionExplorerProps) {
  const [rawRows, setRawRows] = React.useState<RawRows>({
    sessions: initialSessionRows || [],
    pageViews: initialPageViewRows || [],
    submissions: initialSubmissionRows || [],
  });
  // Lazy initializer, not an effect: a one-time read of the long-lived
  // page_structure cache at mount, not a value that needs to stay in sync
  // with anything on every render.
  const [pageStructureRows, setPageStructureRows] = React.useState<PageStructureRow[]>(() => readInitialPageStructureCache(siteId));
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  // null = "not refreshed from the client yet, still showing the server-rendered load" —
  // avoids calling Date.now() during render just to seed this.
  const [lastFetchedAt, setLastFetchedAt] = React.useState<number | null>(null);

  const sessionsRaw = React.useMemo<SessionRaw[]>(() => {
    return buildSessionsRaw({ ...rawRows, pageStructure: pageStructureRows }) as SessionRaw[];
  }, [rawRows, pageStructureRows]);

  const hasLiveSession = sessionsRaw.some((s) => s.endedAt === null);

  // Effective selection: most recent session by default (naturally the live
  // one when there is one), or whatever was explicitly clicked if it still
  // exists. Derived during render, not stored/synced via an effect.
  const effectiveSelectedId =
    selectedSessionId && sessionsRaw.some((s) => s.id === selectedSessionId) ? selectedSessionId : (sessionsRaw[sessionsRaw.length - 1]?.id ?? null);
  const selectedSession = sessionsRaw.find((s) => s.id === effectiveSelectedId) || null;

  // ── Seed the sessions-tier cache with what the server already fetched ──
  // (zero extra network request on first paint — see leadProfile.actions.js,
  // already fetched everything this page needed server-side). Writing to
  // localStorage here is exactly what effects are for; no React state is
  // touched in this one.
  React.useEffect(() => {
    setCachedSessionRows(visitorId, { ...rawRows, hasLiveSession });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Structure tier: fetch page_structure for any page_paths we don't
  // already have cached, long TTL (see STRUCTURE_TTL_MS). setState only
  // happens inside the .then() callback, never synchronously in the effect
  // body itself. ──
  React.useEffect(() => {
    const paths = Array.from(new Set(rawRows.pageViews.map((pv) => pv.page_path).filter((p): p is string => !!p)));
    if (paths.length === 0) return;

    const cached = getCachedPageStructure(siteId);
    if (cached && !cached.isStale) return; // already reflected via the lazy initializer above

    let cancelled = false;
    getLeadPageStructureRows(siteId, paths)
      .then((rows: PageStructureRow[]) => {
        if (cancelled) return;
        setPageStructureRows(rows);
        setCachedPageStructure(siteId, rows);
      })
      .catch((err) => console.error("[LeadSessionExplorer] page_structure fetch failed:", err));
    return () => {
      cancelled = true;
    };
  }, [siteId, rawRows.pageViews]);

  const refreshSessions = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await getLeadSessionRows(siteId, visitorId);
      if (fresh) {
        setRawRows(fresh);
        setLastFetchedAt(Date.now());
        const freshHasLive = fresh.sessions.some((s) => !s.ended_at);
        setCachedSessionRows(visitorId, { ...fresh, hasLiveSession: freshHasLive });
      }
    } catch (err) {
      console.error("[LeadSessionExplorer] session refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }, [siteId, visitorId]);

  // ── Bounded auto-refresh: only while the SELECTED session is itself still
  // live, and only while this component is on screen. Not a general poll. ──
  React.useEffect(() => {
    if (selectedSession?.endedAt !== null) return; // selected session isn't live — no reason to poll
    const interval = setInterval(refreshSessions, SESSIONS_TTL_LIVE_MS);
    return () => clearInterval(interval);
  }, [selectedSession?.endedAt, refreshSessions]);

  if (sessionsRaw.length === 0) {
    return <div className="py-6 text-center text-sm text-muted-foreground">No sessions recorded yet.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {hasLiveSession && (
            <Badge className="gap-1">
              <Radio className="h-3 w-3" /> Live session
            </Badge>
          )}
          <span>{lastFetchedAt ? `Checked ${formatRelativeTime(new Date(lastFetchedAt).toISOString())}` : "Loaded with this page"}</span>
        </div>
        <Button variant="outline" size="sm" onClick={refreshSessions} disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Visit</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Pages</TableHead>
            <TableHead className="text-right">Outcome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessionsRaw.map((session, idx) => {
            const isSelected = session.id === effectiveSelectedId;
            const converted = session.visits.some((v) => v.converted);
            const isLive = session.endedAt === null;
            const durationMs = session.visits.length
              ? new Date(session.visits[session.visits.length - 1].leftAt).getTime() - new Date(session.startedAt).getTime()
              : null;
            return (
              <TableRow key={session.id} className={`cursor-pointer ${isSelected ? "bg-muted/50" : ""}`} onClick={() => setSelectedSessionId(session.id)} aria-selected={isSelected}>
                <TableCell className="font-medium">#{idx + 1}</TableCell>
                <TableCell>{formatDate(session.startedAt)}</TableCell>
                <TableCell>{durationMs != null ? formatDuration(durationMs) : "—"}</TableCell>
                <TableCell>{session.visits.length}</TableCell>
                <TableCell className="text-right">
                  {isLive ? (
                    <Badge className="gap-1">
                      <Radio className="h-3 w-3" /> Live
                    </Badge>
                  ) : converted ? (
                    <Badge>Converted</Badge>
                  ) : (
                    <Badge variant="outline">Left without converting</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selectedSession && (
        <div className="rounded-md border bg-card/50 p-3">
          <FramePlateChart session={selectedSession} deviceType={deviceType} />
        </div>
      )}
    </div>
  );
}
