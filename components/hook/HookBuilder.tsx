// components/hook/HookBuilder.tsx
// The Hook builder canvas: one recursive editor for a hook. The same
// SpecEditor edits the main hook AND every sub-hook whose result flows into
// a value through a tunnel, so a sub-hook is literally another hook, inline,
// with every output the main hook has.
//
// Every block (a hook, a sub-hook, a condition) can be named, given a note,
// collapsed to one line, and given vertical space by dragging its handle.
// All of that is stored IN the query (`meta`, `ui`), so when queries are
// saved to the database later, their names and layout come with them and
// nothing here changes. The engine ignores both.
//
// Everything the menus offer comes from jh-hook/schema.ts: add a field there
// and it appears here, grouped, with the right operators and value editor.
// Every condition and output is colour-coded by the TYPE it works on.
// See jh-hook/ui-ux.md.
"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AGGS_FOR, AGG_LABEL, FIELD_GROUPS, LIST_OPS, NO_VALUE_OPS, OPS_FOR, OP_LABEL, SCHEMA, TIME_OP_LABEL, TWO_VALUE_OPS, TYPE_LABEL,
  type Agg, type EntityKey, type FieldType, type Op,
} from "@/jh-hook/schema";
import { describeCondition, describeSpec } from "@/jh-hook/describe";
import { returnedBy, slotsFor, type Returned } from "@/jh-hook/shape";
import {
  MAX_SPACE_BEFORE, SPEC_VERSION,
  type BlockUi, type Condition, type DurationUnit, type HookSpec, type Measure, type Meta, type Output, type RelativeUnit, type ValueArg,
} from "@/jh-hook/types";
import { hookLog } from "@/jh-hook/debug";
import { suggestHookValues } from "@/lib/actions/hook.action";

export const SEL = "h-8 rounded-md border bg-background px-2 text-sm";
const DUR_UNITS: DurationUnit[] = ["ms", "sec", "min", "hr", "day"];
const REL_UNITS: RelativeUnit[] = ["minute", "hour", "day", "week", "month"];
const ENTITIES = Object.keys(SCHEMA) as EntityKey[];
const SPACE_STEP = 4; // drag snaps to this many px
const KEY_STEP = 16; // arrow keys move by this many px

export const newId = () => "c" + Math.random().toString(36).slice(2, 8);
const isHook = (v: ValueArg | undefined): v is { hook: HookSpec } => typeof v === "object" && v !== null && !Array.isArray(v) && "hook" in v;

/** Builder callbacks that are not edits: user-facing announcements. */
export type Announce = (tone: "info" | "success" | "error", text: string) => void;

// ── meta / ui helpers: keep the query small, drop empty values ────────────
function withMeta<T extends { meta?: Meta }>(x: T, patch: Partial<Meta>): T {
  const m: Meta = { ...x.meta, ...patch };
  if (!m.name) delete m.name;
  if (!m.description) delete m.description;
  return { ...x, meta: Object.keys(m).length ? m : undefined };
}
function withUi<T extends { ui?: BlockUi }>(x: T, patch: Partial<BlockUi>): T {
  const u: BlockUi = { ...x.ui, ...patch };
  if (!u.collapsed) delete u.collapsed;
  if (!u.spaceBefore) delete u.spaceBefore;
  return { ...x, ui: Object.keys(u).length ? u : undefined };
}

// ── Type colours: the same colour means the same kind of value everywhere ──
const TYPE_STYLE: Record<FieldType, { badge: string; border: string }> = {
  number: { badge: "border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-300", border: "border-l-sky-500" },
  duration: { badge: "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300", border: "border-l-amber-500" },
  percent: { badge: "border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-300", border: "border-l-violet-500" },
  px: { badge: "border-slate-500/50 bg-slate-500/10 text-slate-600 dark:text-slate-300", border: "border-l-slate-500" },
  text: { badge: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300", border: "border-l-emerald-500" },
  enum: { badge: "border-pink-500/50 bg-pink-500/10 text-pink-600 dark:text-pink-300", border: "border-l-pink-500" },
  time: { badge: "border-cyan-500/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300", border: "border-l-cyan-500" },
  bool: { badge: "border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-300", border: "border-l-orange-500" },
};

function TypeBadge({ type, prefix }: { type: FieldType; prefix?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TYPE_STYLE[type].badge}`}>
      {prefix ? `${prefix} ` : ""}{TYPE_LABEL[type]}
    </span>
  );
}

function safeReturned(spec: HookSpec): Returned | null {
  try {
    return returnedBy(spec);
  } catch {
    return null;
  }
}

function ReturnBadge({ spec }: { spec: HookSpec }) {
  const r = safeReturned(spec);
  if (!r) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      Returns <TypeBadge type={r.type} /> {r.shape === "list" ? "list" : "single value"}: {r.noun}
    </span>
  );
}

function opLabel(op: Op, t: FieldType) {
  return (t === "time" && TIME_OP_LABEL[op]) || OP_LABEL[op];
}

function defaultValue(t: FieldType, op: Op, enumValues?: string[]): ValueArg | undefined {
  if (NO_VALUE_OPS.has(op)) return undefined;
  if (LIST_OPS.has(op)) return [];
  switch (t) {
    case "duration":
      return { amount: 5, unit: "sec" };
    case "time":
      return { ago: 7, unit: "day" };
    case "enum":
      return enumValues?.[0] ?? "";
    case "text":
      return "";
    default:
      return 0;
  }
}

/** A starting sub-hook that already fits the slot it is dropped into. */
function starterHook(type: FieldType, ref: string | undefined, list: boolean): HookSpec {
  const v = SPEC_VERSION as HookSpec["v"];
  const fieldsOfType = (e: EntityKey) => Object.entries(SCHEMA[e].fields).filter(([, f]) => f.type === type && (!ref || !f.ref || f.ref === ref));
  if (list) {
    for (const e of ENTITIES) if (SCHEMA[e].ref === ref && type === "text") return { v, entity: e, where: [], output: { kind: "ids" } };
    for (const e of ENTITIES) {
      const f = fieldsOfType(e)[0];
      if (f) return { v, entity: e, where: [], output: { kind: "values", field: f[0] } };
    }
  } else {
    if (type === "number") return { v, entity: "pageView", where: [], output: { kind: "count" } };
    for (const e of ENTITIES) {
      const f = fieldsOfType(e).find(([, d]) => AGGS_FOR[d.type].includes("avg"));
      if (f) return { v, entity: e, where: [], output: { kind: "aggregate", agg: "avg", field: f[0] } };
    }
  }
  return { v, entity: "pageView", where: [], output: list ? { kind: "ids" } : { kind: "count" } };
}

// ── Block chrome: name, note, collapse ─────────────────────────────────
function NameInput({ value, placeholder, onChange }: { value?: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <input
      className="h-7 min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1 text-sm font-medium outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground hover:border-border focus:border-ring"
      value={value ?? ""}
      placeholder={placeholder}
      maxLength={80}
      aria-label="Name"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Chevron({ collapsed, onToggle, what }: { collapsed: boolean; onToggle: () => void; what: string }) {
  return (
    <button
      type="button"
      className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expand ${what}` : `Collapse ${what}`}
      title={collapsed ? "Expand" : "Collapse to one line"}
    >
      <span className={`inline-block transition-transform ${collapsed ? "" : "rotate-90"}`}>&#9656;</span>
    </button>
  );
}

function NoteToggle({ open, has, onToggle }: { open: boolean; has: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`h-7 shrink-0 rounded px-1.5 text-xs hover:bg-muted ${has ? "text-foreground" : "text-muted-foreground"}`}
      onClick={onToggle}
      aria-expanded={open}
      title={has ? "Edit the description" : "Add a description"}
    >
      {has ? "note" : "+ note"}
    </button>
  );
}

function NoteEditor({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <textarea
      className="mt-1 w-full rounded-md border bg-background p-2 text-xs"
      rows={2}
      maxLength={500}
      placeholder="What this is for, in your own words (shown to anyone who opens this query)"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ── Vertical space: drag the handle to open space above a block ─────────
// Dragging writes straight to the spacer's style (no React render per
// pointer move, at most one paint per frame); the query is updated once,
// on release.
function SpaceHandle({ spacerRef, value, onCommit }: { spacerRef: RefObject<HTMLDivElement | null>; value: number; onCommit: (px: number) => void }) {
  const drag = useRef<{ y: number; start: number; cur: number; raf: number } | null>(null);
  const clamp = (px: number) => Math.min(MAX_SPACE_BEFORE, Math.max(0, Math.round(px / SPACE_STEP) * SPACE_STEP));
  const paint = () => {
    const d = drag.current;
    if (!d) return;
    d.raf = 0;
    if (spacerRef.current) spacerRef.current.style.height = `${d.cur}px`;
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.raf) cancelAnimationFrame(d.raf);
    if (spacerRef.current) spacerRef.current.style.height = `${d.cur}px`;
    if (d.cur !== value) {
      hookLog.debug("space set", d.cur);
      onCommit(d.cur);
    }
  };
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Space above this block"
      aria-valuemin={0}
      aria-valuemax={MAX_SPACE_BEFORE}
      aria-valuenow={value}
      tabIndex={0}
      title="Drag up or down to add space above. Arrow keys work too. Double-click to remove the space."
      className="flex h-7 w-4 shrink-0 cursor-ns-resize touch-none select-none items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, start: value, cur: value, raf: 0 };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const next = clamp(d.start + e.clientY - d.y);
        if (next === d.cur) return;
        d.cur = next;
        if (!d.raf) d.raf = requestAnimationFrame(paint);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={() => value !== 0 && onCommit(0)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") onCommit(clamp(value + KEY_STEP));
        else if (e.key === "ArrowUp") onCommit(clamp(value - KEY_STEP));
        else if (e.key === "Home" || e.key === "Delete" || e.key === "Backspace") onCommit(0);
        else return;
        e.preventDefault();
      }}
    >
      <span className="text-[10px] leading-none tracking-tighter">&#8942;&#8942;</span>
    </div>
  );
}

function Spacer({ spacerRef, px }: { spacerRef: RefObject<HTMLDivElement | null>; px: number }) {
  return <div ref={spacerRef} aria-hidden style={{ height: px }} className="ml-1 border-l border-dashed border-border/70" />;
}

// ── Spec (a hook or a sub-hook) ─────────────────────────────────────────
export function SpecEditor({
  spec,
  onChange,
  root = false,
  announce,
}: {
  spec: HookSpec;
  onChange: (s: HookSpec) => void;
  /** The main hook: shows "use as a sub-hook". */
  root?: boolean;
  announce?: Announce;
}) {
  const collapsed = !!spec.ui?.collapsed;
  const [noteOpen, setNoteOpen] = useState(!!spec.meta?.description);
  const what = root ? "hook" : "sub-hook";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Chevron collapsed={collapsed} onToggle={() => onChange(withUi(spec, { collapsed: !collapsed }))} what={what} />
        <NameInput value={spec.meta?.name} placeholder={root ? "Untitled hook (click to name it)" : "Untitled sub-hook"} onChange={(name) => onChange(withMeta(spec, { name }))} />
        <NoteToggle open={noteOpen} has={!!spec.meta?.description} onToggle={() => setNoteOpen((o) => !o)} />
      </div>
      {noteOpen && !collapsed && <NoteEditor value={spec.meta?.description} onChange={(description) => onChange(withMeta(spec, { description }))} />}
      {collapsed ? (
        <button type="button" className="w-full truncate rounded-md border border-dashed px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted" onClick={() => onChange(withUi(spec, { collapsed: false }))}>
          {spec.meta?.description || describeSpec(spec)}
        </button>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Show</span>
            <OutputEditor entity={spec.entity} output={spec.output} onChange={(output) => onChange({ ...spec, output })} />
            <span className="text-muted-foreground">of</span>
            <select
              className={SEL}
              value={spec.entity}
              onChange={(e) => {
                const entity = e.target.value as EntityKey;
                // keep the kind of output when it still makes sense, otherwise start from "the number of"
                const keep = spec.output.kind === "count" || spec.output.kind === "ids";
                onChange({ ...spec, entity, where: [], output: keep ? spec.output : { kind: "count" }, order: undefined });
              }}
            >
              {ENTITIES.map((k) => <option key={k} value={k}>{SCHEMA[k].plural}</option>)}
            </select>
            <span className="text-muted-foreground">where</span>
          </div>
          <ReturnBadge spec={spec} />
          <ConditionList entity={spec.entity} conds={spec.where} onChange={(where) => onChange({ ...spec, where })} />
          {root && <WrapPanel spec={spec} onChange={onChange} announce={announce} />}
        </>
      )}
    </div>
  );
}

/** Turns the whole current hook into a sub-hook of a new hook, in any slot its result fits. */
function WrapPanel({ spec, onChange, announce }: { spec: HookSpec; onChange: (s: HookSpec) => void; announce?: Announce }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(0);
  const r = safeReturned(spec);
  const slots = r ? slotsFor(r) : [];
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} title="Put this whole hook inside a new one, so its result flows into a field of the new hook">
        Use this hook as a sub-hook...
      </Button>
    );
  }
  const wrap = () => {
    const slot = slots[choice];
    if (!slot) return;
    const f = SCHEMA[slot.entity].fields[slot.field];
    const next: HookSpec = {
      v: SPEC_VERSION as HookSpec["v"],
      entity: slot.entity,
      where: [{ id: newId(), kind: "field", field: slot.field, op: slot.op, value: { hook: spec } }],
      output: { kind: "count" },
    };
    hookLog.info("wrapped into sub-hook", { into: `${slot.entity}.${slot.field}`, op: slot.op });
    onChange(next);
    setOpen(false);
    announce?.("success", `Your hook is now a sub-hook. Its result flows into "${f.label}" of ${SCHEMA[slot.entity].plural}.`);
  };
  return (
    <div className="space-y-2 rounded-md border border-dashed p-2 text-sm">
      {r && <p className="text-xs text-muted-foreground">This hook returns {r.noun}. Pick where that result should flow in the new hook:</p>}
      {slots.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${SEL} max-w-full`} value={choice} onChange={(e) => setChoice(Number(e.target.value))}>
            {slots.map((s, i) => (
              <option key={`${s.entity}.${s.field}`} value={i}>
                {SCHEMA[s.entity].plural}: {SCHEMA[s.entity].fields[s.field].label} {opLabel(s.op, SCHEMA[s.entity].fields[s.field].type)} [this hook]
              </option>
            ))}
          </select>
          <Button size="sm" onClick={wrap}>Make it a sub-hook</Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Nothing can take {r ? r.noun : "this result"} yet. Change the output first (for example to a calculation, or to a list of ids).</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
        </div>
      )}
    </div>
  );
}

// ── Output ─────────────────────────────────────────────────────────────
const OUTPUT_KINDS: { k: Output["kind"]; label: string; hint: string }[] = [
  { k: "count", label: "the number of", hint: "a number: how many rows match" },
  { k: "countDistinct", label: "the number of different (unique)", hint: "a number: how many different values of one field" },
  { k: "aggregate", label: "a calculation:", hint: "one value: average, total, lowest, highest, median or percentile of one field" },
  { k: "ids", label: "a list of ...", hint: "a list of the matching rows themselves (sessions, leads...). Results show the rows, not ids; as a sub-hook it hands over their ids" },
  { k: "values", label: "a list of ... values", hint: "a list: the different values of one field among the matching rows" },
  { k: "groupBy", label: "a breakdown:", hint: "a table: one measure for each value of a field (for example, page views per page, or sessions per day). As a sub-hook it hands over its keys" },
];

function OutputEditor({ entity, output, onChange }: { entity: EntityKey; output: Output; onChange: (o: Output) => void }) {
  const fields = Object.entries(SCHEMA[entity].fields);
  const firstField = FIELD_GROUPS[entity][0].fields[0] ?? fields[0][0];
  const measurable = fields.filter(([, f]) => AGGS_FOR[f.type].some((a) => a !== "countDistinct"));
  const setKind = (k: Output["kind"]) => {
    const nf = measurable[0]?.[0] ?? firstField;
    onChange(
      k === "count" ? { kind: "count" }
      : k === "countDistinct" ? { kind: "countDistinct", field: firstField }
      : k === "aggregate" ? { kind: "aggregate", agg: "avg", field: nf }
      : k === "ids" ? { kind: "ids" }
      : k === "values" ? { kind: "values", field: firstField }
      : { kind: "groupBy", field: firstField, measure: { agg: "count" } },
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={SEL} value={output.kind} onChange={(e) => setKind(e.target.value as Output["kind"])} title={OUTPUT_KINDS.find((x) => x.k === output.kind)?.hint}>
        {OUTPUT_KINDS.map((x) => (
          <option key={x.k} value={x.k} title={x.hint}>
            {/* "a list of ids" is named by what it lists: a list of sessions, a list of leads... */}
            {x.k === "ids" ? `a list of ${SCHEMA[entity].plural}` : x.label}
          </option>
        ))}
      </select>
      {output.kind === "aggregate" && (
        <>
          <select className={SEL} value={output.agg} onChange={(e) => onChange({ ...output, agg: e.target.value as typeof output.agg })}>
            {AGGS_FOR[SCHEMA[entity].fields[output.field]?.type ?? "number"].filter((a) => a !== "countDistinct").map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
          </select>
          {output.agg === "percentile" && <Input type="number" className="h-8 w-16" value={output.p ?? 90} onChange={(e) => onChange({ ...output, p: Number(e.target.value) })} />}
          <FieldSelect
            entity={entity}
            value={output.field}
            onChange={(field) => {
              const t = SCHEMA[entity].fields[field].type;
              const agg = AGGS_FOR[t].includes(output.agg) ? output.agg : ((AGGS_FOR[t].find((a) => a !== "countDistinct" && a !== "count") as typeof output.agg) ?? "min");
              onChange({ ...output, field, agg });
            }}
            filter={(t) => AGGS_FOR[t].some((a) => a !== "countDistinct")}
          />
        </>
      )}
      {(output.kind === "countDistinct" || output.kind === "values") && <FieldSelect entity={entity} value={output.field} onChange={(field) => onChange({ ...output, field })} />}
      {output.kind === "values" && <span className="text-muted-foreground">values</span>}
      {output.kind === "groupBy" && (
        <>
          <MeasureEditor entity={entity} measure={output.measure} onChange={(measure) => onChange({ ...output, measure })} />
          <span className="text-muted-foreground">for each</span>
          {SCHEMA[entity].fields[output.field]?.type === "time" && (
            <select className={SEL} value={output.bucket ?? "day"} onChange={(e) => onChange({ ...output, bucket: e.target.value as "day" })}>
              {["hour", "day", "week", "month"].map((b) => <option key={b}>{b}</option>)}
            </select>
          )}
          <FieldSelect entity={entity} value={output.field} onChange={(field) => onChange({ ...output, field, bucket: SCHEMA[entity].fields[field]?.type === "time" ? "day" : undefined })} />
          <select className={SEL} value={output.sort ?? ""} onChange={(e) => onChange({ ...output, sort: (e.target.value || undefined) as typeof output.sort })}>
            <option value="">default order</option>
            <option value="valueDesc">biggest first</option>
            <option value="valueAsc">smallest first</option>
            <option value="keyAsc">by key, ascending</option>
            <option value="keyDesc">by key, descending</option>
          </select>
          <span className="text-muted-foreground">top</span>
          <Input type="number" min={1} max={500} className="h-8 w-16" value={output.limit ?? 50} onChange={(e) => onChange({ ...output, limit: Number(e.target.value) })} />
        </>
      )}
    </div>
  );
}

/** A field menu, split into labelled groups so nobody scrolls one long list. */
function FieldSelect({ entity, value, onChange, filter }: { entity: EntityKey; value: string; onChange: (f: string) => void; filter?: (t: FieldType) => boolean }) {
  const fields = SCHEMA[entity].fields;
  return (
    <select className={SEL} value={value} onChange={(e) => onChange(e.target.value)} title={fields[value]?.hint}>
      {FIELD_GROUPS[entity].map((g) => {
        const items = g.fields.filter((k) => fields[k] && (!filter || filter(fields[k].type)));
        if (!items.length) return null;
        return (
          <optgroup key={g.label} label={g.label}>
            {items.map((k) => <option key={k} value={k} title={fields[k].hint}>{fields[k].label} ({TYPE_LABEL[fields[k].type]})</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}

function MeasureEditor({ entity, measure, onChange }: { entity: EntityKey; measure: Measure; onChange: (m: Measure) => void }) {
  const t = measure.field ? SCHEMA[entity].fields[measure.field]?.type : undefined;
  const allAggs: Agg[] = ["count", "countDistinct", "sum", "avg", "min", "max", "median", "percentile"];
  return (
    <span className="flex flex-wrap items-center gap-1">
      <select
        className={SEL}
        value={measure.agg}
        onChange={(e) => {
          const agg = e.target.value as Agg;
          if (agg === "count") return onChange({ agg });
          const field = measure.field && AGGS_FOR[SCHEMA[entity].fields[measure.field]?.type ?? "text"].includes(agg)
            ? measure.field
            : Object.entries(SCHEMA[entity].fields).find(([, f]) => AGGS_FOR[f.type].includes(agg))?.[0];
          onChange({ agg, field });
        }}
      >
        {allAggs.map((a) => <option key={a} value={a} disabled={!!t && a !== "count" && !AGGS_FOR[t].includes(a) && a !== measure.agg}>{AGG_LABEL[a]}</option>)}
      </select>
      {measure.agg === "percentile" && <Input type="number" className="h-8 w-16" value={measure.p ?? 90} onChange={(e) => onChange({ ...measure, p: Number(e.target.value) })} />}
      {measure.agg !== "count" && (
        <FieldSelect entity={entity} value={measure.field ?? ""} onChange={(field) => onChange({ ...measure, field })} filter={(ft) => AGGS_FOR[ft].includes(measure.agg)} />
      )}
    </span>
  );
}

// ── Conditions ─────────────────────────────────────────────────────────
export function ConditionList({ entity, conds, onChange }: { entity: EntityKey; conds: Condition[]; onChange: (c: Condition[]) => void }) {
  const set = (i: number, c: Condition) => onChange(conds.map((x, j) => (j === i ? c : x)));
  const del = (i: number) => onChange(conds.filter((_, j) => j !== i));
  const firstField = FIELD_GROUPS[entity][0].fields[0];
  const rels = Object.entries(SCHEMA[entity].relations);
  const add = (kind: "field" | "group") => {
    const id = newId();
    const t = SCHEMA[entity].fields[firstField].type;
    const op = OPS_FOR[t][0];
    const c: Condition =
      kind === "field" ? { id, kind, field: firstField, op, value: defaultValue(t, op, SCHEMA[entity].fields[firstField].enumValues) } : { id, kind, mode: "or", where: [] };
    onChange([...conds, c]);
  };
  return (
    <div className="border-l pl-3">
      {conds.map((c, i) => (
        <ConditionBlock key={c.id} entity={entity} c={c} onChange={(x) => set(i, x)} onRemove={() => del(i)} />
      ))}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => add("field")}>+ Condition</Button>
        {rels.length > 0 && (
          <select
            className={SEL}
            value=""
            title="Check the rows connected to this one: its page views, its session, its fields..."
            onChange={(e) => {
              if (!e.target.value) return;
              onChange([...conds, { id: newId(), kind: "related", relation: e.target.value, where: [] }]);
            }}
          >
            <option value="">+ Look at its...</option>
            {rels.map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </select>
        )}
        <Button variant="outline" size="sm" onClick={() => add("group")}>+ Any of / none of</Button>
      </div>
    </div>
  );
}

function ConditionBlock({ entity, c, onChange, onRemove }: { entity: EntityKey; c: Condition; onChange: (c: Condition) => void; onRemove: () => void }) {
  const spacerRef = useRef<HTMLDivElement>(null);
  const space = c.ui?.spaceBefore ?? 0;
  const collapsed = !!c.ui?.collapsed;
  const [noteOpen, setNoteOpen] = useState(!!c.meta?.description);
  const t = conditionType(c, entity);
  const summary = describeCondition(c, entity);
  return (
    <div className="pt-2">
      <Spacer spacerRef={spacerRef} px={space} />
      <div className={`rounded-lg border border-l-4 bg-card p-2 shadow-sm transition-shadow hover:shadow-md ${t ? TYPE_STYLE[t].border : "border-l-border"}`}>
        <div className="flex items-center gap-1">
          <SpaceHandle spacerRef={spacerRef} value={space} onCommit={(px) => onChange(withUi(c, { spaceBefore: px }))} />
          <Chevron collapsed={collapsed} onToggle={() => onChange(withUi(c, { collapsed: !collapsed }))} what="condition" />
          <NameInput value={c.meta?.name} placeholder={collapsed ? summary : "Name this condition (optional)"} onChange={(name) => onChange(withMeta(c, { name }))} />
          {t && <TypeBadge type={t} />}
          <NoteToggle open={noteOpen} has={!!c.meta?.description} onToggle={() => setNoteOpen((o) => !o)} />
          <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">{c.id}</span>
          <Button variant="ghost" size="sm" onClick={onRemove}>Remove</Button>
        </div>
        {noteOpen && !collapsed && <NoteEditor value={c.meta?.description} onChange={(description) => onChange(withMeta(c, { description }))} />}
        {collapsed ? (
          c.meta?.name && <p className="truncate px-1 pt-0.5 text-xs text-muted-foreground">{c.meta.description || summary}</p>
        ) : (
          <div className="mt-1 pl-1">
            {c.kind === "field" && <FieldConditionEditor entity={entity} c={c} onChange={onChange} />}
            {c.kind === "related" && <RelatedConditionEditor entity={entity} c={c} onChange={onChange} />}
            {c.kind === "group" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!c.not} onChange={(e) => onChange({ ...c, not: e.target.checked })} /> exclude (NOT)
                  </label>
                  <select className={SEL} value={c.mode} onChange={(e) => onChange({ ...c, mode: e.target.value as "and" | "or" })}>
                    <option value="or">match any (OR)</option>
                    <option value="and">match all (AND)</option>
                  </select>
                </div>
                <ConditionList entity={entity} conds={c.where} onChange={(where) => onChange({ ...c, where })} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The type a condition works on: what you compare. A group has none. */
function conditionType(c: Condition, entity: EntityKey): FieldType | null {
  if (c.kind === "field") return SCHEMA[entity].fields[c.field]?.type ?? null;
  if (c.kind === "related") {
    const rel = SCHEMA[entity].relations[c.relation];
    if (!rel || rel.cardinality === "one" || (!c.measure && !c.op)) return "bool";
    const m = c.measure ?? { agg: "count" as const };
    return m.agg === "count" || m.agg === "countDistinct" ? "number" : (SCHEMA[rel.target].fields[m.field ?? ""]?.type ?? "number");
  }
  return null;
}

function FieldConditionEditor({ entity, c, onChange }: { entity: EntityKey; c: Extract<Condition, { kind: "field" }>; onChange: (c: Condition) => void }) {
  const f = SCHEMA[entity].fields[c.field];
  if (!f) return <p className="text-xs text-red-500">&quot;{c.field}&quot; is no longer a field of {SCHEMA[entity].plural}. Remove this condition.</p>;
  const t = f.type;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <FieldSelect
        entity={entity}
        value={c.field}
        onChange={(field) => {
          const nf = SCHEMA[entity].fields[field];
          const op = OPS_FOR[nf.type].includes(c.op) ? c.op : OPS_FOR[nf.type][0];
          onChange({ ...c, field, op, value: defaultValue(nf.type, op, nf.enumValues), value2: TWO_VALUE_OPS.has(op) ? defaultValue(nf.type, op, nf.enumValues) : undefined });
        }}
      />
      <OpAndValues
        entity={entity}
        field={c.field}
        type={t}
        enumValues={f.enumValues}
        op={c.op}
        value={c.value}
        value2={c.value2}
        onChange={(op, value, value2) => onChange({ ...c, op, value, value2 })}
      />
      {f.hint && <span className="w-full text-xs text-muted-foreground">{f.hint}</span>}
    </div>
  );
}

function RelatedConditionEditor({ entity, c, onChange }: { entity: EntityKey; c: Extract<Condition, { kind: "related" }>; onChange: (c: Condition) => void }) {
  const rel = SCHEMA[entity].relations[c.relation];
  if (!rel) return <p className="text-xs text-red-500">&quot;{c.relation}&quot; is no longer a connection of {SCHEMA[entity].plural}. Remove this condition.</p>;
  const target = rel.target;
  const measured = !!(c.measure || c.op);
  const m: Measure = c.measure ?? { agg: "count" };
  const mType: FieldType = m.agg === "count" || m.agg === "countDistinct" ? "number" : (SCHEMA[target].fields[m.field ?? ""]?.type ?? "number");
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {rel.cardinality === "many" ? (
          <select
            className={SEL}
            value={measured ? "measure" : "has"}
            onChange={(e) => onChange(e.target.value === "has" ? { ...c, measure: undefined, op: undefined, value: undefined, value2: undefined } : { ...c, measure: { agg: "count" }, op: ">=", value: 1 })}
          >
            <option value="has">has at least one</option>
            <option value="measure">count or total</option>
          </select>
        ) : (
          <span>its</span>
        )}
        {measured && rel.cardinality === "many" && <MeasureEditor entity={target} measure={m} onChange={(measure) => onChange({ ...c, measure, value: measure.agg === "count" || measure.agg === "countDistinct" ? 1 : defaultValue(SCHEMA[target].fields[measure.field ?? ""]?.type ?? "number", c.op ?? ">=") })} />}
        <select className={SEL} value={c.relation} onChange={(e) => onChange({ ...c, relation: e.target.value, where: [], measure: undefined, op: undefined, value: undefined })}>
          {Object.entries(SCHEMA[entity].relations).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
        </select>
        {measured && rel.cardinality === "many" && (
          <OpAndValues entity={target} type={mType} op={c.op ?? ">="} value={c.value} value2={c.value2} onChange={(op, value, value2) => onChange({ ...c, op, value, value2 })} />
        )}
        <span className="text-muted-foreground">{rel.cardinality === "one" ? "matches" : "where"}</span>
      </div>
      <ConditionList entity={target} conds={c.where} onChange={(where) => onChange({ ...c, where })} />
    </div>
  );
}

// ── Operator + value(s) ────────────────────────────────────────────────
function OpAndValues({
  entity, field, type, enumValues, op, value, value2, onChange,
}: {
  entity: EntityKey;
  field?: string;
  type: FieldType;
  enumValues?: string[];
  op: Op;
  value?: ValueArg;
  value2?: ValueArg;
  onChange: (op: Op, v?: ValueArg, v2?: ValueArg) => void;
}) {
  return (
    <>
      <select
        className={SEL}
        value={op}
        onChange={(e) => {
          const nop = e.target.value as Op;
          const keep = LIST_OPS.has(nop) === LIST_OPS.has(op) && !NO_VALUE_OPS.has(op) && !NO_VALUE_OPS.has(nop);
          onChange(nop, keep ? value : defaultValue(type, nop, enumValues), TWO_VALUE_OPS.has(nop) ? (value2 ?? defaultValue(type, nop, enumValues)) : undefined);
        }}
      >
        {OPS_FOR[type].map((o) => <option key={o} value={o}>{opLabel(o, type)}</option>)}
      </select>
      {!NO_VALUE_OPS.has(op) && (
        <ValueEditor
          entity={entity}
          field={field}
          type={type}
          enumValues={enumValues}
          list={LIST_OPS.has(op)}
          value={value}
          onChange={(v) => onChange(op, v, value2)}
          useListOp={OPS_FOR[type].includes("in") ? () => onChange("in", value, undefined) : undefined}
        />
      )}
      {TWO_VALUE_OPS.has(op) && (
        <>
          <span className="text-muted-foreground">and</span>
          <ValueEditor entity={entity} field={field} type={type} enumValues={enumValues} list={false} value={value2} onChange={(v) => onChange(op, value, v)} />
        </>
      )}
    </>
  );
}

function ValueEditor({
  entity, field, type, enumValues, list, value, onChange, useListOp,
}: {
  entity: EntityKey;
  field?: string;
  type: FieldType;
  enumValues?: string[];
  list: boolean;
  value?: ValueArg;
  onChange: (v: ValueArg) => void;
  /** Switches the operator to "is any of": the fix for a sub-hook that returns a list. */
  useListOp?: () => void;
}) {
  const ref = field ? SCHEMA[entity].fields[field]?.ref : undefined;
  const hookMode = isHook(value);
  const toggle = (
    <select
      className={SEL}
      value={hookMode ? "hook" : "value"}
      title="A sub-hook is another complete hook. Its result flows into this value through a tunnel."
      onChange={(e) => {
        if (e.target.value === "value") return onChange(defaultValue(type, list ? "in" : "=", enumValues) as ValueArg);
        onChange({ hook: starterHook(type, ref, list) });
      }}
    >
      <option value="value">a value I type</option>
      <option value="hook">the result of a sub-hook (tunnel)</option>
    </select>
  );
  if (hookMode) {
    const sub = (value as { hook: HookSpec }).hook;
    const ret = safeReturned(sub);
    let problem: string | null = null;
    let fix: (() => void) | null = null;
    if (ret) {
      if (ret.type !== type) problem = `This slot needs ${TYPE_LABEL[type]}, but the sub-hook returns ${TYPE_LABEL[ret.type]}.`;
      else if (ret.ref && ref && ret.ref !== ref) problem = `This slot needs ${ref} ids, but the sub-hook returns ${ret.ref} ids.`;
      else if (ret.shape === "list" && !list) {
        problem = "The sub-hook returns a list, but this operator takes one value.";
        if (useListOp) fix = useListOp;
      }
    }
    return (
      <div className="w-full space-y-1">
        {toggle}
        <div className={`rounded-lg border border-dashed p-2 ${problem ? "border-red-500/60 bg-red-500/5" : "border-primary/40 bg-primary/5"}`}>
          <p className="mb-1 text-xs text-muted-foreground">
            Sub-hook: a separate, complete hook. Its result flows into this value through a tunnel ({list ? "a list works here" : "one value works here"}, type {TYPE_LABEL[type]}).
          </p>
          <SpecEditor spec={sub} onChange={(hook) => onChange({ hook })} />
          <p className={`mt-1 text-xs ${problem ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`} role={problem ? "alert" : undefined}>
            {problem ?? "Fits: what the sub-hook returns can flow into this slot."}
            {fix && <button type="button" className="ml-2 underline" onClick={fix}>Use &quot;is any of&quot; instead</button>}
          </p>
        </div>
      </div>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      <TypeBadge type={type} />
      <LiteralEditor entity={entity} field={field} type={type} enumValues={enumValues} list={list} value={value} onChange={onChange} />
      {toggle}
    </span>
  );
}

function LiteralEditor({
  entity, field, type, enumValues, list, value, onChange,
}: {
  entity: EntityKey;
  field?: string;
  type: FieldType;
  enumValues?: string[];
  list: boolean;
  value?: ValueArg;
  onChange: (v: ValueArg) => void;
}) {
  const [hints, setHints] = useState<string[]>([]);
  const suggestable = !!field && type === "text";
  useEffect(() => {
    if (!suggestable) return;
    let live = true;
    suggestHookValues(entity, field!)
      .then((r) => live && setHints(r.map((x) => x.value)))
      .catch((e) => hookLog.warn("suggestions failed", e));
    return () => {
      live = false;
    };
  }, [entity, field, suggestable]);
  const listId = `hk-${entity}-${field}`;

  if (list) {
    const arr = Array.isArray(value) ? (value as (string | number)[]) : [];
    const numeric = type !== "text" && type !== "enum";
    return (
      <span className="flex flex-wrap items-center gap-1">
        {arr.map((x, i) => (
          <button key={`${x}-${i}`} type="button" className="rounded-full border px-2 py-0.5 text-xs" title="Remove" onClick={() => onChange(arr.filter((_, j) => j !== i) as string[])}>{String(x)} x</button>
        ))}
        {type === "enum" ? (
          <select className={SEL} value="" onChange={(e) => e.target.value && onChange([...new Set([...(arr as string[]), e.target.value])])}>
            <option value="">add...</option>
            {enumValues?.map((v) => <option key={v}>{v}</option>)}
          </select>
        ) : (
          <>
            <Input
              className="h-8 w-44"
              list={listId}
              placeholder="type, press Enter"
              onKeyDown={(e) => {
                const el = e.currentTarget;
                if (e.key !== "Enter" || !el.value.trim()) return;
                e.preventDefault();
                const v = numeric ? Number(el.value) : el.value.trim();
                onChange([...arr, v] as string[]);
                el.value = "";
              }}
            />
            <datalist id={listId}>{hints.map((h) => <option key={h} value={h} />)}</datalist>
          </>
        )}
      </span>
    );
  }

  switch (type) {
    case "duration": {
      const d = typeof value === "object" && value && "amount" in value ? value : { amount: 0, unit: "sec" as DurationUnit };
      return (
        <span className="flex items-center gap-1">
          <Input type="number" min={0} className="h-8 w-20" value={d.amount} onChange={(e) => onChange({ ...d, amount: Number(e.target.value) })} />
          <select className={SEL} value={d.unit} onChange={(e) => onChange({ ...d, unit: e.target.value as DurationUnit })}>
            {DUR_UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </span>
      );
    }
    case "time": {
      const rel = typeof value === "object" && value && "ago" in value ? value : null;
      return (
        <span className="flex items-center gap-1">
          <select className={SEL} value={rel ? "rel" : "abs"} onChange={(e) => onChange(e.target.value === "rel" ? { ago: 7, unit: "day" } : new Date().toISOString())}>
            <option value="rel">time ago</option>
            <option value="abs">exact date</option>
          </select>
          {rel ? (
            <>
              <Input type="number" min={0} className="h-8 w-16" value={rel.ago} onChange={(e) => onChange({ ...rel, ago: Number(e.target.value) })} />
              <select className={SEL} value={rel.unit} onChange={(e) => onChange({ ...rel, unit: e.target.value as RelativeUnit })}>
                {REL_UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
              <span className="text-muted-foreground">ago</span>
            </>
          ) : (
            <Input
              type="datetime-local"
              className="h-8 w-52"
              value={typeof value === "string" ? toLocalInput(value) : ""}
              onChange={(e) => e.target.value && onChange(new Date(e.target.value).toISOString())}
            />
          )}
        </span>
      );
    }
    case "enum":
      return (
        <select className={SEL} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
          {enumValues?.map((v) => <option key={v}>{v}</option>)}
        </select>
      );
    case "text":
      return (
        <>
          <Input className="h-8 w-48" list={listId} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
          <datalist id={listId}>{hints.map((h) => <option key={h} value={h} />)}</datalist>
        </>
      );
    default:
      return (
        <span className="flex items-center gap-1">
          <Input type="number" className="h-8 w-24" value={typeof value === "number" ? value : 0} onChange={(e) => onChange(Number(e.target.value))} />
          {type === "percent" && <span>%</span>}
          {type === "px" && <span>px</span>}
        </span>
      );
  }
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
