"use client";
// components/forms/FieldNamingHelp.tsx
// The popup shown when a person names a form field that the site does not have (in the mark builder, or in Enter with
// AI: "budget > 30" on a site whose budget field is called field_3). It says which fields exist and sends them to
// Settings → Form fields to name the right one, or to the docs page that explains why.
import * as React from "react";
import { AppLink as Link } from "@/components/sandbox/sandbox";
import { X } from "lucide-react";

export function FieldNamingHelp({ asked, known, onClose }: { asked: string; known: { key: string; name: string; unnamed?: boolean }[]; onClose: () => void }) {
  const unnamed = known.filter((k) => k.unnamed);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="field-help-title" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()} style={{ animation: "jh-card-in 200ms ease-out both" }}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="field-help-title" className="text-sm font-semibold text-foreground">
            No form field called &quot;{asked}&quot;
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Your forms may have this field under another name. Many pages do not name their fields, so they arrive as something like{" "}
          <span className="font-mono text-foreground">field_3</span>. Name it once and marks will find it.
        </p>
        {known.length > 0 && (
          <div className="mt-3 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
            Fields on your forms: {known.slice(0, 8).map((k) => k.name).join(", ")}
            {known.length > 8 ? ` and ${known.length - 8} more` : ""}.
            {unnamed.length > 0 && <span className="text-amber-700 dark:text-amber-400"> {unnamed.length === 1 ? "1 has" : `${unnamed.length} have`} no name yet.</span>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Link href="/docs/reference/form-fields" target="_blank" className="flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted">
            Read how
          </Link>
          <Link href={"/platform/settings?section=fields" + (unnamed[0] ? "&field=" + encodeURIComponent(unnamed[0].key) : "")} className="flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            Name your form fields
          </Link>
        </div>
      </div>
    </div>
  );
}
