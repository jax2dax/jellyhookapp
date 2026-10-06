// jh-hook/engine/validate.ts
// Structural checks before any SQL exists: shape, sizes, nesting depth,
// unique ids. Specs arrive from a URL and from the browser, so nothing here
// is trusted. Type checks (does this operator fit this field, does this
// sub-hook's output fit this field) happen in compile.ts, where the types are.
import { SCHEMA } from "../schema";
import { HookError } from "../errors";
import { MAX_SPACE_BEFORE, SPEC_VERSION, type BlockUi, type Condition, type HookSpec, type Meta, type ValueArg } from "../types";

const MAX_CONDITIONS = 60; // across the whole tree, sub-hooks included
const MAX_DEPTH = 6; // groups, relations and sub-hooks all count as a level
const MAX_LIST = 500;
const MAX_TEXT = 200;
const MAX_NAME = 80;
const MAX_DESCRIPTION = 500;
const OUTPUTS = new Set(["count", "countDistinct", "ids", "values", "aggregate", "groupBy"]);

export function validateSpec(spec: HookSpec): void {
  const counter = { n: 0 };
  checkSpec(spec, 0, counter, "Hook");
  if (spec.order?.mode === "manual") {
    const top = new Set(spec.where.map((c) => c.id));
    for (const id of spec.order.steps ?? []) if (!top.has(id)) throw new HookError(`Order refers to "${id}", which is not a top-level condition`);
  }
}

function checkSpec(spec: HookSpec, depth: number, counter: { n: number }, where: string): void {
  if (!spec || typeof spec !== "object" || spec.v !== SPEC_VERSION) throw new HookError(`${where}: unsupported query version (upgrade it with migrateSpec first)`);
  checkMeta(spec.meta, spec.ui, where);
  if (!SCHEMA[spec.entity]) throw new HookError(`${where}: unknown entity "${String(spec.entity)}"`);
  if (!spec.output || !OUTPUTS.has(spec.output.kind)) throw new HookError(`${where}: unknown output`);
  if (!Array.isArray(spec.where)) throw new HookError(`${where}: conditions must be a list`);
  const ids = new Set<string>();
  checkConds(spec.where, depth + 1, counter, ids, where);
}

function checkValue(v: ValueArg | undefined, depth: number, counter: { n: number }, where: string): void {
  if (v === undefined || v === null) return;
  if (typeof v === "string" && v.length > MAX_TEXT) throw new HookError(`${where}: text is longer than ${MAX_TEXT} characters`);
  if (Array.isArray(v)) {
    if (v.length > MAX_LIST) throw new HookError(`${where}: lists are limited to ${MAX_LIST} values`);
    for (const x of v) if (typeof x === "string" && x.length > MAX_TEXT) throw new HookError(`${where}: a list value is too long`);
  }
  if (typeof v === "object" && !Array.isArray(v) && "hook" in v) checkSpec(v.hook, depth + 1, counter, `${where} sub-hook`);
}

function checkConds(conds: Condition[], depth: number, counter: { n: number }, ids: Set<string>, where: string): void {
  if (depth > MAX_DEPTH) throw new HookError(`${where}: nested more than ${MAX_DEPTH} levels deep`);
  for (const c of conds) {
    if (++counter.n > MAX_CONDITIONS) throw new HookError(`Too many conditions (max ${MAX_CONDITIONS})`);
    if (!c || typeof c.id !== "string" || !c.id) throw new HookError(`${where}: every condition needs an id`);
    if (ids.has(c.id)) throw new HookError(`${where}: condition id "${c.id}" is used twice`);
    ids.add(c.id);
    const here = `Condition "${c.id}"`;
    checkMeta(c.meta, c.ui, here);
    if (c.kind === "field") {
      checkValue(c.value, depth, counter, here);
      checkValue(c.value2, depth, counter, here);
    } else if (c.kind === "related") {
      if (!Array.isArray(c.where)) throw new HookError(`${here}: conditions must be a list`);
      checkValue(c.value, depth, counter, here);
      checkValue(c.value2, depth, counter, here);
      checkConds(c.where, depth + 1, counter, ids, where);
    } else if (c.kind === "group") {
      if (c.mode !== "and" && c.mode !== "or") throw new HookError(`${here}: group must be "and" or "or"`);
      checkConds(c.where, depth + 1, counter, ids, where);
    } else {
      throw new HookError(`${here}: unknown condition kind`);
    }
  }
}

/** Names, notes and layout are free-form, so only their size and shape are checked. */
function checkMeta(meta: Meta | undefined, ui: BlockUi | undefined, where: string): void {
  if (meta !== undefined) {
    if (typeof meta !== "object" || meta === null) throw new HookError(`${where}: name and description must be an object`);
    if (meta.name !== undefined && (typeof meta.name !== "string" || meta.name.length > MAX_NAME)) throw new HookError(`${where}: names are limited to ${MAX_NAME} characters`);
    if (meta.description !== undefined && (typeof meta.description !== "string" || meta.description.length > MAX_DESCRIPTION))
      throw new HookError(`${where}: descriptions are limited to ${MAX_DESCRIPTION} characters`);
  }
  if (ui !== undefined) {
    if (typeof ui !== "object" || ui === null) throw new HookError(`${where}: layout must be an object`);
    if (ui.spaceBefore !== undefined && !(Number.isFinite(ui.spaceBefore) && ui.spaceBefore >= 0 && ui.spaceBefore <= MAX_SPACE_BEFORE))
      throw new HookError(`${where}: spacing must be between 0 and ${MAX_SPACE_BEFORE} px`);
  }
}
