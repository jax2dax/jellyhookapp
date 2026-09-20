// components/charts/pageViewsBar.tsx
// "How many people are looking at each page" — one horizontal bar per page,
// bar length = view count, with unique-visitor count and engagement shown
// alongside. Same visual language as leadTimeBar.tsx (single-hue magnitude
// encoding) but for raw counts instead of durations.
"use client";

import * as React from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface PageViewsBarDatum {
  page_path: string;
  views: number;
  uniqueVisitors: number;
  avgTimeMs?: number | null;
  avgScrollPct?: number | null;
}

function formatDuration(ms?: number | null) {
  if (ms == null) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function truncate(label: string, max = 30) {
  if (!label) return "(unknown page)";
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: PageViewsBarDatum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const avgTime = formatDuration(d.avgTimeMs);
  return (
    <div className="max-w-64 rounded-lg border bg-card text-card-foreground shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-foreground break-all">{d.page_path}</p>
      <p className="text-muted-foreground mt-0.5">
        <span className="font-bold text-foreground">{d.views}</span> view{d.views !== 1 ? "s" : ""} ·{" "}
        <span className="font-bold text-foreground">{d.uniqueVisitors}</span> visitor{d.uniqueVisitors !== 1 ? "s" : ""}
      </p>
      {(avgTime || d.avgScrollPct != null) && (
        <p className="text-muted-foreground text-xs mt-0.5">
          {avgTime && <>avg {avgTime} on page</>}
          {avgTime && d.avgScrollPct != null && " · "}
          {d.avgScrollPct != null && <>{d.avgScrollPct}% scroll</>}
        </p>
      )}
    </div>
  );
}

export function PageViewsBar({ data }: { data: PageViewsBarDatum[] }) {
  if (!data.length) {
    return <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">No page views recorded yet.</div>;
  }

  const chartData = data.map((d) => ({ ...d, displayLabel: truncate(d.page_path) }));
  const height = Math.max(140, chartData.length * 34 + 16);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 32, left: 4, bottom: 4 }} barCategoryGap="22%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="displayLabel" width={160} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar dataKey="views" radius={[0, 4, 4, 0]} maxBarSize={18} fill="var(--primary)">
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill="var(--primary)" opacity={index === 0 ? 1 : Math.max(0.35, 1 - index * 0.08)} />
            ))}
            <LabelList dataKey="views" position="right" style={{ fill: "var(--foreground)", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
