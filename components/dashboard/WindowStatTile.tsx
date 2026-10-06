// components/dashboard/WindowStatTile.tsx
// A stat tile with its own time window (last 24 hours / 7 days / 30 days,
// optionally all time) and the change from the window just before it, the
// way Vercel Analytics shows it: "50% (down arrow)", and on hover "50% fewer
// form submissions than the previous 24 hours". The chosen window is
// remembered per tile in this browser.
"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Eye, Minus, Percent, UserCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoTip } from "@/components/InfoTip";
import { getWindowStat, type StatMetric, type StatWindow, type WindowStat } from "@/lib/actions/dashboardStats.action";

// The icon is chosen by NAME: this tile is used from server pages (the
// dashboard), and a component (function) can't be passed from a server
// component to a client component, only plain values like a string.
const ICONS = { eye: Eye, users: Users, userCheck: UserCheck, percent: Percent } as const;
export type TileIcon = keyof typeof ICONS;

const WINDOW_LABEL: Record<StatWindow, { short: string; previous: string }> = {
  "24h": { short: "24 hours", previous: "the previous 24 hours" },
  "7d": { short: "7 days", previous: "the previous 7 days" },
  "30d": { short: "30 days", previous: "the previous 30 days" },
  all: { short: "All time", previous: "" },
};

export function WindowStatTile({
  siteId,
  metric,
  icon,
  label,
  noun,
  info,
  allowAll = false,
  defaultWindow = "24h",
  storageId,
}: {
  siteId: string;
  metric: StatMetric;
  icon: TileIcon;
  label: string;
  /** Plural noun for the hover sentence ("form submissions"). */
  noun: string;
  info: React.ReactNode;
  allowAll?: boolean;
  defaultWindow?: StatWindow;
  /** Remembers this tile's window separately from other tiles of the same metric. */
  storageId?: string;
}) {
  const Icon = ICONS[icon];
  const storageKey = `jh_tile_window_${storageId ?? metric}`;
  const [win, setWin] = React.useState<StatWindow>(defaultWindow);
  const [stat, setStat] = React.useState<WindowStat | null>(null);
  const [failed, setFailed] = React.useState(false);

  // the remembered window (browser storage is an external system)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) as StatWindow | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser storage
      if (saved && (saved !== "all" || allowAll) && WINDOW_LABEL[saved]) setWin(saved);
    } catch {
      /* storage blocked: keep the default */
    }
  }, [storageKey, allowAll]);

  React.useEffect(() => {
    let live = true;
    getWindowStat(siteId, metric, win)
      .then((s) => {
        if (!live) return;
        setStat(s);
        setFailed(false);
      })
      .catch((e) => {
        console.error(`[WindowStatTile] ${metric} ${win}:`, e);
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [siteId, metric, win]);

  const choose = (w: StatWindow) => {
    setWin(w);
    try {
      localStorage.setItem(storageKey, w);
    } catch {
      /* storage blocked */
    }
  };

  const isRate = metric === "conversionRate";
  const shown = stat && stat.window === win ? stat : null;
  const value = shown ? (isRate ? `${shown.current.toFixed(1)}%` : shown.current.toLocaleString()) : failed ? "!" : "–";

  return (
    <Card>
      <CardContent className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{label}</span>
            <InfoTip label={`About ${label}`}>{info}</InfoTip>
          </div>
          <select
            aria-label={`Time window for ${label}`}
            className="h-6 shrink-0 rounded border bg-background px-1 text-[11px] text-muted-foreground"
            value={win}
            onChange={(e) => choose(e.target.value as StatWindow)}
          >
            <option value="24h">24h</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            {allowAll && <option value="all">All time</option>}
          </select>
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <p className="text-lg font-bold leading-tight text-foreground" title={failed ? "Couldn't load this number. Try reloading." : undefined}>
            {value}
          </p>
          {shown && shown.previous !== null && <Trend stat={shown} noun={noun} />}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {shown?.detail ?? (win === "all" ? "all time" : `last ${WINDOW_LABEL[win].short}`)}
        </p>
      </CardContent>
    </Card>
  );
}

/** "50% (down)" with the full sentence on hover. Rates change in percentage points. */
function Trend({ stat, noun }: { stat: WindowStat; noun: string }) {
  const prev = stat.previous!;
  const cur = stat.current;
  const isRate = stat.metric === "conversionRate";
  const period = WINDOW_LABEL[stat.window].previous;
  let text: string;
  let sentence: string;
  let dir: "up" | "down" | "flat";
  if (isRate) {
    const pts = cur - prev;
    dir = Math.abs(pts) < 0.05 ? "flat" : pts > 0 ? "up" : "down";
    text = dir === "flat" ? "0 pts" : `${Math.abs(pts).toFixed(1)} pts`;
    sentence = dir === "flat" ? `The same conversion rate as ${period} (${prev.toFixed(1)}%)` : `${Math.abs(pts).toFixed(1)} percentage points ${dir === "up" ? "higher" : "lower"} than ${period} (${prev.toFixed(1)}%)`;
  } else if (prev === 0) {
    dir = cur > 0 ? "up" : "flat";
    text = cur > 0 ? "new" : "0%";
    sentence = cur > 0 ? `No ${noun} in ${period}, ${cur.toLocaleString()} now` : `No ${noun} in this period or ${period}`;
  } else {
    const pct = ((cur - prev) / prev) * 100;
    dir = Math.abs(pct) < 0.5 ? "flat" : pct > 0 ? "up" : "down";
    text = `${Math.abs(Math.round(pct))}%`;
    sentence = dir === "flat" ? `About the same number of ${noun} as ${period} (${prev.toLocaleString()})` : `${Math.abs(Math.round(pct))}% ${dir === "up" ? "more" : "fewer"} ${noun} than ${period} (${prev.toLocaleString()})`;
  }
  const Arrow = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const color = dir === "up" ? "text-emerald-600 dark:text-emerald-400" : dir === "down" ? "text-red-600 dark:text-red-400" : "text-muted-foreground";
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${color}`} aria-label={sentence}>
            <Arrow className="h-3 w-3" />
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{sentence}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
