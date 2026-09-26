// components/dashboard/FramePlatePreviewCard.tsx
//
// A small, narrow "teaser" for the FramePlate chart, shown on the dashboard
// overview above Live Activity — NOT a second lead explorer, just a shortcut
// that makes people curious enough to click into a real lead's page. Compact
// theme (miniPlate), no "1vh" marks, no duration ribbon — see framePlate's
// miniPlate preset for why those specific two are stripped.
//
// Two mini charts, each for a DIFFERENT lead when more than one exists:
//   - Each slot prioritizes that lead's CONVERTED session (the most
//     "interesting" one to show off) — falling back to their most recent
//     session if they haven't converted.
//   - Slot B picks a different lead than slot A when possible. With only one
//     lead on the site, both slots fall back to that same lead, but slot B
//     is still given a DIFFERENT session than slot A picked (not necessarily
//     the converted one this time, since that's already shown in slot A) —
//     never just the same chart twice.
//
// TODO(product): which lead lands in each slot is picked with Math.random()
// out of this site's leads — arbitrary beyond the converted/distinct-lead
// priority above. The plan (per conversation) is to replace
// pickPreviewVisitorId with an algorithmic pick (e.g. the most visually
// interesting / highest-scroll session), cache THAT specific choice, and
// always re-serve the same cached "featured" sessions instead of re-rolling
// on every render. Swap the implementation of pickPreviewVisitorId (and how
// it's cached) without touching anything else in this file when that's ready.
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

/** Arbitrary beyond the exclude filter — see the TODO(product) note above the imports. */
function pickRandomFrom(ids: string[], exclude?: string | null): string | null {
  const pool = exclude ? ids.filter((id) => id !== exclude) : ids;
  const candidates = pool.length ? pool : ids; // nothing left after excluding — only one lead exists, reuse it
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
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

/** Synchronous cache read for the lazy useState initializers below — same tier LeadSessionExplorer uses (jh_leadsess_<visitorId>). */
function readInitialSessionsRaw(visitorId: string | null): SessionRaw[] {
  if (!visitorId) return [];
  const cached = getCachedSessionRows(visitorId);
  return cached ? toSessionsRaw(cached.data) : [];
}

type SlotStatus = "loading" | "ready" | "empty";

/** Cache-first fetch of one visitor's sessions. `visitorId: null` means "nothing to fetch" (e.g. slot B reusing slot A's own data for a single-lead site). */
function useVisitorSessions(siteId: string, visitorId: string | null): { sessionsRaw: SessionRaw[]; status: SlotStatus } {
  const [sessionsRaw, setSessionsRaw] = React.useState<SessionRaw[]>(() => readInitialSessionsRaw(visitorId));
  const [status, setStatus] = React.useState<SlotStatus>(() => {
    if (!visitorId) return "empty";
    return readInitialSessionsRaw(visitorId).length ? "ready" : "loading";
  });

  React.useEffect(() => {
    if (!visitorId) return;
    let cancelled = false;

    const cached = getCachedSessionRows(visitorId);
    if (cached && !cached.isStale) return;

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

function MiniChartSlot({ status, session }: { status: SlotStatus; session: SessionRaw | null }) {
  if (status === "empty") return <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">No sessions yet.</div>;
  if (status === "loading" || !session) return <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">Loading a preview…</div>;
  return (
    <div className="max-w-md overflow-x-auto rounded-md border bg-card/50 p-2">
      <FramePlateChart session={session} theme={miniPlate} viewportHeightPx={0} />
    </div>
  );
}

export function FramePlatePreviewCard({ siteId, visitorIds }: FramePlatePreviewCardProps) {
  // Picked once per mount, not re-rolled on every re-render.
  const [visitorIdA] = React.useState(() => pickRandomFrom(visitorIds));
  const [visitorIdB] = React.useState(() => pickRandomFrom(visitorIds, visitorIdA));
  const sameLead = visitorIdA !== null && visitorIdA === visitorIdB;

  const slotA = useVisitorSessions(siteId, visitorIdA);
  // Same lead as slot A: don't re-fetch, just reuse slot A's own sessions
  // list and pick a different session out of it (see pickPrioritySession).
  const slotB = useVisitorSessions(siteId, sameLead ? null : visitorIdB);

  const sessionA = slotA.sessionsRaw.length ? pickPrioritySession(slotA.sessionsRaw) : null;
  const sessionsRawB = sameLead ? slotA.sessionsRaw : slotB.sessionsRaw;
  const sessionB = sessionsRawB.length ? pickPrioritySession(sessionsRawB, sameLead ? sessionA?.id : undefined) : null;
  const statusB = sameLead ? slotA.status : slotB.status;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-1.5">
          <LineChart className="h-4 w-4 text-muted-foreground" /> Session Playback
        </CardTitle>
        <CardDescription>See exactly how a visitor moved through your site, scroll by scroll.</CardDescription>
      </CardHeader>
      <CardContent>
        {!visitorIdA ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No lead sessions yet to preview.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MiniChartSlot status={slotA.status} session={sessionA} />
            <MiniChartSlot status={statusB} session={sessionB} />
          </div>
        )}
        <Link href="/platform/leads" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Explore full lead sessions <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
