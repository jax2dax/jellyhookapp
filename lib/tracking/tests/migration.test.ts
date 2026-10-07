// lib/tracking/tests/migration.test.ts
// Runs mds/migrations/2026-10-07-ingestion-hardening.sql against a real
// Postgres (PGlite, in memory) built from the table definitions in
// mds/database.md, then checks what the migration promises. Run: npm run test:tracking-sql
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

let fails = 0;
let passes = 0;
const ok = (c, m) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const root = path.resolve(__dirname, "../../..");
const doc = fs.readFileSync(path.join(root, "mds/database.md"), "utf8").replace(/\r\n/g, "\n");
const migration = fs.readFileSync(path.join(root, "mds/migrations/2026-10-07-ingestion-hardening.sql"), "utf8");

/** The create-table statement for one table in database.md. */
function tableDdl(name) {
  const start = doc.indexOf(`create table public.${name} (`);
  if (start === -1) throw new Error("table not in database.md: " + name);
  const end = doc.indexOf("\n);", start);
  return doc.slice(start, end + 3);
}

async function main() {
  const db = new PGlite();
  await db.exec("create schema if not exists public; create role anon; create role authenticated; create role service_role;");
  // Supabase's auth.jwt(): here it reads a setting so the test can "sign in" as someone
  await db.exec("create schema if not exists auth; create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;");
  for (const t of ["sites", "site_members", "visitors", "sessions", "page_views", "page_structure", "form_engagement"]) {
    await db.exec(tableDdl(t));
  }
  // columns the app added to sites that the doc table block does not list
  await db.exec("alter table public.site_members add column if not exists status text not null default 'active'; alter table public.site_members add column if not exists user_email text; alter table public.site_members add column if not exists invited_by text;");
  await db.exec("alter table public.sites add column if not exists verified boolean not null default false; alter table public.sites add column if not exists specify_form boolean not null default false;");
  // the unique key a production sessions table has (database.md line 131)
  await db.exec("alter table public.page_views alter column site_id drop not null; alter table public.visitors alter column site_id drop not null;");

  // ── data that exists BEFORE the migration ─────────────────────────────
  const siteA = (await db.query("insert into public.sites (name, domain, api_key, verified, is_active) values ('A','example.com','keyA',true,true) returning id")).rows[0].id;
  const siteB = (await db.query("insert into public.sites (name, domain, api_key, verified, is_active) values ('B','example.com','keyB',false,true) returning id")).rows[0].id;
  // duplicate visitor rows (the old race): same site + visitor_id three times
  await db.query("insert into public.visitors (site_id, visitor_id, first_seen, last_seen) values ($1,'v1','2026-01-01','2026-01-02'),($1,'v1','2026-01-03','2026-01-09'),($1,'v1','2026-01-05','2026-01-06'),($1,'v2','2026-02-01','2026-02-01')", [siteA]);
  await db.query("insert into public.page_structure (site_id, page_path, page_height, header_index, header_text, header_tag, position_y) values ($1,'/',3000,0,'Hello','h1',100),($1,'/',3000,1,'About','h2',900)", [siteA]);

  // ── run the migration (twice: it must be re-runnable) ─────────────────
  await db.exec(migration);
  await db.exec(migration);
  ok(true, "migration runs, and runs again without error");

  // visitors
  const v = (await db.query("select count(*)::int as n, min(first_seen) as f, max(last_seen) as l from public.visitors where visitor_id = 'v1'")).rows[0];
  ok(v.n === 1, "duplicate visitor rows merged into one");
  ok(new Date(v.f).toISOString().startsWith("2026-01-01") && new Date(v.l).toISOString().startsWith("2026-01-09"), "merged visitor keeps the earliest first_seen and latest last_seen");
  let dupErr = null;
  try { await db.query("insert into public.visitors (site_id, visitor_id) values ($1,'v2')", [siteA]); } catch (e) { dupErr = e; }
  ok(!!dupErr, "a second visitor row for the same (site, visitor_id) is now impossible");
  const up = await db.query("insert into public.visitors (site_id, visitor_id) values ($1,'v2') on conflict (site_id, visitor_id) do nothing returning id", [siteA]);
  ok(up.rows.length === 0, "upsert on (site_id, visitor_id) is a no-op for an existing visitor");

  // structure versions backfill
  const sv = (await db.query("select device_class, fingerprint, headers, page_height from public.page_structure_versions where site_id = $1", [siteA])).rows;
  ok(sv.length === 1 && sv[0].fingerprint === "legacy" && sv[0].headers.length === 2 && sv[0].headers[1].text === "About" && sv[0].page_height === 3000, "page_structure backfilled as ONE legacy version with both headers");
  let verErr = null;
  try { await db.query("insert into public.page_structure_versions (site_id, page_path, device_class, fingerprint, headers) values ($1,'/','desktop','legacy','[]')", [siteA]); } catch (e) { verErr = e; }
  ok(!!verErr, "the same (site, path, device, fingerprint) cannot be stored twice");

  // sites: one VERIFIED live site per domain
  let domErr = null;
  try { await db.query("update public.sites set verified = true where id = $1", [siteB]); } catch (e) { domErr = e; }
  ok(domErr && domErr.code === "23505", "a second site cannot verify a domain another site already verified (first to prove wins)");
  const pend = await db.query("select count(*)::int as n from public.sites where lower(domain) = 'example.com'");
  ok(pend.rows[0].n === 2, "several PENDING sites for one domain are still allowed");
  const cols = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='sites'")).rows.map((r) => r.column_name);
  ok(["previous_api_key", "previous_key_expires_at", "allowed_hosts", "claim_started_at", "new_key_first_hit_at", "last_unmatched_host", "unmatched_count"].every((c) => cols.includes(c)), "sites has the key-rotation, claim and unmatched-host columns");
  const claim = (await db.query("select claim_started_at from public.sites where id = $1", [siteA])).rows[0].claim_started_at;
  ok(!!claim, "existing sites get a claim_started_at");

  // usage RPC adds up
  await db.query("select public.jh_usage_add($1, '2026-10-07', '{\"requests\":1,\"events\":3,\"bytes_in\":500}'::jsonb)", [siteA]);
  await db.query("select public.jh_usage_add($1, '2026-10-07', '{\"requests\":1,\"events\":2,\"clicks\":1,\"bytes_in\":250}'::jsonb)", [siteA]);
  const u = (await db.query("select requests, events, clicks, bytes_in from public.site_usage_daily where site_id = $1", [siteA])).rows[0];
  ok(u.requests === 2 && u.events === 5 && u.clicks === 1 && Number(u.bytes_in) === 750, "jh_usage_add accumulates per site per day");

  // tracking_health + click_events exist
  await db.query("insert into public.tracking_health (site_id, page_path, check_key, details) values ($1,'/','conversion_form','{\"marked\":1}')", [siteA]);
  await db.query("insert into public.tracking_health (site_id, page_path, check_key, last_event_at) values ($1,'/','conversion_form', now()) on conflict (site_id, page_path, check_key) do update set last_event_at = excluded.last_event_at", [siteA]);
  const th = (await db.query("select details, last_event_at from public.tracking_health where site_id = $1", [siteA])).rows;
  ok(th.length === 1 && th[0].details.marked === 1 && th[0].last_event_at, "tracking_health upsert keeps details and stamps last_event_at");
  await db.query("insert into public.click_events (site_id, name) values ($1,'hero-cta')", [siteA]);

  // page_views new columns
  await db.query("insert into public.page_views (page_view_id, session_id, visitor_id, site_id, viewport_width, device_class) values ('pv1','s1','v2',$1,390,'mobile')", [siteA]);

  // ── dashboard read access (RLS): members see their site's rows, others see nothing ──
  await db.query("insert into public.site_members (site_id, user_id, user_email, role, status) values ($1,'user_member','m@x.io','member','active'),($1,'user_gone','g@x.io','member','removed')", [siteA]);
  await db.exec("grant usage on schema public to authenticated; grant select on public.site_members to authenticated; grant usage on schema auth to authenticated; grant execute on function auth.jwt() to authenticated");
  const readAs = async (sub, table) => {
    await db.exec("set role authenticated; select set_config('test.jwt', '{\"sub\":\"" + sub + "\"}', false)");
    try { return (await db.query("select count(*)::int as n from public." + table)).rows[0].n; }
    finally { await db.exec("reset role"); }
  };
  ok((await readAs("user_member", "page_structure_versions")) === 1, "RLS: an active member can read their site's structure versions");
  ok((await readAs("stranger", "page_structure_versions")) === 0, "RLS: someone who is not a member reads nothing");
  ok((await readAs("user_gone", "tracking_health")) === 0, "RLS: a removed member reads nothing");
  ok((await readAs("user_member", "click_events")) === 1 && (await readAs("user_member", "tracking_health")) === 1, "RLS: members can read click_events and tracking_health");

  // ── the idle sweep ────────────────────────────────────────────────────
  const old = "now() - interval '2 hours'";
  const recent = "now() - interval '5 minutes'";
  await db.exec(`
    insert into public.sessions (session_id, visitor_id, site_id, started_at, last_activity_at) values
      ('stale1','v2','${siteA}', ${old}, ${old}),
      ('live1','v2','${siteA}', ${recent}, ${recent});
    insert into public.page_views (page_view_id, session_id, visitor_id, site_id, entered_at) values
      ('pvStale','stale1','v2','${siteA}', ${old} + interval '1 minute'),
      ('pvLive','live1','v2','${siteA}', ${recent});
  `);
  const sw = (await db.query("select * from public.jh_close_stale()")).rows[0];
  ok(sw.closed_sessions === 1, "sweep closes only the session idle for 30+ minutes (closed " + sw.closed_sessions + ")");
  const st = (await db.query("select ended_at, last_activity_at from public.sessions where session_id = 'stale1'")).rows[0];
  const lv = (await db.query("select ended_at from public.sessions where session_id = 'live1'")).rows[0];
  ok(st.ended_at && !lv.ended_at, "stale session has ended_at, the live one does not");
  const pvs = (await db.query("select left_at, time_on_page from public.page_views where page_view_id = 'pvStale'")).rows[0];
  const pvl = (await db.query("select left_at from public.page_views where page_view_id = 'pvLive'")).rows[0];
  ok(pvs.left_at && !pvl.left_at, "the stale session's open page view is closed, the live one stays open");
  ok(new Date(st.ended_at).getTime() < Date.now() - 100 * 60_000, "the session ends at its last real activity, not at sweep time");
  const sw2 = (await db.query("select * from public.jh_close_stale()")).rows[0];
  ok(sw2.closed_sessions === 0, "a second sweep has nothing left to close");

  // storage report functions
  await db.exec("analyze public.page_views; analyze public.visitors");
  const sr = (await db.query("select * from public.jh_storage_report()")).rows;
  ok(sr.some((r) => r.table_name === "page_views" && Number(r.total_bytes) > 0), "jh_storage_report lists tables with sizes");
  const cr = (await db.query("select * from public.jh_column_report(array['visitors','page_views'])")).rows;
  ok(cr.some((r) => r.table_name === "page_views" && r.column_name === "viewport_width") && cr.some((r) => r.table_name === "visitors" && r.column_name === "ip_hash"), "jh_column_report covers the new columns");

  console.log(`\n${passes} passed, ${fails} failed`);
  if (fails) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
