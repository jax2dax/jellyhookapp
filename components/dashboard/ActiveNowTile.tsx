// components/dashboard/ActiveNowTile.tsx
//
// "Active Now": a compact round badge (number + a pulsing green dot) rather
// than a full-width tile; "visitors on site right now, live" shows on hover
// or focus. Reads from the exact same live store the main chart does (see
// useSessionsOnlineNow), so this number and the chart's "N open right now"
// readout are always identical, never two independently-drifting sources.
"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSessionsOnlineNow } from "@/main-chart";

export function ActiveNowTile({ siteId }: { siteId: string }) {
  const onlineNow = useSessionsOnlineNow(siteId);
  const n = onlineNow ?? null;
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            tabIndex={0}
            role="status"
            aria-label={`${n ?? "Loading"} visitors on site right now, live`}
            className="flex h-full min-h-[58px] items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/60 text-base font-bold text-foreground">
              {n ?? "–"}
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
              </span>
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Active now</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Visitors on site right now, live
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
