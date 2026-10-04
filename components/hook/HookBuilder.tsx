// components/hook/HookBuilder.tsx
// The Hook query builder: one recursive editor for a HookSpec. The same
// SpecEditor builds the main query AND every sub-hook tunneled into a field
// value, so a tunnel is literally "another hook, inline". Everything it
// offers comes from jh-hook/schema.ts: add a field there and it appears
// here with the right operators and value editor, no UI change needed.
// See jh-hook/ui-ux.md.
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AGGS_FOR, AGG_LABEL, LIST_OPS, NO_VALUE_OPS, OPS_FOR, OP_LABEL, SCHEMA, TIME_OP_LABEL, TWO_VALUE_OPS,
  type Agg, type EntityKey, type FieldType, type Op,
} from "@/jh-hook/schema";
import type { Condition, DurationUnit, HookSpec, Measure, Output, RelativeUnit, ValueArg } from "@/jh-hook/types";
import { suggestHookValues } from "@/lib/actions/hook.action";

export const SEL = "h-8 rounded-md border bg-background px-2 text-sm";
const DUR_UNITS: DurationUnit[] = ["ms", "sec", "min", "hr", "day"];
const REL_UNITS: RelativeUnit[] = ["minute", "hour", "day", "week", "month"];
const ENTITIES = Object.keys(SCHEMA) as EntityKey[];

export const newId = () => "c" + Math.random().toString(36).slice(2, 8);
const isHook = (v: ValueArg | undefined): v is { hook: HookSpec } => typeof v === "object" && v !== null && !Array.isArray(v) && "hook" in v;

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

// ── Spec (entity + conditions + output) ────────────────────────────────
export function SpecEditor({
  spec,
  onChange,
  outputShapes,
}: {
  spec: HookSpec;
  onChange: (s: HookSpec) => void;
  /** Restrict outputs (sub-hooks): "one" = single value, "list" = ids/values. */
  outputShapes?: "one" | "list";
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <OutputEditor entity={spec.entity} output={spec.output} onChange={(output) => onChange({ ...spec, output })} restrict={outputShapes} />
        <span className="text-muted-foreground">of</span>
        <select
          className={SEL}
          value={spec.entity}
          onChange={(e) => {
            const entity = e.target.value as EntityKey;
            const output: Output = outputShapes === "list" ? { kind: "ids" } : { kind: "count" };
            onChange({ ...spec, entity, where: [], output, order: undefined });
          }}
        >
          {ENTITIES.map((k) => <option key={k} value={k}>{SCHEMA[k].plural}</option>)}
        </select>
        <span className="text-muted-foreground">where</span>
      </div>
      <ConditionList entity={spec.entity} conds={spec.where} onChange={(where) => onChange({ ...spec, where })} />
    </div>
  );
}

// ── Output ─────────────────────────────────────────────────────────────
function OutputEditor({ entity, output, onChange, restrict }: { entity: EntityKey; output: Output; onChange: (o: Output) => void; restrict?: "one" | "list" }) {
  const fields = Object.entries(SCHEMA[entity].fields);
  const firstField = fields[0][0];
  const numericFields = fields.filter(([, f]) => AGGS_FOR[f.type].some((a) => a !== "countDistinct"));
  const kinds: { k: Output["kind"]; label: string; shape: "one" | "list" | "table" }[] = [
    { k: "count", label: "how many", shape: "one" },
    { k: "countDistinct", label: "how many different", shape: "one" },
    { k: "aggregate", label: "a measure of", shape: "one" },
    { k: "ids", label: "the ids", shape: "list" },
    { k: "values", label: "the values of", shape: "list" },
    { k: "groupBy", label: "a breakdown", shape: "table" },
  ];
  const allowed = kinds.filter((x) => !restrict || x.shape === restrict);
  const setKind = (k: Output["kind"]) => {
    const nf = numericFields[0]?.[0] ?? firstField;
    const o: Output =
      k === "count" ? { kind: "count" }
      : k === "countDistinct" ? { kind: "countDistinct", field: firstField }
      : k === "aggregate" ? { kind: "aggregate", agg: "avg", field: nf }
      : k === "ids" ? { kind: "ids" }
      : k === "values" ? { kind: "values", field: firstField }
      : { kind: "groupBy", field: firstField, measure: { agg: "count" } };
    onChange(o);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={SEL} value={output.kind} onChange={(e) => setKind(e.target.value as Output["kind"])}>
        {allowed.map((x) => <option key={x.k} value={x.k}>{x.label}</option>)}
      </select>
      {output.kind === "aggregate" && (
        <>
          <select className={SEL} value={output.agg} onChange={(e) => onChange({ ...output, agg: e.target.value as typeof output.agg })}>
            {AGGS_FOR[SCHEMA[entity].fields[output.field]?.type ?? "number"].filter((a) => a !== "countDistinct").map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
          </select>
          {output.agg === "percentile" && <Input type="number" className="h-8 w-16" value={output.p ?? 90} onChange={(e) => onChange({ ...output, p: Number(e.target.value) })} />}
          <FieldSelect entity={entity} value={output.field} onChange={(field) => onChange({ ...output, field })} filter={(t) => AGGS_FOR[t].some((a) => a !== "countDistinct")} />
        </>
      )}
      {(output.kind === "countDistinct" || output.kind === "values") && <FieldSelect entity={entity} value={output.field} onChange={(field) => onChange({ ...output, field })} />}
      {output.kind === "groupBy" && (
        <>
          <MeasureEditor entity={entity} measure={output.measure} onChange={(measure) => onChange({ ...output, measure })} />
          <span className="text-muted-foreground">per</span>
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
          <Input type="number" className="h-8 w-16" value={output.limit ?? 50} onChange={(e) => onChange({ ...output, limit: Number(e.target.value) })} />
        </>
      )}
    </div>
  );
}

function FieldSelect({ entity, value, onChange, filter }: { entity: EntityKey; value: string; onChange: (f: string) => void; filter?: (t: FieldType) => boolean }) {
  return (
    <select className={SEL} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(SCHEMA[entity].fields)
        .filter(([, f]) => !filter || filter(f.type))
        .map(([k, f]) => <option key={k} value={k} title={f.hint}>{f.label}</option>)}
    </select>
  );
}

function MeasureEditor({ entity, measure, onChange }: { entity: EntityKey; measure: Measure; onChange: (m: Measure) => void }) {
  const t = measure.field ? SCHEMA[entity].fields[measure.field]?.type : undefined;
  const aggs: Agg[] = ["count", ...(t ? AGGS_FOR[t] : [])];
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
        {allAggs.map((a) => <option key={a} value={a} disabled={!!t && !aggs.includes(a) && a !== measure.agg}>{AGG_LABEL[a]}</option>)}
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
  const firstField = Object.keys(SCHEMA[entity].fields)[0];
  const firstRel = Object.keys(SCHEMA[entity].relations)[0];
  const add = (kind: Condition["kind"]) => {
    const id = newId();
    const t = SCHEMA[entity].fields[firstField].type;
    const op = OPS_FOR[t][0];
    const c: Condition =
      kind === "field" ? { id, kind, field: firstField, op, value: defaultValue(t, op, SCHEMA[entity].fields[firstField].enumValues) }
      : kind === "related" ? { id, kind, relation: firstRel, where: [] }
      : { id, kind, mode: "or", where: [] };
    onChange([...conds, c]);
  };
  return (
    <div className="space-y-2 border-l pl-3">
      {conds.map((c, i) => (
        <div key={c.id} className="rounded-md border bg-card/50 p-2">
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              {c.kind === "field" && <FieldConditionEditor entity={entity} c={c} onChange={(x) => set(i, x)} />}
              {c.kind === "related" && <RelatedConditionEditor entity={entity} c={c} onChange={(x) => set(i, x)} />}
              {c.kind === "group" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!!c.not} onChange={(e) => set(i, { ...c, not: e.target.checked })} /> not</label>
                    <select className={SEL} value={c.mode} onChange={(e) => set(i, { ...c, mode: e.target.value as "and" | "or" })}>
                      <option value="or">any of these</option>
                      <option value="and">all of these</option>
                    </select>
                  </div>
                  <ConditionList entity={entity} conds={c.where} onChange={(where) => set(i, { ...c, where })} />
                </div>
              )}
            </div>
            <span className="pt-1.5 font-mono text-[10px] text-muted-foreground">{c.id}</span>
            <Button variant="ghost" size="sm" onClick={() => del(i)}>Remove</Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => add("field")}>+ Field</Button>
        {firstRel && <Button variant="outline" size="sm" onClick={() => add("related")}>+ Related rows</Button>}
        <Button variant="outline" size="sm" onClick={() => add("group")}>+ Group (or / not)</Button>
      </div>
    </div>
  );
}

function FieldConditionEditor({ entity, c, onChange }: { entity: EntityKey; c: Extract<Condition, { kind: "field" }>; onChange: (c: Condition) => void }) {
  const f = SCHEMA[entity].fields[c.field];
  const t = f?.type ?? "text";
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
        enumValues={f?.enumValues}
        op={c.op}
        value={c.value}
        value2={c.value2}
        onChange={(op, value, value2) => onChange({ ...c, op, value, value2 })}
      />
      {f?.hint && <span className="w-full text-xs text-muted-foreground">{f.hint}</span>}
    </div>
  );
}

function RelatedConditionEditor({ entity, c, onChange }: { entity: EntityKey; c: Extract<Condition, { kind: "related" }>; onChange: (c: Condition) => void }) {
  const rel = SCHEMA[entity].relations[c.relation];
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
            <option value="has">has</option>
            <option value="measure">measure</option>
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
          const keep = (LIST_OPS.has(nop) === LIST_OPS.has(op)) && !NO_VALUE_OPS.has(op) && !NO_VALUE_OPS.has(nop);
          onChange(nop, keep ? value : defaultValue(type, nop, enumValues), TWO_VALUE_OPS.has(nop) ? (value2 ?? defaultValue(type, nop, enumValues)) : undefined);
        }}
      >
        {OPS_FOR[type].map((o) => <option key={o} value={o}>{opLabel(o, type)}</option>)}
      </select>
      {!NO_VALUE_OPS.has(op) && (
        <ValueEditor entity={entity} field={field} type={type} enumValues={enumValues} list={LIST_OPS.has(op)} value={value} onChange={(v) => onChange(op, v, value2)} />
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
  const hookMode = isHook(value);
  const toggle = (
    <select
      className={SEL}
      value={hookMode ? "hook" : "value"}
      title="A sub-hook: the output of another query becomes this value"
      onChange={(e) => {
        if (e.target.value === "value") return onChange(defaultValue(type, list ? "in" : "=", enumValues) as ValueArg);
        const sub: HookSpec = { v: 2, entity: "pageView", where: [], output: list ? { kind: "values", field: "page" } : { kind: "count" } };
        onChange({ hook: sub });
      }}
    >
      <option value="value">value</option>
      <option value="hook">result of a sub-hook</option>
    </select>
  );
  if (hookMode) {
    return (
      <div className="w-full space-y-1">
        {toggle}
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
          <p className="mb-1 text-xs text-muted-foreground">
            Sub-hook: its {list ? "list of values" : "single value"} becomes this {type}. It must return {list ? "ids or values" : "a count or a measure"} of the same type.
          </p>
          <SpecEditor spec={(value as { hook: HookSpec }).hook} onChange={(hook) => onChange({ hook })} outputShapes={list ? "list" : "one"} />
        </div>
      </div>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
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
  const suggestable = !!field && (type === "text" || type === "enum");
  useEffect(() => {
    if (!suggestable || type === "enum") return;
    let live = true;
    suggestHookValues(entity, field!).then((r) => live && setHints(r.map((x) => x.value))).catch(() => {});
    return () => {
      live = false;
    };
  }, [entity, field, suggestable, type]);
  const listId = `hk-${entity}-${field}`;

  if (list) {
    const arr = Array.isArray(value) ? (value as (string | number)[]) : [];
    const numeric = type !== "text" && type !== "enum";
    return (
      <span className="flex flex-wrap items-center gap-1">
        {arr.map((x, i) => (
          <button key={`${x}-${i}`} className="rounded-full border px-2 py-0.5 text-xs" onClick={() => onChange(arr.filter((_, j) => j !== i) as string[])}>{String(x)} x</button>
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
