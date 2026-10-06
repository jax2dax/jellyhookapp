// jh-hook/describe.ts
// Spec -> plain English. Used by the explain panel ("what the engine did")
// and by the builder UI, so a query always reads back as a sentence.
// Client-safe: no SQL here.
import { AGG_LABEL, OP_LABEL, SCHEMA, TIME_OP_LABEL, TWO_VALUE_OPS, NO_VALUE_OPS, type EntityKey, type FieldType } from "./schema";
import type { Condition, HookSpec, Measure, Output, ValueArg } from "./types";

function lit(v: ValueArg | undefined, type: FieldType | null): string {
  if (v === undefined) return "?";
  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    if ("hook" in v) return `[from a sub-hook: ${describeSpec(v.hook)}]`;
    if ("amount" in v) return `${v.amount} ${v.unit}`;
    if ("ago" in v) return `${v.ago} ${v.unit}${v.ago === 1 ? "" : "s"} ago`;
  }
  if (Array.isArray(v)) return v.join(", ");
  if (type === "percent") return `${v}%`;
  if (type === "time" && typeof v === "string") return v.slice(0, 16).replace("T", " ");
  return String(v);
}

function fieldLabel(entity: EntityKey, field: string | undefined): string {
  return (field && SCHEMA[entity]?.fields[field]?.label) || field || "?";
}

export function describeMeasure(entity: EntityKey, m: Measure | undefined, plural: string): string {
  if (!m || m.agg === "count") return `number of ${plural}`;
  const label = fieldLabel(entity, m.field);
  if (m.agg === "percentile") return `${m.p ?? 90}th percentile ${label} of ${plural}`;
  if (m.agg === "countDistinct") return `number of different ${label}s among ${plural}`;
  return `${AGG_LABEL[m.agg]} ${label} of ${plural}`;
}

function opText(op: string, type: FieldType | null): string {
  return (type === "time" && TIME_OP_LABEL[op as keyof typeof TIME_OP_LABEL]) || OP_LABEL[op as keyof typeof OP_LABEL] || op;
}

function comparison(op: string | undefined, v: ValueArg | undefined, v2: ValueArg | undefined, type: FieldType | null): string {
  if (!op) return "";
  if (NO_VALUE_OPS.has(op as never)) return opText(op, type);
  if (TWO_VALUE_OPS.has(op as never)) return `${opText(op, type)} ${lit(v, type)} and ${lit(v2, type)}`;
  return `${opText(op, type)} ${lit(v, type)}`;
}

export function describeCondition(c: Condition, entity: EntityKey): string {
  if (c.kind === "field") {
    const f = SCHEMA[entity]?.fields[c.field];
    return `${f?.label ?? c.field} ${comparison(c.op, c.value, c.value2, f?.type ?? null)}`;
  }
  if (c.kind === "group") {
    const inner = c.where.map((x) => describeCondition(x, entity)).join(c.mode === "and" ? " and " : " or ");
    return `${c.not ? "not " : ""}(${inner || "anything"})`;
  }
  const rel = SCHEMA[entity]?.relations[c.relation];
  if (!rel) return c.relation;
  const target = rel.target;
  const where = c.where.length ? ` where ${c.where.map((x) => describeCondition(x, target)).join(" and ")}` : "";
  if (rel.cardinality === "one") return `${rel.label} matches${where || " anything"}`;
  if (!c.measure && !c.op) return `has ${SCHEMA[target].plural}${where}`;
  const m = c.measure ?? { agg: "count" as const };
  const mType = m.agg === "count" || m.agg === "countDistinct" ? "number" : (SCHEMA[target].fields[m.field ?? ""]?.type ?? null);
  return `${describeMeasure(target, m, rel.label)}${where} ${comparison(c.op ?? ">=", c.value ?? 1, c.value2, mType)}`;
}

export function describeOutput(entity: EntityKey, o: Output): string {
  const plural = SCHEMA[entity]?.plural ?? entity;
  switch (o.kind) {
    case "count":
      return `the number of ${plural}`;
    case "countDistinct":
      return `the number of different ${fieldLabel(entity, o.field)} among ${plural}`;
    case "ids":
      return `a list of ${SCHEMA[entity]?.label ?? entity} ids of ${plural}`;
    case "values":
      return `a list of ${fieldLabel(entity, o.field)} values of ${plural}`;
    case "aggregate":
      return describeMeasure(entity, { agg: o.agg, field: o.field, p: o.p }, plural);
    case "groupBy":
      return `a breakdown: ${describeMeasure(entity, o.measure, plural)}, for each ${o.bucket ? o.bucket + " of " : ""}${fieldLabel(entity, o.field)}`;
  }
}

export function describeSpec(s: HookSpec): string {
  const where = s.where.length ? ` where ${s.where.map((c) => describeCondition(c, s.entity)).join(" and ")}` : "";
  return `${describeOutput(s.entity, s.output)}${where}`;
}
