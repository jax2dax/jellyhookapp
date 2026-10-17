"use client";
// components/marks/MarkVarsEditor.tsx
// The page variables of a connected (or locked) mark: the one part of a published mark the person sets for their own
// site, e.g. "Pricing page: /plans". Everything else of the mark stays the publisher's. Server side: setMarkVars.
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { MarkVar } from "@/jh-marks/catalog";
import { setMarkVars, type MarkView } from "@/lib/actions/marks.action";

export function MarkVarsEditor({ mark, pages, onSaved, onCancel }: { mark: MarkView; pages: string[]; onSaved: (m: MarkView) => void; onCancel: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(mark.vars.map((v) => [v.key, mark.varValues[v.key] ?? v.default])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!mark.vars.length) return <p className="text-xs text-muted-foreground">This mark has no page to set.</p>;
  const save = async () => {
    setBusy(true);
    setError(null);
    const r = await setMarkVars(mark.id, values);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onSaved(r.mark);
  };
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-2.5">
      <datalist id={"jh-vars-" + mark.id}>
        {pages.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      {mark.vars.map((v: MarkVar) => (
        <label key={v.key} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 text-muted-foreground">{v.label}</span>
          <input
            list={"jh-vars-" + mark.id}
            value={values[v.key] ?? ""}
            onChange={(e) => setValues((x) => ({ ...x, [v.key]: e.target.value }))}
            placeholder={v.default}
            className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 font-mono text-xs"
          />
        </label>
      ))}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-7 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-muted">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={busy} className="flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {busy && <Loader2 className="size-3 animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}
