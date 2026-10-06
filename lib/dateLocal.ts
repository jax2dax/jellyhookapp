// lib/dateLocal.ts
// The app's date inputs speak one format: a LOCAL date-time string,
// "YYYY-MM-DDTHH:mm" (what <input type="datetime-local"> used to give), or
// "YYYY-MM-DD" for date-only fields. These helpers convert to and from Date
// and ISO instants, always in the viewer's own time zone. Used by the range
// calendar (components/ui/DateRangeField.tsx) and every caller of it.

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-01T09:30" or "2026-10-01" -> a Date in local time, or null if empty or invalid. */
export function parseLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatLocal(d: Date, withTime = true): string {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

export function isoToLocal(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : formatLocal(d, withTime);
}

export function localToIso(value: string | null | undefined): string | null {
  const d = parseLocal(value);
  return d ? d.toISOString() : null;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59);
}
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

/** "Oct 1, 2026, 9:30 AM" or "Oct 1, 2026" */
export function prettyLocal(value: string | null | undefined, withTime = true): string {
  const d = parseLocal(value);
  if (!d) return "";
  return d.toLocaleString(undefined, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}
