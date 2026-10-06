// jh-hook/shape.ts
// What a hook RETURNS, computed from the spec alone (no SQL, client-safe).
// The engine uses it to type-check tunnels; the builder uses it to show the
// return type next to every output and every sub-hook, and to say whether a
// sub-hook fits the value slot it was dropped into.
import { OPS_FOR, SCHEMA, aggType, type EntityKey, type FieldType, type Op, type RefKind } from "./schema";
import type { HookSpec } from "./types";

export interface Returned {
  /** one: a single value. list: many values. */
  shape: "one" | "list";
  type: FieldType;
  /** Identity of an id/path list: visitor ids can only feed visitor fields, and so on. */
  ref?: RefKind;
  /** Plain-language description, for the UI and the explain panel. */
  noun: string;
}

export class ShapeError extends Error {}

function field(spec: HookSpec, key: string) {
  const f = SCHEMA[spec.entity]?.fields[key];
  if (!f) throw new ShapeError(`"${key}" is not a field of ${SCHEMA[spec.entity]?.plural ?? String(spec.entity)}`);
  return f;
}

export function returnedBy(spec: HookSpec): Returned {
  const o = spec.output;
  const e = SCHEMA[spec.entity];
  switch (o.kind) {
    case "count":
      return { shape: "one", type: "number", noun: `a number (how many ${e.plural})` };
    case "countDistinct":
      return { shape: "one", type: "number", noun: `a number (how many different ${field(spec, o.field).label})` };
    case "aggregate": {
      const f = field(spec, o.field);
      return { shape: "one", type: aggType(o.agg, f.type), noun: `one value (${o.agg} of ${f.label})` };
    }
    case "ids":
      return { shape: "list", type: "text", ref: e.ref, noun: `a list of ${e.label} ids` };
    case "values": {
      const f = field(spec, o.field);
      return { shape: "list", type: f.type, ref: f.ref, noun: `a list of ${f.label} values` };
    }
    case "groupBy": {
      const f = field(spec, o.field);
      return { shape: "list", type: o.bucket ? "time" : f.type, ref: o.bucket ? undefined : f.ref, noun: `a list of ${f.label}${o.bucket ? " (per " + o.bucket + ")" : ""}, one per row of the breakdown` };
    }
  }
}

// ── Where a hook's result can flow (used to turn a hook into a sub-hook) ──

export interface Slot {
  entity: EntityKey;
  field: string;
  op: Op;
}

/**
 * Every field, on every entity, that can receive this result through a
 * tunnel: same type, same kind of id, and an operator that takes it (a list
 * needs "is any of", one value takes a comparison). Ordered so the most
 * natural slot comes first: matching ids, then fields with no id meaning.
 */
export function slotsFor(r: Returned): Slot[] {
  const out: (Slot & { rank: number })[] = [];
  for (const [entity, def] of Object.entries(SCHEMA) as [EntityKey, (typeof SCHEMA)[EntityKey]][]) {
    for (const [field, f] of Object.entries(def.fields)) {
      if (f.type !== r.type) continue;
      if (r.ref && f.ref && f.ref !== r.ref) continue;
      if (r.ref && !f.ref) continue; // ids only flow into fields that hold the same ids
      const ops = OPS_FOR[f.type];
      const op: Op | undefined = r.shape === "list" ? (ops.includes("in") ? "in" : undefined) : ops.includes(">") ? ">" : ops.includes("=") ? "=" : undefined;
      if (!op) continue;
      out.push({ entity, field, op, rank: r.ref && f.ref === r.ref ? 0 : 1 });
    }
  }
  return out.sort((a, b) => a.rank - b.rank).map(({ entity, field, op }) => ({ entity, field, op }));
}
