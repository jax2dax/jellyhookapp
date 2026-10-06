// components/charts/ConversionsAreaChart.tsx
// Unique conversions over time — area chart. Fully independent of
// NewReachChart: own data fetch, own range state. Only the DateRangePicker
// control and bucketing shape are shared, not any state or logic.
"use client";

import * as React from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { ChartFacts } from "./ChartFacts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { RefreshCw, UserCheck } from "lucide-react";
import { DateRangePicker, type DateRange } from "./DateRangePicker";
import { getUniqueConversionsOverTime, type ConversionsOverTimeResult } from "@/lib/actions/conversionsOverTime.action";
import { getCachedChartRange, setCachedChartRange, miniRangeStart } from "@/lib/chartRangeCache";

// Fixed yellow — matches the "converted" color used everywhere else in the
// app (FramePlate's converted bulb/frame), not theme-linked like New Reach.
const chartConfig: ChartConfig = {
  uniqueConversions: { label: "Conversions", color: "#eab308" },
};

const CACHE_KIND = "conversions";

export function ConversionsAreaChart({ siteId, mini = false, embedded = false }: { siteId: string; mini?: boolean; embedded?: boolean }) {
  const [range, setRange] = React.useState<DateRange>(() => (mini ? { start: miniRangeStart(3), end: null } : { start: null, end: null }));
  const [data, setData] = React.useState<ConversionsOverTimeResult | null>(null);

  // See NewReachChart's identical comment: cache read/write happens inside
  // the effect, never in a lazy useState initializer (localStorage doesn't
  // exist during this component's one server-rendered pass, and reading it
  // synchronously at init would desync that render from hydration).
  React.useEffect(() => {
    let cancelled = false;

    const cached = getCachedChartRange<ConversionsOverTimeResult>(CACHE_KIND, siteId, range.start, range.end);
    if (cached && !cached.isStale) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cached.data);
      return; // fresh enough — no network request at all
    }

    getUniqueConversionsOverTime(siteId, range.start, range.end)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setCachedChartRange(CACHE_KIND, siteId, range.start, range.end, result);
      })
      .catch((err) => console.error("[ConversionsAreaChart] fetch failed:", err));
    return () => {
      cancelled = true;
    };
  }, [siteId, range.start, range.end]);

  const chartData = React.useMemo(() => data?.buckets.map((b) => ({ label: b.label, uniqueConversions: b.uniqueConversions })) ?? [], [data]);
  const height = mini ? "h-24" : "h-72";

  const header = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className={mini ? "text-sm flex items-center gap-1.5" : "text-lg flex items-center gap-2"}>
            <UserCheck className="h-3.5 w-3.5 text-muted-foreground" /> Conversions
            <InfoTip label="About Conversions">Different people who submitted a form, per day (or hour). A person who submits several times in one period counts once. A flat line at 0 means nobody converted.</InfoTip>
          </CardTitle>
          {!mini && <CardDescription className="mt-0.5">Unique visitors who converted over time.</CardDescription>}
          {/* Mini has no controls at all, so it says what window it's actually
              showing instead of leaving that to be assumed — must match
              miniRangeStart's own span below, these two are not derived from
              one shared constant. */}
          {mini && <CardDescription className="mt-0 text-[11px]">Last 3 days</CardDescription>}
          {data && (
            <div className="mt-1">
              <ChartFacts values={data.buckets.map((b) => b.uniqueConversions)} total={data.totalUniqueConversions} noun="conversions" compact={mini} />
            </div>
          )}
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
      <div className={`flex items-center justify-center ${height} text-sm text-muted-foreground`}>No conversions in this period.</div>
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
            <linearGradient id="conversionsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-uniqueConversions)" stopOpacity={0.45} />
              <stop offset="95%" stopColor="var(--color-uniqueConversions)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="uniqueConversions" stroke="var(--color-uniqueConversions)" fill="url(#conversionsFill)" strokeWidth={2} />
        </AreaChart>
      </ChartContainer>
      {data?.totalUniqueConversions === 0 && <p className="mt-1 text-center text-[11px] text-muted-foreground">No conversions in this period.</p>}
      </div>
    );

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
