// components/leads/FormDetails.tsx
// "Submitted form details" on the lead page. name, email and phone are
// already in the header, so this block exists only when the form carried
// OTHER fields (business-name, budget...). It shows the first 4 as plain
// key: value, and tucks the rest (and any nested raw data) into one compact
// dropdown, so a form with 40 fields doesn't push the page down.
"use client";

import * as React from "react";

export interface FormField {
  key: string;
  value: string;
}

const INLINE = 4;

export function FormDetails({ scalars, complex }: { scalars: FormField[]; complex: FormField[] }) {
  const [open, setOpen] = React.useState(false);
  if (scalars.length === 0 && complex.length === 0) return null;
  const first = scalars.slice(0, INLINE);
  const rest = scalars.slice(INLINE);
  const hidden = rest.length + complex.length;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted form details</p>
      <div className="flex flex-wrap gap-2">
        {first.map((f) => (
          <div key={f.key} className="max-w-full rounded-md border bg-muted/40 px-2.5 py-1 text-xs">
            <span className="text-muted-foreground">{f.key}: </span>
            <span className="break-words font-medium text-foreground">{f.value}</span>
          </div>
        ))}
        {hidden > 0 && (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            {open ? "Hide the rest" : `+${hidden} more field${hidden === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
      {open && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-2">
          {rest.length > 0 && (
            <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              {rest.map((f) => (
                <div key={f.key} className="contents">
                  <dt className="truncate text-muted-foreground">{f.key}</dt>
                  <dd className="break-words text-foreground">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {complex.map((f) => (
            <details key={f.key} className="rounded-md border bg-background">
              <summary className="cursor-pointer select-none px-2.5 py-1.5 text-xs font-medium text-muted-foreground">{f.key} (raw data)</summary>
              <pre className="max-h-64 overflow-auto border-t px-2.5 py-2 text-[11px] leading-relaxed text-foreground">{f.value}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
