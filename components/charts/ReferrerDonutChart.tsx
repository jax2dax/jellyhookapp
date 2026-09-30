// components/charts/ReferrerDonutChart.tsx
// Interactive donut — hover a slice (or its legend row) to highlight it.
// Center text always shows the total, same as shadcn's donut-with-text
// pattern. Long tail beyond the top 7 sources collapses into "Other" so
// the chart stays legible instead of a ring of slivers.
"use client";

import * as React from "react";
import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { RefreshCw, PieChart as PieIcon } from "lucide-react";
import { getReferrerBreakdown, type ReferrerBreakdownResult } from "@/lib/actions/referrerBreakdown.action";

const PALETTE = ["#eab308", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#06b6d4", "#f97316", "#6b7280"];
const MAX_SLICES = 7;

export function ReferrerDonutChart({ siteId }: { siteId: string }) {
  const [data, setData] = React.useState<ReferrerBreakdownResult | null>(null);
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    getReferrerBreakdown(siteId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => console.error("[ReferrerDonutChart] fetch failed:", err));
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const { chartData, config } = React.useMemo(() => {
    if (!data) return { chartData: [], config: {} as ChartConfig };
    const top = data.slices.slice(0, MAX_SLICES);
    const rest = data.slices.slice(MAX_SLICES);
    const otherCount = rest.reduce((sum, s) => sum + s.uniqueVisitors, 0);
    const slices = otherCount > 0 ? [...top, { source: "Other", uniqueVisitors: otherCount }] : top;

    const cfg: ChartConfig = {};
    const rows = slices.map((s, i) => {
      const key = s.source.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      cfg[key] = { label: s.source, color: PALETTE[i % PALETTE.length] };
      return { key, source: s.source, uniqueVisitors: s.uniqueVisitors, fill: PALETTE[i % PALETTE.length] };
    });
    return { chartData: rows, config: cfg };
  }, [data]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-muted-foreground" /> Referrers
        </CardTitle>
        <CardDescription className="mt-0.5">Where new unique visitors actually came from — first touch, not every repeat visit.</CardDescription>
      </CardHeader>
      <CardContent>
        {data === null ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No sessions recorded yet.</div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
            <ChartContainer config={config} className="h-64 w-64 shrink-0">
              <PieChart>
                <Pie data={chartData} dataKey="uniqueVisitors" nameKey="source" innerRadius={65} outerRadius={95} strokeWidth={2}>
                  {chartData.map((row, i) => (
                    <Cell
                      key={row.key}
                      fill={row.fill}
                      opacity={activeIndex === undefined || activeIndex === i ? 1 : 0.35}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(undefined)}
                    />
                  ))}
                </Pie>
                <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">
                  {data.totalUniqueVisitors}
                </text>
                <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">
                  unique visitors
                </text>
              </PieChart>
            </ChartContainer>

            <ul className="w-full min-w-0 space-y-1.5 sm:w-56">
              {chartData.map((row, i) => {
                const pct = data.totalUniqueVisitors > 0 ? Math.round((row.uniqueVisitors / data.totalUniqueVisitors) * 100) : 0;
                return (
                  <li
                    key={row.key}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseLeave={() => setActiveIndex(undefined)}
                    className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm transition-colors ${activeIndex === i ? "bg-muted" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} />
                      <span className="truncate text-foreground">{row.source}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {row.uniqueVisitors} · {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
