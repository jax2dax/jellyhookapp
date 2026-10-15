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
import { getLeadOriginBreakdown, type AttributionModel, type LeadOriginBreakdownResult } from "@/lib/actions/leadOriginBreakdown.action";
import { oneOf, useUrlState } from "@/lib/urlState";

const chartConfig: ChartConfig = {
  leads: { label: "Leads", color: "#eab308" },
  visitors: { label: "Visitors", color: "#38bdf8" },
};

export function LeadOriginRadarChart({ siteId }: { siteId: string }) {
  const [data, setData] = React.useState<LeadOriginBreakdownResult | null>(null);
  // On by default: every unique visitor's first source next to the leads'. Both are then shares (%) of their own total,
  // otherwise visitors (hundreds) would flatten leads (a handful) to a dot. Off: leads as plain counts.
  const [showVisitors, setShowVisitors] = React.useState(true);
  // the attribution model lives in the address (?origin=last), so a shared link shows the same view
  const [url, setUrl] = useUrlState({ origin: "first" });
  const model: AttributionModel = oneOf(url.origin, ["first", "last"] as const, "first") === "last" ? "lastNonDirect" : "first";

  React.useEffect(() => {
    let cancelled = false;
    getLeadOriginBreakdown(siteId, model)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => console.error("[LeadOriginRadarChart] fetch failed:", err));
    return () => {
      cancelled = true;
    };
  }, [siteId, model]);

  const chartData = React.useMemo(() => {
    if (!data) return [];
    const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
    return data.slices.map((s) =>
      showVisitors ? { source: s.source, leads: pct(s.leads, data.totalLeads), visitors: pct(s.visitors, data.totalVisitors), leadsN: s.leads, visitorsN: s.visitors } : { source: s.source, leads: s.leads, leadsN: s.leads, visitorsN: s.visitors },
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
          {model === "first" ? "Where converted leads first came from (their first visit)" : "What brought converted leads back to convert (their last visit that was not Direct)"}
          {showVisitors && hasVisitors ? ", next to all visitors (shares of each total)" : ""}.
        </CardDescription>
        <div className="mt-2 inline-flex w-fit overflow-hidden rounded-md border text-xs" role="radiogroup" aria-label="Which visit gets the credit">
          {([["first", "First visit"], ["last", "Last non-direct visit"]] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={url.origin === v || (v === "first" && url.origin !== "last")}
              onClick={() => setUrl({ origin: v })}
              className={"px-2.5 py-1 " + ((v === "last") === (model === "lastNonDirect") ? "bg-primary/15 font-medium text-foreground" : "text-muted-foreground hover:bg-muted")}
            >
              {label}
            </button>
          ))}
        </div>
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
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    // with both shapes the numbers are shares of each total: say so, and give the real counts
                    formatter={(value, name, item) => {
                      const row = (item?.payload ?? {}) as { leadsN?: number; visitorsN?: number };
                      const isVisitors = name === "visitors";
                      const n = isVisitors ? row.visitorsN : row.leadsN;
                      const total = isVisitors ? data?.totalVisitors : data?.totalLeads;
                      return (
                        <span className="flex w-full items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            {/* the swatch has the colour of its shape on the chart: blue dashed = visitors, yellow = leads */}
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                              style={isVisitors ? { backgroundColor: "var(--color-visitors)", opacity: 0.85, outline: "1px dashed var(--color-visitors)", outlineOffset: 1 } : { backgroundColor: "var(--color-leads)" }}
                            />
                            {isVisitors ? "Visitors" : "Leads"}
                          </span>
                          <span className="font-mono font-medium tabular-nums">
                            {showVisitors ? value + "%" : String(value)}
                            {showVisitors && <span className="ml-1 font-normal text-muted-foreground">({n} of {total})</span>}
                          </span>
                        </span>
                      );
                    }}
                  />
                }
              />
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
