// components/leads/ConversionEventsBadges.tsx
// "Conversion events" as one compact row of badges (page + time) instead of
// a tall column of cards: a lead who submitted forms 28 times used to take a
// whole scrolling panel. Shows the first 12; the rest sit behind one button.
// The submission being viewed is highlighted.
"use client";

import * as React from "react";
import { formatDateTime } from "@/lib/leadFormat";

export interface ConversionEvent {
  id: string;
  pagePath: string | null;
  submittedAt: string | null;
  isFocus: boolean;
}

const VISIBLE = 12;

export function ConversionEventsBadges({ events }: { events: ConversionEvent[] }) {
  const [all, setAll] = React.useState(false);
  const shown = all ? events : events.slice(0, VISIBLE);
  return (
    <section aria-label="Conversion events" className="rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-sm font-semibold">Conversion events</h2>
        <span className="text-xs text-muted-foreground">{events.length} forms submitted from this same browser</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {shown.map((c) => (
          <li
            key={c.id}
            title={`${c.pagePath ?? "unknown page"} · ${formatDateTime(c.submittedAt)}`}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${c.isFocus ? "border-primary/60 bg-primary/10 font-medium" : "bg-muted/40 text-muted-foreground"}`}
          >
            <span className="truncate text-foreground">{c.pagePath ?? "—"}</span>
            <span className="shrink-0">{formatDateTime(c.submittedAt)}</span>
            {c.isFocus && <span className="shrink-0 text-[10px] uppercase tracking-wide text-primary">viewing</span>}
          </li>
        ))}
        {events.length > VISIBLE && (
          <li>
            <button type="button" onClick={() => setAll((v) => !v)} className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-expanded={all}>
              {all ? "Show fewer" : `+${events.length - VISIBLE} more`}
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
