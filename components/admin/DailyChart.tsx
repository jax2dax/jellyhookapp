"use client";
// components/admin/DailyChart.tsx
// One day-by-day chart of the control room (app/admin): a few series from jh_admin_daily, drawn as lines. Durations are
// shown in seconds. Uses the app's chart frame (components/ui/chart.tsx) so it matches the rest of Jellyhook.
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { count } from "@/lib/admin/format";

export function DailyChart({ title, data, series, unit }: { title: string; data: Record<string, unknown>[]; series: { key: string; label: string; color: string }[]; unit?: "s" }) {
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));
  const rows = data.map((d) => {
    const out: Record<string, unknown> = { day: String(d.day).slice(5) };
    for (const s of series) {
      const v = d[s.key];
      out[s.key] = v === null || v === undefined ? null : unit === "s" ? Math.round((Number(v) / 1000) * 10) / 10 : Number(v);
    }
    return out;
  });
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.label}
              {unit === "s" ? " (s)" : ""}
            </span>
          ))}
        </div>
      </div>
      <ChartContainer config={config} className="h-44 w-full">
        <LineChart data={rows} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} tickFormatter={(v: number) => (unit === "s" ? String(v) : count(v))} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false} connectNulls />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}
