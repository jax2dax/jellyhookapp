/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures are plain JSON rows */
// jh-hook/tests/engine.test.ts
// The Hook engine against a real Postgres (PGlite, in-memory: same SQL
// dialect and planner as Supabase). Every check compares the engine's answer
// with the same answer computed by hand in plain JS from the fixture.
// Run: npm run test:hook   (must pass before any change to jh-hook/ ships)
import { PGlite } from "@electric-sql/pglite";
import { runHook, clearEstimateCache, type HookDb } from "../engine/run";
import { SCHEMA, FIELD_GROUPS } from "../schema";
import { SQL } from "../engine/sqlmap";
import type { HookSpec, Condition, Output } from "../types";
import { isHookError } from "../errors";
import { migrateSpec } from "../migrate";

const SITE = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
let fails = 0, passes = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL:", m); } else { passes++; console.log("ok:", m); } };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// ── deterministic fixture ────────────────────────────────────────────────
type PV = { id?: string; sid: string; vid: string; site: string; path: string; enter: number; left: number | null; t: number | null;
  ph: number | null; vh: number | null; entry: number; max: number; revisit: number | null; exit: number };
type S = { sid: string; vid: string; site: string; start: number; end: number | null; utm: string | null; country: string };
const T0 = Date.UTC(2026, 9, 1, 10);
const sessions: S[] = [], pvs: PV[] = [], subs: any[] = [], visitors: any[] = [], forms: any[] = [];
let rnd = 7; const r = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
const PATHS = ["/", "/blogs", "/pricing", "/about", "/contact"];
for (let i = 0; i < 60; i++) {
  const site = i >= 52 ? OTHER : SITE;
  const vid = "v" + (i % 15);
  const sid = "s" + i;
  const start = T0 + i * 3_600_000 * 5;
  let t = start;
  const n = 1 + (i % 5);
  for (let k = 0; k < n; k++) {
    const dur = Math.round(r() * 12) * 1000;
    const vhNull = (i + k) % 7 === 0;
    pvs.push({ sid, vid, site, path: PATHS[Math.floor(r() * 5)], enter: t, left: t + dur, t: dur, ph: 2000, vh: vhNull ? null : 800,
      entry: 0, max: Math.round(r() * 10) / 10, revisit: k % 3 === 1 ? 0.1 : null, exit: 0.2 });
    const g = k % 4 === 1 ? 180_000 : k % 4 === 2 ? 20_000 : 500; // away 3 min, away 20 s, or plain navigation
    t += dur + g;
  }
  const last = pvs[pvs.length - 1];
  sessions.push({ sid, vid, site, start, end: i % 9 === 0 ? null : (last.left as number), utm: i % 3 === 0 ? "facebook" : i % 3 === 1 ? "google" : null, country: i % 2 ? "US" : "ET" });
  if (i % 4 === 0) subs.push({ site, vid, sid, name: i % 8 === 0 ? "Hanna Lee" : "Joseph Kay", email: `u${i}@x.com`, page: "/contact", at: start + 1000, q: i % 12 === 0 ? true : null });
  if (i % 3 === 0) forms.push({ site, vid, sid, path: "/contact", status: i % 4 === 0 ? "submitted" : "abandoned", viewed: start, first: start + 4000, ended: start + 30_000 });
}
for (let v = 0; v < 15; v++) for (const site of [SITE, OTHER]) visitors.push({ vid: "v" + v, site, device: v % 2 ? "mobile" : "desktop" });

async function main() {
  const pg = new PGlite();
  await pg.exec(`
    create table sessions (id uuid primary key default gen_random_uuid(), session_id text unique, visitor_id text, site_id uuid, started_at timestamptz, ended_at timestamptz, last_activity_at timestamptz, referrer text, country text, timezone text, utm_source text, utm_medium text, utm_campaign text);
    create table page_views (id uuid primary key default gen_random_uuid(), page_view_id text, session_id text, visitor_id text, site_id uuid, page_url text, page_path text, page_title text, entered_at timestamptz, left_at timestamptz, time_on_page integer, scroll_depth real, max_scroll_depth real, max_scroll_reached_at timestamptz, page_height integer, entry_scroll_depth real, revisit_start_scroll_depth real, viewport_height integer);
    create table form_submissions (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text, session_id text, page_url text, page_path text, name text, email text, phone text, confidence text default 'high', raw_data jsonb, submitted_at timestamptz, qualified boolean);
    create table visitors (id uuid primary key default gen_random_uuid(), visitor_id text, site_id uuid, first_seen timestamptz, last_seen timestamptz, device_type text, browser text, os text, language text);
    create table form_engagement (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text, session_id text, page_view_id text, page_path text, form_index integer default 0, status text, last_field_type text, last_field_key text, viewed_at timestamptz, first_input_at timestamptz, ended_at timestamptz, field_timings jsonb default '{}', last_activity_at timestamptz);
  `);
  const iso = (n: number | null) => (n == null ? null : new Date(n).toISOString());
  for (const s of sessions) await pg.query("insert into sessions(session_id,visitor_id,site_id,started_at,ended_at,last_activity_at,utm_source,country) values ($1,$2,$3,$4,$5,$6,$7,$8)", [s.sid, s.vid, s.site, iso(s.start), iso(s.end), iso(s.end ?? s.start), s.utm, s.country]);
  for (const p of pvs) {
    const res = await pg.query<{ id: string }>("insert into page_views(session_id,visitor_id,site_id,page_path,entered_at,left_at,time_on_page,page_height,viewport_height,entry_scroll_depth,max_scroll_depth,revisit_start_scroll_depth,scroll_depth) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id",
      [p.sid, p.vid, p.site, p.path, iso(p.enter), iso(p.left), p.t, p.ph, p.vh, p.entry, p.max, p.revisit, p.exit]);
    p.id = res.rows[0].id;
  }
  for (const s of subs) await pg.query("insert into form_submissions(site_id,visitor_id,session_id,name,email,page_path,submitted_at,qualified) values ($1,$2,$3,$4,$5,$6,$7,$8)", [s.site, s.vid, s.sid, s.name, s.email, s.page, iso(s.at), s.q]);
  await pg.query("insert into form_submissions(site_id,visitor_id,session_id,name,email) values ($1,'vx','sx','a_b%c','wild@x.com'),($1,'vy','sy','axbyc','plain@x.com')", [SITE]);
  for (const v of visitors) await pg.query("insert into visitors(visitor_id,site_id,device_type) values ($1,$2,$3)", [v.vid, v.site, v.device]);
  for (const f of forms) await pg.query("insert into form_engagement(site_id,visitor_id,session_id,page_path,status,viewed_at,first_input_at,ended_at,field_timings) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [f.site, f.vid, f.sid, f.path, f.status, iso(f.viewed), iso(f.first), iso(f.ended), JSON.stringify({ email: {}, name: {} })]);
  // form friction fixture: real per-field timings on /demo-form
  const friction = [
    { sid: "s1", status: "abandoned", last: ["phone", null], t: { name: { order: 1, totalFocusedMs: 2000, firstFocusAt: "2026-10-01T10:00:00Z", firstKeydownAt: "2026-10-01T10:00:01Z" }, email: { order: 2, totalFocusedMs: 5000, firstFocusAt: "2026-10-01T10:00:03Z", firstKeydownAt: "2026-10-01T10:00:04Z" }, phone: { order: 3, totalFocusedMs: 21000, firstFocusAt: "2026-10-01T10:00:09Z", firstKeydownAt: null } } },
    { sid: "s2", status: "abandoned", last: ["custom", "company"], t: { email: { order: 1, totalFocusedMs: 3000, firstFocusAt: "2026-10-01T11:00:00Z", firstKeydownAt: "2026-10-01T11:00:02Z" }, "custom:company": { order: 2, totalFocusedMs: 9000, firstFocusAt: "2026-10-01T11:00:05Z", firstKeydownAt: "2026-10-01T11:00:08Z" } } },
    { sid: "s3", status: "submitted", last: ["email", null], t: { name: { order: 1, totalFocusedMs: 1000, firstFocusAt: "2026-10-01T12:00:00Z", firstKeydownAt: "2026-10-01T12:00:00.500Z" }, email: { order: 2, totalFocusedMs: 4000, firstFocusAt: "2026-10-01T12:00:02Z", firstKeydownAt: "2026-10-01T12:00:03Z" }, broken: "not an object", phone: { order: "x", totalFocusedMs: "y", firstFocusAt: "garbage" } } },
  ];
  for (const f of friction)
    await pg.query("insert into form_engagement(site_id,visitor_id,session_id,page_path,status,last_field_type,last_field_key,field_timings) values ($1,$2,$3,'/demo-form',$4,$5,$6,$7)", [SITE, "v" + f.sid, f.sid, f.status, f.last[0], f.last[1], JSON.stringify(f.t)]);
  await pg.exec("analyze");

  const queries: string[] = [];
  const db: HookDb = {
    async query(sql, params) { queries.push(sql); return (await pg.query(sql, params as any[])).rows as any; },
    async explain(sql, params) {
      queries.push(sql);
      const res: any = await pg.query("EXPLAIN (FORMAT JSON) " + sql, params as any[]);
      const plan = res.rows[0]["QUERY PLAN"][0].Plan;
      return { rows: plan["Plan Rows"], cost: plan["Total Cost"] };
    },
  };
  let idn = 0;
  const id = () => "c" + ++idn;
  const H = (entity: HookSpec["entity"], where: Condition[], output: Output = { kind: "count" }, order?: HookSpec["order"]): HookSpec => ({ v: 3, entity, where, output, order });
  const one = async (s: HookSpec) => { const res = await runHook(db, SITE, s); if (res.answer.shape !== "one") throw new Error("not one"); return res.answer.value as number; };
  const list = async (s: HookSpec) => { const res = await runHook(db, SITE, s); if (res.answer.shape !== "list") throw new Error("not list"); return res.answer.values; };
  const err = async (s: HookSpec) => { try { await runHook(db, SITE, s); return ""; } catch (e: any) { return e.message as string; } };

  // JS ground truth
  const S_ = sessions.filter((s) => s.site === SITE);
  const P_ = pvs.filter((p) => p.site === SITE);
  const conv = new Set(subs.filter((s) => s.site === SITE).map((s) => s.sid));
  const pvOf = (sid: string) => P_.filter((p) => p.sid === sid).sort((a, b) => a.enter - b.enter);
  const gapsOf = (sid: string) => { const v = pvOf(sid); const g: number[] = []; for (let i = 0; i + 1 < v.length; i++) { const d = v[i + 1].enter - (v[i].left as number); if (d >= 15000) g.push(d); } return g; };

  // 0. schema and sqlmap never drift
  let drift = 0;
  for (const [e, def] of Object.entries(SCHEMA)) {
    for (const f of Object.keys(def.fields)) if (!(SQL as any)[e].fields[f]) { drift++; console.log("missing sql", e, f); }
    for (const rl of Object.keys(def.relations)) if (!(SQL as any)[e].joins[rl]) { drift++; console.log("missing join", e, rl); }
  }
  ok(drift === 0, "every schema field and relation has SQL");
  let ungrouped = 0;
  for (const [e, def] of Object.entries(SCHEMA)) {
    const grouped = (FIELD_GROUPS as any)[e].flatMap((g: any) => g.fields) as string[];
    for (const f of Object.keys(def.fields)) if (grouped.filter((x) => x === f).length !== 1) { ungrouped++; console.log("field not in exactly one group", e, f); }
    for (const f of grouped) if (!(def.fields as any)[f]) { ungrouped++; console.log("group names unknown field", e, f); }
  }
  ok(ungrouped === 0, "every field is in exactly one display group");

  // 1. ranges
  ok((await one(H("pageView", [{ id: id(), kind: "field", field: "timeOnPage", op: "between", value: { amount: 3, unit: "sec" }, value2: { amount: 5, unit: "sec" } }]))) === P_.filter((p) => p.t! >= 3000 && p.t! <= 5000).length, "time on page between 3 and 5 sec");
  ok((await one(H("pageView", [{ id: id(), kind: "field", field: "timeOnPage", op: ">", value: { amount: 0.05, unit: "min" } }]))) === P_.filter((p) => p.t! > 3000).length, "0.05 min = 3 sec");

  // 2. counts of related rows with any operator
  ok((await one(H("session", [{ id: id(), kind: "related", relation: "pageViews", where: [], measure: { agg: "count" }, op: "<", value: 4 }]))) === S_.filter((s) => pvOf(s.sid).length < 4).length, "sessions with fewer than 4 page views");
  ok((await one(H("session", [{ id: id(), kind: "related", relation: "pageViews", where: [], measure: { agg: "countDistinct", field: "page" }, op: "=", value: 2 }]))) === S_.filter((s) => new Set(pvOf(s.sid).map((p) => p.path)).size === 2).length, "sessions with exactly 2 different pages");
  ok((await one(H("session", [{ id: id(), kind: "related", relation: "pageViews", where: [], measure: { agg: "sum", field: "timeOnPage" }, op: "between", value: { amount: 10, unit: "sec" }, value2: { amount: 20, unit: "sec" } }]))) === S_.filter((s) => { const t = pvOf(s.sid).reduce((a, p) => a + p.t!, 0); return t >= 10000 && t <= 20000; }).length, "total time on pages between 10 and 20 sec");

  // 3. the marketer query, all three order modes must agree
  const after = new Date(T0 + 24 * 3_600_000).toISOString();
  const mk = () => [
    { id: "date", kind: "field", field: "startedAt", op: ">", value: after },
    { id: "blogs", kind: "related", relation: "pageViews", where: [{ id: "bp", kind: "field", field: "page", op: "=", value: "/blogs" }, { id: "bt", kind: "field", field: "timeOnPage", op: ">", value: { amount: 5, unit: "sec" } }], measure: { agg: "count" }, op: ">=", value: 2 },
    { id: "nc", kind: "field", field: "converted", op: "isFalse" },
  ] as Condition[];
  const expM = S_.filter((s) => s.start > Date.parse(after) && !conv.has(s.sid) && pvOf(s.sid).filter((p) => p.path === "/blogs" && p.t! > 5000).length >= 2).length;
  for (const order of [undefined, { mode: "manual" as const, steps: ["nc", "date", "blogs"], guard: false }, { mode: "manual" as const, steps: ["blogs", "nc", "date"] }]) {
    clearEstimateCache();
    const res = await runHook(db, SITE, H("session", mk(), { kind: "count" }, order));
    ok(res.answer.shape === "one" && res.answer.value === expM, `marketer query ${order ? order.mode + (order.guard === false ? " no-guard" : "") : "auto"}: ${(res.answer as any).value} of ${expM} (${res.plan.strategy}, ${res.plan.order.join(">")})`);
  }

  // 4. converted sessions with fewer than 4 pages and exactly 1 away gap longer than 2 min
  const exp4 = S_.filter((s) => conv.has(s.sid) && pvOf(s.sid).length < 4 && gapsOf(s.sid).filter((g) => g > 120000).length === 1).length;
  ok((await one(H("session", [
    { id: id(), kind: "field", field: "converted", op: "isTrue" },
    { id: id(), kind: "related", relation: "pageViews", where: [], op: "<", value: 4 },
    { id: id(), kind: "related", relation: "awayGaps", where: [{ id: id(), kind: "field", field: "duration", op: ">", value: { amount: 2, unit: "min" } }], op: "=", value: 1 },
  ]))) === exp4, `converted, <4 pages, exactly 1 away gap > 2 min: ${exp4}`);
  ok((await one(H("awayGap", [{ id: id(), kind: "field", field: "duration", op: ">=", value: { amount: 15, unit: "sec" } }]))) === S_.reduce((a, s) => a + gapsOf(s.sid).length, 0), "away gaps use the 15 s threshold");

  // 5. OR and NOT groups
  ok((await one(H("session", [{ id: id(), kind: "group", mode: "or", where: [
    { id: id(), kind: "field", field: "utmSource", op: "=", value: "facebook" }, { id: id(), kind: "field", field: "country", op: "=", value: "US" }] }]))) === S_.filter((s) => s.utm === "facebook" || s.country === "US").length, "OR group");
  ok((await one(H("session", [{ id: id(), kind: "group", mode: "and", not: true, where: [
    { id: id(), kind: "field", field: "utmSource", op: "in", value: ["facebook", "google"] }] }]))) === S_.filter((s) => !(s.utm === "facebook" || s.utm === "google")).length, "NOT (utm is any of facebook, google) includes empty utm");
  ok((await one(H("session", [{ id: id(), kind: "field", field: "utmSource", op: "notIn", value: ["facebook"] }]))) === S_.filter((s) => s.utm !== "facebook").length, "is none of keeps empty values");

  // 6. tunnels
  const hannaV = new Set(subs.filter((s) => s.site === SITE && /hanna/i.test(s.name)).map((s) => s.vid));
  const hannaHook: HookSpec = H("lead", [{ id: "n", kind: "field", field: "name", op: "contains", value: "hanna" }], { kind: "values", field: "visitor" });
  let res = await runHook(db, SITE, H("pageView", [{ id: "who", kind: "field", field: "visitor", op: "in", value: { hook: hannaHook } }]));
  ok(res.answer.shape === "one" && res.answer.value === P_.filter((p) => hannaV.has(p.vid)).length, `tunnel list -> visitor is any of: ${(res.answer as any).value}`);
  ok(res.tunnels.length === 1 && res.tunnels[0].count === hannaV.size && res.tunnels[0].shape === "list", `tunnel reports ${res.tunnels[0]?.count} visitors`);
  const pricing = P_.filter((p) => p.path === "/pricing");
  const avgPricing = pricing.reduce((a, p) => a + p.t!, 0) / pricing.length;
  res = await runHook(db, SITE, H("pageView", [{ id: "x", kind: "field", field: "timeOnPage", op: ">", value: { hook: H("pageView", [{ id: "pp", kind: "field", field: "page", op: "=", value: "/pricing" }], { kind: "aggregate", agg: "avg", field: "timeOnPage" }) } }]));
  ok(res.answer.shape === "one" && res.answer.value === P_.filter((p) => p.t! > avgPricing).length, `tunnel one -> time on page > average on /pricing (${avgPricing.toFixed(0)} ms)`);
  const convPages = new Set(P_.filter((p) => conv.has(p.sid)).map((p) => p.path));
  const mobile = new Set(visitors.filter((v) => v.site === SITE && v.device === "mobile").map((v) => v.vid));
  ok((await one(H("pageView", [
    { id: "pg", kind: "field", field: "page", op: "in", value: { hook: H("pageView", [{ id: "ic", kind: "field", field: "inConvertedSession", op: "isTrue" }], { kind: "values", field: "page" }) } },
    { id: "mob", kind: "field", field: "visitor", op: "in", value: { hook: H("visitor", [{ id: "dv", kind: "field", field: "device", op: "=", value: "mobile" }], { kind: "ids" }) } },
  ]))) === P_.filter((p) => convPages.has(p.path) && mobile.has(p.vid)).length, "two tunnels feed one query");
  ok((await one(H("page", [{ id: "pp2", kind: "field", field: "path", op: "in", value: { hook: H("session", [{ id: "cv", kind: "field", field: "converted", op: "isTrue" }], { kind: "values", field: "landingPage" }) } }]))) === new Set(S_.filter((s) => conv.has(s.sid)).map((s) => pvOf(s.sid)[0].path)).size, "landing pages of converted sessions, as pages");
  // tunnel inside a tunnel
  const innerHook = H("lead", [{ id: "q1", kind: "field", field: "qualified", op: "isTrue" }], { kind: "values", field: "visitor" });
  const qualV = new Set(subs.filter((s) => s.site === SITE && s.q === true).map((s) => s.vid));
  ok((await one(H("pageView", [{ id: "s1", kind: "field", field: "session", op: "in", value: { hook: H("session", [{ id: "s2", kind: "field", field: "visitor", op: "in", value: { hook: innerHook } }], { kind: "ids" }) } }]))) === P_.filter((p) => qualV.has(p.vid)).length, "tunnel inside a tunnel");

  // breakdown as a sub-hook: the 2 pages with the most views feed "page is any of"
  const top2 = [...byPageAll()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
  function byPageAll() { const m = new Map<string, number>(); for (const p of P_) m.set(p.path, (m.get(p.path) ?? 0) + 1); return m; }
  ok((await one(H("pageView", [{ id: "tp", kind: "field", field: "page", op: "in", value: { hook: H("pageView", [], { kind: "groupBy", field: "page", measure: { agg: "count" }, sort: "valueDesc", limit: 2 }) } }]))) === P_.filter((p) => top2.includes(p.path)).length, "breakdown (top 2 pages by views) as a sub-hook feeds 'is any of'");

  // 7. mismatches are errors, never coercions
  ok(/returns a list/.test(await err(H("pageView", [{ id: "a", kind: "field", field: "visitor", op: "=", value: { hook: hannaHook } }]))), "list into '=' is an error");
  ok(/returns number, but this needs duration/.test(await err(H("pageView", [{ id: "a", kind: "field", field: "timeOnPage", op: ">", value: { hook: H("session", [], { kind: "count" }) } }]))), "count into a duration is an error");
  ok(/returns session ids, but this needs visitor ids/.test(await err(H("pageView", [{ id: "a", kind: "field", field: "visitor", op: "in", value: { hook: H("session", [], { kind: "ids" }) } }]))), "session ids into a visitor field is an error");
  ok(/can't be used on a duration/.test(await err(H("pageView", [{ id: "a", kind: "field", field: "timeOnPage", op: "contains", value: "x" }]))), "text operator on a duration is an error");
  ok(/is not a field/.test(await err(H("pageView", [{ id: "a", kind: "field", field: "password", op: "=", value: "x" }]))), "unknown field is an error");

  // 8. outputs
  const avgAll = P_.reduce((a, p) => a + p.t!, 0) / P_.length;
  ok(near(await one(H("pageView", [], { kind: "aggregate", agg: "avg", field: "timeOnPage" })), avgAll), "average time on page");
  ok((await one(H("pageView", [], { kind: "countDistinct", field: "session" }))) === new Set(P_.map((p) => p.sid)).size, "number of different sessions");
  res = await runHook(db, SITE, H("pageView", [], { kind: "groupBy", field: "page", measure: { agg: "count" } }));
  const byPage = new Map<string, number>(); for (const p of P_) byPage.set(p.path, (byPage.get(p.path) ?? 0) + 1);
  ok(res.answer.shape === "table" && res.answer.rows.every((row) => byPage.get(row.key!) === row.value) && res.answer.rows.length === byPage.size, "page views per page");
  res = await runHook(db, SITE, H("session", [], { kind: "groupBy", field: "startedAt", bucket: "day", measure: { agg: "count" } }));
  const byDay = new Map<string, number>(); for (const s of S_) { const d = new Date(s.start).toISOString().slice(0, 10); byDay.set(d, (byDay.get(d) ?? 0) + 1); }
  ok(res.answer.shape === "table" && res.answer.rows.length === byDay.size && res.answer.rows.every((row) => byDay.get(row.key!.slice(0, 10)) === row.value), "sessions per day (bucketed)");
  const ids = await list(H("session", [{ id: id(), kind: "field", field: "converted", op: "isTrue" }], { kind: "ids" }));
  ok(ids.length === conv.size && ids.every((x) => conv.has(x)), "ids of converted sessions are session ids");

  // 9. derived fields
  const vf = 800 / 2000;
  const seen = (p: PV) => { if (p.vh == null) return null; const topS = Math.min(p.entry, p.revisit ?? p.entry) * (1 - vf); const bot = Math.min(1, p.max * (1 - vf) + vf); return 100 * (bot - topS); };
  ok((await one(H("pageView", [{ id: id(), kind: "field", field: "seenPct", op: ">=", value: 70 }]))) === P_.filter((p) => (seen(p) ?? -1) >= 70 - 1e-9).length, "seen at least 70%");
  ok((await one(H("pageView", [{ id: id(), kind: "field", field: "seenPct", op: "isEmpty" }]))) === P_.filter((p) => p.vh == null).length, "seen % is empty (unknown) when the screen height was never measured");
  ok((await one(H("pageView", [{ id: id(), kind: "field", field: "isLanding", op: "isTrue" }]))) === S_.length, "one landing page per session");
  ok((await one(H("pageView", [{ id: id(), kind: "field", field: "position", op: "=", value: 3 }]))) === S_.filter((s) => pvOf(s.sid).length >= 3).length, "position in session = 3");
  ok((await one(H("pageView", [{ id: id(), kind: "related", relation: "session", where: [{ id: id(), kind: "field", field: "converted", op: "isTrue" }] }]))) === P_.filter((p) => conv.has(p.sid)).length, "page views whose session converted (one-to-one relation)");
  ok((await one(H("form", [{ id: id(), kind: "field", field: "fillTime", op: "=", value: { amount: 26, unit: "sec" } }, { id: id(), kind: "field", field: "fieldsTouched", op: "=", value: 2 }]))) === forms.filter((f) => f.site === SITE).length, "form fill time and fields touched");

  // 11. form friction: per-field timings
  const demo = { id: "dm", kind: "field", field: "page", op: "=", value: "/demo-form" } as Condition;
  ok((await one(H("formField", [demo]))) === 8, "form fields: every focused field, malformed entries skipped (8 of 9 keys)");
  ok((await one(H("formField", [demo, { id: id(), kind: "field", field: "focusedTime", op: ">", value: { amount: 8, unit: "sec" } }]))) === 2, "fields where people spent more than 8 sec");
  ok((await one(H("formField", [demo, { id: id(), kind: "field", field: "typed", op: "isFalse" }]))) === 2, "fields clicked into but never typed in (incl. the malformed one)");
  ok((await one(H("form", [
    { id: id(), kind: "field", field: "status", op: "=", value: "abandoned" },
    { id: id(), kind: "related", relation: "fields", where: [{ id: id(), kind: "field", field: "isLastTouched", op: "isTrue" }, { id: id(), kind: "field", field: "name", op: "=", value: "phone" }] },
  ]))) === 1, "abandoned forms where the last field touched was phone");
  ok((await one(H("formField", [demo, { id: id(), kind: "field", field: "isLastTouched", op: "isTrue" }, { id: id(), kind: "field", field: "fieldType", op: "=", value: "custom" }]))) === 1, "a custom field (custom:company) is matched as the last field touched");
  res = await runHook(db, SITE, H("formField", [demo], { kind: "groupBy", field: "name", measure: { agg: "avg", field: "focusedTime" }, sort: "valueDesc" }));
  ok(res.answer.shape === "table" && res.answer.rows[0]?.key === "phone" && res.answer.rows[0]?.value === 21000, "average time per field, slowest first (phone, 21 sec)");
  ok(near(await one(H("formField", [demo, { id: id(), kind: "field", field: "name", op: "=", value: "email" }], { kind: "aggregate", agg: "avg", field: "timeToFirstKey" })), (1000 + 2000 + 1000) / 3), "average time before typing in the email field");

  // 12. old queries keep working (jh-hook/migrate.ts)
  const v1 = { v: 1, return: { entity: "sessions", as: "count" }, filters: [
    { id: "p", kind: "page", paths: ["/blogs"] }, { id: "t", kind: "timeOnPage", op: ">", value: 5, unit: "sec" }, { id: "c", kind: "sessionConversion", value: "nonConverted" }] };
  const expV1 = S_.filter((x) => !conv.has(x.sid) && pvOf(x.sid).some((pp) => pp.path === "/blogs" && pp.t! > 5000)).length;
  res = await runHook(db, SITE, v1 as unknown as HookSpec);
  ok(res.answer.shape === "one" && res.answer.value === expV1 && /older format \(v1\)/.test(res.plan.notes.join(" ")), `a v1 query is upgraded and gives the same answer (${expV1})`);
  const v2 = { v: 2, entity: "pageView", where: [{ id: "r", kind: "related", relation: "pageInfo", where: [{ id: "p", kind: "field", field: "path", op: "=", value: "/blogs" }] }], output: { kind: "count" } };
  ok((await one(v2 as unknown as HookSpec)) === P_.filter((pp) => pp.path === "/blogs").length, "a v2 query using the removed 'its page' becomes 'page is /blogs'");
  ok(migrateSpec(migrateSpec(v2).spec).upgradedFrom === null, "upgrading an up-to-date query changes nothing");
  ok(/newer version/.test(await err({ v: 99 } as unknown as HookSpec)), "a query from a newer version is refused clearly");

  // 13. names, notes and layout never change the answer
  const named = H("pageView", [{ id: "nm", kind: "field", field: "page", op: "=", value: "/blogs", meta: { name: "Blog readers", description: "anyone on /blogs" }, ui: { collapsed: true, spaceBefore: 120 } } as Condition]);
  named.meta = { name: "My hook" };
  named.ui = { collapsed: false };
  ok((await one(named)) === P_.filter((pp) => pp.path === "/blogs").length, "names, descriptions and layout are ignored by the engine");
  ok(/spacing must be between/.test(await err(H("pageView", [{ id: "sp", kind: "field", field: "page", op: "=", value: "/", ui: { spaceBefore: 99999 } } as Condition]))), "layout values are bounds-checked");

  // 14. errors a person can fix are HookErrors; everything else is not
  let caught: unknown = null;
  try { await runHook(db, SITE, H("pageView", [{ id: "a", kind: "field", field: "timeOnPage", op: "contains", value: "x" }])); } catch (e) { caught = e; }
  ok(isHookError(caught), "a type mistake is a HookError (safe to show)");
  caught = null;
  try { await runHook({ ...db, query: async () => { throw new Error("connection refused at 10.0.0.1"); } }, SITE, H("pageView", [])); } catch (e) { caught = e; }
  ok(caught !== null && !isHookError(caught), "a database failure is NOT a HookError (never shown verbatim)");

  // 10. security
  ok((await one(H("pageView", []))) === P_.length, "no conditions counts only this site");
  const all = queries.join("\n");
  const refs = (all.match(/public\.\w+/g) ?? []).length;
  const scopedRefs = (all.match(/FROM public\.\w+ WHERE site_id = \$1::uuid/g) ?? []).length;
  ok(refs === scopedRefs && refs > 0, `every table reference is site-scoped (${scopedRefs}/${refs})`);
  ok((await one(H("pageView", [{ id: id(), kind: "field", field: "page", op: "=", value: "/x'; drop table page_views; --" }]))) === 0, "hostile text is just data");
  ok(/can't be used/.test(await err(H("pageView", [{ id: id(), kind: "field", field: "timeOnPage", op: "; drop" as any, value: 1 }]))), "unknown operator rejected");
  for (const [t, n] of [["%", 1], ["_b%", 1], ["a%c", 0]] as const)
    ok((await one(H("lead", [{ id: id(), kind: "field", field: "name", op: "contains", value: t }]))) === n, `LIKE text '${t}' matched literally`);
  ok(/credit limit/.test(await (async () => { try { await runHook(db, SITE, H("pageView", []), { maxCredits: 0 }); return ""; } catch (e: any) { return e.message; } })()), "budget gate blocks before running");

  console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `\nALL ${passes} PASS`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
