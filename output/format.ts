// output/format.ts
// How values read on screen, by type. Shared by the canvas and the Hook
// workspace so a duration, a percent or a date looks the same everywhere.
import type { FieldType } from "../jh-hook/schema";
import { formatMs } from "../jh-hook/units";

export function formatValue(v: number | string | null | undefined, t: FieldType): string {
  if (v == null) return "empty";
  if (typeof v === "string") return t === "time" ? formatDate(v) : v;
  if (t === "duration") return formatMs(v);
  if (t === "percent") return `${+v.toFixed(2)}%`;
  if (t === "px") return `${Math.round(v)} px`;
  return Number.isInteger(v) ? v.toLocaleString() : (+v.toFixed(4)).toLocaleString();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
