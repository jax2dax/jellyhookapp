// components/dashboard/FramePlatePreviewCard.tsx
//
// A small, narrow "teaser" for the FramePlate chart, shown on the dashboard
// overview above Live Activity — NOT a second lead explorer, just a shortcut
// that makes people curious enough to click into a real lead's page. Compact
// theme (miniPlate), no "1vh" marks, no duration ribbon — see framePlate's
// miniPlate preset for why those specific two are stripped.
//
// Two mini charts, each for a DIFFERENT lead when more than one exists:
//   - WHICH lead lands in each slot: the lead with the most form_submissions
//     rows on this site (see rankByFrequency) — someone who's shown up
//     repeatedly is more interesting to show off than a one-time submitter.
//     Slot A gets the most frequent lead, slot B the next-most-frequent
//     distinct one. With only one lead on the site, both slots fall back to
//     that same lead.
//   - Within a lead's own sessions, each slot prioritizes their CONVERTED
//     session (the most "interesting" one to show off) — falling back to
//     their most recent session if they haven't converted.
//   - Slot B is given a DIFFERENT session than slot A when both land on the
//     same lead (not necessarily the converted one this time, since that's
//     already shown in slot A) — never just the same chart twice.
"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Footprints } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FramePlateChart, miniPlate, type SessionRaw } from "@/framePlate";
import { buildSessionsRaw } from "@/lib/leadSessions/transform";
import { getLeadSessionRows } from "@/lib/actions/leadSessions.action";
import { getCachedSessionRows, setCachedSessionRows } from "@/lib/leadSessionsCache";

export interface PreviewLead {
  visitor_id: string | null;
  name: string | null;
  email: string | null;
}

export interface FramePlatePreviewCardProps {
  siteId: string;
  /** this site's leads (form_submissions rows) — see dashboard page.jsx. Order doesn't matter; frequency is computed here. */
  leads: PreviewLead[];
}

interface RankedLead {
  visitorId: string;
  displayName: string;
  submissionCount: number;
}

/**
 * Distinct leads, ranked by how many times they've shown up in
 * form_submissions (most frequent first) — a lead who's converted or
 * re-engaged repeatedly is more interesting to feature than a one-time
 * submitter. Ties keep submission order (first-seen first).
 */
function rankByFrequency(leads: PreviewLead[]): RankedLead[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  const names = new Map<string, string>();
  for (const lead of leads) {
    if (!lead.visitor_id) continue;
    if (!counts.has(lead.visitor_id)) {
      order.push(lead.visitor_id);
      names.set(lead.visitor_id, lead.name || lead.email || "This visitor");
    }
    counts.set(lead.visitor_id, (counts.get(lead.visitor_id) ?? 0) + 1);
  }
  return order
    .map((visitorId) => ({ visitorId, displayName: names.get(visitorId)!, submissionCount: counts.get(visitorId)! }))
    .sort((a, b) => b.submissionCount - a.submissionCount);
}

/**
 * The session shown for a lead: prefer one they actually converted on (the
 * most "interesting" thing to show off), otherwise their most recent visit.
 * `excludeId` lets a second slot for the SAME lead avoid repeating whatever
 * the first slot already picked — if excluding would leave nothing, the
 * exclusion is dropped rather than showing no chart at all.
 */
function pickPrioritySession(sessionsRaw: SessionRaw[], excludeId?: string | null): SessionRaw | null {
  const pool = excludeId ? sessionsRaw.filter((s) => s.id !== excludeId) : sessionsRaw;
  const candidates = pool.length ? pool : sessionsRaw;
  if (!candidates.length) return null;
  const converted = candidates.find((s) => s.visits.some((v) => v.converted));
  // Ascending (oldest first, per buildSessionsRaw) — the most recent session
  // reads as the most "alive" advertisement for the chart.
  return converted ?? candidates[candidates.length - 1];
}

function toSessionsRaw(rows: { sessions: unknown[]; pageViews: unknown[]; submissions: unknown[] }): SessionRaw[] {
  return buildSessionsRaw({ ...rows, pageStructure: [] }) as SessionRaw[];
}

type SlotStatus = "loading" | "ready" | "empty";

/**
 * Cache-first fetch of one visitor's sessions. `visitorId: null` means
 * "nothing to fetch" (e.g. slot B reusing slot A's own data for a
 * single-lead site).
 *
 * Starts every render — server and client alike — from the same empty/
 * loading state, then reads the localStorage cache inside useEffect, never
 * in a lazy useState initializer. localStorage doesn't exist during SSR,
 * so reading it synchronously there would make the server-rendered HTML
 * ("loading") diverge from what the client immediately renders on mount if
 * a cache entry happens to exist ("ready") — exactly the hydration mismatch
 * this used to produce. See components/leads/LeadSessionExplorer.tsx for
 * the same pattern done correctly from the start.
 */
function useVisitorSessions(siteId: string, visitorId: string | null): { sessionsRaw: SessionRaw[]; status: SlotStatus } {
  const [sessionsRaw, setSessionsRaw] = React.useState<SessionRaw[]>([]);
  const [status, setStatus] = React.useState<SlotStatus>(visitorId ? "loading" : "empty");

  React.useEffect(() => {
    if (!visitorId) return;
    let cancelled = false;

    const cached = getCachedSessionRows(visitorId);
    if (cached) {
      const raw = toSessionsRaw(cached.data);
      if (raw.length) {
        // One-shot sync from an external system (localStorage) — not a
        // cascading-render risk, same justification as the identical
        // pattern in components/charts/NewReachChart.tsx.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSessionsRaw(raw);
        setStatus("ready");
      }
      if (!cached.isStale) return;
    }

    getLeadSessionRows(siteId, visitorId)
      .then((fresh) => {
        if (cancelled || !fresh) return;
        const hasLiveSession = fresh.sessions.some((s: { ended_at: string | null }) => !s.ended_at);
        setCachedSessionRows(visitorId, { ...fresh, hasLiveSession });
        const raw = toSessionsRaw(fresh);
        if (raw.length) {
          setSessionsRaw(raw);
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

  return { sessionsRaw, status };
}

function MiniChartSlot({ status, session, displayName }: { status: SlotStatus; session: SessionRaw | null; displayName: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Footprints className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{displayName}&apos;s footprints</span>
      </div>
      {status === "empty" ? (
        <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">No sessions yet.</div>
      ) : status === "loading" || !session ? (
        <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">Loading a preview…</div>
      ) : (
        <div className="max-w-md overflow-x-auto rounded-md border bg-card/50 p-2">
          <FramePlateChart session={session} theme={miniPlate} viewportHeightPx={0} />
        </div>
      )}
    </div>
  );
}

export function FramePlatePreviewCard({ siteId, leads }: FramePlatePreviewCardProps) {
  // Ranked once per mount, not re-rolled on every re-render.
  const [ranked] = React.useState(() => rankByFrequency(leads));
  const leadA = ranked[0] ?? null;
  const leadB = ranked[1] ?? null;
  const sameLead = leadB === null && leadA !== null;

  const slotA = useVisitorSessions(siteId, leadA?.visitorId ?? null);
  // Only one distinct lead on this site: don't re-fetch, just reuse slot A's
  // own sessions list and pick a different session out of it (see pickPrioritySession).
  const slotB = useVisitorSessions(siteId, sameLead ? null : leadB?.visitorId ?? null);

  const sessionA = slotA.sessionsRaw.length ? pickPrioritySession(slotA.sessionsRaw) : null;
  const sessionsRawB = sameLead ? slotA.sessionsRaw : slotB.sessionsRaw;
  const sessionB = sessionsRawB.length ? pickPrioritySession(sessionsRawB, sameLead ? sessionA?.id : undefined) : null;
  const statusB = sameLead ? slotA.status : slotB.status;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-1.5">
          <Footprints className="h-4 w-4 text-muted-foreground" /> Lead footprints
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!leadA ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No lead sessions yet to preview.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MiniChartSlot status={slotA.status} session={sessionA} displayName={leadA.displayName} />
            <MiniChartSlot status={statusB} session={sessionB} displayName={(sameLead ? leadA : leadB)?.displayName ?? "This visitor"} />
          </div>
        )}
        <Link href="/platform/leads" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Explore full lead sessions <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
