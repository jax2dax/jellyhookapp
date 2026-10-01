// components/leads/ConvertedLeadsExplorer.tsx
// Replaces the old "Top paths to conversion" list on /platform/conversions.
// One card per converted lead (see ConvertedLeadCard), each showing only
// its own start-of-session → conversion path, filterable by date range and
// paginated — not every conversion ever rendered onto one page at once.
//
// Fetches raw rows itself (client component calling the server action
// directly, same pattern NewReachChart/ReferrerDonutChart etc. already
// use) rather than being handed everything by the server page.
//
// Cached client-side (lib/convertedLeadsCache.ts, its own module — see
// that file's top for the actual refresh-interval constant, kept separate
// from chartRangeCache.ts's shared TTL specifically so this one can be
// tuned independently). A fresh (non-stale) hit means the chart loads
// from localStorage, not a database round trip — only a cache MISS or a
// STALE entry ever calls getConvertedLeadSessions. Raw rows are what's
// cached (same split LeadSessionExplorer/leadSessionsCache.js already
// established): buildSessionsRaw/truncateSessionToSubmission re-derive the
// actual chart data from them fresh on every render via useMemo, never
// stored pre-built.
"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getConvertedLeadSessions } from "@/lib/actions/conversionLeads.action";
import { getCachedConvertedLeads, setCachedConvertedLeads } from "@/lib/convertedLeadsCache";
import { buildSessionsRaw, truncateSessionToSubmission } from "@/lib/leadSessions/transform";
import { ConvertedLeadCard, type ConvertedSubmission } from "./ConvertedLeadCard";
import type { SessionRaw } from "@/framePlate";

interface RawConvertedLeadsData {
  submissions: ConvertedSubmission[];
  sessions: unknown[];
  pageViews: unknown[];
  pageStructure: unknown[];
  formEngagement: unknown[];
}

type RangePreset = "3d" | "7d" | "30d" | "all" | "custom";

const PAGE_SIZE = 5;

function presetToRange(preset: RangePreset, customStart: string, customEnd: string): { startIso: string | null; endIso: string | null } {
  if (preset === "all") return { startIso: null, endIso: null };
  if (preset === "custom") {
    return {
      startIso: customStart ? new Date(customStart).toISOString() : null,
      endIso: customEnd ? new Date(customEnd).toISOString() : null,
    };
  }
  const days = preset === "3d" ? 3 : preset === "7d" ? 7 : 30;
  return { startIso: new Date(Date.now() - days * 86_400_000).toISOString(), endIso: null };
}

// Local datetime-local input value, e.g. "2026-10-01T09:30" — a week ago by default.
function defaultCustomStart(): string {
  const d = new Date(Date.now() - 7 * 86_400_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function defaultCustomEnd(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ConvertedLeadsExplorer({ siteId }: { siteId: string }) {
  const [preset, setPreset] = React.useState<RangePreset>("all");
  // Empty until the effect below fills them in, never computed from
  // Date.now() in a lazy initializer — same reason as everywhere else in
  // this codebase: that function would run once during SSR and again on
  // client mount, computing two different timestamps. These inputs are
  // only ever rendered once preset === "custom" (a post-hydration user
  // action), so it wouldn't surface as a visible mismatch today, but
  // there's no reason to rely on that staying true.
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setCustomStart(defaultCustomStart());
    setCustomEnd(defaultCustomEnd());
  }, []);

  // Raw rows only — never the built SessionRaw[]. See this file's header
  // comment for why that split matters for caching.
  const [rawData, setRawData] = React.useState<RawConvertedLeadsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const { startIso, endIso } = presetToRange(preset, customStart, customEnd);

  // Cache read/write happens INSIDE the effect (post-mount), never in a
  // lazy useState initializer — this component is server-rendered once
  // before hydration, and localStorage doesn't exist during that pass.
  // Same hydration-safety reasoning as every other cache in this codebase
  // (see lib/chartRangeCache.ts's identical comment).
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const cached = getCachedConvertedLeads<RawConvertedLeadsData>(siteId, startIso, endIso);
    if (cached && !cached.isStale) {
      // One-shot sync from an external system — not a cascading-render
      // risk, same justification as every other cache read in this app.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRawData(cached.data);
      setLoading(false);
      return; // fresh enough — zero network request, not just a fast one
    }

    getConvertedLeadSessions(siteId, startIso, endIso)
      .then((raw) => {
        if (cancelled) return;
        setRawData(raw);
        setCachedConvertedLeads(siteId, startIso, endIso, raw);
      })
      .catch((err) => {
        console.error("[ConvertedLeadsExplorer] fetch failed:", err);
        if (!cancelled) setError(err?.message || "Failed to load conversions");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, startIso, endIso]);

  // Reset to page 1 whenever the filter (and therefore the dataset) changes.
  React.useEffect(() => {
    setPage(1);
  }, [startIso, endIso]);

  const sessionsRaw = React.useMemo(() => {
    if (!rawData) return [];
    return buildSessionsRaw({
      sessions: rawData.sessions,
      pageViews: rawData.pageViews,
      submissions: rawData.submissions,
      pageStructure: rawData.pageStructure,
      formEngagement: rawData.formEngagement,
    }) as SessionRaw[];
  }, [rawData]);

  const cards = React.useMemo(() => {
    if (!rawData) return [];
    const sessionsById = new Map(sessionsRaw.map((s) => [s.id, s]));
    return rawData.submissions.map((sub) => {
      const fullSession = sub.session_id ? sessionsById.get(sub.session_id) ?? null : null;
      const truncated = fullSession ? truncateSessionToSubmission(fullSession, sub) : null;
      return { submission: sub, session: truncated };
    });
  }, [rawData, sessionsRaw]);

  const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const visibleCards = cards.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-foreground">Conversions</div>
            <div className="text-xs text-muted-foreground">Each card shows the path a lead actually took, start of session through the moment they converted.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as RangePreset)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
            >
              <option value="3d">Last 3 days</option>
              <option value="7d">Last week</option>
              <option value="30d">Last month</option>
              <option value="all">All time</option>
              <option value="custom">Custom range</option>
            </select>
            {preset === "custom" && (
              <>
                <input
                  type="datetime-local"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
                />
              </>
            )}
          </div>
        </div>

        {loading && <div className="py-10 text-center text-sm text-muted-foreground">Loading conversions…</div>}
        {!loading && error && <div className="py-10 text-center text-sm text-destructive">{error}</div>}
        {!loading && !error && cards.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">No conversions in this range.</div>
        )}

        {!loading && !error && visibleCards.length > 0 && (
          <div className="space-y-3">
            {visibleCards.map(({ submission, session }) => (
              <ConvertedLeadCard key={submission.id} submission={submission} session={session} />
            ))}
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {(clampedPage - 1) * PAGE_SIZE + 1}–{Math.min(clampedPage * PAGE_SIZE, cards.length)} of {cards.length} conversions
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage <= 1}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Previous
              </Button>
              <span>
                Page {clampedPage} of {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={clampedPage >= totalPages}>
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
