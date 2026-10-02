// components/dashboard/ActiveNowTile.tsx
//
// Replaces the old static "Active Now" tile, which read a one-shot
// getActiveVisitors() server query at page load and never updated again
// without a full reload — while the main chart right below it kept counting
// live. Now reads from the exact same live store the main chart does (see
// useSessionsOnlineNow), so this number and the chart's "N open right now"
// readout are always identical, never two independently-drifting sources.
"use client";

import { Activity } from "lucide-react";
import { StatTile } from "@/components/StatTile";
import { useSessionsOnlineNow } from "@/main-chart";

export function ActiveNowTile({ siteId }: { siteId: string }) {
  const onlineNow = useSessionsOnlineNow(siteId);
  return <StatTile compact icon={Activity} label="Active Now" value={onlineNow ?? "–"} sub="visitors on site right now, live" />;
}
