// components/charts/leadTimeBar.tsx
// Horizontal "time spent per page" bar chart — the visual centerpiece of the
// Lead Profile page's path-to-conversion section. One bar per page visit,
// bar length = time on page (a single-hue magnitude encoding, per the
// dataviz sequential-color rule). The page the lead actually converted on
// is drawn at full opacity; everything before it fades back, so the eye
// lands on the moment that mattered.

"use client";

import * as React from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDuration } from "@/lib/leadFormat";

export interface LeadTimeBarDatum {
  label: string;
  timeMs: number;
  scrollDepthPct?: number | null;
  visitNumber?: number;
  highlight?: boolean;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: LeadTimeBarDatum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="max-w-64 rounded-lg border bg-card text-card-foreground shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-foreground break-all">{d.label}</p>
      <p className="text-muted-foreground mt-0.5">
        <span className="font-bold text-foreground">{formatDuration(d.timeMs)}</span> on page
        {d.scrollDepthPct != null && <> · {d.scrollDepthPct}% scrolled</>}
        {d.visitNumber != null && <> · visit #{d.visitNumber}</>}
      </p>
      {d.highlight && <p className="text-primary text-xs mt-0.5 font-medium">Converted here</p>}
    </div>
  );
}

function truncate(label: string, max = 28) {
  if (!label) return "(unknown page)";
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

// The card this chart lives in must never grow without bound as a lead
// visits more and more pages. Rows stay a fixed, legible height — instead of
// shrinking them to fit (which made hover targets thin and, combined with
// the duplicate-category bug below, produced visibly wrong tooltip data),
// the VISIBLE area caps at MAX_VISIBLE_HEIGHT and scrolls vertically once a
// session has more pages than that.
const MIN_HEIGHT = 96;
const MAX_VISIBLE_HEIGHT = 208;
const CHART_PADDING = 16;
const ROW_HEIGHT = 34;
const BAR_SIZE = 18;

export function LeadTimeBar({ data }: { data: LeadTimeBarDatum[] }) {
  if (!data.length) {
    return <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">No page activity recorded.</div>;
  }

  // Recharts' category axis dedupes rows that share the same dataKey VALUE —
  // two visits to the same page path (very common in a path-to-conversion,
  // e.g. a visitor bouncing back to /pricing) would otherwise collapse onto
  // ONE tick, so hovering the tallest bar could resolve to whichever OTHER
  // row happened to share its label, showing that row's (often much
  // shorter) duration instead — this is exactly the "says 0 visits on the
  // longest bar" bug. Giving every row a unique `rowId` for the axis key,
  // and rendering the human-readable text via tickFormatter, keeps every
  // row addressable on its own regardless of duplicate page paths.
  const chartData = data.map((d, i) => ({ ...d, rowId: `row-${i}`, displayLabel: truncate(d.label) }));
  const labelByRowId = new Map(chartData.map((d) => [d.rowId, d.displayLabel]));

  const contentHeight = chartData.length * ROW_HEIGHT + CHART_PADDING;
  const visibleHeight = Math.min(MAX_VISIBLE_HEIGHT, Math.max(MIN_HEIGHT, contentHeight));
  const scrollable = contentHeight > MAX_VISIBLE_HEIGHT;

  return (
    <div style={{ width: "100%", height: visibleHeight, overflowY: scrollable ? "auto" : "hidden" }}>
      <div style={{ width: "100%", height: contentHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap="22%">
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="rowId"
              tickFormatter={(rowId: string) => labelByRowId.get(rowId) ?? ""}
              width={140}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
            <Bar dataKey="timeMs" radius={[0, 4, 4, 0]} barSize={BAR_SIZE}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="var(--primary)" opacity={entry.highlight ? 1 : 0.45} />
              ))}
              <LabelList
                dataKey="timeMs"
                position="right"
                formatter={(v: React.ReactNode) => formatDuration(Number(v))}
                style={{ fill: "var(--foreground)", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
