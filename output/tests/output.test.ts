/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures are plain JSON rows */
// output/tests/output.test.ts
// The output engine's rules and its riskiest parts, checked for real:
//   - the plan (which view, which evidence) for every kind of hook
//   - the evidence SQL (which visits get highlighted) on a real Postgres,
//     including site isolation and sequences
//   - sealed tokens (round trip, tampering, wrong site, expiry)
// Run: npm run test:output
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { planOutput } from "../plan";
import { foldSessions, foldVisits, matchingSessionsQuery, matchingVisitsQuery } from "../server/queries";
import { openWith, sealWith, TOKEN_MAX_AGE_MS } from "../server/seal-core";
import type { Condition, HookSpec, Output, RelatedCondition } from "../../jh-hook/types";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) {
    passes++;
    console.log("ok:", m);
  } else {
    fails++;
    console.log("FAIL:", m);
  }
};
const H = (entity: HookSpec["entity"], where: Condition[], output: Output = { kind: "ids" }): HookSpec => ({ v: 3, entity, where, output });
const blogs: RelatedCondition = { id: "pv", kind: "related", relation: "pageViews", where: [{ id: "p", kind: "field", field: "page", op: "=", value: "/blogs" }] };

async function main() {
  // ── 1. the plan ──────────────────────────────────────────────────────
  let p = planOutput(H("session", [], { kind: "count" }));
  ok(p.view === "number" && p.baseRate, "a count: a number with its base rate");
  p = planOutput(H("session", [], { kind: "groupBy", field: "startedAt", bucket: "day", measure: { agg: "count" } }));
  ok(p.view === "timeSeries", "a breakdown per day: a time series");
  p = planOutput(H("pageView", [], { kind: "groupBy", field: "page", measure: { agg: "count" } }));
  ok(p.view === "ranking", "a breakdown per page: a ranking");
  p = planOutput(H("session", [], { kind: "values", field: "utmSource" }));
  ok(p.view === "values", "a list of values: value chips");
  p = planOutput(H("session", [{ id: "d", kind: "field", field: "converted", op: "isTrue" }, blogs]));
  ok(p.view === "sessions" && p.evidence.kind === "visits" && p.evidence.conditions.length === 1, "sessions with a page condition: FramePlates with those visits highlighted");
  p = planOutput(H("session", [{ id: "d", kind: "field", field: "converted", op: "isTrue" }]));
  ok(p.view === "sessions" && p.evidence.kind === "none", "sessions with no page condition: FramePlates, nothing highlighted");
  p = planOutput(H("session", [{ id: "n", kind: "group", mode: "and", not: true, where: [blogs] }]));
  ok(p.evidence.kind === "none", "a page condition under NOT is not highlighted (those visits are absent by definition)");
  p = planOutput(H("session", [{ ...blogs, measure: { agg: "count" }, op: "=", value: 0 }]));
  ok(p.evidence.kind === "none", "'has no /blogs visit' (count = 0) is not highlighted");
  p = planOutput(H("pageView", [{ id: "p", kind: "field", field: "page", op: "=", value: "/blogs" }]));
  ok(p.view === "sessions" && p.evidence.kind === "returnedVisits", "page views: shown inside their sessions, the returned visits highlighted");
  p = planOutput(H("lead", [{ id: "n", kind: "field", field: "name", op: "contains", value: "a" }]));
  ok(p.view === "leads" && p.evidence.kind === "none", "a plain lead filter: lead cards only");
  p = planOutput(H("lead", [{ id: "s", kind: "related", relation: "session", where: [blogs] }]));
  ok(p.view === "leads" && p.evidence.kind === "leadSession", "leads filtered on their session: lead cards + the session they converted in");
  p = planOutput(H("visitor", [{ id: "s", kind: "related", relation: "sessions", where: [{ id: "c", kind: "field", field: "converted", op: "isTrue" }] }]));
  ok(p.view === "visitors" && p.evidence.kind === "visitorSessions", "visitors filtered on sessions: visitor cards + up to 2 matching sessions");
  ok(planOutput(H("awayGap", [])).view === "sessions" && planOutput(H("form", [])).view === "forms" && planOutput(H("formField", [])).view === "formFields" && planOutput(H("page", [])).view === "pages", "every entity has a list view");
  ok(planOutput(H("session", [])).pageSize === 6, "sessions load 6 at a time");

  // ── 2. evidence SQL on a real Postgres ───────────────────────────────
  const SITE = "11111111-1111-1111-1111-111111111111";
  const OTHER = "22222222-2222-2222-2222-222222222222";
  const pg = new PGlite();
  await pg.exec(`
    create table sessions (id uuid primary key default gen_random_uuid(), session_id text, visitor_id text, site_id uuid, started_at timestamptz, ended_at timestamptz, last_activity_at timestamptz, referrer text, country text, timezone text, utm_source text, utm_medium text, utm_campaign text);
    create table page_views (id uuid primary key default gen_random_uuid(), page_view_id text, session_id text, visitor_id text, site_id uuid, page_url text, page_path text, page_title text, entered_at timestamptz, left_at timestamptz, time_on_page integer, scroll_depth real, max_scroll_depth real, max_scroll_reached_at timestamptz, page_height integer, entry_scroll_depth real, revisit_start_scroll_depth real, viewport_height integer);
    create table form_submissions (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text, session_id text, page_url text, page_path text, name text, email text, phone text, confidence text, raw_data jsonb, submitted_at timestamptz, qualified boolean);
  `);
  const T = Date.UTC(2026, 9, 1, 10);
  const pages: [string, string, string, string, number][] = [
    // site, session, visitor, path, minute
    [SITE, "s1", "v1", "/", 0], [SITE, "s1", "v1", "/blogs", 1], [SITE, "s1", "v1", "/pricing", 2],
    [SITE, "s2", "v1", "/blogs", 0], [SITE, "s2", "v1", "/blogs", 1],
    [SITE, "s3", "v2", "/", 0],
    [OTHER, "s4", "v9", "/blogs", 0],
  ];
  for (const [site, sid, vid, path, m] of pages)
    await pg.query("insert into page_views(page_view_id,session_id,visitor_id,site_id,page_path,entered_at,left_at,time_on_page) values ($1,$2,$3,$4,$5,$6,$7,$8)", [`${sid}-${path}-${m}`, sid, vid, site, path, new Date(T + m * 60_000).toISOString(), new Date(T + m * 60_000 + 30_000).toISOString(), 30_000]);
  for (const [site, sid, vid, at] of [[SITE, "s1", "v1", 0], [SITE, "s2", "v1", 3600], [SITE, "s3", "v2", 0], [OTHER, "s4", "v9", 0]] as const)
    await pg.query("insert into sessions(session_id,visitor_id,site_id,started_at) values ($1,$2,$3,$4)", [sid, vid, site, new Date(T + at * 1000).toISOString()]);
  await pg.query("insert into form_submissions(site_id,visitor_id,session_id,submitted_at) values ($1,'v1','s2',$2)", [SITE, new Date(T).toISOString()]);
  const run = async (q: { sql: string; params: unknown[] }) => (await pg.query(q.sql, q.params as any[])).rows as Record<string, unknown>[];

  let ev = foldVisits(await run(matchingVisitsQuery(SITE, blogs, ["s1", "s2", "s3", "s4"])));
  ok([...(ev.get("s1") ?? [])].join() === "s1-/blogs-1", "session 1: only its /blogs visit is highlighted");
  ok((ev.get("s2")?.size ?? 0) === 2, "session 2: both /blogs visits are highlighted");
  ok(!ev.has("s3"), "session 3 (no /blogs): nothing highlighted");
  ok(!ev.has("s4"), "another site's session is never read, even when its id is asked for");
  const seq: RelatedCondition = { id: "pv", kind: "related", relation: "pageViews", where: [
    { id: "p", kind: "field", field: "page", op: "=", value: "/blogs" },
    { id: "n", kind: "related", relation: "nextPage", where: [{ id: "q", kind: "field", field: "page", op: "=", value: "/pricing" }] },
  ] };
  ev = foldVisits(await run(matchingVisitsQuery(SITE, seq, ["s1", "s2"])));
  ok([...(ev.get("s1") ?? [])].join() === "s1-/blogs-1" && !ev.has("s2"), "a sequence condition (/blogs then /pricing) highlights only the /blogs visit followed by /pricing");
  const conv: RelatedCondition = { id: "s", kind: "related", relation: "sessions", where: [{ id: "c", kind: "field", field: "converted", op: "isTrue" }] };
  const vs = foldSessions(await run(matchingSessionsQuery(SITE, [conv], ["v1", "v2"])), 2);
  ok(vs.get("v1")?.join() === "s2" && !vs.has("v2"), "visitor evidence: only the session that converted");
  const all = foldSessions(await run(matchingSessionsQuery(SITE, [{ id: "s", kind: "related", relation: "sessions", where: [] }], ["v1"])), 1);
  ok(all.get("v1")?.join() === "s2", "visitor evidence: capped per visitor, newest session first");

  // ── 3. sealed tokens ─────────────────────────────────────────────────
  const key = randomBytes(32);
  const tok = sealWith(key, SITE, "sessions", { id: "s1", h: ["a"] });
  ok(JSON.stringify(openWith(key, SITE, "sessions", tok)) === JSON.stringify({ id: "s1", h: ["a"] }), "a sealed token opens to what was sealed");
  ok(!tok.includes("s1"), "the id is not readable inside the token");
  const err = (f: () => unknown) => {
    try {
      f();
      return "";
    } catch (e: any) {
      return e.message as string;
    }
  };
  const tampered = tok.slice(0, -2) + (tok.endsWith("A") ? "BB" : "AA");
  ok(/can't be loaded/.test(err(() => openWith(key, SITE, "sessions", tampered))), "a tampered token is refused");
  ok(/different site/.test(err(() => openWith(key, OTHER, "sessions", tok))), "a token from another site is refused");
  ok(/different site or view/.test(err(() => openWith(key, SITE, "leads", tok))), "a token for another view is refused");
  ok(/more than a day old/.test(err(() => openWith(key, SITE, "sessions", tok, Date.now() + TOKEN_MAX_AGE_MS + 1))), "an expired token is refused");
  ok(/can't be loaded/.test(err(() => openWith(randomBytes(32), SITE, "sessions", tok))), "a token made with another key is refused");

  console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `\nALL ${passes} PASS`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
