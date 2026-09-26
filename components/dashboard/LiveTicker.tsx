// components/dashboard/LiveTicker.tsx
//
// A stock/memecoin-style ticker for the dashboard overview, replacing the
// old static "Live Activity" table. Purpose is entirely different from a
// data table: it's meant to hype the owner up about the traffic they're
// actually getting, second by second, not to be a careful record you'd
// export. Exactly 10 rows, newest visitor always entering at the top and
// visibly pushing everything else down a slot — never a silent re-sort.
"use client";

import * as React from "react";
import { Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentActivity } from "@/lib/actions/supabase.actions";

interface ActivityRow {
  id: string;
  page_path: string | null;
  visitor_id: string | null;
  entered_at: string | null;
}

const MAX_ROWS = 10;
const MIN_POLL_MS = 1200;
const MAX_POLL_MS = 6000;
const BASE_POLL_MS = 4000;
const NEW_ROW_ANIMATION_MS = 900;

function formatElapsed(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0) return "0s ago";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

export function LiveTicker({ siteId, initialRows }: { siteId: string; initialRows: ActivityRow[] }) {
  const [rows, setRows] = React.useState<ActivityRow[]>(() => initialRows.slice(0, MAX_ROWS));
  const [pollMs, setPollMs] = React.useState(BASE_POLL_MS);
  const [justAdded, setJustAdded] = React.useState<Set<string>>(new Set());
  // Forces a re-render every second purely so each row's "Xs ago" text keeps
  // counting up even between polls — the rows themselves don't change.
  const [, setTick] = React.useState(0);

  const rowEls = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRects = React.useRef<Map<string, DOMRect>>(new Map());

  React.useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const fresh: ActivityRow[] = await getRecentActivity(siteId, 15);
        if (cancelled) return;
        setRows((prev) => {
          const knownIds = new Set(prev.map((r) => r.id));
          const incoming = fresh.filter((r) => !knownIds.has(r.id));
          if (incoming.length === 0) {
            setPollMs((p) => Math.min(MAX_POLL_MS, p + 250));
            return prev;
          }
          // The busier the site, the faster the ticker updates — more new
          // arrivals in one poll pulls the interval down harder.
          setPollMs((p) => Math.max(MIN_POLL_MS, p - incoming.length * 350));
          setJustAdded(new Set(incoming.map((r) => r.id)));
          return [...incoming, ...prev].slice(0, MAX_ROWS);
        });
      } catch (err) {
        console.error("[LiveTicker] refresh failed:", err);
      }
    }, pollMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // rows is deliberately NOT a dependency — it's only ever read through the
    // functional setRows(prev => ...) updater above, which always sees the
    // latest value regardless of this closure. Depending on it here would
    // just reschedule the same timer a second time on every poll for no
    // reason; pollMs already changing is what re-arms it.
  }, [siteId, pollMs]);

  React.useEffect(() => {
    if (justAdded.size === 0) return;
    const t = setTimeout(() => setJustAdded(new Set()), NEW_ROW_ANIMATION_MS);
    return () => clearTimeout(t);
  }, [justAdded]);

  // FLIP: rows already on screen get pushed down a slot when a new one lands
  // above them — measure where each row WAS before this render, then after
  // the DOM updates, offset it back to that spot with no transition and
  // immediately animate to zero, so it visibly slides into its new position
  // instead of silently teleporting there.
  React.useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();
    rowEls.current.forEach((el, id) => {
      if (el) nextRects.set(id, el.getBoundingClientRect());
    });

    nextRects.forEach((rect, id) => {
      const prevRect = prevRects.current.get(id);
      const el = rowEls.current.get(id);
      if (!prevRect || !el) return;
      const deltaY = prevRect.top - rect.top;
      if (Math.abs(deltaY) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      });
    });

    prevRects.current = nextRects;
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-1.5">
          <Radio className="h-4 w-4 text-primary animate-pulse" /> Live Ticker
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No activity yet.</div>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-md border">
            {rows.map((row) => (
              <div
                key={row.id}
                ref={(el) => {
                  if (el) rowEls.current.set(row.id, el);
                  else rowEls.current.delete(row.id);
                }}
                className={`flex items-center justify-between gap-3 border-b px-3 py-2.5 text-sm last:border-b-0 ${
                  justAdded.has(row.id) ? "jh-ticker-row-in" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-foreground">{row.page_path || "/"}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{row.visitor_id ? `${row.visitor_id.slice(0, 8)}...` : "—"}</span>
                <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{formatElapsed(row.entered_at)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
