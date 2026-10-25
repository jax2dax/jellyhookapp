"use client";
// components/forms/FormFieldsSettings.tsx
// Settings → Form fields: every field of the site's forms, with the name marks use for it. Many real forms give their
// fields no visible name (the page only says "field_3"); naming one here once ("Budget") lets a mark or Enter with AI
// find it. ?field=<key> opens with that field highlighted (the "name your form fields" popup links here).
// Data: lib/actions/formFields.action.ts. Docs: /docs/reference/form-fields.
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { nameFormField } from "@/lib/actions/formFields.action";
import type { CatalogField } from "@/lib/forms/catalog";

const KIND_LABEL: Record<CatalogField["kind"], string> = {
  number: "Number",
  choice: "One choice",
  multi: "Several choices",
  yesno: "Yes / no",
  date: "Date",
  text: "Text",
};

export function FormFieldsSettings({ fields: initial, namesReady, focusKey }: { fields: CatalogField[]; namesReady: boolean; focusKey?: string | null }) {
  const [fields, setFields] = React.useState(initial);
  const unnamed = fields.filter((f) => f.unnamed);
  const ordered = [...unnamed, ...fields.filter((f) => !f.unnamed)];

  React.useEffect(() => {
    if (!focusKey) return;
    document.getElementById("field-" + focusKey)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusKey]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Form fields</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The fields of your forms, as your visitors see them. Marks and Enter with AI find a field by its name, so a field your page does not name (for
          example <span className="font-mono text-foreground">field_3</span>) needs a name here before you can filter leads by it.{" "}
          <Link href="/docs/reference/form-fields" className="text-primary hover:underline">
            How field names work
          </Link>
        </p>
        {unnamed.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            {unnamed.length === 1 ? "1 field has no name." : `${unnamed.length} fields have no name.`} Give each one the name you would use for it, like Budget.
          </p>
        )}
        {!namesReady && <p className="mt-2 text-sm text-red-600 dark:text-red-400">Field names are not set up on this database yet (migration 21). You can see the fields, but not name them.</p>}
      </div>

      {fields.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No form fields yet. They appear here after a visitor sees one of your forms with the latest tracker.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {ordered.map((f) => (
            <FieldRow key={f.key} field={f} focused={focusKey === f.key} disabled={!namesReady} onSaved={(name) => setFields((list) => list.map((x) => (x.key === f.key ? { ...x, ownName: name || null, name: name || x.pageLabel || x.rawKey, unnamed: !name && x.unnamed && !x.pageLabel } : x)))} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FieldRow({ field: f, focused, disabled, onSaved }: { field: CatalogField; focused: boolean; disabled: boolean; onSaved: (name: string) => void }) {
  const [value, setValue] = React.useState(f.ownName ?? "");
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | { error: string }>("idle");
  const save = async () => {
    const next = value.trim();
    if (next === (f.ownName ?? "")) return;
    setState("saving");
    const r = await nameFormField(f.key, next);
    if (!r.ok) return setState({ error: r.error });
    setState("saved");
    onSaved(next);
  };
  const choices = f.options.slice(0, 5).map((o) => o.l || o.v);
  return (
    <li id={"field-" + f.key} className={"grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_16rem] " + (focused ? "bg-primary/5 ring-1 ring-inset ring-primary/40" : "")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{f.name}</span>
          {f.unnamed && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">Needs a name</span>}
          <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{KIND_LABEL[f.kind]}</span>
        </div>
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <div>
            On the page: {f.pageLabel ? <span className="text-foreground/80">&quot;{f.pageLabel}&quot;</span> : <span className="italic">no visible name</span>} · key{" "}
            <span className="font-mono">{f.rawKey}</span> · {f.type}
          </div>
          {choices.length > 0 && (
            <div className="truncate">
              Choices: {choices.join(", ")}
              {f.options.length > 5 ? ` and ${f.options.length - 5} more` : ""}
            </div>
          )}
          {f.kind === "number" && (f.min !== null || f.max !== null) && (
            <div>
              From {f.min ?? "any"} to {f.max ?? "any"}
            </div>
          )}
          <div>
            Answered in {f.answered} of the last {f.sampled} leads · {f.pages.slice(0, 3).join(", ")}
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <input
          value={value}
          maxLength={60}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            setState("idle");
          }}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          placeholder={f.pageLabel || "Name this field"}
          aria-label={"Name for " + f.name}
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-sm disabled:opacity-50"
        />
        <span className="flex h-8 w-5 items-center justify-center">
          {state === "saving" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {state === "saved" && <Check className="size-4 text-emerald-600" />}
        </span>
      </div>
      {typeof state === "object" && <p className="text-xs text-red-600 sm:col-span-2 dark:text-red-400">{state.error}</p>}
    </li>
  );
}
