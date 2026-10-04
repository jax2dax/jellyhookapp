// jh-hook/engine/run.ts
// The pipeline: validate -> steps -> tunnels -> estimate -> order -> emit
// -> cost gate -> execute. Pure with respect to the database: everything it
// needs comes through HookDb, so the same code runs against the real
// read-only pg role (lib/actions/hook.action.ts) and an in-memory Postgres
// in tests.
//
// Steps are the top-level conditions (ANDed). How their order is decided
// (no AI, no third party): Postgres keeps statistics (pg_stats). For each
// step we ask it "how many rows would this condition alone keep?" with
// EXPLAIN, which plans without scanning: a few milliseconds per step, and
// cached. The most selective step runs first. See jh-hook/architecture.md.
import { describeCondition, describeSpec } from "../describe";
import { LIST_LIMIT, type Condition, type HookAnswer, type HookCost, type HookPlan, type HookResult, type HookSpec, type TunnelInfo } from "../types";
import { Ctx, compileCondition, compileOutput, compileSpecSelect, findTunnels, outputShape, fieldDef, measureSql } from "./compile";
import { SQL } from "./sqlmap";
import { validateSpec } from "./validate";

export interface HookDb {
  query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
  /** EXPLAIN (FORMAT JSON), top node: estimated rows and total cost. Never executes. */
  explain(sql: string, params: unknown[]): Promise<{ rows: number; cost: number }>;
}

export interface RunOptions {
  /** Refuse to execute if the estimated cost is above this many credits. */
  maxCredits?: number;
}

/** 1 credit = this many Postgres cost units. Calibrate against real usage. */
export const COST_UNITS_PER_CREDIT = 500;
/** A manual order is overridden only if the engine's order starts this many times smaller. */
export const GUARD_FACTOR = 10;
/** Staged (fenced) execution is only chosen when step sizes differ by at least this much. */
export const SPREAD_FACTOR = 10;
const ESTIMATE_TTL_MS = 5 * 60_000;
const ESTIMATE_CACHE_MAX = 500;
const estimateCache = new Map<string, { at: number; rows: number }>();

export function clearEstimateCache(): void {
  estimateCache.clear();
}

async function estimateRows(db: HookDb, siteId: string, spec: HookSpec, c: Condition): Promise<number> {
  const ctx = new Ctx(siteId);
  const pred = compileCondition(c, spec.entity, "b", ctx);
  const sql = ctx.withClause() + `SELECT 1 FROM ${SQL[spec.entity].source("b")} WHERE ${pred}`;
  const key = `${siteId}|${sql}|${JSON.stringify(ctx.p.values)}`;
  const hit = estimateCache.get(key);
  if (hit && Date.now() - hit.at < ESTIMATE_TTL_MS) return hit.rows;
  const { rows } = await db.explain(sql, ctx.p.values);
  if (estimateCache.size >= ESTIMATE_CACHE_MAX) estimateCache.delete(estimateCache.keys().next().value as string);
  estimateCache.set(key, { at: Date.now(), rows });
  return rows;
}

/** One statement that runs every top-level-visible tunnel and reports what it produced. */
async function runTunnels(db: HookDb, siteId: string, spec: HookSpec): Promise<TunnelInfo[]> {
  const found = findTunnels(spec.where);
  if (!found.length) return [];
  const ctx = new Ctx(siteId);
  const cols: string[] = [];
  const meta = found.map(({ path, value }, i) => {
    const { shape, typed } = outputShape(value.hook, `Tunnel ${path}`);
    const body = compileSpecSelect(value.hook, ctx, { limit: false });
    const name = `probe${i}`;
    ctx.tunnels.push({ name, body });
    cols.push(
      shape === "one"
        ? `(SELECT v::text FROM ${name} LIMIT 1) AS s${i}, 1 AS n${i}`
        : `(SELECT ARRAY(SELECT v::text FROM ${name} LIMIT 10)) AS s${i}, (SELECT count(*)::int FROM ${name}) AS n${i}`,
    );
    return { path, label: describeSpec(value.hook), shape, type: typed.type };
  });
  const [row] = await db.query(ctx.withClause() + `SELECT ${cols.join(", ")}`, ctx.p.values);
  return meta.map((m, i) => {
    const s = row[`s${i}`];
    return { ...m, count: Number(row[`n${i}`]), sample: Array.isArray(s) ? s.map(String) : s == null ? [] : [String(s)] };
  });
}

function toText(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}
function toScalar(v: unknown): number | string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return typeof v === "number" ? v : String(v); // every numeric output is cast to float8, which pg returns as a number
}

export async function runHook(db: HookDb, siteId: string, spec: HookSpec, opts: RunOptions = {}): Promise<HookResult> {
  validateSpec(spec);
  const t0 = Date.now();
  const entity = spec.entity;
  const steps = spec.where;
  const notes: string[] = [];

  // Type-check the output up front, so a bad output fails before any query.
  compileOutput(entity, spec.output, "x", [], false);

  // 1. Tunnels first: each sub-engine runs and reports what it hands over.
  const tunnels = await runTunnels(db, siteId, spec);
  for (const t of tunnels)
    notes.push(t.shape === "one" ? `Sub-hook at ${t.path} produced ${t.sample[0] ?? "nothing"}.` : `Sub-hook at ${t.path} produced ${t.count} value${t.count === 1 ? "" : "s"}.`);

  // 2. Estimate every step alone (parallel, cached).
  const est = await Promise.all(steps.map((c) => estimateRows(db, siteId, spec, c)));
  const estOf = new Map(steps.map((c, i) => [c, est[i]]));
  const byEstimate = [...steps].sort((a, b) => estOf.get(a)! - estOf.get(b)!);

  // 3. Order + strategy.
  let ordered: Condition[] = byEstimate;
  let strategy: "fused" | "staged" = "fused";
  if (steps.length >= 2) {
    if (spec.order?.mode === "manual") {
      const ids = spec.order.steps ?? [];
      const mine = [...ids.map((id) => steps.find((c) => c.id === id)!).filter(Boolean), ...steps.filter((c) => !ids.includes(c.id))];
      const guard = spec.order.guard !== false;
      const myFirst = estOf.get(mine[0])!;
      const bestFirst = estOf.get(byEstimate[0])!;
      if (guard && bestFirst * GUARD_FACTOR <= myFirst) {
        notes.push(
          `Your order starts with "${mine[0].id}" (about ${Math.round(myFirst)} rows). "${byEstimate[0].id}" keeps about ${Math.round(bestFirst)}, at least ${GUARD_FACTOR}x fewer, so the engine ran it first. Turn the guard off to force your order.`,
        );
      } else {
        ordered = mine;
        notes.push(guard ? `Ran in your order (no other order was ${GUARD_FACTOR}x cheaper).` : "Ran in your order (guard is off).");
      }
      strategy = "staged";
    } else {
      const lo = Math.max(1, estOf.get(byEstimate[0])!);
      const hi = estOf.get(byEstimate[byEstimate.length - 1])!;
      if (hi / lo >= SPREAD_FACTOR) {
        strategy = "staged";
        notes.push(`Step sizes differ by about ${Math.round(hi / lo)}x, so the most selective step runs first and each next step only looks at what survived.`);
      } else {
        notes.push("Steps are similar in size, so Postgres was left to order them itself.");
      }
    }
  }

  // 4. Emit exactly what will run, estimate its cost, gate on budget.
  const ctx = new Ctx(siteId);
  const src = SQL[entity];
  const limit = spec.output.kind === "ids" || spec.output.kind === "values";
  let sql: string;
  if (strategy === "fused" || ordered.length < 2) {
    const preds = ordered.map((c) => `(${compileCondition(c, entity, "b", ctx)})`);
    const body = compileOutput(entity, spec.output, src.source("b"), preds, limit);
    sql = ctx.withClause() + body;
  } else {
    const chain = ordered.map((c, i) => {
      const pred = compileCondition(c, entity, "b", ctx);
      return i === 0
        ? `s0 AS MATERIALIZED (SELECT ${src.key("b")} AS k FROM ${src.source("b")} WHERE ${pred})`
        : `s${i} AS MATERIALIZED (SELECT ${src.key("b")} AS k FROM s${i - 1} JOIN ${src.source("b")} ON ${src.key("b")} = s${i - 1}.k WHERE ${pred})`;
    });
    const last = `s${ordered.length - 1}`;
    const body = compileOutput(entity, spec.output, `${last} JOIN ${src.source("b")} ON ${src.key("b")} = ${last}.k`, [], limit);
    sql = ctx.withClause(chain) + body;
  }
  const { cost: pgCost } = await db.explain(sql, ctx.p.values);
  const cost: HookCost = { pgCost: Math.round(pgCost * 100) / 100, credits: Math.max(1, Math.ceil(pgCost / COST_UNITS_PER_CREDIT)) };
  if (opts.maxCredits !== undefined && cost.credits > opts.maxCredits)
    throw new Error(`This hook is estimated at ${cost.credits} credits, over the ${opts.maxCredits} credit limit. Nothing was run.`);
  const planMs = Date.now() - t0;

  // 5. Execute.
  const t1 = Date.now();
  const rows = await db.query(sql, ctx.p.values);
  const execMs = Date.now() - t1;

  const plan: HookPlan = {
    strategy,
    order: ordered.map((c) => c.id),
    steps: ordered.map((c) => ({ id: c.id, label: describeCondition(c, entity), estRows: Math.round(estOf.get(c)!) })),
    notes,
  };

  // 6. Shape the answer.
  const o = spec.output;
  let answer: HookAnswer;
  if (o.kind === "groupBy") {
    const f = fieldDef(entity, o.field, "Output");
    const m = measureSql(entity, o.measure, "b", "Output");
    answer = { shape: "table", keyType: o.bucket ? "time" : f.type, valueType: m.type, rows: rows.map((r) => ({ key: toText(r.k), value: toScalar(r.v) })) };
  } else {
    const { shape, typed } = outputShape(spec, "Output");
    if (shape === "one") answer = { shape: "one", type: typed.type, value: toScalar(rows[0]?.v) };
    else {
      const values = rows.map((r) => toText(r.v) ?? "");
      const truncated = values.length > LIST_LIMIT;
      answer = { shape: "list", type: typed.type, values: truncated ? values.slice(0, LIST_LIMIT) : values, truncated };
    }
  }
  return { answer, plan, cost, tunnels, timing: { planMs, execMs }, sql };
}
