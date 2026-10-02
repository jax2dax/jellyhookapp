// components/dashboard/LiveTicker.tsx
//
// A stock/memecoin-style ticker for the dashboard overview, replacing the
// old static "Live Activity" table. Purpose is entirely different from a
// data table: it's meant to hype the owner up about the traffic they're
// actually getting, second by second, not to be a careful record you'd
// export. Exactly 10 rows, newest visitor always entering at the top and
// visibly pushing everything else down a slot — never a silent re-sort.
//
// Polling is coordinated across browser tabs via lib/liveTickerCache.js —
// see that file's header for why a shared localStorage cache exists at all.
//
// Polling alone means a brand-new visitor only ever appears on this tab's
// NEXT scheduled check — up to pollMs away, not "the moment it happened".
// A Supabase Realtime subscription below pushes new page_views rows the
// instant Postgres inserts them, over the same websocket connection, so a
// new visitor shows up essentially immediately instead of waiting out a
// poll interval. Polling is kept running regardless, as the backstop: if
// Realtime isn't enabled for this table yet (see the comment on the
// subscription effect) or a websocket drops, the ticker just continues
// working exactly as it already did, at the usual polling pace.
"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentActivity } from "@/lib/actions/supabase.actions";
import { getCachedActivity, setCachedActivity, liveTickerCacheKey } from "@/lib/liveTickerCache";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

interface ActivityRow {
  id: string;
  page_path: string | null;
  visitor_id: string | null;
  entered_at: string | null;
}

const MAX_ROWS = 10;
// Tightened from the original 1.2s-6s range — this is the PER-TAB timer
// pace; the actual network-request rate for a given site is separately
// capped at MIN_NETWORK_GAP_MS regardless of how many tabs are open (see
// lib/liveTickerCache.js).
const MIN_POLL_MS = 500;
const MAX_POLL_MS = 4000;
const BASE_POLL_MS = 1500;
// No two real getRecentActivity() calls for the same site happen closer
// together than this, no matter how many tabs have this dashboard open —
// a tab whose own timer fires before this gap has elapsed since the last
// fetch (by ANY tab) skips the network call and just re-reads the shared
// cache instead.
const MIN_NETWORK_GAP_MS = 500;
const NEW_ROW_ANIMATION_MS = 900;

// A clock that's null during server render AND during hydration, then the
// real time once the browser has taken over. Reading Date.now() in render
// instead made the server print "23h 48m ago" while the browser, a moment
// later, printed "23h 49m ago": a hydration mismatch that made React throw
// away and rebuild the whole page. Ticks once a second.
function subscribeClock(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const readClock = () => Math.floor(Date.now() / 1000) * 1000; // stable within a second, as useSyncExternalStore requires
const readServerClock = () => null;

function formatElapsed(dateStr: string | null, now: number | null): string {
  if (now === null) return ""; // server render / hydration: filled in right after
  if (!dateStr) return "—";
  const diffMs = now - new Date(dateStr).getTime();
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
  // Re-renders every second so each row's "Xs ago" keeps counting up between polls.
  const now = React.useSyncExternalStore(subscribeClock, readClock, readServerClock);

  const { getToken } = useAuth();
  // Read fresh inside the Realtime client's accessToken callback below,
  // never a closed-over value from whichever render created the client.
  const getTokenRef = React.useRef(getToken);
  React.useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const rowEls = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRects = React.useRef<Map<string, DOMRect>>(new Map());

  // Merges freshly-seen rows (from this tab's own fetch OR another tab's,
  // via the storage event below) into what's on screen: only genuinely new
  // ids trigger the drop-in animation and the pace speedup/backoff, so a
  // storage event that just repeats what we already knew is a no-op.
  const mergeIncoming = React.useCallback((fresh: ActivityRow[]) => {
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
  }, []);

  // Cross-tab: pick up another tab's poll result the instant it lands,
  // rather than waiting for this tab's own timer to next fire.
  React.useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key !== liveTickerCacheKey(siteId) || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed?.rows)) mergeIncoming(parsed.rows);
      } catch (err) {
        console.error("[LiveTicker] storage event parse failed:", err);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [siteId, mergeIncoming]);

  // Realtime: push new page_views the instant Postgres inserts them, instead
  // of waiting for this tab's next poll. Requires the `page_views` table to
  // be added to the `supabase_realtime` publication (see
  // mds/database.md — not applied yet as of writing this). Until that's
  // done, .subscribe() simply never calls back and the ticker runs on
  // polling alone, exactly as before this was added — never a regression.
  React.useEffect(() => {
    const supabase = createBrowserSupabaseClient(() => getTokenRef.current());
    const channel = supabase
      .channel(`live-ticker-${siteId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "page_views", filter: `site_id=eq.${siteId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          mergeIncoming([
            {
              id: String(row.id),
              page_path: (row.page_path as string) ?? null,
              visitor_id: (row.visitor_id as string) ?? null,
              entered_at: (row.entered_at as string) ?? null,
            },
          ]);
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[LiveTicker] realtime subscription failed, continuing on polling alone:", err ?? status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [siteId, mergeIncoming]);

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      // Another tab may have already fetched more recently than
      // MIN_NETWORK_GAP_MS ago — reuse that instead of hitting the network
      // again ourselves. Its result already reached us via the storage
      // listener above when it was written, so this is just a fallback for
      // whichever tab happens to be the very first to check.
      const cached = getCachedActivity(siteId);
      if (cached && Date.now() - cached.fetchedAt < MIN_NETWORK_GAP_MS) {
        mergeIncoming(cached.rows);
        return;
      }
      try {
        const fresh: ActivityRow[] = await getRecentActivity(siteId, 15);
        if (cancelled) return;
        setCachedActivity(siteId, fresh);
        mergeIncoming(fresh);
      } catch (err) {
        console.error("[LiveTicker] refresh failed:", err);
      }
    }, pollMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [siteId, pollMs, mergeIncoming]);

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
                <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{formatElapsed(row.entered_at, now)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
