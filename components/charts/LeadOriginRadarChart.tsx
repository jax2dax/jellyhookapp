// components/charts/LeadOriginRadarChart.tsx
// Where converted leads actually came from, first touch — a fixed number
// of axes (see lib/actions/leadOriginBreakdown.action.ts) so the shape
// stays visually stable as real sources replace placeholder ones over
// time, instead of the polygon growing/shrinking axis count.
"use client";

import * as React from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { RefreshCw, Radar as RadarIcon } from "lucide-react";
import { getLeadOriginBreakdown, type LeadOriginBreakdownResult } from "@/lib/actions/leadOriginBreakdown.action";

const chartConfig: ChartConfig = {
  leads: { label: "Leads", color: "#eab308" },
  visitors: { label: "Visitors", color: "#38bdf8" },
};

export function LeadOriginRadarChart({ siteId }: { siteId: string }) {
  const [data, setData] = React.useState<LeadOriginBreakdownResult | null>(null);
  // On by default: every unique visitor's first source next to the leads'. Both are then shares (%) of their own total,
  // otherwise visitors (hundreds) would flatten leads (a handful) to a dot. Off: leads as plain counts.
  const [showVisitors, setShowVisitors] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    getLeadOriginBreakdown(siteId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => console.error("[LeadOriginRadarChart] fetch failed:", err));
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const chartData = React.useMemo(() => {
    if (!data) return [];
    const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
    return data.slices.map((s) =>
      showVisitors ? { source: s.source, leads: pct(s.leads, data.totalLeads), visitors: pct(s.visitors, data.totalVisitors) } : { source: s.source, leads: s.leads },
    );
  }, [data, showVisitors]);
  const hasVisitors = (data?.totalVisitors ?? 0) > 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <RadarIcon className="h-4 w-4 text-muted-foreground" /> Leads Origin
        </CardTitle>
        <CardDescription className="mt-0.5">
          Where converted leads came from, first touch only{showVisitors && hasVisitors ? ", next to where every visitor came from (shares of each total)" : ""}.
        </CardDescription>
        <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showVisitors} onChange={(e) => setShowVisitors(e.target.checked)} />
          Show where all unique visitors came from
        </label>
      </CardHeader>
      <CardContent>
        {data === null ? (
          <div className="flex h-72 items-center justify-center text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
          </div>
        ) : data.totalLeads === 0 && !(showVisitors && hasVisitors) ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No leads yet.</div>
        ) : (
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <RadarChart data={chartData}>
              <ChartTooltip content={<ChartTooltipContent />} />
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="source" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              {showVisitors && hasVisitors && <Radar dataKey="visitors" stroke="var(--color-visitors)" fill="var(--color-visitors)" fillOpacity={0.15} strokeWidth={1.5} strokeDasharray="4 3" />}
              <Radar dataKey="leads" stroke="var(--color-leads)" fill="var(--color-leads)" fillOpacity={0.35} strokeWidth={2} />
            </RadarChart>
          </ChartContainer>
        )}
        {data && showVisitors && hasVisitors && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Shares of {data.totalLeads} lead{data.totalLeads === 1 ? "" : "s"} (yellow) and {data.totalVisitors.toLocaleString()} visitors (blue, dashed). A source where yellow reaches further than blue turns visitors into leads better than average.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
