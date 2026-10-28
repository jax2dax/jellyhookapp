"use client";
// components/marks/PastLeadsChoice.tsx
// "Also check past leads": the choice made when a mark is saved with a new rule, or turned on (v3,
// mds/build/marks/when-marks-run.md). New leads are always checked while the mark is on; this decides which leads that
// came before are checked too, in the background. Counts come from the server (pastLeadCounts); in the home page demo
// (no counts) the labels show without them.
import * as React from "react";
import { pastLeadCounts } from "@/lib/actions/marks.action";
import { checkTime, PAST_CHOICES, PAST_LABEL, type PastChoice } from "@/lib/marks/coverage";
import { useAction } from "@/components/sandbox/sandbox";

export function usePastCounts(): Record<PastChoice, number> | null {
  const act = useAction("pastLeadCounts", pastLeadCounts);
  const [counts, setCounts] = React.useState<Record<PastChoice, number> | null>(null);
  React.useEffect(() => {
    let live = true;
    act().then((r) => live && r.ok && setCounts(r.counts));
    return () => {
      live = false;
    };
  }, [act]);
  return counts;
}

export function PastLeadsChoice({ value, onChange, counts, name }: { value: PastChoice; onChange: (v: PastChoice) => void; counts: Record<PastChoice, number> | null; name: string }) {
  const n = counts?.[value] ?? 0;
  return (
    <fieldset className="space-y-1 text-xs">
      <legend className="mb-1 text-muted-foreground">Also check past leads</legend>
      {PAST_CHOICES.map((c) => (
        <label key={c} className="flex cursor-pointer items-center gap-2">
          <input type="radio" name={name} checked={value === c} onChange={() => onChange(c)} className="size-3" />
          {PAST_LABEL[c]}
          {counts && c !== "none" && <span className="text-muted-foreground">({counts[c]})</span>}
        </label>
      ))}
      <p className="pt-0.5 text-[11px] text-muted-foreground">
        {value === "none" ? "Only leads that arrive from now on are checked. Older leads show as not checked." : n > 0 ? `Checked in the background, newest first (${checkTime(n)}). You can keep working.` : "New leads are checked as they arrive."}
      </p>
    </fieldset>
  );
}
