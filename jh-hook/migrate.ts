// jh-hook/migrate.ts
// Old queries keep working. Every query that enters the engine (a URL, a
// pasted query, later a saved row in the database) passes through
// migrateSpec() first, which upgrades it step by step to SPEC_VERSION.
//
// The rule that keeps future changes from breaking saved queries:
//  - a breaking change (a field or relation removed or renamed, a property
//    whose meaning changes) bumps SPEC_VERSION and adds ONE upgrade step
//    here, from the previous version to the new one;
//  - an additive change (a new field, a new optional property) does not
//    bump anything;
//  - field and relation KEYS are permanent ids; LABELS can change freely
//    (that is why renaming "time on page" never broke a query).
// Steps are pure functions on plain JSON, tested in jh-hook/tests.
// Client-safe.
import { HookError } from "./errors";
import { SCHEMA, type EntityKey } from "./schema";
import { SPEC_VERSION, type Condition, type HookSpec } from "./types";

export interface Migrated {
  spec: HookSpec;
  /** The version the query arrived in, when it had to be upgraded. */
  upgradedFrom: number | null;
  /** Anything the upgrade could not carry over exactly. */
  notes: string[];
}

type Json = Record<string, unknown>;
const obj = (x: unknown): x is Json => typeof x === "object" && x !== null && !Array.isArray(x);

export function migrateSpec(input: unknown): Migrated {
  if (!obj(input) || typeof input.v !== "number") throw new HookError("This is not a Hook query (it has no version).");
  const from = input.v;
  if (from > SPEC_VERSION) throw new HookError(`This query was made by a newer version of Hook (v${from}). Reload the page.`);
  const notes: string[] = [];
  let spec: Json = input;
  if (spec.v === 1) spec = v1to2(spec, notes);
  if (spec.v === 2) spec = v2to3(spec, notes);
  return { spec: spec as unknown as HookSpec, upgradedFrom: from === SPEC_VERSION ? null : from, notes };
}

// ── v2 -> v3: the "its page" relation was removed (2026-10-05). On a page
// view or a form it only ever held conditions on the page's path, which is
// the same as the page field on the row itself. ───────────────────────────
function v2to3(spec: Json, notes: string[]): Json {
  const entity = spec.entity as EntityKey;
  return { ...spec, v: 3, where: up23((spec.where as Condition[]) ?? [], entity, notes) };
}

function up23(conds: Condition[], entity: EntityKey, notes: string[]): Condition[] {
  return conds.map((c) => up23one(c, entity, notes));
}

function up23one(c: Condition, entity: EntityKey, notes: string[]): Condition {
  const subs = (x: unknown) => (obj(x) && obj(x.hook) ? { hook: v2to3(x.hook as Json, notes) as unknown as HookSpec } : x);
  if (c.kind === "field") return { ...c, value: subs(c.value) as never, value2: subs(c.value2) as never };
  if (c.kind === "group") return { ...c, where: up23(c.where, entity, notes) };
  if (c.relation === "pageInfo" && (entity === "pageView" || entity === "form")) {
    const inner = pathToPage(c.where, c.id);
    if (!inner.length) return { id: c.id, kind: "field", field: "page", op: "isNotEmpty", meta: c.meta, ui: c.ui };
    if (inner.length === 1) return { ...inner[0], meta: c.meta ?? inner[0].meta, ui: c.ui };
    return { id: c.id, kind: "group", mode: "and", where: inner, meta: c.meta, ui: c.ui };
  }
  const target = SCHEMA[entity]?.relations[c.relation]?.target;
  return { ...c, value: subs(c.value) as never, value2: subs(c.value2) as never, where: target ? up23(c.where, target, notes) : c.where };
}

/** Conditions on the page entity's `path` become conditions on the row's `page`. */
function pathToPage(conds: Condition[], ownerId: string): Condition[] {
  return conds.map((c) => {
    if (c.kind === "field" && c.field === "path") return { ...c, field: "page" };
    if (c.kind === "group") return { ...c, where: pathToPage(c.where, ownerId) };
    throw new HookError(
      `Condition "${ownerId}" used "its page" with something other than the page address. That connection was removed; rebuild this part with the page field.`,
    );
  });
}

// ── v1 -> v2: the first version had a fixed list of filters. ──────────
const V1_ENTITY: Record<string, EntityKey> = { page_views: "pageView", sessions: "session", leads: "lead" };

function v1to2(spec: Json, notes: string[]): Json {
  const ret = (spec.return ?? {}) as Json;
  const entity = V1_ENTITY[String(ret.entity)];
  if (!entity) throw new HookError("This query is in an old format that can't be read.");
  const filters = (Array.isArray(spec.filters) ? spec.filters : []) as Json[];
  const where: Json[] = [];
  const pageLevel = filters.filter((f) => f.kind === "page" || f.kind === "timeOnPage");

  const pagePred = (f: Json): Json =>
    f.kind === "page"
      ? { id: `${f.id}`, kind: "field", field: "page", op: "in", value: f.paths }
      : { id: `${f.id}`, kind: "field", field: "timeOnPage", op: f.op, value: { amount: f.value, unit: f.unit } };

  // v1 folded page + time on page into ONE page view when returning sessions
  if (entity === "session" && pageLevel.length)
    where.push({ id: String(pageLevel[0].id), kind: "related", relation: "pageViews", where: pageLevel.map((f) => ({ ...pagePred(f), id: `${f.id}_pv` })) });

  for (const f of filters) {
    const id = String(f.id);
    if (entity === "session" && (f.kind === "page" || f.kind === "timeOnPage")) continue;
    switch (f.kind) {
      case "page":
      case "timeOnPage":
        where.push(pagePred(f));
        break;
      case "sessionConversion":
        where.push({ id, kind: "field", field: entity === "session" ? "converted" : "inConvertedSession", op: f.value === "converted" ? "isTrue" : "isFalse" });
        break;
      case "sessionDateRange": {
        const bounds: Json[] = [];
        if (f.from) bounds.push({ id: `${id}_from`, kind: "field", field: "startedAt", op: ">=", value: f.from });
        if (f.to) bounds.push({ id: `${id}_to`, kind: "field", field: "startedAt", op: "<", value: f.to });
        if (!bounds.length) break;
        where.push(entity === "session" ? { id, kind: "group", mode: "and", where: bounds } : { id, kind: "related", relation: "session", where: bounds });
        break;
      }
      case "leads": {
        const sub = (f.sub ?? {}) as Json;
        const subFilters = (Array.isArray(sub.filters) ? sub.filters : []) as Json[];
        if (f.expect === "one") notes.push(`Condition "${id}" asked for exactly one lead; Hook now checks the type of what flows through a tunnel instead, so it accepts any number.`);
        where.push({
          id,
          kind: "field",
          field: "visitor",
          op: "in",
          value: { hook: { v: 2, entity: "lead", where: subFilters.map(leadPred), output: { kind: "values", field: "visitor" } } },
        });
        break;
      }
      case "leadSearch":
      case "leadIds":
        where.push(leadPred(f));
        break;
    }
  }
  const order = obj(spec.order) ? spec.order : undefined;
  return { v: 2, entity, where, output: { kind: ret.as === "ids" ? "ids" : "count" }, order };
}

function leadPred(f: Json): Json {
  if (f.kind === "leadIds") return { id: String(f.id), kind: "field", field: "id", op: "in", value: f.ids };
  return {
    id: String(f.id),
    kind: "group",
    mode: "or",
    where: [
      { id: `${f.id}_name`, kind: "field", field: "name", op: "contains", value: f.text },
      { id: `${f.id}_email`, kind: "field", field: "email", op: "contains", value: f.text },
    ],
  };
}
