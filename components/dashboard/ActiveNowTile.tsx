// components/dashboard/ActiveNowTile.tsx
//
// "Active now": the number of visitors on the site right now, live, as a tile like the others, with a pulsing dot.
// Reads from the exact same live store the main chart does (see useSessionsOnlineNow), so this number and the
// chart's "N open right now" readout are always identical, never two independently-drifting sources.
// ActiveNowCard draws it from a number (the dashboard preview passes a sample).
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useSessionsOnlineNow } from "@/main-chart";

export function ActiveNowTile({ siteId }: { siteId: string }) {
  return <ActiveNowCard count={useSessionsOnlineNow(siteId) ?? null} />;
}

export function ActiveNowCard({ count }: { count: number | null }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4" role="status" aria-label={`${count ?? "Loading"} visitors on the site right now, live`}>
        <div className="flex h-6 items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Active now
        </div>
        <div className="mt-2 flex h-8 items-center">
          {count === null ? <span className="jh-skeleton h-7 w-12 rounded-md" /> : <p className="text-2xl font-semibold leading-none tracking-tight text-foreground tabular-nums">{count}</p>}
        </div>
        <p className="mt-1.5 truncate text-xs text-muted-foreground">On the site, live</p>
      </CardContent>
    </Card>
  );
}
