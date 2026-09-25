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
// visits more and more pages — cap the total height, and once a session has
// enough visits to hit that cap, shrink every row (and the bars within them)
// proportionally instead of letting rows overflow or get clipped. A row
// never shrinks below MIN_ROW_HEIGHT — beyond that point the chart is simply
// as dense as it can legibly get, capped height or not.
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 360;
const CHART_PADDING = 16;
const BASE_ROW_HEIGHT = 34;
const MIN_ROW_HEIGHT = 13;

export function LeadTimeBar({ data }: { data: LeadTimeBarDatum[] }) {
  if (!data.length) {
    return <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">No page activity recorded.</div>;
  }

  const chartData = data.map((d) => ({ ...d, displayLabel: truncate(d.label) }));

  const uncappedHeight = chartData.length * BASE_ROW_HEIGHT + CHART_PADDING;
  const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, uncappedHeight));
  // Once rows no longer fit at BASE_ROW_HEIGHT within MAX_HEIGHT, shrink
  // every row down to whatever height actually fits (never below
  // MIN_ROW_HEIGHT) — this is what keeps the card's height itself bounded.
  const rowHeight = uncappedHeight > MAX_HEIGHT ? Math.max(MIN_ROW_HEIGHT, (MAX_HEIGHT - CHART_PADDING) / chartData.length) : BASE_ROW_HEIGHT;
  const compact = rowHeight < BASE_ROW_HEIGHT;
  const barSize = Math.max(3, Math.min(18, rowHeight * 0.55));
  const tickFontSize = rowHeight < 20 ? 9 : 11;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap={compact ? 2 : "22%"}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="displayLabel"
            width={140}
            tick={{ fill: "var(--muted-foreground)", fontSize: tickFontSize }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar dataKey="timeMs" radius={[0, 4, 4, 0]} barSize={barSize}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="var(--primary)" opacity={entry.highlight ? 1 : 0.45} />
            ))}
            {!compact && (
              <LabelList
                dataKey="timeMs"
                position="right"
                formatter={(v: React.ReactNode) => formatDuration(Number(v))}
                style={{ fill: "var(--foreground)", fontSize: 11 }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
