// components/charts/ChartFacts.tsx
// Two small facts under an area chart's title, replacing the old big
// "Conversion Rate Over Time" cards:
//   - Growth: the most recent interval compared with the first interval of
//     the chosen range, as a percent, with the two numbers ("2 to 0").
//   - In range: the total for the whole chosen range.
// The most recent interval is usually still in progress, so it can look low
// until the interval ends; the (i) says so.
"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";

export function ChartFacts({ values, total, noun, compact = false }: { values: number[]; total: number; noun: string; compact?: boolean }) {
  const first = values.length ? values[0] : null;
  const last = values.length ? values[values.length - 1] : null;
  const hasGrowth = first !== null && last !== null && values.length > 1;

  let growth: { text: string; dir: "up" | "down" | "flat"; detail: string } | null = null;
  if (hasGrowth) {
    if (first === 0) growth = last === 0 ? { text: "0%", dir: "flat", detail: "0 to 0" } : { text: "new", dir: "up", detail: `0 to ${last}` };
    else {
      const pct = ((last! - first!) / first!) * 100;
      growth = { text: `${pct > 0 ? "+" : pct < 0 ? "-" : ""}${Math.abs(pct).toFixed(1)}%`, dir: Math.abs(pct) < 0.05 ? "flat" : pct > 0 ? "up" : "down", detail: `${first} to ${last}` };
    }
  }
  const Arrow = growth?.dir === "up" ? ArrowUpRight : growth?.dir === "down" ? ArrowDownRight : Minus;
  const color = growth?.dir === "up" ? "text-emerald-600 dark:text-emerald-400" : growth?.dir === "down" ? "text-red-600 dark:text-red-400" : "text-muted-foreground";

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-0.5 ${compact ? "text-[11px]" : "text-xs"} text-muted-foreground`}>
      <span>
        In range <span className="font-semibold text-foreground">{total.toLocaleString()}</span> {noun}
      </span>
      {growth && (
        <span className="inline-flex items-center gap-1">
          Growth
          <span className={`inline-flex items-center font-semibold ${color}`}>
            <Arrow className="h-3 w-3" />
            {growth.text}
          </span>
          <span>({growth.detail})</span>
          {!compact && (
            <InfoTip label="About growth">
              Growth compares the most recent interval of this range with the first one (the two numbers in brackets). The most recent interval is usually still in progress, so it can look low until it ends. It is a quick read of direction, not a trend line.
            </InfoTip>
          )}
        </span>
      )}
    </div>
  );
}
