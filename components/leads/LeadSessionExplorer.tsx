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
import { RefreshCw, Radio, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, FileText, Layers } from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/leadFormat";
import { journeyStory, sessionStorySentences, shortDuration } from "@/lib/leadSessions/story";
import { StoryText, StorySentences, StoryFormatToggle, useStoryLines } from "./StoryText";
import { FramePlateChart, resolveViewportHeightPx, type PlateView, type SessionRaw, type TimelineItem } from "@/framePlate";
import { SessionSummaryDrawer } from "./SessionSummaryDrawer";
import { ChartLegend } from "./ChartLegend";
import { useUrlState } from "@/lib/urlState";
import { SelectedFrameDetails } from "./SelectedFrameDetails";
import { Collapse } from "./Collapse";
import { buildSessionsRaw } from "@/lib/leadSessions/transform";
import { getLeadSessionRows, getLeadPageStructureRows, getLeadFormEngagementRows } from "@/lib/actions/leadSessions.action";
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
  /** time per heading (lib/tracking/headingTime.js); absent before it was recorded */
  heading_time?: unknown;
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
  header_tag?: string;
  position_y: number;
  page_height: number;
}
export interface FormEngagementRow {
  page_view_id: string;
  status: string;
  form_top_y: number | null;
  form_bottom_y: number | null;
}

interface RawRows {
  sessions: SessionRow[];
  pageViews: PageViewRow[];
  submissions: SubmissionRow[];
}

// "By section": wider plates so each section's heading and time can be written on it (framePlate/components/SectionBands.tsx)
const SECTION_PLATE_THEME = { plate: { width: 160 }, frame: { minWidth: 186, typicalWidth: 196, maxWidth: 320 } };

// A visitor with a long history otherwise renders one ever-growing table —
// this caps a page at 10 rows and pages back in time from there. sessionsRaw
// is ascending (oldest first, per buildSessionsRaw), so "page 1" is a slice
// off the END of that array, not the start — see visibleSessions below.
const SESSIONS_PAGE_SIZE = 10;

interface LeadSessionExplorerProps {
  siteId: string;
  visitorId: string;
  deviceType?: string | null;
  initialSessionRows: SessionRow[];
  initialPageViewRows: PageViewRow[];
  initialSubmissionRows: SubmissionRow[];
  /** demo pages only: the page headings, instead of fetching them (the fetch needs a signed-in site) */
  initialStructureRows?: PageStructureRow[];
}

export function LeadSessionExplorer({
  siteId,
  visitorId,
  deviceType,
  initialSessionRows,
  initialPageViewRows,
  initialSubmissionRows,
  initialStructureRows,
}: LeadSessionExplorerProps) {
  const [rawRows, setRawRows] = React.useState<RawRows>({
    sessions: initialSessionRows || [],
    pageViews: initialPageViewRows || [],
    submissions: initialSubmissionRows || [],
  });
  // Always starts empty — matching what the server renders (no localStorage
  // there) — and gets populated from cache/fetch in an effect below, AFTER
  // the first commit. Reading localStorage synchronously in a lazy
  // initializer would make this component's very first client render differ
  // from its server-rendered HTML (server always sees no cache), which is
  // exactly what was causing a real hydration mismatch on any page view
  // whose own page_height fell back to a cached page_structure height.
  const [pageStructureRows, setPageStructureRows] = React.useState<PageStructureRow[]>(initialStructureRows ?? []);
  // Not seeded from a server prop or cache tier. Fetched once when the component mounts, then refreshed together with
  // the sessions (refreshSessions): while a session is live its form appears, gets its field stripes and changes
  // colour as the visitor works on it.
  const [formEngagementRows, setFormEngagementRows] = React.useState<FormEngagementRow[]>([]);
  // The session being looked at lives in the URL (?session=<id>), only when chosen,
  // so a refresh or a shared link opens the same session (lib/urlState.ts).
  const [urlState, setUrlState] = useUrlState({ session: "" });
  const selectedSessionId = urlState.session || null;
  // picking another visit blinks the whole chart once, so it is clear that another visit is being drawn
  const [blink, setBlink] = React.useState(0);
  const setSelectedSessionId = (id: string | null) => {
    if (id !== selectedSessionId) setBlink((n) => n + 1);
    setUrlState({ session: id ?? "" });
  };
  // Click-to-pin frame details — separate from hover. Cleared whenever the
  // selected SESSION changes, since a frame id from one session's timeline
  // means nothing in another's.
  const [selectedFrame, setSelectedFrame] = React.useState<{ item: TimelineItem; isLastVisit: boolean } | null>(null);
  // 1 = the most recent SESSIONS_PAGE_SIZE sessions (a slice off the END of
  // the ascending array); 2 = the SESSIONS_PAGE_SIZE before that, etc. This
  // way "page 1" always means "latest" regardless of how many more sessions
  // arrive later — no reset-on-new-session logic needed.
  const [sessionsPage, setSessionsPage] = React.useState(1);
  const [refreshing, setRefreshing] = React.useState(false);
  // null = "not refreshed from the client yet, still showing the server-rendered load" —
  // avoids calling Date.now() during render just to seed this.
  const [lastFetchedAt, setLastFetchedAt] = React.useState<number | null>(null);
  // under the chart, the visit's story shows by default; its numbers ("Session details") on demand
  const [showSessionDetails, setShowSessionDetails] = React.useState(false);
  // the visit's story as one paragraph or one sentence per line (shared with the page story)
  const [storyLines, setStoryLines] = useStoryLines();
  // the visit list can be folded away to a thin strip of numbers (a per-browser convenience; starts open)
  const [listOpen, setListOpen] = React.useState(true);
  // what the plates show: the seen bands, or time per section (remembered per browser)
  const [plateView, setPlateView] = React.useState<PlateView>("seen");
  React.useEffect(() => {
    try {
      // localStorage is the external system read once here
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem("jh:visit-list-open") === "0") setListOpen(false);
      const saved = window.localStorage.getItem("jh:plate-view");
      if (saved === "sections" || saved === "sections-main") setPlateView(saved);
    } catch {
      /* starts open */
    }
  }, []);
  const choosePlateView = (v: PlateView) => {
    setPlateView(v);
    try {
      window.localStorage.setItem("jh:plate-view", v);
    } catch {
      /* fine */
    }
  };
  const toggleList = () =>
    setListOpen((o) => {
      try {
        window.localStorage.setItem("jh:visit-list-open", o ? "0" : "1");
      } catch {
        /* fine */
      }
      return !o;
    });

  const sessionsRaw = React.useMemo<SessionRaw[]>(() => {
    return buildSessionsRaw({ ...rawRows, pageStructure: pageStructureRows, formEngagement: formEngagementRows }) as SessionRaw[];
  }, [rawRows, pageStructureRows, formEngagementRows]);

  const hasLiveSession = sessionsRaw.some((s) => s.endedAt === null);

  const totalSessionPages = Math.max(1, Math.ceil(sessionsRaw.length / SESSIONS_PAGE_SIZE));
  // Clamp rather than store the clamped value — if sessions ever shrink
  // (shouldn't normally happen, but never trust it blindly) a stale page
  // number in state just falls back to the last real page instead of
  // rendering an empty slice.
  const clampedSessionsPage = Math.min(sessionsPage, totalSessionPages);
  const sessionsPageEnd = sessionsRaw.length - (clampedSessionsPage - 1) * SESSIONS_PAGE_SIZE;
  const sessionsPageStart = Math.max(0, sessionsPageEnd - SESSIONS_PAGE_SIZE);
  const visibleSessions = sessionsRaw.slice(sessionsPageStart, sessionsPageEnd);

  // Effective selection: most recent session by default (naturally the live
  // one when there is one), or whatever was explicitly clicked if it still
  // exists. Derived during render, not stored/synced via an effect.
  const effectiveSelectedId =
    selectedSessionId && sessionsRaw.some((s) => s.id === selectedSessionId) ? selectedSessionId : (sessionsRaw[sessionsRaw.length - 1]?.id ?? null);
  const selectedSession = sessionsRaw.find((s) => s.id === effectiveSelectedId) || null;

  // A frame id only means something within the timeline it came from —
  // switching sessions must drop whatever was pinned open. Reset during
  // render (see SessionStrip's identical pattern) rather than an effect.
  const [prevSelectedSessionId, setPrevSelectedSessionId] = React.useState(effectiveSelectedId);
  if (effectiveSelectedId !== prevSelectedSessionId) {
    setPrevSelectedSessionId(effectiveSelectedId);
    setSelectedFrame(null);
  }

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
    // A visit recorded AFTER the cache was filled may belong to a newer
    // structure version the cache doesn't have: refetch rather than draw it
    // with an older version's headers.
    if (initialStructureRows) return; // a demo: the headings were given
    const newestVisitMs = rawRows.pageViews.reduce((m, pv) => Math.max(m, pv.entered_at ? new Date(pv.entered_at as string).getTime() : 0), 0);
    if (cached && !cached.isStale && cached.fetchedAt >= newestVisitMs) {
      // Populated here, post-mount, instead of a lazy initializer — see the
      // state declaration above for why that distinction matters. This is
      // the exact external-system-read case the lint rule's own guidance
      // allows; disabled deliberately, not to dodge a real cascading-render
      // problem (this runs once per mount/siteId change, not in a loop).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPageStructureRows(cached.data as PageStructureRow[]);
      return;
    }

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
  }, [siteId, rawRows.pageViews, initialStructureRows]);

  // ── Form engagement: first load. Later refreshes ride along with refreshSessions (the live poll and the refresh
  // button) — see the state declaration above. ──
  React.useEffect(() => {
    let cancelled = false;
    getLeadFormEngagementRows(siteId, visitorId)
      .then((rows: FormEngagementRow[]) => {
        if (!cancelled) setFormEngagementRows(rows);
      })
      .catch((err) => console.error("[LeadSessionExplorer] form_engagement fetch failed:", err));
    return () => {
      cancelled = true;
    };
  }, [siteId, visitorId]);

  const refreshSessions = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // The form's rows are refreshed WITH the sessions. They used to be fetched once per visitor, so a form that came
      // on screen after the page loaded (the yellow form mini-plate on a live session) only appeared after a full
      // reload: the page views were polled every 15 s, their form was not.
      const [fresh, forms] = await Promise.all([
        getLeadSessionRows(siteId, visitorId),
        getLeadFormEngagementRows(siteId, visitorId).catch((err: unknown) => {
          console.error("[LeadSessionExplorer] form_engagement refresh failed:", err);
          return null;
        }),
      ]);
      if (forms) setFormEngagementRows(forms as FormEngagementRow[]);
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

  const fallbackVh = resolveViewportHeightPx(undefined, deviceType);
  const selectedIndex = selectedSession ? sessionsRaw.findIndex((s) => s.id === selectedSession.id) : -1;
  // the page they went to after the clicked one (for its story)
  const nextPath = (() => {
    if (!selectedSession || !selectedFrame || selectedFrame.item.kind !== "visit") return null;
    const i = selectedSession.visits.findIndex((v) => v.id === selectedFrame.item.id);
    return i >= 0 ? selectedSession.visits[i + 1]?.pagePath ?? null : null;
  })();

  return (
    <div className="space-y-3">
      {/* every visit, in plain words */}
      <div className="rounded-md border bg-muted/40 px-3.5 pb-2.5 pt-2">
        <div className="text-sm font-medium text-foreground">Whole Journey Summary</div>
        <StoryText text={journeyStory(sessionsRaw, fallbackVh)} className="pt-1 text-sm leading-[1.9] text-foreground" />
      </div>

      <div className={"grid gap-3 " + (listOpen ? "lg:grid-cols-[13.5rem_minmax(0,1fr)]" : "lg:grid-cols-[3.25rem_minmax(0,1fr)]")}>
        {/* the visits: a compact list right next to the chart, exactly as tall as the chart (it scrolls inside) */}
        <div className="relative min-w-0">
        <div className="flex max-h-[24rem] min-h-0 flex-col overflow-hidden rounded-md border lg:absolute lg:inset-0 lg:max-h-none">
          <div className={"flex h-9 shrink-0 items-center border-b bg-muted/40 text-xs " + (listOpen ? "gap-1 px-2" : "justify-between px-1")}>
            {listOpen && (
              <>
                <span className="font-medium text-foreground">{sessionsRaw.length} visits</span>
                {hasLiveSession && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400" title="A visit is happening now">
                    <Radio className="size-3" /> live
                  </span>
                )}
              </>
            )}
            <span className={"flex items-center " + (listOpen ? "ml-auto" : "")}>
              {listOpen && totalSessionPages > 1 && (
                <>
                  <button type="button" onClick={() => setSessionsPage((p) => p + 1)} disabled={clampedSessionsPage >= totalSessionPages} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label="Older visits" title="Older visits">
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="px-0.5 text-[11px] tabular-nums text-muted-foreground" title={`Visits ${sessionsPageStart + 1}–${sessionsPageEnd} of ${sessionsRaw.length}`}>
                    {clampedSessionsPage}/{totalSessionPages}
                  </span>
                  <button type="button" onClick={() => setSessionsPage((p) => p - 1)} disabled={clampedSessionsPage <= 1} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label="Newer visits" title="Newer visits">
                    <ChevronRight className="size-3.5" />
                  </button>
                </>
              )}
              <button type="button" onClick={refreshSessions} disabled={refreshing} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Refresh" title={lastFetchedAt ? "Refresh (checked " + formatRelativeTime(new Date(lastFetchedAt).toISOString()) + ")" : "Refresh"}>
                <RefreshCw className={"size-3.5 " + (refreshing ? "animate-spin" : "")} />
              </button>
              <button type="button" onClick={toggleList} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={listOpen ? "Fold the visit list" : "Show the visit list"} title={listOpen ? "Fold the list: only the numbers stay" : "Show the visits"}>
                {listOpen ? <PanelLeftClose className="size-3.5" /> : <PanelLeftOpen className="size-3.5" />}
              </button>
            </span>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label="Visits">
            {[...visibleSessions].reverse().map((session) => {
              const idx = sessionsRaw.indexOf(session);
              const isSelected = session.id === effectiveSelectedId;
              const converted = session.visits.some((v) => v.converted);
              const isLive = session.endedAt === null;
              const durationMs = session.visits.length ? new Date(session.visits[session.visits.length - 1].leftAt).getTime() - new Date(session.startedAt).getTime() : null;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={
                      "flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-left text-xs transition " +
                      (converted ? "border-l-yellow-500 " : isLive ? "border-l-emerald-500 " : "border-l-transparent ") +
                      (isSelected ? "bg-primary/10" : "hover:bg-muted/60")
                    }
                    title={(listOpen ? "" : "Visit " + (idx + 1) + " · " + formatDate(session.startedAt) + " · " + (durationMs != null ? shortDuration(durationMs) : "-") + " · " + session.visits.length + " pages" + (converted ? " · sent the form" : isLive ? " · now" : "")) || (converted ? "Sent the form in this visit" : isLive ? "Happening now" : undefined)}
                  >
                    <span className={(listOpen ? "w-9 " : "w-full text-center ") + "shrink-0 tabular-nums " + (isSelected ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {listOpen ? (idx === sessionsRaw.length - 1 ? "Latest" : "#" + (idx + 1)) : idx + 1}
                    </span>
                    {listOpen && (
                      <>
                        <span className="min-w-0 flex-1 truncate text-foreground">{formatDate(session.startedAt)}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {durationMs != null ? shortDuration(durationMs) : "-"} · {session.visits.length}p
                        </span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        </div>

        {/* the selected visit: its chart, then each card with a label on its left saying what it is about */}
        <div className="min-w-0">
          {selectedSession && (
            // w-full + min-w-0 + overflow-hidden: a long session's chart scrolls inside, never widens the page
            <div key={blink} className="w-full min-w-0 overflow-hidden rounded-md border bg-card/50 p-3" style={blink > 0 ? { animation: "jh-chart-blink 520ms ease-in-out" } : undefined}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <ChartLegend />
                <PlateViewSwitch value={plateView} onChange={choosePlateView} hasSections={selectedSession.visits.some((v) => (v.sections?.length ?? 0) > 0)} />
              </div>
              <FramePlateChart
                session={selectedSession}
                view={plateView}
                theme={plateView !== "seen" ? SECTION_PLATE_THEME : undefined}
                deviceType={deviceType}
                onSelectItem={(item, meta) => setSelectedFrame(item ? { item, isLastVisit: meta.isLastVisit } : null)}
                className="w-full min-w-0"
              />
            </div>
          )}
        </div>

        {selectedFrame && selectedFrame.item.kind === "visit" && (
          <Reveal key={"l" + selectedFrame.item.id} className="hidden lg:block">
          <CardLabel
            folded={!listOpen}
            icon={<FileText className="size-3.5" />}
            title="Page info"
            name={selectedFrame.item.pagePath || "(unknown)"}
          />
          </Reveal>
        )}
        {selectedFrame && (
          <Reveal key={"c" + selectedFrame.item.id} className="min-w-0">
            <SelectedFrameDetails item={selectedFrame.item} isLastVisit={selectedFrame.isLastVisit} nextPath={nextPath} onClose={() => setSelectedFrame(null)} />
          </Reveal>
        )}

        {selectedSession && (
          <CardLabel
            folded={!listOpen}
            icon={<Layers className="size-3.5" />}
            title="Session info"
            name={(selectedIndex === sessionsRaw.length - 1 ? "Latest visit" : "Visit #" + (selectedIndex + 1)) + " · " + formatDate(selectedSession.startedAt)}
          />
        )}
        {selectedSession && (
          <div className="min-w-0 rounded-md border bg-card/50">
            <div className="px-3.5 pt-2 text-sm font-medium text-foreground">Session summary</div>
            <div className="flex items-start gap-3 px-3.5 pb-2.5 pt-1">
              <StorySentences sentences={sessionStorySentences(selectedSession, selectedIndex + 1, fallbackVh)} lines={storyLines} className="min-w-0 flex-1 text-sm leading-[1.9] text-foreground" />
              <StoryFormatToggle lines={storyLines} onChange={setStoryLines} />
              <button type="button" onClick={() => setShowSessionDetails((v) => !v)} className="shrink-0 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-expanded={showSessionDetails}>
                {showSessionDetails ? "Hide details" : "Session details"}
              </button>
            </div>
            <Collapse open={showSessionDetails}>
              <div className="border-t p-2">
                <SessionSummaryDrawer key={selectedSession.id} session={selectedSession} fallbackViewportHeightPx={fallbackVh} />
              </div>
            </Collapse>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A card that arrives smoothly: it opens from zero height while it fades in and settles down (the page summary, when a
 * page is clicked in the chart). Pure presentation; the content is there from the first frame.
 */
function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className={"grid transition-[grid-template-rows] duration-300 ease-out " + (shown ? "grid-rows-[1fr] " : "grid-rows-[0fr] ") + (className ?? "")}>
      <div className="min-h-0 overflow-hidden">
        <div style={{ animation: "jh-card-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both" }}>{children}</div>
      </div>
    </div>
  );
}

/**
 * The left of a card, under the visit list: what the card on its right is about. Wide screens only (on a phone the
 * cards stack and need no label). With the list folded, only the icon stays.
 */
function CardLabel({ folded, icon, title, name }: { folded: boolean; icon: React.ReactNode; title: string; name: string }) {
  if (folded) {
    return (
      <div className="hidden justify-center pt-3 text-muted-foreground lg:flex" title={title + ": " + name}>
        {icon}
      </div>
    );
  }
  return (
    <div className="hidden min-w-0 border-l-2 border-primary/40 py-1 pl-2.5 lg:block">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-foreground">{name}</div>
    </div>
  );
}

/**
 * Seen / By section: what the plates show inside. "By section" is a heat map of time per heading (recorded since
 * 2026-10-19); the Sub-headings box adds or removes the smaller headings inside each main section.
 */
function PlateViewSwitch({ value, onChange, hasSections }: { value: PlateView; onChange: (v: PlateView) => void; hasSections: boolean }) {
  const bySection = value !== "seen";
  const opt = (active: boolean, label: string, title: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={"rounded px-2 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 " + (active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-3">
      {bySection && (
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground" title="Show the smaller headings inside each main section. Untick to see only the main sections.">
          <input type="checkbox" checked={value === "sections"} onChange={(e) => onChange(e.target.checked ? "sections" : "sections-main")} />
          Sub-headings
        </label>
      )}
      <div role="radiogroup" aria-label="What the pages show" className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5">
        {opt(!bySection, "Seen", "How much of each page they scrolled past", () => onChange("seen"))}
        {opt(
          bySection,
          "By section",
          hasSections ? "A heat map of the page by its headings: the deeper the green, the longer it was on screen" : "No time per section was recorded for this visit (recorded since Oct 19, 2026)",
          () => onChange("sections"),
          !hasSections && !bySection,
        )}
      </div>
    </div>
  );
}
