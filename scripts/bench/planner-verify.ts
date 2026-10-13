/* eslint-disable @typescript-eslint/no-explicit-any -- bench fixtures are plain rows */
// scripts/bench/planner-verify.ts
// Correctness check for the Hook engine on 1M synthetic rows (report/numbers.md, row B3/V1).
// Every query is answered three ways and all three must agree:
//   engine : runHook as the engine plans it (staged or fused, its choice)
//   fused  : runHook with flat row estimates, so it always runs one statement
//   oracle : plain SQL written by hand in this file, with no Hook code involved
// "fused vs engine" alone only tests the planner, because both go through the same compiler.
// The oracle is what tests the compiler and the field semantics.
// Run: npm run bench:verify   (about 5 to 10 minutes; seeds 1M rows in memory, never touches a real database)
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { runHook, clearEstimateCache } from "../../jh-hook/engine/run";
import type { HookSpec, Condition, Output } from "../../jh-hook/types";
import { SITE, seed, makeDb } from "./seed";

const root = path.resolve(__dirname, "../..");
const now = () => performance.now();
const H = (entity: HookSpec["entity"], where: Condition[], output: Output = { kind: "count" }): HookSpec => ({ v: 3, entity, where, output } as HookSpec);
const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

type Case = { id: string; template: string; params: string; spec: HookSpec; oracle: string; args: unknown[] };
const cases: Case[] = [];
const add = (template: string, params: string, spec: HookSpec, oracle: string, args: unknown[] = []) =>
  cases.push({ id: `${template}-${cases.filter((c) => c.template === template).length + 1}`, template, params, spec, oracle, args });

const cnt = (alias: string, extra = "") => `(select count(*) from page_views p where p.session_id = ${alias}.session_id and p.site_id = ${alias}.site_id ${extra})`;
const SESS = `select count(*)::int as v from sessions s where s.site_id = '${SITE}'`;
const PV = `select count(*)::int as v from page_views p where p.site_id = '${SITE}'`;
const CONV = (a: string) => `exists (select 1 from form_submissions f where f.session_id = ${a}.session_id and f.site_id = ${a}.site_id)`;

// T1: sessions from a utm source with at least K page views
for (const u of ["google", "facebook", "newsletter"]) for (const k of [2, 3])
  add("T1", `utm=${u}, views>=${k}`,
    H("session", [{ id: "u", kind: "field", field: "utmSource", op: "=", value: u }, { id: "k", kind: "related", relation: "pageViews", where: [], measure: { agg: "count" }, op: ">=", value: k }] as any),
    `${SESS} and s.utm_source = $1 and ${cnt("s")} >= $2`, [u, k]);

// T2: sessions from a country that viewed page P at least once
for (const c of ["ET", "GB", "DE"]) for (const p of ["/p0", "/p5"])
  add("T2", `country=${c}, page=${p}`,
    H("session", [{ id: "c", kind: "field", field: "country", op: "=", value: c }, { id: "p", kind: "related", relation: "pageViews", where: [{ id: "pp", kind: "field", field: "page", op: "=", value: p }], measure: { agg: "count" }, op: ">=", value: 1 }] as any),
    `${SESS} and s.country = $1 and ${cnt("s", "and p.page_path = $2")} >= 1`, [c, p]);

// T3: page views of a page lasting over N seconds
for (const p of ["/p3", "/p20", "/p45"]) for (const n of [5, 30])
  add("T3", `page=${p}, time>${n}s`,
    H("pageView", [{ id: "p", kind: "field", field: "page", op: "=", value: p }, { id: "t", kind: "field", field: "timeOnPage", op: ">", value: { amount: n, unit: "sec" } }] as any),
    `${PV} and p.page_path = $1 and p.time_on_page > $2`, [p, n * 1000]);

// T4: sessions with a utm source in a country
for (const u of ["google", "facebook"]) for (const c of ["US", "GB", "ET"])
  add("T4", `utm=${u}, country=${c}`,
    H("session", [{ id: "u", kind: "field", field: "utmSource", op: "=", value: u }, { id: "c", kind: "field", field: "country", op: "=", value: c }] as any),
    `${SESS} and s.utm_source = $1 and s.country = $2`, [u, c]);

// T5: sessions started in the last D days with at least K page views
for (const d of [7, 30, 60]) for (const k of [1, 2]) {
  const iso = days(d);
  add("T5", `last ${d}d, views>=${k}`,
    H("session", [{ id: "d", kind: "field", field: "startedAt", op: ">", value: iso }, { id: "k", kind: "related", relation: "pageViews", where: [], measure: { agg: "count" }, op: ">=", value: k }] as any),
    `${SESS} and s.started_at > $1::timestamptz and ${cnt("s")} >= $2`, [iso, k]);
}

// T6: (utm A OR country C) AND not converted
for (const [a, c] of [["facebook", "GB"], ["google", "ET"], ["newsletter", "DE"]] as const) for (const neg of [true, false])
  add("T6", `(utm=${a} OR country=${c}) AND ${neg ? "not " : ""}converted`,
    H("session", [{ id: "or", kind: "group", mode: "or", where: [{ id: "a", kind: "field", field: "utmSource", op: "=", value: a }, { id: "c", kind: "field", field: "country", op: "=", value: c }] }, { id: "cv", kind: "field", field: "converted", op: neg ? "isFalse" : "isTrue" }] as any),
    `${SESS} and (s.utm_source = $1 or s.country = $2) and ${neg ? "not " : ""}${CONV("s")}`, [a, c]);

// T7: sub-hook. page views by visitors who are qualified leads, longer than N seconds
for (const n of [10, 30, 60])
  add("T7", `qualified leads' views, time>${n}s`,
    H("pageView", [{ id: "who", kind: "field", field: "visitor", op: "in", value: { hook: H("lead", [{ id: "q", kind: "field", field: "qualified", op: "isTrue" }], { kind: "values", field: "visitor" }) } }, { id: "t", kind: "field", field: "timeOnPage", op: ">", value: { amount: n, unit: "sec" } }] as any),
    `${PV} and p.visitor_id in (select f.visitor_id from form_submissions f where f.site_id = '${SITE}' and f.qualified is true) and p.time_on_page > $1`, [n * 1000]);

// T8: converted sessions in the last D days with at least 2 page views over a minute (the slow one)
for (const d of [30, 60])
  add("T8", `converted, last ${d}d, 2+ views over 1 min`,
    H("session", [{ id: "cv", kind: "field", field: "converted", op: "isTrue" }, { id: "d", kind: "field", field: "startedAt", op: ">", value: days(d) }, { id: "long", kind: "related", relation: "pageViews", where: [{ id: "t1", kind: "field", field: "timeOnPage", op: ">", value: { amount: 1, unit: "min" } }], measure: { agg: "count" }, op: ">=", value: 2 }] as any),
    `${SESS} and ${CONV("s")} and s.started_at > $1::timestamptz and ${cnt("s", "and p.time_on_page > 60000")} >= 2`, [days(d)]);

async function main() {
  const started = new Date().toISOString();
  const pg = new PGlite();
  const t0 = now();
  const counts = await seed(pg);
  console.log("seeded", counts, `${Math.round((now() - t0) / 1000)} s`, `| ${cases.length} cases`);

  const rows: any[] = [];
  for (const c of cases) {
    // the oracle uses the date baked into the spec params for T5/T8, so re-use the same ISO strings
    const oracle = Number((await pg.query<any>(c.oracle, c.args as any[])).rows[0].v);
    clearEstimateCache();
    const eng = await runHook(makeDb(pg, false), SITE, c.spec);
    clearEstimateCache();
    const fus = await runHook(makeDb(pg, true), SITE, c.spec);
    const a = eng.answer as any, b = fus.answer as any;
    const ev = a.shape === "one" ? Number(a.value) : NaN, fv = b.shape === "one" ? Number(b.value) : NaN;
    const ok = ev === oracle && fv === oracle;
    rows.push({ id: c.id, template: c.template, params: c.params, oracle, engine: ev, fused: fv, engineStrategy: eng.plan.strategy, ok });
    console.log(`${ok ? "ok  " : "FAIL"} ${c.id.padEnd(5)} ${c.params.padEnd(44)} oracle=${oracle} engine=${ev} (${eng.plan.strategy}) fused=${fv}`);
  }

  const passed = rows.filter((r) => r.ok).length;
  const nonTrivial = rows.filter((r) => r.oracle > 0).length;
  const staged = rows.filter((r) => r.engineStrategy === "staged").length;
  const summary = { cases: rows.length, passed, failed: rows.length - passed, nonZeroAnswers: nonTrivial, engineStaged: staged, engineFused: rows.length - staged };
  console.log("SUMMARY", summary);

  const dir = path.join(root, "report", "raw");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `planner-verify-${started.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify({ started, finished: new Date().toISOString(), database: "PGlite", data: counts, summary, rows }, null, 2));
  console.log("saved", path.relative(root, file));
  if (summary.failed) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
