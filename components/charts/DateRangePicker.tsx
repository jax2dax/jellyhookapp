// components/charts/DateRangePicker.tsx
//
// Quick presets (last 24 hours / 7 days / month) plus "All time" and a
// free-form "Custom range" chosen on the app's calendar
// (components/ui/DateRangeField.tsx), down to the minute.
//
// Which preset is selected is tracked in its OWN state here, separate from
// the `start`/`end` values the parent sees. Deriving "which preset is
// active" FROM start/end would be ambiguous: a custom range that happens
// to span exactly 7 days looks identical, in start/end terms, to picking
// "Last 7 days". Keeping an explicit mode is what lets the dropdown show
// the right option without that guess.
"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import { DateRangeField } from "@/components/ui/DateRangeField";
import { isoToLocal, localToIso } from "@/lib/dateLocal";

export interface DateRange {
  /** null = beginning of this site's history (when mode is "all"), or an explicit instant otherwise */
  start: string | null;
  /** null = now */
  end: string | null;
}

type PresetMode = "all" | "24h" | "7d" | "1m" | "custom";

const PRESET_OPTIONS: { value: PresetMode; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "1m", label: "Last month" },
  { value: "custom", label: "Custom range" },
];

function rangeForPreset(mode: PresetMode): DateRange {
  if (mode === "all") return { start: null, end: null };
  const days = mode === "24h" ? 1 : mode === "7d" ? 7 : 30;
  return { start: new Date(Date.now() - days * 86_400_000).toISOString(), end: null };
}

export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  // Only the INITIAL mode is derived from the incoming value (so a parent
  // that defaults to "all time" renders correctly on first paint); every
  // change after that comes from this component's own selection, not a
  // re-derivation that could misread a since-changed value.
  const [mode, setMode] = React.useState<PresetMode>(() => (value.start === null && value.end === null ? "all" : "custom"));

  function handleModeChange(next: PresetMode) {
    setMode(next);
    if (next === "custom") {
      // Seed the two inputs with a sensible default range instead of
      // opening empty, same default window "Last 7 days" below would give.
      onChange({ start: new Date(Date.now() - 7 * 86_400_000).toISOString(), end: new Date().toISOString() });
    } else {
      onChange(rangeForPreset(next));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={mode}
        onChange={(e) => handleModeChange(e.target.value as PresetMode)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
      >
        {PRESET_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {mode === "custom" && (
        <DateRangeField
          start={isoToLocal(value.start)}
          end={isoToLocal(value.end)}
          onChange={(s, e) => onChange({ start: localToIso(s), end: localToIso(e) })}
          placeholder="Pick a range"
          aria-label="Custom date range"
        />
      )}
    </div>
  );
}
