// components/charts/DateRangePicker.tsx
//
// A free-form date/time range picker — not fixed presets. Defaults to "All
// time" (the entire history, beginning to now); switching to "Custom range"
// reveals two datetime-local inputs, each pickable down to year/month/day/
// time, satisfying "time, day, month, year" granularity without a bespoke
// calendar widget (none exists in this project's UI kit yet).
"use client";

import * as React from "react";
import { Calendar } from "lucide-react";

export interface DateRange {
  /** null = beginning of this site's history */
  start: string | null;
  /** null = now */
  end: string | null;
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  const isCustom = value.start !== null || value.end !== null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={isCustom ? "custom" : "all"}
        onChange={(e) => {
          if (e.target.value === "all") onChange({ start: null, end: null });
          else onChange({ start: new Date(Date.now() - 7 * 86_400_000).toISOString(), end: new Date().toISOString() });
        }}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
      >
        <option value="all">All time</option>
        <option value="custom">Custom range</option>
      </select>
      {isCustom && (
        <>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(value.start)}
            onChange={(e) => onChange({ ...value, start: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(value.end)}
            onChange={(e) => onChange({ ...value, end: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          />
        </>
      )}
    </div>
  );
}
