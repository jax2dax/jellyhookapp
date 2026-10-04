// jh-hook/units.ts
// The user types "5 sec" or "2 min"; the database stores milliseconds
// (page_views.time_on_page is Date.now() - startTime, see public/tracker.js).
// Converting is the engine's job, before any SQL is built.
import type { DurationUnit, RelativeUnit } from "./types";

export const DURATION_MS: Record<DurationUnit, number> = { ms: 1, sec: 1000, min: 60_000, hr: 3_600_000, day: 86_400_000 };
export const RELATIVE_UNITS: readonly RelativeUnit[] = ["minute", "hour", "day", "week", "month"];

export function toMs(amount: number, unit: DurationUnit): number {
  const f = DURATION_MS[unit];
  if (f === undefined) throw new Error(`Unknown duration unit: ${String(unit)}`);
  if (!Number.isFinite(amount)) throw new Error("Duration must be a number");
  return Math.round(amount * f);
}

/** Largest unit that keeps the number readable: 1500 -> "1.5 sec". */
export function formatMs(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "empty";
  const abs = Math.abs(ms);
  const [unit, f] = abs >= 86_400_000 ? ["day", 86_400_000] : abs >= 3_600_000 ? ["hr", 3_600_000] : abs >= 60_000 ? ["min", 60_000] : abs >= 1000 ? ["sec", 1000] : ["ms", 1];
  return `${+(ms / (f as number)).toFixed(2)} ${unit}`;
}
