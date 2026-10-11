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
import { runHook, clearEstimateCache, type HookDb } from "../../jh-hook/engine/run";
import type { HookSpec, Condition, Output } from "../../jh-hook/types";

const SITE = "11111111-1111-1111-1111-111111111111";
const N_VISITORS = 100_000;
const N_SESSIONS = 300_000;
const N_PAGEVIEWS = 1_000_000;
const RUNS = Number(process.env.BENCH_RUNS ?? 5);
const PROD_MAX_CREDITS = 200; // lib/actions/hook.action.ts DEFAULT_MAX_CREDITS
const root = path.resolve(__dirname, "../..");

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = (x: number) => Math.round(x * 10) / 10;
const now = () => performance.now();

async function seed(pg: PGlite) {
  await pg.exec(`
    create table sessions (id uuid primary key default gen_random_uuid(), session_id text unique, visitor_id text, site_id uuid, started_at timestamptz, ended_at timestamptz, last_activity_at timestamptz, referrer text, country text, timezone text, utm_source text, utm_medium text, utm_campaign text);
    create table page_views (id uuid primary key default gen_random_uuid(), page_view_id text, session_id text, visitor_id text, site_id uuid, page_url text, page_path text, page_title text, entered_at timestamptz, left_at timestamptz, time_on_page integer, scroll_depth real, max_scroll_depth real, max_scroll_reached_at timestamptz, page_height integer, entry_scroll_depth real, revisit_start_scroll_depth real, viewport_height integer);
    create table form_submissions (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text, session_id text, page_url text, page_path text, name text, email text, phone text, confidence text default 'high', raw_data jsonb, submitted_at timestamptz, qualified boolean);
    create table visitors (id uuid primary key default gen_random_uuid(), visitor_id text, site_id uuid, first_seen timestamptz, last_seen timestamptz, device_type text, browser text, os text, language text);
    create table form_engagement (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text, session_id text, page_view_id text, page_path text, form_index integer default 0, status text, last_field_type text, last_field_key text, viewed_at timestamptz, first_input_at timestamptz, ended_at timestamptz, field_timings jsonb default '{}', last_activity_at timestamptz);
    select setseed(0.42);
  `);
  // Visitors. Device: 55% mobile.
  await pg.exec(`insert into visitors (visitor_id, site_id, first_seen, last_seen, device_type)
    select 'v' || g, '${SITE}', now() - interval '90 days', now(), case when random() < 0.55 then 'mobile' else 'desktop' end
    from generate_series(1, ${N_VISITORS}) g;`);
  // Sessions. Skew: most visitors come once, a few come many times (power-law pick of visitor).
  // utm: google 35%, facebook 15%, newsletter 0.3% (rare), none otherwise. country: US 60%, GB 15%, ET 0.5%, rest DE.
  await pg.exec(`insert into sessions (session_id, visitor_id, site_id, started_at, ended_at, last_activity_at, country, utm_source)
    select 's' || g, 'v' || (1 + floor(${N_VISITORS} * power(random(), 2.5)))::int, '${SITE}', t, t + interval '10 minutes', t + interval '10 minutes',
      case when c < 0.60 then 'US' when c < 0.75 then 'GB' when c < 0.755 then 'ET' else 'DE' end,
      case when u < 0.35 then 'google' when u < 0.50 then 'facebook' when u < 0.503 then 'newsletter' else null end
    from (select g, now() - (random() * 90 || ' days')::interval as t, random() as c, random() as u from generate_series(1, ${N_SESSIONS}) g) x;`);
  // Page views. Skew: page popularity is power-law over 50 paths (/p0 most common, /p49 rarest).
  await pg.exec(`insert into page_views (page_view_id, session_id, visitor_id, site_id, page_path, entered_at, left_at, time_on_page, page_height, viewport_height, entry_scroll_depth, max_scroll_depth, scroll_depth)
    select 'pv' || x.g, s.session_id, s.visitor_id, '${SITE}', '/p' || floor(50 * power(random(), 3))::int,
      s.started_at + (x.k || ' seconds')::interval, s.started_at + ((x.k + x.t) || ' seconds')::interval, x.t * 1000, 3000, 800, 0, random(), random()
    from (select g, 1 + floor(${N_SESSIONS} * random())::int as sid, floor(random() * 500)::int as k, floor(power(random(), 2) * 300)::int as t from generate_series(1, ${N_PAGEVIEWS}) g) x
    join sessions s on s.session_id = 's' || x.sid;`);
  // Leads: 2% of sessions convert; 30% of leads are qualified.
  await pg.exec(`insert into form_submissions (site_id, visitor_id, session_id, page_path, name, email, submitted_at, qualified)
    select site_id, visitor_id, session_id, '/contact', 'Lead ' || session_id, session_id || '@x.com', started_at + interval '5 minutes', random() < 0.3
    from sessions where random() < 0.02;`);
  // Production indexes (mds/database.md).
  await pg.exec(`
    create index sessions_visitor_id_idx on sessions (visitor_id);
    create index sessions_site_started_idx on sessions (site_id, started_at);
    create index sessions_site_last_activity_idx on sessions (site_id, last_activity_at);
    create index page_views_session_id_idx on page_views (session_id);
    create index page_views_site_id_idx on page_views (site_id);
    create index page_views_site_entered_idx on page_views (site_id, entered_at);
    create index form_submissions_visitor_id_idx on form_submissions (visitor_id);
    create index form_submissions_site_id_idx on form_submissions (site_id);
    create index form_submissions_site_submitted_idx on form_submissions (site_id, submitted_at);
    create unique index visitors_site_visitor_key on visitors (site_id, visitor_id);
    analyze;
  `);
  const c = async (t: string) => Number((await pg.query<any>(`select count(*)::int n from ${t}`)).rows[0].n);
  return { visitors: await c("visitors"), sessions: await c("sessions"), pageViews: await c("page_views"), leads: await c("form_submissions") };
}

function makeDb(pg: PGlite, flat: boolean): HookDb {
  return {
    async query(sql, params) { return (await pg.query(sql, params as any[])).rows as any; },
    async explain(sql, params) {
      const res: any = await pg.query("EXPLAIN (FORMAT JSON) " + sql, params as any[]);
      const plan = res.rows[0]["QUERY PLAN"][0].Plan;
      // rows is only read for per-step estimates, cost only for the final statement.
      return { rows: flat ? 1000 : plan["Plan Rows"], cost: plan["Total Cost"] };
    },
  };
}

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
