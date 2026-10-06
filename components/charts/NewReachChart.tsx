// components/charts/NewReachChart.tsx
// New unique visitors gained over time — area chart. Fully independent of
// ConversionsAreaChart: own data fetch, own range state, nothing shared
// except the same DateRangePicker control and bucketing shape.
"use client";

import * as React from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { RefreshCw, Users } from "lucide-react";
import { DateRangePicker, type DateRange } from "./DateRangePicker";
import { getNewReachOverTime, type ReachOverTimeResult } from "@/lib/actions/reachOverTime.action";
import { getCachedChartRange, setCachedChartRange, miniRangeStart } from "@/lib/chartRangeCache";

// White in dark mode, black in light mode — inverted from the usual
// convention on purpose (explicit design choice, may change later).
const chartConfig: ChartConfig = {
  newVisitors: { label: "New visitors", theme: { light: "#000000", dark: "#ffffff" } },
};

const CACHE_KIND = "reach";

export function NewReachChart({ siteId, mini = false, embedded = false }: { siteId: string; mini?: boolean; embedded?: boolean }) {
  // mini's start uses miniRangeStart (rounded to a 15-min step, see
  // chartRangeCache.ts) instead of a raw Date.now() offset — a fresh
  // Date.now()-derived value would produce a different cache key on every
  // single mount/reload, defeating the cache before it could ever hit.
  const [range, setRange] = React.useState<DateRange>(() => (mini ? { start: miniRangeStart(3), end: null } : { start: null, end: null }));
  const [data, setData] = React.useState<ReachOverTimeResult | null>(null);

  // Cache read/write happens INSIDE the effect (post-mount), never in a
  // lazy useState initializer — this component is server-rendered once
  // before hydration, and localStorage doesn't exist during that render.
  // Reading it synchronously at init would make the first client render
  // disagree with the server-rendered HTML — the exact hydration bug fixed
  // earlier in LeadSessionExplorer's page_structure cache (see its comment).
  React.useEffect(() => {
    let cancelled = false;

    const cached = getCachedChartRange<ReachOverTimeResult>(CACHE_KIND, siteId, range.start, range.end);
    if (cached && !cached.isStale) {
      // One-shot sync from an external system (localStorage) — not a real
      // cascading-render risk; same justification as LeadSessionExplorer's
      // identical page_structure cache read.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cached.data);
      return; // fresh enough — no network request at all
    }

    getNewReachOverTime(siteId, range.start, range.end)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setCachedChartRange(CACHE_KIND, siteId, range.start, range.end, result);
      })
      .catch((err) => console.error("[NewReachChart] fetch failed:", err));
    return () => {
      cancelled = true;
    };
  }, [siteId, range.start, range.end]);

  const chartData = React.useMemo(() => data?.buckets.map((b) => ({ label: b.label, newVisitors: b.newVisitors })) ?? [], [data]);
  const height = mini ? "h-24" : "h-72";

  const header = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className={mini ? "text-sm flex items-center gap-1.5" : "text-lg flex items-center gap-2"}>
            <Users className="h-3.5 w-3.5 text-muted-foreground" /> New Reach
            <InfoTip label="About New Reach">People visiting your site for the first time ever, per day (or hour). Returning visitors are not counted again. A flat line at 0 means no new visitors.</InfoTip>
          </CardTitle>
          {!mini && <CardDescription className="mt-0.5">New unique visitors gained over time.</CardDescription>}
          {/* Mini has no controls at all, so it says what window it's actually
              showing instead of leaving that to be assumed — must match
              miniRangeStart's own span below, these two are not derived from
              one shared constant. */}
          {mini && <CardDescription className="mt-0 text-[11px]">Last 3 days</CardDescription>}
        </div>
      </div>
      {!mini && (
        <div className="mt-3">
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      )}
    </>
  );

  const body =
    data === null ? (
      <div className={`flex items-center justify-center ${height} text-muted-foreground`}>
        <RefreshCw className="h-4 w-4 animate-spin" />
      </div>
    ) : chartData.length === 0 ? (
      <div className={`flex items-center justify-center ${height} text-sm text-muted-foreground`}>No new visitors in this period.</div>
    ) : (
      // A period with none still draws the chart: a flat line at 0 says
      // "nothing happened" more clearly than an empty box (the caption under
      // it says so in words).
      <div className="relative">
      <ChartContainer config={chartConfig} className={`${height} w-full`}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: mini ? -20 : -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis dataKey="label" tick={mini ? false : { fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} hide={mini} />
          <YAxis allowDecimals={false} domain={[0, (dataMax: number) => Math.max(1, dataMax)]} tick={mini ? false : { fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={mini ? 0 : 28} hide={mini} />
          {!mini && <ChartTooltip content={<ChartTooltipContent />} />}
          <defs>
            <linearGradient id="newReachFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-newVisitors)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-newVisitors)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="newVisitors" stroke="var(--color-newVisitors)" fill="url(#newReachFill)" strokeWidth={2} />
        </AreaChart>
      </ChartContainer>
      {data?.totalNewVisitors === 0 && <p className="mt-1 text-center text-[11px] text-muted-foreground">No new visitors in this period.</p>}
      </div>
    );

  // embedded = no own Card/border — used when a parent container (the
  // split-view layout) supplies one shared card wrapper for both halves,
  // sitting flush against each other with no gap.
  if (embedded) {
    return (
      <div className="p-4">
        {header}
        <div className="mt-3">{body}</div>
      </div>
    );
  }

  const card = (
    <Card className={mini ? "" : "w-full"}>
      <CardHeader className={mini ? "pb-1 pt-3 px-4" : "pb-2"}>{header}</CardHeader>
      <CardContent className={mini ? "px-4 pb-3" : undefined}>{body}</CardContent>
    </Card>
  );

  // mini = the dashboard-overview preview of this chart; the full version
  // lives on /platform/conversions, so the whole tile is a shortcut there.
  if (mini) {
    return (
      <Link href="/platform/conversions" className="block transition-opacity hover:opacity-80">
        {card}
      </Link>
    );
  }
  return card;
}
