// jh-hook/engine/compile.ts
// Hook language -> SQL fragments. Generic: nothing here knows about any
// particular field. Fields, types and joins come from schema.ts + sqlmap.ts;
// operators and aggregates are applied by type. So "time on page between 3
// and 5 sec", "number of page views where page is /blogs at most 2" and
// "session start after (the result of another hook)" all go through the
// same three functions: compileCondition, compileComparison, compileValue.
//
// Every user value is a bound parameter. The only things spliced into SQL
// text are whitelisted (operators, aggregates, buckets, units) or produced
// by the engine (aliases, CTE names).
import {
  AGGS_FOR, LIST_OPS, NO_VALUE_OPS, OPS_FOR, SCHEMA, TWO_VALUE_OPS,
  type Agg, type EntityKey, type FieldDef, type FieldType, type Op, type RefKind,
} from "../schema";
import type { Condition, HookSpec, HookValue, Literal, Measure, Output, ValueArg } from "../types";
import { LIST_LIMIT, GROUP_LIMIT_MAX } from "../types";
import { RELATIVE_UNITS, toMs } from "../units";
import { HookError } from "../errors";
import { ShapeError, returnedBy } from "../shape";
import { Params, escapeLike } from "./sql";
import { SQL } from "./sqlmap";

/** Per-statement compile state. */
export class Ctx {
  readonly p: Params;
  /** Tunnel CTEs, in dependency order (a nested tunnel lands before its parent). */
  readonly tunnels: { name: string; body: string }[] = [];
  private n = 0;
  constructor(siteId: string) {
    this.p = new Params(siteId);
  }
  alias(): string {
    return `a${++this.n}`;
  }
  tunnelName(): string {
    return `t${this.tunnels.length + 1}_${++this.n}`;
  }
  withClause(extra: string[] = []): string {
    const all = [...this.tunnels.map((t) => `${t.name} AS MATERIALIZED (${t.body})`), ...extra];
    return all.length ? `WITH ${all.join(",\n")}\n` : "";
  }
}

const fail = (where: string, msg: string): never => {
  throw new HookError(`${where}: ${msg}`);
};

// ── Types of things ────────────────────────────────────────────────────
interface Typed {
  type: FieldType;
  ref?: RefKind;
}

export function fieldDef(entity: EntityKey, field: string, where: string): FieldDef {
  const f = SCHEMA[entity]?.fields[field];
  if (!f || !SQL[entity].fields[field]) fail(where, `"${field}" is not a field of ${SCHEMA[entity]?.plural ?? entity}`);
  return f!;
}

/** What a hook's output is, so a parent knows what it can feed. */
export function outputShape(spec: HookSpec, where = "sub-hook"): { shape: "one" | "list"; typed: Typed } {
  try {
    const r = returnedBy(spec);
    return { shape: r.shape, typed: { type: r.type, ref: r.ref } };
  } catch (e) {
    if (e instanceof ShapeError) return fail(where, e.message);
    throw e;
  }
}

/**
 * A hook as the SELECT a parent reads from: one column, `v`. A breakdown
 * hands over its keys (the pages, the days...), so "the 5 pages with most
 * views" can feed "page is any of".
 */
export function tunnelSelect(spec: HookSpec, ctx: Ctx): string {
  const body = compileSpecSelect(spec, ctx, { limit: false });
  return spec.output.kind === "groupBy" ? `SELECT k AS v FROM (${body}) g` : body;
}

// ── Values ─────────────────────────────────────────────────────────────
const isHook = (v: ValueArg | undefined): v is HookValue => typeof v === "object" && v !== null && !Array.isArray(v) && "hook" in v;

const CAST: Record<FieldType, string> = {
  number: "float8", duration: "float8", percent: "float8", px: "float8",
  text: "text", enum: "text", time: "timestamptz", bool: "boolean",
};

function scalarLiteral(v: Literal, t: Typed, enumValues: string[] | undefined, ctx: Ctx, where: string): string {
  switch (t.type) {
    case "duration":
      if (typeof v === "number") return ctx.p.add(v, "float8"); // already ms
      if (typeof v === "object" && v && "amount" in v) return ctx.p.add(toMs(v.amount, v.unit), "float8");
      return fail(where, "expected a duration like 5 sec");
    case "number":
    case "percent":
    case "px":
      if (typeof v !== "number" || !Number.isFinite(v)) return fail(where, "expected a number");
      return ctx.p.add(v, "float8");
    case "time":
      if (typeof v === "string") {
        if (Number.isNaN(Date.parse(v))) return fail(where, `"${v}" is not a date`);
        return ctx.p.add(v, "timestamptz");
      }
      if (typeof v === "object" && v && "ago" in v) {
        if (!RELATIVE_UNITS.includes(v.unit)) return fail(where, `unknown unit ${String(v.unit)}`);
        if (!Number.isFinite(v.ago)) return fail(where, "expected a number");
        return `(now() - ${ctx.p.add(v.ago, "float8")} * interval '1 ${v.unit}')`;
      }
      return fail(where, "expected a date or 'N units ago'");
    case "enum":
      if (typeof v !== "string" || (enumValues && !enumValues.includes(v))) return fail(where, `expected one of ${enumValues?.join(", ")}`);
      return ctx.p.add(v, "text");
    case "text":
      if (typeof v !== "string") return fail(where, "expected text");
      return ctx.p.add(v, "text");
    case "bool":
      return fail(where, "true/false fields take no value");
  }
}

function listLiteral(v: Literal, t: Typed, enumValues: string[] | undefined, ctx: Ctx, where: string): string {
  if (!Array.isArray(v) || v.length === 0) return fail(where, "expected a non-empty list");
  if (t.type === "text" || t.type === "enum") {
    if (!v.every((x) => typeof x === "string")) return fail(where, "expected a list of text");
    if (t.type === "enum" && enumValues && !v.every((x) => enumValues.includes(x as string))) return fail(where, `expected values from ${enumValues.join(", ")}`);
    return ctx.p.add(v, "text[]");
  }
  if (t.type === "number" || t.type === "percent" || t.type === "px" || t.type === "duration") {
    if (!v.every((x) => typeof x === "number" && Number.isFinite(x))) return fail(where, "expected a list of numbers");
    return ctx.p.add(v, "float8[]");
  }
  return fail(where, "lists aren't supported for this field type");
}

/** Compiles a sub-hook into a tunnel CTE and type-checks it against its target. */
function tunnel(v: HookValue, target: Typed, ctx: Ctx, where: string): { name: string; shape: "one" | "list" } {
  const { shape, typed } = outputShape(v.hook, where);
  if (typed.type !== target.type) fail(where, `the sub-hook returns ${typed.type}, but this needs ${target.type}`);
  if (typed.ref && target.ref && typed.ref !== target.ref) fail(where, `the sub-hook returns ${typed.ref} ids, but this needs ${target.ref} ids`);
  const body = tunnelSelect(v.hook, ctx); // registers its own nested tunnels first
  const name = ctx.tunnelName();
  ctx.tunnels.push({ name, body });
  return { name, shape };
}

// ── Comparison: expr <op> value(s), by type ────────────────────────────
export function compileComparison(
  expr: string,
  t: Typed,
  op: Op,
  v1: ValueArg | undefined,
  v2: ValueArg | undefined,
  ctx: Ctx,
  where: string,
  enumValues?: string[],
): string {
  if (!OPS_FOR[t.type].includes(op)) fail(where, `"${op}" can't be used on a ${t.type} field`);
  if (NO_VALUE_OPS.has(op)) {
    if (op === "isTrue") return `(${expr}) IS TRUE`;
    if (op === "isFalse") return `(${expr}) IS FALSE`;
    const empty = t.type === "text" || t.type === "enum" ? `NULLIF((${expr})::text, '') IS NULL` : `(${expr}) IS NULL`;
    return op === "isEmpty" ? empty : `NOT (${empty})`;
  }
  if (v1 === undefined) fail(where, "missing value");

  // single value (literal or one-value tunnel)
  const one = (v: ValueArg | undefined, label: string): string => {
    if (v === undefined) return fail(where, `missing ${label}`);
    if (isHook(v)) {
      const tn = tunnel(v, t, ctx, where);
      if (tn.shape === "list") fail(where, `the sub-hook returns a list, but "${op}" compares with one value. Use "is any of" / "is none of", or make the sub-hook return a count or an aggregate`);
      return `(SELECT v FROM ${tn.name})`;
    }
    return scalarLiteral(v, t, enumValues, ctx, where);
  };

  if (TWO_VALUE_OPS.has(op)) {
    const lo = one(v1, "lower bound");
    const hi = one(v2, "upper bound");
    const b = `(${expr}) BETWEEN ${lo} AND ${hi}`;
    return op === "between" ? b : `NOT (${b})`;
  }

  if (LIST_OPS.has(op)) {
    let inSet: string;
    let notInSet: string;
    if (isHook(v1)) {
      const tn = tunnel(v1, t, ctx, where);
      if (tn.shape === "one") {
        inSet = `(${expr}) = (SELECT v FROM ${tn.name})`;
        notInSet = `(${expr}) IS DISTINCT FROM (SELECT v FROM ${tn.name})`;
      } else {
        inSet = `(${expr}) IN (SELECT v FROM ${tn.name})`;
        notInSet = `NOT EXISTS (SELECT 1 FROM ${tn.name} WHERE ${tn.name}.v = (${expr}))`;
      }
    } else {
      const arr = listLiteral(v1!, t, enumValues, ctx, where);
      inSet = `(${expr}) = ANY(${arr})`;
      notInSet = `((${expr}) IS NULL OR (${expr}) <> ALL(${arr}))`;
    }
    return op === "in" ? inSet : notInSet;
  }

  if (op === "contains" || op === "notContains" || op === "startsWith" || op === "endsWith") {
    if (isHook(v1) || typeof v1 !== "string") return fail(where, `"${op}" needs typed text, not a sub-hook`);
    const s = escapeLike(v1);
    const pattern = op === "startsWith" ? `${s}%` : op === "endsWith" ? `%${s}` : `%${s}%`;
    const like = `(${expr}) ILIKE ${ctx.p.add(pattern, "text")}`;
    return op === "notContains" ? `((${expr}) IS NULL OR NOT (${like}))` : like;
  }

  const val = one(v1, "value");
  if (op === "=") return `(${expr}) = ${val}`;
  if (op === "!=") return `(${expr}) IS DISTINCT FROM ${val}`;
  return `(${expr}) ${op} ${val}`; // > >= < <=, whitelisted by OPS_FOR above
}

// ── Measures (aggregates over rows) ────────────────────────────────────
export function measureSql(entity: EntityKey, m: Measure, alias: string, where: string): { sql: string; type: FieldType } {
  const agg: Agg = m.agg;
  if (agg === "count") return { sql: "count(*)::float8", type: "number" };
  if (!m.field) return fail(where, `"${agg}" needs a field`);
  const f = fieldDef(entity, m.field, where);
  if (!AGGS_FOR[f.type].includes(agg)) fail(where, `"${agg}" can't be applied to ${f.label} (${f.type})`);
  const e = SQL[entity].fields[m.field](alias);
  const num = f.type !== "time";
  const cast = num ? "::float8" : "";
  switch (agg) {
    case "countDistinct":
      return { sql: `count(DISTINCT ${e})::float8`, type: "number" };
    case "sum":
      return { sql: `COALESCE(sum(${e}), 0)::float8`, type: f.type };
    case "avg":
    case "min":
    case "max":
      return { sql: `${agg}(${e})${cast}`, type: f.type };
    case "median":
    case "percentile": {
      const p = agg === "median" ? 0.5 : (m.p ?? 90) / 100;
      if (!(p > 0 && p < 1)) fail(where, "percentile must be between 0 and 100");
      return { sql: `percentile_cont(${Number(p)}) WITHIN GROUP (ORDER BY ${e})::float8`, type: f.type };
    }
  }
}

// ── Conditions ─────────────────────────────────────────────────────────
export function compileCondition(c: Condition, entity: EntityKey, alias: string, ctx: Ctx): string {
  const where = `Condition "${c.id}"`;
  if (c.kind === "field") {
    const f = fieldDef(entity, c.field, where);
    const expr = SQL[entity].fields[c.field](alias);
    return compileComparison(expr, { type: f.type, ref: f.ref }, c.op, c.value, c.value2, ctx, where, f.enumValues);
  }

  if (c.kind === "group") {
    if (!c.where.length) return c.not ? "FALSE" : "TRUE";
    // Two-valued logic: a condition on an empty value is FALSE, not NULL,
    // so NOT (utm is any of facebook) keeps sessions with no utm at all,
    // which is what a person means by it. Plain SQL NOT NULL = NULL drops them.
    const inner = c.where.map((x) => `COALESCE((${compileCondition(x, entity, alias, ctx)}), FALSE)`).join(c.mode === "or" ? " OR " : " AND ");
    return c.not ? `NOT (${inner})` : `(${inner})`;
  }

  const rel = SCHEMA[entity]?.relations[c.relation];
  const join = SQL[entity].joins[c.relation];
  if (!rel || !join) return fail(where, `"${c.relation}" is not related to ${SCHEMA[entity]?.plural}`);
  const ca = ctx.alias();
  const parts = [join(alias, ca), ...c.where.map((x) => `(${compileCondition(x, rel.target, ca, ctx)})`)];
  const from = `FROM ${SQL[rel.target].source(ca)} WHERE ${parts.join(" AND ")}`;

  if (rel.cardinality === "one") {
    if (c.measure || c.op) fail(where, `${rel.label} is a single row; it can be matched but not counted or measured`);
    return `EXISTS (SELECT 1 ${from})`;
  }

  const m: Measure = c.measure ?? { agg: "count" };
  const op: Op = c.op ?? ">=";
  const value = c.value ?? (c.op ? undefined : 1);
  // "has at least one" / "has none" are existence checks: cheaper than counting
  if (m.agg === "count" && !isHook(value) && typeof value === "number") {
    if ((op === ">=" && value === 1) || (op === ">" && value === 0)) return `EXISTS (SELECT 1 ${from})`;
    if ((op === "=" && value === 0) || (op === "<" && value === 1) || (op === "<=" && value === 0)) return `NOT EXISTS (SELECT 1 ${from})`;
  }
  const ms = measureSql(rel.target, m, ca, where);
  return compileComparison(`(SELECT ${ms.sql} ${from})`, { type: ms.type }, op, value, c.value2, ctx, where);
}

// ── Outputs ────────────────────────────────────────────────────────────
const BUCKETS = new Set(["hour", "day", "week", "month"]);

/** SELECT list + tail for an output, over rows of `entity` aliased `b` in `from`. */
export function compileOutput(entity: EntityKey, o: Output, from: string, preds: string[], limit: boolean): string {
  const where = "Output";
  const w = (extra?: string) => {
    const all = extra ? [...preds, extra] : preds;
    return all.length ? ` WHERE ${all.join(" AND ")}` : "";
  };
  const lim = limit ? ` LIMIT ${LIST_LIMIT + 1}` : "";
  switch (o.kind) {
    case "count":
      return `SELECT count(*)::float8 AS v FROM ${from}${w()}`;
    case "countDistinct": {
      fieldDef(entity, o.field, where);
      return `SELECT count(DISTINCT ${SQL[entity].fields[o.field]("b")})::float8 AS v FROM ${from}${w()}`;
    }
    case "ids":
      return `SELECT DISTINCT ${SQL[entity].ref("b")} AS v FROM ${from}${w()}${lim}`;
    case "values": {
      fieldDef(entity, o.field, where);
      const e = SQL[entity].fields[o.field]("b");
      return `SELECT DISTINCT ${e} AS v FROM ${from}${w(`${e} IS NOT NULL`)}${lim}`;
    }
    case "aggregate": {
      const ms = measureSql(entity, { agg: o.agg, field: o.field, p: o.p }, "b", where);
      return `SELECT ${ms.sql} AS v FROM ${from}${w()}`;
    }
    case "groupBy": {
      const f = fieldDef(entity, o.field, where);
      const e = SQL[entity].fields[o.field]("b");
      let k = e;
      if (o.bucket) {
        if (f.type !== "time") fail(where, "only time fields can be bucketed");
        if (!BUCKETS.has(o.bucket)) fail(where, `unknown bucket ${o.bucket}`);
        k = `date_trunc('${o.bucket}', ${e}, 'UTC')`;
      }
      const ms = measureSql(entity, o.measure, "b", where);
      const sort = { valueDesc: "v DESC NULLS LAST", valueAsc: "v ASC NULLS LAST", keyAsc: "k ASC NULLS LAST", keyDesc: "k DESC NULLS LAST" }[o.sort ?? (o.bucket ? "keyAsc" : "valueDesc")];
      if (!sort) fail(where, "unknown sort");
      const n = Math.min(GROUP_LIMIT_MAX, Math.max(1, Math.floor(o.limit ?? 50)));
      return `SELECT ${k} AS k, ${ms.sql} AS v FROM ${from}${w()} GROUP BY 1 ORDER BY ${sort} LIMIT ${n}`;
    }
  }
}

/** A whole spec as one SELECT (fused). Used for sub-hooks; the main query goes through the planner. */
export function compileSpecSelect(spec: HookSpec, ctx: Ctx, opts: { limit: boolean }): string {
  const preds = spec.where.map((c) => `(${compileCondition(c, spec.entity, "b", ctx)})`);
  return compileOutput(spec.entity, spec.output, SQL[spec.entity].source("b"), preds, opts.limit);
}

/** Every tunnel directly inside these conditions (not inside sub-hooks), with a readable path. */
export function findTunnels(conds: Condition[], prefix = ""): { path: string; value: HookValue }[] {
  const out: { path: string; value: HookValue }[] = [];
  for (const c of conds) {
    const p = prefix ? `${prefix} > ${c.id}` : c.id;
    if (c.kind !== "group") {
      if (isHook(c.value)) out.push({ path: `${p} (value)`, value: c.value });
      if (isHook(c.value2)) out.push({ path: `${p} (upper bound)`, value: c.value2 });
    }
    if (c.kind !== "field") out.push(...findTunnels(c.where, p));
  }
  return out;
}

export { CAST };
