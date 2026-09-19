// components/charts/leadEngagementRadial.tsx
// Radial gauge for the lead's 0-100 engagement score (lib/algorithms/leadProfile.js).
// Single-series magnitude encoding — one hue (primary), track in muted — with
// the score itself as the direct label so the chart reads with no legend.

"use client";

import * as React from "react";
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

export function LeadEngagementRadial({ score, label = "Engagement" }: { score: number; label?: string }) {
  const data = [{ name: label, value: score, fill: "var(--primary)" }];

  return (
    <div className="relative" style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          startAngle={90}
          endAngle={-270}
          innerRadius="72%"
          outerRadius="100%"
          barSize={12}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "var(--muted)" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}
