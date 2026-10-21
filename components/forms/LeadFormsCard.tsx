"use client";
// components/forms/LeadFormsCard.tsx
// A lead's forms on the lead page. Two sides of one card:
//   - simple (default): each form's fields as bars, "field name: time spent in it", in the order used, then the fields
//     never touched. On a form they gave up, the field they stopped on is red. The form that became this lead first;
//     the forms they started and did not send are folded below it.
//   - Advanced (checkbox at the top): the card turns over to the field-by-field drawing of each form
//     (FormActivityChart). Only rendered when Advanced is ticked, so the page stays light on every visit.
// The checkbox is remembered in this browser (a convenience; it starts unticked when storage is unavailable).
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapse } from "@/components/leads/Collapse";
import { InfoTip } from "@/components/forms/InfoTip";
import { FormActivityChart } from "@/components/forms/FormActivityChart";
import type { VersionSummary } from "@/jh-forms/averages";
import type { FormActivity } from "@/jh-forms/collect";

const KEY = "jh:lead-forms-advanced";

const fmt = (ms: number | null) => {
  if (ms === null) return "-";
  if (ms < 1000) return (ms / 1000).toFixed(1) + "s";
  const s = Math.round(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  return m < 60 ? m + "m " + (s % 60) + "s" : Math.floor(m / 60) + "h " + (m % 60) + "m";
};

function title(fa: FormActivity): string {
  const when = fa.seenAt ? new Date(fa.seenAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const what = fa.status === "submitted" ? "Sent" : fa.status === "abandoned" ? "Started, not sent" : "In progress";
  return what + " on " + (fa.page || "a page") + (when ? " · " + when : "");
}

export function LeadFormsCard({ activities, references }: { activities: FormActivity[]; references: Record<string, VersionSummary | null> }) {
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    try {
      // a per-browser convenience read once (localStorage is the external system)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(KEY) === "1") setAdvanced(true);
    } catch {
      /* starts simple */
    }
  }, []);
  const toggle = (v: boolean) => {
    setAdvanced(v);
    try {
      window.localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* fine */
    }
  };

  const sent = activities.filter((a) => a.status === "submitted");
  const others = activities.filter((a) => a.status !== "submitted");
  const ref = (a: FormActivity) => (a.formKey ? references[a.formKey] ?? null : null);
  // one scale for every form on the card, so a 0.3 s field never draws as long as a 30 s one
  const scale = Math.max(1000, ...activities.flatMap((a) => a.timeline.fields.map((f) => f.focusedMs)));

  /** One form, its fields as bars. The rows arrive one after the other and the bars grow out from the left. */
  const FieldBars = ({ a }: { a: FormActivity }) => {
    const t = a.timeline;
    const gaveUp = a.status === "abandoned";
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline gap-2 text-sm">
          <span className={"size-2 shrink-0 self-center rounded-full " + (a.status === "submitted" ? "bg-yellow-500" : gaveUp ? "bg-orange-500" : "bg-sky-500")} />
          <span className="font-medium text-foreground">{title(a)}</span>
          {t.totals.spanMs !== null && <span className="text-xs text-muted-foreground">{fmt(t.totals.spanMs)} in total</span>}
        </div>
        {t.fields.length === 0 && t.untouched.length === 0 && <p className="pl-4 text-xs text-muted-foreground">Seen, but no field was clicked into.</p>}
        <div className="space-y-1 pl-4">
          {t.fields.map((f, i) => {
            const stopped = gaveUp && f.last;
            return (
              <div key={f.key} style={{ animation: "jh-row-in 380ms ease-out both", animationDelay: i * 60 + "ms" }} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] items-center gap-3 text-xs" title={stopped ? "They gave up on this field" : undefined}>
                <span className={"truncate " + (stopped ? "font-medium text-red-600 dark:text-red-400" : "text-foreground")}>
                  {f.label}
                  {f.required && <span className="text-muted-foreground"> *</span>}
                </span>
                <span className="h-3 overflow-hidden rounded-sm bg-muted/40">
                  <span className={"block h-full origin-left rounded-sm " + (stopped ? "bg-red-500" : "bg-primary")} style={{ width: Math.max(1, (f.focusedMs / scale) * 100) + "%", animation: "jh-bar-grow 650ms cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: i * 60 + 120 + "ms" }} />
                </span>
                <span className={"text-right tabular-nums " + (stopped ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>{fmt(f.focusedMs)}</span>
              </div>
            );
          })}
          {t.untouched.map((u) => (
            <div key={u.key} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] items-center gap-3 text-xs">
              <span className="truncate text-muted-foreground">
                {u.label}
                {u.required && " *"}
              </span>
              <span className="h-3 rounded-sm border border-dashed border-muted-foreground/30" />
              <span className="text-right text-muted-foreground">not touched</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 px-6 pb-2 pt-5">
        <h2 className="text-base font-semibold">Form activity</h2>
        <InfoTip>
          Every form this person started, field by field: the time spent in each field, in the order they used them, and the field where they gave up (red). Advanced draws the whole form over time: the pauses, other pages, and when they left and came back. Nothing they typed is recorded, only when and how long.
        </InfoTip>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
          <input type="checkbox" checked={advanced} onChange={(e) => toggle(e.target.checked)} className="size-3.5 accent-(--primary)" />
          Advanced
        </label>
      </div>

      {/* the card turns over between the two views; the advanced side only exists while ticked */}
      <div key={advanced ? "advanced" : "simple"} className="animate-[jh-card-flip_380ms_ease-out] px-6 pb-6 pt-2 [transform-origin:50%_0] motion-reduce:animate-none">
        {!advanced ? (
          <div className="space-y-5">
            {sent.map((a) => (
              <FieldBars key={a.id} a={a} />
            ))}
            {others.length > 0 && (
              <OthersFold count={others.length} defaultOpen={sent.length === 0} gap="space-y-5">
                {others.map((a) => (
                  <FieldBars key={a.id} a={a} />
                ))}
              </OthersFold>
            )}
            <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-primary" />time in the field</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-red-500" />where they gave up</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm border border-dashed border-muted-foreground/40" />never touched</span>
              <span>* required</span>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {sent.map((a) => (
              <FormActivityChart key={a.id} timeline={a.timeline} title={title(a)} reference={ref(a)} referenceLabel="every successful submission of this form (all time)" />
            ))}
            {others.length > 0 && (
              <OthersFold count={others.length} defaultOpen={false} gap="space-y-8">
                {others.map((a) => (
                  <FormActivityChart key={a.id} timeline={a.timeline} title={title(a)} reference={ref(a)} referenceLabel="every successful submission of this form (all time)" />
                ))}
              </OthersFold>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "N other forms started, not sent": a header you click, and the forms open and close smoothly (height and fade, the
 * chevron turns). Each time it opens, its content is drawn again so the rows and bars play their entrance.
 */
function OthersFold({ count, defaultOpen, gap, children }: { count: number; defaultOpen: boolean; gap: string; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const [opens, setOpens] = useState(0); // bumps when it opens: the content is keyed by it
  const toggle = () => {
    if (!open) setOpens((n) => n + 1);
    setOpen(!open);
  };
  return (
    <div className="rounded-lg border">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm">
        <span className="font-medium text-foreground">
          {count} other form{count === 1 ? "" : "s"} started, not sent
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {open ? "Hide" : "Show"}
          <ChevronDown className={"size-3.5 transition-transform duration-300 " + (open ? "rotate-180" : "")} />
        </span>
      </button>
      <Collapse open={open}>
        <div key={opens} className={"border-t px-4 py-3 " + gap}>
          {children}
        </div>
      </Collapse>
    </div>
  );
}
