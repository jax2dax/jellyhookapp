/* eslint-disable @typescript-eslint/no-explicit-any -- bench fixtures are plain rows */
// scripts/bench/planner.bench.ts
// Measures the Hook planner (report/numbers.md rows B1-B4, C1-C3, D1) on PGlite,
// an in-memory Postgres (same SQL and planner as Supabase, WebAssembly speed).
// Never touches a real database. Run: npm run bench:planner   (several minutes)
//
// Baseline without changing the engine: the "fused" run gets a HookDb wrapper
// that reports the same row estimate for every step. The engine then sees no
// spread between steps, picks one fused statement, and Postgres orders it.
// Everything else (SQL, data, cost gate) is identical. Answers must match.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runHook, clearEstimateCache } from "../../jh-hook/engine/run";
import { SITE, seed, makeDb } from "./seed";
import type { HookSpec, Condition, Output } from "../../jh-hook/types";

const RUNS = Number(process.env.BENCH_RUNS ?? 5);
const PROD_MAX_CREDITS = 200; // lib/actions/hook.action.ts DEFAULT_MAX_CREDITS
const root = path.resolve(__dirname, "../..");

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = (x: number) => Math.round(x * 10) / 10;
const now = () => performance.now();

const H = (entity: HookSpec["entity"], where: Condition[], output: Output = { kind: "count" }): HookSpec => ({ v: 3, entity, where, output } as HookSpec);
const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

type Q = { id: string; kind: "high-spread" | "low-spread" | "nested" | "sub-hook"; desc: string; spec: HookSpec };
const QUERIES: Q[] = [
  { id: "H1", kind: "high-spread", desc: "sessions from the newsletter (rare) with 3+ page views",
    spec: H("session", [{ id: "nl", kind: "field", field: "utmSource", op: "=", value: "newsletter" }, { id: "pv3", kind: "related", relation: "pageViews", where: [], measure: { agg: "count" }, op: ">=", value: 3 }] as any) },
  { id: "H2", kind: "high-spread", desc: "sessions from Ethiopia (rare) that viewed the most common page",
    spec: H("session", [{ id: "et", kind: "field", field: "country", op: "=", value: "ET" }, { id: "p0", kind: "related", relation: "pageViews", where: [{ id: "pp", kind: "field", field: "page", op: "=", value: "/p0" }], measure: { agg: "count" }, op: ">=", value: 1 }] as any) },
  { id: "H3", kind: "high-spread", desc: "converted sessions in the last 60 days with 2+ views over a minute",
    spec: H("session", [{ id: "cv", kind: "field", field: "converted", op: "isTrue" }, { id: "d60", kind: "field", field: "startedAt", op: ">", value: days(60) }, { id: "long", kind: "related", relation: "pageViews", where: [{ id: "t1", kind: "field", field: "timeOnPage", op: ">", value: { amount: 1, unit: "min" } }], measure: { agg: "count" }, op: ">=", value: 2 }] as any) },
  { id: "H4", kind: "high-spread", desc: "page views of a rare page that lasted over 5 seconds",
    spec: H("pageView", [{ id: "rare", kind: "field", field: "page", op: "=", value: "/p45" }, { id: "t5", kind: "field", field: "timeOnPage", op: ">", value: { amount: 5, unit: "sec" } }] as any) },
  { id: "L1", kind: "low-spread", desc: "sessions from Google in the US",
    spec: H("session", [{ id: "g", kind: "field", field: "utmSource", op: "=", value: "google" }, { id: "us", kind: "field", field: "country", op: "=", value: "US" }] as any) },
  { id: "L2", kind: "low-spread", desc: "sessions in the last 45 days with 2+ page views",
    spec: H("session", [{ id: "d45", kind: "field", field: "startedAt", op: ">", value: days(45) }, { id: "pv2", kind: "related", relation: "pageViews", where: [], measure: { agg: "count" }, op: ">=", value: 2 }] as any) },
  { id: "N1", kind: "nested", desc: "(facebook OR UK) AND not converted",
    spec: H("session", [{ id: "or", kind: "group", mode: "or", where: [{ id: "fb", kind: "field", field: "utmSource", op: "=", value: "facebook" }, { id: "gb", kind: "field", field: "country", op: "=", value: "GB" }] }, { id: "nc", kind: "field", field: "converted", op: "isFalse" }] as any) },
  { id: "S1", kind: "sub-hook", desc: "page views by visitors who became qualified leads, over 30 seconds",
    spec: H("pageView", [{ id: "who", kind: "field", field: "visitor", op: "in", value: { hook: H("lead", [{ id: "q", kind: "field", field: "qualified", op: "isTrue" }], { kind: "values", field: "visitor" }) } }, { id: "t30", kind: "field", field: "timeOnPage", op: ">", value: { amount: 30, unit: "sec" } }] as any) },
];

async function timeRuns(pg: PGlite, spec: HookSpec, flat: boolean) {
  const db = makeDb(pg, flat);
  clearEstimateCache();
  const t0 = now(); const cold = await runHook(db, SITE, spec); const coldMs = now() - t0;
  const total: number[] = [], plan: number[] = [], exec: number[] = [];
  let last = cold;
  for (let i = 0; i < RUNS; i++) {
    const t = now(); last = await runHook(db, SITE, spec); total.push(now() - t);
    plan.push(last.timing.planMs); exec.push(last.timing.execMs);
  }
  return { res: last, coldMs, coldPlanMs: cold.timing.planMs, total, plan, exec };
}

async function stepActuals(pg: PGlite, spec: HookSpec, res: any) {
  // D1: each top-level step alone, estimated vs real row count.
  const out: { id: string; est: number; actual: number; q: number }[] = [];
  for (const step of res.plan.steps) {
    const c = spec.where.find((w: any) => w.id === step.id)!;
    const r = await runHook(makeDb(pg, false), SITE, { ...spec, where: [c], output: { kind: "count" } } as HookSpec);
    const actual = Number((r.answer as any).value);
    const est = Math.max(1, step.estRows), a = Math.max(1, actual);
    out.push({ id: step.id, est: step.estRows, actual, q: Math.max(est / a, a / est) });
  }
  return out;
}

async function main() {
  const started = new Date().toISOString();
  const pg = new PGlite();
  let t = now();
  const counts = await seed(pg);
  const seedMs = now() - t;
  console.log("seeded", counts, `${Math.round(seedMs / 1000)} s`);

  const results: any[] = [];
  const qerrors: number[] = [];
  for (const q of QUERIES) {
    const engine = await timeRuns(pg, q.spec, false);
    const fused = await timeRuns(pg, q.spec, true);
    const same = JSON.stringify(engine.res.answer) === JSON.stringify(fused.res.answer);
    const steps = await stepActuals(pg, q.spec, engine.res);
    qerrors.push(...steps.map((s) => s.q));
    const row = {
      id: q.id, kind: q.kind, desc: q.desc,
      engineStrategy: engine.res.plan.strategy, baselineStrategy: fused.res.plan.strategy, engineOrder: engine.res.plan.order,
      answer: engine.res.answer.shape === "one" ? engine.res.answer.value : engine.res.answer, sameAnswer: same,
      credits: engine.res.cost.credits, pgCost: engine.res.cost.pgCost,
      engineMedianMs: r1(median(engine.total)), fusedMedianMs: r1(median(fused.total)), speedup: r1(median(fused.total) / median(engine.total)),
      engineMaxMs: r1(Math.max(...engine.total)), fusedMaxMs: r1(Math.max(...fused.total)),
      planColdMs: engine.coldPlanMs, planWarmMedianMs: median(engine.plan), execMedianMs: median(engine.exec),
      steps, engineRuns: engine.total.map(r1), fusedRuns: fused.total.map(r1), notes: engine.res.plan.notes,
    };
    results.push(row);
    console.log(`${q.id} ${q.kind.padEnd(11)} engine=${row.engineStrategy} ${row.engineMedianMs} ms | fused ${row.fusedMedianMs} ms | x${row.speedup} | same=${same} | ${row.credits} cr`);
  }

  // C: budget gate. The most expensive query of the set, rejected with a limit just under its estimate.
  const heaviest = [...results].sort((a, b) => b.credits - a.credits)[0];
  const hq = QUERIES.find((q) => q.id === heaviest.id)!;
  const limit = Math.max(1, heaviest.credits - 1);
  const rejectMs: number[] = []; let message = "";
  for (let i = 0; i < RUNS; i++) {
    clearEstimateCache();
    const t1 = now();
    try { await runHook(makeDb(pg, false), SITE, hq.spec, { maxCredits: limit }); message = "NOT REJECTED"; } catch (e: any) { message = e.message; }
    rejectMs.push(now() - t1);
  }
  const falseRejections: string[] = [];
  for (const q of QUERIES) {
    try { await runHook(makeDb(pg, false), SITE, q.spec, { maxCredits: PROD_MAX_CREDITS }); } catch (e: any) { falseRejections.push(`${q.id}: ${e.message}`); }
  }
  const budget = { query: heaviest.id, credits: heaviest.credits, limit, rejectMedianMs: r1(median(rejectMs)), rejectRuns: rejectMs.map(r1), message,
    wouldHaveRunMedianMs: heaviest.engineMedianMs, falseRejectionsAtProdLimit: falseRejections, prodLimit: PROD_MAX_CREDITS };
  console.log("budget", budget);

  const sortedQ = [...qerrors].sort((a, b) => a - b);
  const estimates = { steps: qerrors.length, medianQError: r1(median(qerrors)), maxQError: r1(sortedQ[sortedQ.length - 1]) };
  console.log("estimates", estimates);

  const out = {
    started, finished: new Date().toISOString(), runsPerMode: RUNS,
    machine: { cpu: os.cpus()[0]?.model, cores: os.cpus().length, ramGb: Math.round(os.totalmem() / 2 ** 30), os: `${os.platform()} ${os.release()}`, node: process.version },
    database: "PGlite (in-memory Postgres, WebAssembly)", data: counts, seedSeconds: Math.round(seedMs / 1000),
    queries: results, budget, estimates,
  };
  const dir = path.join(root, "report", "raw");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `planner-${started.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("saved", path.relative(root, file));
}

main().catch((e) => { console.error(e); process.exit(1); });
