// jh-hook/engine/validate.ts
// Structural checks before any SQL exists: shape, sizes, nesting depth,
// unique ids. Specs arrive from a URL and from the browser, so nothing here
// is trusted. Type checks (does this operator fit this field, does this
// sub-hook's output fit this field) happen in compile.ts, where the types are.
import { SCHEMA } from "../schema";
import type { Condition, HookSpec, ValueArg } from "../types";

const MAX_CONDITIONS = 60; // across the whole tree, sub-hooks included
const MAX_DEPTH = 6; // groups, relations and sub-hooks all count as a level
const MAX_LIST = 500;
const MAX_TEXT = 200;
const OUTPUTS = new Set(["count", "countDistinct", "ids", "values", "aggregate", "groupBy"]);

export function validateSpec(spec: HookSpec): void {
  const counter = { n: 0 };
  checkSpec(spec, 0, counter, "Hook");
  if (spec.order?.mode === "manual") {
    const top = new Set(spec.where.map((c) => c.id));
    for (const id of spec.order.steps ?? []) if (!top.has(id)) throw new Error(`Order refers to "${id}", which is not a top-level condition`);
  }
}

function checkSpec(spec: HookSpec, depth: number, counter: { n: number }, where: string): void {
  if (!spec || typeof spec !== "object" || spec.v !== 2) throw new Error(`${where}: unsupported spec version`);
  if (!SCHEMA[spec.entity]) throw new Error(`${where}: unknown entity "${String(spec.entity)}"`);
  if (!spec.output || !OUTPUTS.has(spec.output.kind)) throw new Error(`${where}: unknown output`);
  if (!Array.isArray(spec.where)) throw new Error(`${where}: conditions must be a list`);
  const ids = new Set<string>();
  checkConds(spec.where, depth + 1, counter, ids, where);
}

function checkValue(v: ValueArg | undefined, depth: number, counter: { n: number }, where: string): void {
  if (v === undefined || v === null) return;
  if (typeof v === "string" && v.length > MAX_TEXT) throw new Error(`${where}: text is longer than ${MAX_TEXT} characters`);
  if (Array.isArray(v)) {
    if (v.length > MAX_LIST) throw new Error(`${where}: lists are limited to ${MAX_LIST} values`);
    for (const x of v) if (typeof x === "string" && x.length > MAX_TEXT) throw new Error(`${where}: a list value is too long`);
  }
  if (typeof v === "object" && !Array.isArray(v) && "hook" in v) checkSpec(v.hook, depth + 1, counter, `${where} sub-hook`);
}

function checkConds(conds: Condition[], depth: number, counter: { n: number }, ids: Set<string>, where: string): void {
  if (depth > MAX_DEPTH) throw new Error(`${where}: nested more than ${MAX_DEPTH} levels deep`);
  for (const c of conds) {
    if (++counter.n > MAX_CONDITIONS) throw new Error(`Too many conditions (max ${MAX_CONDITIONS})`);
    if (!c || typeof c.id !== "string" || !c.id) throw new Error(`${where}: every condition needs an id`);
    if (ids.has(c.id)) throw new Error(`${where}: condition id "${c.id}" is used twice`);
    ids.add(c.id);
    const here = `Condition "${c.id}"`;
    if (c.kind === "field") {
      checkValue(c.value, depth, counter, here);
      checkValue(c.value2, depth, counter, here);
    } else if (c.kind === "related") {
      if (!Array.isArray(c.where)) throw new Error(`${here}: conditions must be a list`);
      checkValue(c.value, depth, counter, here);
      checkValue(c.value2, depth, counter, here);
      checkConds(c.where, depth + 1, counter, ids, where);
    } else if (c.kind === "group") {
      if (c.mode !== "and" && c.mode !== "or") throw new Error(`${here}: group must be "and" or "or"`);
      checkConds(c.where, depth + 1, counter, ids, where);
    } else {
      throw new Error(`${here}: unknown condition kind`);
    }
  }
}
