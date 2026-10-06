// components/ui/DateRangeField.tsx
// The app's calendar for every custom date or range, replacing the browser's
// default date inputs. A button shows the chosen range; clicking it opens a
// calendar popover:
//   - click a day, then another day, to pick a range (hover previews it);
//   - or click once and it is a single day (mode="single");
//   - quick picks: Today, Yesterday, Last 7 days, Last 30 days, This month;
//   - optional start / end times (withTime);
//   - keyboard: arrow keys move by day and week, Page Up / Page Down change
//     month, Enter or Space picks, Escape closes.
// Values are LOCAL strings, "YYYY-MM-DDTHH:mm" (or "YYYY-MM-DD" without
// time), see lib/dateLocal.ts, the same shape the old datetime-local inputs
// gave, so callers swap it in without changing their own logic.
"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, endOfDay, formatLocal, parseLocal, prettyLocal, sameDay, startOfDay } from "@/lib/dateLocal";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface Props {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  /** single: pick one moment (end follows start). range: pick two. */
  mode?: "single" | "range";
  withTime?: boolean;
  placeholder?: string;
  className?: string;
  /** Latest selectable day (default: no limit). */
  max?: Date;
  "aria-label"?: string;
}

/** The 6 weeks (42 days) shown for a month, starting on Sunday. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const lead = first.getDay();
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - lead + i));
}

export function DateRangeField({ start, end, onChange, mode = "range", withTime = true, placeholder = "Pick a date", className, max, ...rest }: Props) {
  const [open, setOpen] = React.useState(false);
  const s = parseLocal(start);
  const e = parseLocal(end);

  const label = !s ? placeholder : mode === "single" || !e ? prettyLocal(start, withTime) : `${prettyLocal(start, withTime)} to ${prettyLocal(end, withTime)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={rest["aria-label"] ?? "Choose dates"}
          className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs text-foreground hover:bg-muted ${className ?? ""}`}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[19rem]">
        <CalendarBody start={s} end={e} mode={mode} withTime={withTime} max={max} onChange={(a, b) => onChange(formatLocal(a, withTime), formatLocal(b, withTime))} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function CalendarBody({
  start,
  end,
  mode,
  withTime,
  max,
  onChange,
  onDone,
}: {
  start: Date | null;
  end: Date | null;
  mode: "single" | "range";
  withTime: boolean;
  max?: Date;
  onChange: (a: Date, b: Date) => void;
  onDone: () => void;
}) {
  const [view, setView] = React.useState(() => {
    const d = start ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [focused, setFocused] = React.useState<Date>(() => start ?? new Date());
  const [anchor, setAnchor] = React.useState<Date | null>(null); // first click of a range, waiting for the second
  const [hover, setHover] = React.useState<Date | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const today = new Date();
  const days = React.useMemo(() => monthGrid(view.getFullYear(), view.getMonth()), [view]);

  const startTime = start ? formatLocal(start).slice(11) : "00:00";
  const endTime = end ? formatLocal(end).slice(11) : "23:59";
  const withT = (d: Date, hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0);
  };
  const disabled = (d: Date) => !!max && startOfDay(d) > startOfDay(max);

  const emit = (a: Date, b: Date) => onChange(a <= b ? a : b, a <= b ? b : a);

  const pick = (d: Date) => {
    if (disabled(d)) return;
    if (mode === "single") {
      emit(withT(d, startTime), withT(d, startTime));
      onDone();
      return;
    }
    if (!anchor) {
      setAnchor(d);
      emit(withT(d, startTime), withT(d, endTime));
      return;
    }
    const [a, b] = d < anchor ? [d, anchor] : [anchor, d];
    emit(withT(a, startTime), withT(b, endTime));
    setAnchor(null);
    setHover(null);
  };

  const quick = (a: Date, b: Date) => {
    emit(withT(a, startTime), withT(b, endTime));
    setAnchor(null);
    setView(new Date(a.getFullYear(), a.getMonth(), 1));
    setFocused(a);
  };

  // the range shown: the saved one, or the in-progress one with hover preview
  const shownA = anchor ?? start;
  const shownB = anchor ? (hover ?? anchor) : end;
  const lo = shownA && shownB ? (shownA <= shownB ? shownA : shownB) : shownA;
  const hi = shownA && shownB ? (shownA <= shownB ? shownB : shownA) : shownA;
  const inRange = (d: Date) => !!lo && !!hi && startOfDay(d) >= startOfDay(lo) && startOfDay(d) <= startOfDay(hi);

  const move = (d: Date) => {
    setFocused(d);
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) setView(new Date(d.getFullYear(), d.getMonth(), 1));
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus());
  };
  const onKey = (ev: React.KeyboardEvent) => {
    const k = ev.key;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (k in step) {
      ev.preventDefault();
      move(addDays(focused, step[k]));
    } else if (k === "PageUp" || k === "PageDown") {
      ev.preventDefault();
      move(new Date(focused.getFullYear(), focused.getMonth() + (k === "PageUp" ? -1 : 1), Math.min(focused.getDate(), 28)));
    } else if (k === "Home") {
      ev.preventDefault();
      move(addDays(focused, -focused.getDay()));
    } else if (k === "End") {
      ev.preventDefault();
      move(addDays(focused, 6 - focused.getDay()));
    }
  };

  const prevMonth = () => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1));
  const nextMonth = () => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1));

  return (
    <div className="space-y-2.5 text-sm">
      {mode === "range" && (
        <div className="flex flex-wrap gap-1">
          {[
            ["Today", () => quick(startOfDay(today), endOfDay(today))],
            ["Yesterday", () => quick(startOfDay(addDays(today, -1)), endOfDay(addDays(today, -1)))],
            ["Last 7 days", () => quick(startOfDay(addDays(today, -6)), endOfDay(today))],
            ["Last 30 days", () => quick(startOfDay(addDays(today, -29)), endOfDay(today))],
            ["This month", () => quick(new Date(today.getFullYear(), today.getMonth(), 1), endOfDay(today))],
          ].map(([name, fn]) => (
            <button key={name as string} type="button" onClick={fn as () => void} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
              {name as string}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth} aria-label="Previous month" className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="font-medium" aria-live="polite">
          {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </div>
        <button type="button" onClick={nextMonth} aria-label="Next month" className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div role="grid" aria-label="Calendar" ref={gridRef} onKeyDown={onKey} onMouseLeave={() => setHover(null)} className="grid grid-cols-7 gap-y-0.5">
        {WEEKDAYS.map((w) => (
          <div key={w} role="columnheader" className="pb-1 text-center text-[11px] text-muted-foreground">
            {w}
          </div>
        ))}
        {days.map((d) => {
          const outside = d.getMonth() !== view.getMonth();
          const isLo = !!lo && sameDay(d, lo);
          const isHi = !!hi && sameDay(d, hi);
          const edge = isLo || isHi;
          const mid = inRange(d) && !edge;
          const isFocus = sameDay(d, focused);
          return (
            <button
              key={d.toISOString()}
              type="button"
              role="gridcell"
              tabIndex={isFocus ? 0 : -1}
              disabled={disabled(d)}
              aria-selected={inRange(d)}
              aria-label={d.toLocaleDateString(undefined, { dateStyle: "full" })}
              onClick={() => pick(d)}
              onMouseEnter={() => anchor && setHover(d)}
              onFocus={() => setFocused(d)}
              className={[
                "relative mx-auto flex h-8 w-9 items-center justify-center text-xs transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring",
                edge ? "rounded-md bg-primary font-semibold text-primary-foreground" : mid ? "bg-primary/15 text-foreground" : "rounded-md hover:bg-muted",
                outside && !edge && !mid ? "text-muted-foreground/50" : "",
                sameDay(d, today) && !edge ? "font-semibold ring-1 ring-inset ring-primary/60 rounded-md" : "",
                disabled(d) ? "cursor-not-allowed opacity-30" : "",
              ].join(" ")}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {mode === "range" && <p className="text-[11px] text-muted-foreground">{anchor ? "Now pick the last day." : "Pick the first day, then the last day."}</p>}

      {withTime && start && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">{mode === "range" ? "From" : "At"}</span>
            <input
              type="time"
              value={startTime}
              onChange={(ev) => start && onChange(withT(start, ev.target.value), mode === "range" && end ? (sameDay(start, end) && ev.target.value > endTime ? withT(end, ev.target.value) : end) : withT(start, ev.target.value))}
              className="h-7 rounded-md border border-input bg-background px-1.5"
            />
          </label>
          {mode === "range" && end && (
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">to</span>
              <input
                type="time"
                value={endTime}
                onChange={(ev) => start && end && onChange(start, withT(end, ev.target.value))}
                className="h-7 rounded-md border border-input bg-background px-1.5"
              />
            </label>
          )}
        </div>
      )}

      <div className="flex justify-end border-t pt-2">
        <button type="button" onClick={onDone} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
          Done
        </button>
      </div>
    </div>
  );
}
