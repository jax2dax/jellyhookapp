"use client";
// app/platform/settings/FormSwitchesCard.jsx
// Settings, Lead tracking: which forms count as leads (mds/build/forms/lead-forms.md). Every form Jellyhook has seen a
// submission from is listed (site_forms, migration 28) with its leads, its skipped submissions and a switch. A form
// marked in code (data-conversion) shows that and its switch is locked, because the mark wins. The site's default
// (sites.specify_form) is the small setting at the top: what a form nobody has switched yet does. The rule:
// lib/tracking/formRules.js. Replaces the old "Only the form I label / Every form" choice (2026-10-25).
import { useEffect, useState } from "react";
import { listLeadForms, setFormMode, setLeadFormSwitch } from "@/lib/actions/settings.actions";
import { Card, CardContent } from "@/components/ui/card";

function ago(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 3_600_000) return Math.max(1, Math.round(ms / 60_000)) + " min ago";
  if (ms < 86_400_000) return Math.round(ms / 3_600_000) + " h ago";
  return Math.round(ms / 86_400_000) + " days ago";
}

function Segment({ value, onChange, disabled, options }) {
  return (
    <div role="radiogroup" className={"flex h-7 shrink-0 items-center rounded-md border p-0.5 " + (disabled ? "opacity-60" : "")}>
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled}
          onClick={() => value !== v && onChange(v)}
          className={"h-full rounded px-2 text-xs transition-colors " + (value === v ? "bg-primary/15 font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function FormSwitchesCard({ siteId, onChanged }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listLeadForms(siteId).then((r) => {
      if (!cancelled) setState(r);
    });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const reload = async () => setState(await listLeadForms(siteId));

  async function setDefault(specify) {
    setBusy("default");
    setError(null);
    const r = await setFormMode(siteId, specify);
    if (r.success) {
      onChanged?.(r.data);
      await reload();
    } else setError(r.error);
    setBusy(null);
  }

  async function setSwitch(key, value) {
    setBusy(key);
    setError(null);
    const r = await setLeadFormSwitch(siteId, key, value);
    if (r.success) await reload();
    else setError(r.error);
    setBusy(null);
  }

  if (!state) return <Card><CardContent className="text-xs text-muted-foreground">Loading forms…</CardContent></Card>;
  if (!state.success) return <Card><CardContent className="text-xs text-destructive">{state.error}</CardContent></Card>;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm font-medium text-foreground">Which forms count as leads</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Each form appears here after its first submission. Switch off the ones that are not leads, such as a newsletter or job application. A form that is not a lead is only counted (its submissions are skipped); its names, emails and answers are never kept. Login, search and password forms are never leads. Changes apply within a minute; leads already recorded stay.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <span className="text-xs text-foreground">Forms found from now on</span>
          <Segment
            value={state.specifyForm ? "off" : "on"}
            disabled={!state.canEdit || busy === "default"}
            onChange={(v) => setDefault(v === "off")}
            options={[
              ["on", "Count as leads"],
              ["off", "Wait until I switch them on"],
            ]}
          />
        </div>

        {!state.ready ? (
          <p className="text-xs text-muted-foreground">The form list is not set up on this database yet (migration 28).</p>
        ) : state.forms.length === 0 ? (
          <p className="text-xs text-muted-foreground">No form has been submitted yet. Forms appear here after their first submission.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {state.forms.map((f) => (
              <li key={f.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-foreground">{f.label}</span>
                    {f.mark && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground" title="data-conversion on the page decides for this form; its switch has no effect while the mark is there">
                        marked in code: {f.mark === "true" ? "always a lead" : "never a lead"}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {f.page ? f.page + " · " : ""}
                    {f.leads} lead{f.leads === 1 ? "" : "s"}
                    {f.skipped > 0 ? ` · ${f.skipped} skipped (last ${ago(f.lastSkippedAt)})` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {f.switch === null && !f.mark && <span className="text-[10px] text-muted-foreground">default</span>}
                  <Segment
                    value={f.counts ? "on" : "off"}
                    disabled={!state.canEdit || !!f.mark || busy === f.key}
                    onChange={(v) => setSwitch(f.key, v === "on")}
                    options={[
                      ["on", "Lead"],
                      ["off", "Not a lead"],
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground">
          In code, data-conversion=&quot;true&quot; on a form (or a box around it) makes it always a lead, and data-conversion=&quot;false&quot; never. Most sites need neither.
        </p>
        {!state.canEdit && <p className="text-xs text-muted-foreground">Only the owner or an admin can change these.</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
