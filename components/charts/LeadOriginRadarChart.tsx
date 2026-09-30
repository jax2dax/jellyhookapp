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
};

export function LeadOriginRadarChart({ siteId }: { siteId: string }) {
  const [data, setData] = React.useState<LeadOriginBreakdownResult | null>(null);

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

  const chartData = React.useMemo(() => data?.slices.map((s) => ({ source: s.source, leads: s.leads })) ?? [], [data]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <RadarIcon className="h-4 w-4 text-muted-foreground" /> Leads Origin
        </CardTitle>
        <CardDescription className="mt-0.5">Where converted leads came from, first touch only.</CardDescription>
      </CardHeader>
      <CardContent>
        {data === null ? (
          <div className="flex h-72 items-center justify-center text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
          </div>
        ) : data.totalLeads === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No leads yet.</div>
        ) : (
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <RadarChart data={chartData}>
              <ChartTooltip content={<ChartTooltipContent />} />
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="source" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Radar dataKey="leads" stroke="var(--color-leads)" fill="var(--color-leads)" fillOpacity={0.35} strokeWidth={2} />
            </RadarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
