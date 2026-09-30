// components/charts/MergedReachConversionsChart.tsx
//
// The "merged" view: one chart, one shared date range, both series drawn
// together — not New Reach with conversions stuffed into it or vice versa.
// This is its own chart with its own data-merge step, fetching both
// datasets with the SAME range and zipping them by bucket index (safe
// because buildBuckets() is a pure function of [start, end] — calling it
// twice with an identical range always produces identical bucket
// boundaries/labels, so the two results line up 1:1 without needing to
// match on bucketStart strings).
"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { RefreshCw, TrendingUp } from "lucide-react";
import { DateRangePicker, type DateRange } from "./DateRangePicker";
import { getNewReachOverTime } from "@/lib/actions/reachOverTime.action";
import { getUniqueConversionsOverTime } from "@/lib/actions/conversionsOverTime.action";
import { getCachedChartRange, setCachedChartRange } from "@/lib/chartRangeCache";

const chartConfig: ChartConfig = {
  newVisitors: { label: "New visitors", theme: { light: "#000000", dark: "#ffffff" } },
  uniqueConversions: { label: "Conversions", color: "#eab308" },
};

interface MergedRow {
  label: string;
  newVisitors: number;
  uniqueConversions: number;
}

interface MergedCachePayload {
  rows: MergedRow[];
  empty: boolean;
}

const CACHE_KIND = "merged";

export function MergedReachConversionsChart({ siteId }: { siteId: string }) {
  const [range, setRange] = React.useState<DateRange>({ start: null, end: null });
  const [rows, setRows] = React.useState<MergedRow[] | null>(null);
  const [empty, setEmpty] = React.useState(false);

  // Cache read/write inside the effect only — see NewReachChart's comment
  // for why (this component is server-rendered once before hydration, and
  // localStorage isn't available during that pass).
  React.useEffect(() => {
    let cancelled = false;

    const cached = getCachedChartRange<MergedCachePayload>(CACHE_KIND, siteId, range.start, range.end);
    if (cached && !cached.isStale) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows(cached.data.rows);
      setEmpty(cached.data.empty);
      return; // fresh enough — no network request at all
    }

    Promise.all([getNewReachOverTime(siteId, range.start, range.end), getUniqueConversionsOverTime(siteId, range.start, range.end)])
      .then(([reach, conversions]) => {
        if (cancelled) return;
        const merged = reach.buckets.map((b, i) => ({
          label: b.label,
          newVisitors: b.newVisitors,
          uniqueConversions: conversions.buckets[i]?.uniqueConversions ?? 0,
        }));
        const isEmpty = reach.totalNewVisitors === 0 && conversions.totalUniqueConversions === 0;
        setRows(merged);
        setEmpty(isEmpty);
        setCachedChartRange(CACHE_KIND, siteId, range.start, range.end, { rows: merged, empty: isEmpty });
      })
      .catch((err) => console.error("[MergedReachConversionsChart] fetch failed:", err));
    return () => {
      cancelled = true;
    };
  }, [siteId, range.start, range.end]);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" /> Reach &amp; Conversions
          </CardTitle>
          <CardDescription className="mt-0.5">New visitors and unique conversions, same timeline.</CardDescription>
        </div>
      </div>
      <div className="mt-3">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <div className="mt-3">
        {rows === null ? (
          <div className="flex h-72 items-center justify-center text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
          </div>
        ) : empty ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No activity in this period.</div>
        ) : (
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <AreaChart data={rows} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
              <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <defs>
                <linearGradient id="mergedReachFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-newVisitors)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-newVisitors)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="mergedConversionsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-uniqueConversions)" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="var(--color-uniqueConversions)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="newVisitors" stroke="var(--color-newVisitors)" fill="url(#mergedReachFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="uniqueConversions" stroke="var(--color-uniqueConversions)" fill="url(#mergedConversionsFill)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
