// components/forms/FormAverages.tsx
// The median journey of successful submissions (presentation only): each field the typical person used, in the form's
// order, as a block (light part = before typing), then the pause after it (amber: how long, among those who paused, and
// how many did). Data: a VersionSummary from jh-forms/averages.ts. Same colours as FormActivityChart.
// Used by the form dashboard (components/forms/FormDashboard.tsx) for the current version and the reference.
import type { AvgField } from "@/jh-forms/averages";

export const fmtMs = (ms: number | null | undefined) => {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) return (ms / 1000).toFixed(1) + " s";
  const s = Math.round(ms / 1000);
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60);
  return m + "m " + (s % 60) + "s";
};
const pct = (v: number | null) => (v === null ? "-" : Math.round(v * 100) + "%");

export function Journey({ fields, typed, keys }: { fields: AvgField[]; typed: number; /** only these fields, in this order (the current version's) */ keys?: string[] }) {
  const pick = keys ? keys.map((k) => fields.find((f) => f.key === k)).filter((f): f is AvgField => !!f) : fields;
  const used = pick.filter((f) => f.used > 0 && f.inFieldMs !== null);
  const total = used.reduce((n, f) => n + (f.inFieldMs ?? 0) + (f.pauseAfterMs ?? 0), 0);
  if (!used.length || total <= 0) return <p className="text-sm text-muted-foreground">No typed submissions yet.</p>;
  const w = (ms: number) => Math.max(1.5, (ms / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex w-full items-end">
        {used.map((f, i) => (
          <div key={f.key} className="flex shrink-0" style={{ width: w((f.inFieldMs ?? 0) + (f.pauseAfterMs ?? 0)) + "%" }}>
            <div className="min-w-0 flex-1">
              <div className="truncate px-0.5 pb-1 text-center text-[11px] font-medium text-foreground mask-[linear-gradient(to_right,black_85%,transparent)]" title={f.label}>
                {i + 1}. {f.label}
              </div>
              <div className="flex h-9 overflow-hidden rounded-md" title={`${f.label}: ${fmtMs(f.inFieldMs)} in the field, ${fmtMs(f.hesitationMs)} of it before typing`}>
                {(f.hesitationMs ?? 0) > 0 && <div className="h-full bg-primary/35" style={{ width: Math.min(100, ((f.hesitationMs ?? 0) / (f.inFieldMs || 1)) * 100) + "%" }} />}
                <div className="flex h-full flex-1 items-center justify-center bg-primary text-[11px] font-medium text-primary-foreground tabular-nums">
                  {(f.inFieldMs ?? 0) / total > 0.07 ? fmtMs(f.inFieldMs) : ""}
                </div>
              </div>
            </div>
            {(f.pauseAfterMs ?? 0) > 0 && (
              <div className="flex shrink-0 flex-col justify-end" style={{ width: ((f.pauseAfterMs ?? 0) / ((f.inFieldMs ?? 0) + (f.pauseAfterMs ?? 0))) * 100 + "%" }}>
                <div className="mx-px flex h-9 flex-col items-center justify-center rounded-md bg-amber-400/70 text-[10px] leading-tight text-amber-950 tabular-nums" title={`${pct(f.pausedShare)} paused after ${f.label}; their median pause: ${fmtMs(f.pauseAfterMs)}`}>
                  {(f.pauseAfterMs ?? 0) / total > 0.04 && (
                    <>
                      <span>{fmtMs(f.pauseAfterMs)}</span>
                      <span>{pct(f.pausedShare)}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">
        <span><span className="mr-1 inline-block size-2 rounded-sm bg-primary/35 align-middle" />before typing</span>
        <span><span className="mr-1 inline-block size-2 rounded-sm bg-primary align-middle" />in the field</span>
        <span><span className="mr-1 inline-block size-2 rounded-sm bg-amber-400/70 align-middle" />pause after it: how long, and the share who paused</span>
        <span>Medians over {typed} typed submissions. They do not add up to the median total.</span>
      </div>
    </div>
  );
}
