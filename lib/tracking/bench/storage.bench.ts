/* eslint-disable */
// @ts-nocheck
// Measures what the 2026-10-07 migration's new columns cost in storage and in write time,
// on a real Postgres (PGlite): the same data in the tables before vs after the migration.
// Run: npm run bench:storage   (about 1 to 2 minutes)
// Sizes are real Postgres sizes. Timings are PGlite (WebAssembly), good for the RATIO
// between before and after, not for absolute speed on Supabase.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

import path from "node:path";
const root = path.resolve(__dirname, "../../..");
const doc = fs.readFileSync(root + "/mds/database.md", "utf8").replace(/\r\n/g, "\n");
const migration = fs.readFileSync(root + "/mds/migrations/2026-10-07-ingestion-hardening.sql", "utf8");
function ddl(name) {
  const start = doc.indexOf(`create table public.${name} (`);
  const end = doc.indexOf("\n);", start);
  return doc.slice(start, end + 3);
}
const N_VIS = 20000;
const N_PV = 100000;

async function setup(applyMigration) {
  const db = new PGlite();
  await db.exec("create schema if not exists public; create role anon; create role authenticated; create role service_role; create schema if not exists auth; create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;");
  for (const t of ["sites", "site_members", "visitors", "sessions", "page_views", "page_structure", "form_engagement"]) await db.exec(ddl(t));
  await db.exec("alter table public.site_members add column if not exists status text not null default 'active'; alter table public.sites add column if not exists verified boolean not null default false; alter table public.sites add column if not exists specify_form boolean not null default false;");
  // the indexes the real database has today (database.md)
  await db.exec("create index if not exists page_views_session_id_idx on public.page_views (session_id); create index if not exists page_views_site_id_idx on public.page_views (site_id); create index if not exists page_views_site_entered_idx on public.page_views (site_id, entered_at);");
  const site = (await db.query("insert into public.sites (name, domain, api_key) values ('x','example.com','k') returning id")).rows[0].id;
  if (applyMigration) await db.exec(migration);
  return { db, site };
}

async function fill(db, site, after) {
  const t0 = performance.now();
  // visitors: before keeps the raw IP; after stores only the hash plus first touch
  if (!after) {
    await db.exec(`insert into public.visitors (visitor_id, site_id, first_seen, last_seen, device_type, ip_address)
      select gen_random_uuid()::text, '${site}', now() - (g || ' minutes')::interval, now(), case when g % 3 = 0 then 'mobile' else 'desktop' end, '203.0.113.' || (g % 250)
      from generate_series(1, ${N_VIS}) g`);
  } else {
    await db.exec(`insert into public.visitors (visitor_id, site_id, first_seen, last_seen, device_type, ip_hash, first_referrer, first_utm_source, first_utm_medium, first_utm_campaign, first_landing_path, first_touch_at)
      select gen_random_uuid()::text, '${site}', now() - (g || ' minutes')::interval, now(), case when g % 3 = 0 then 'mobile' else 'desktop' end,
        md5(g::text) || md5((g+1)::text),
        case when g % 10 < 7 then (array['https://www.google.com/','https://www.linkedin.com/','https://twitter.com/','https://news.ycombinator.com/','https://www.facebook.com/'])[1 + g % 5] end,
        case when g % 4 = 0 then 'google' end, case when g % 4 = 0 then 'cpc' end, case when g % 5 = 0 then 'spring_sale_2026' end,
        (array['/','/pricing','/features','/blog/how-it-works','/contact'])[1 + g % 5], now() - (g || ' minutes')::interval
      from generate_series(1, ${N_VIS}) g`);
  }
  const tv = performance.now() - t0;

  const t1 = performance.now();
  const extraCols = after ? ", viewport_width, device_class, structure_id" : "";
  const extraVals = after ? ", case when g % 3 = 0 then 390 else 1440 end, case when g % 3 = 0 then 'mobile' else 'desktop' end, " + (after ? "(select id from public.page_structure_versions limit 1)" : "null") : "";
  await db.exec(`insert into public.page_views (page_view_id, session_id, visitor_id, site_id, page_url, page_path, page_title, entered_at, time_on_page, scroll_depth, left_at, max_scroll_depth, max_scroll_reached_at, page_height, entry_scroll_depth, revisit_start_scroll_depth, viewport_height${extraCols})
    select gen_random_uuid()::text, gen_random_uuid()::text, gen_random_uuid()::text, '${site}',
      'https://www.example.com/products/item-' || (g % 40), '/products/item-' || (g % 40), 'Item ' || (g % 40) || ' | Example Store',
      now() - (g || ' seconds')::interval, (g % 90000), 0.5, now(), 0.8, now(), 3200 + g % 800, 0, case when g % 2 = 0 then 0.3 end, 900${extraVals}
    from generate_series(1, ${N_PV}) g`);
  const tp = performance.now() - t1;
  await db.exec("analyze public.visitors; analyze public.page_views;");
  return { tv, tp };
}

async function sizes(db, t) {
  const r = (await db.query(`select pg_total_relation_size('public.${t}') as total, pg_relation_size('public.${t}') as heap, pg_indexes_size('public.${t}') as idx, (select count(*) from public.${t}) as n`)).rows[0];
  return { total: Number(r.total), heap: Number(r.heap), idx: Number(r.idx), n: Number(r.n) };
}

async function main() {
  const before = await setup(false);
  // a structure version row for the FK of the "after" run is created by the migration run below
  const tb = await fill(before.db, before.site, false);
  const vb = await sizes(before.db, "visitors");
  const pb = await sizes(before.db, "page_views");

  const after = await setup(true);
  await after.db.query("insert into public.page_structure_versions (site_id, page_path, device_class, fingerprint, headers, page_height) values ($1,'/','desktop','fp','[]',3000)", [after.site]);
  const ta = await fill(after.db, after.site, true);
  const va = await sizes(after.db, "visitors");
  const pa = await sizes(after.db, "page_views");

  // other rows the new code writes
  const extra = {};
  await after.db.exec(`insert into public.sessions (session_id, visitor_id, site_id, started_at, last_activity_at, referrer, country, timezone, utm_source, utm_medium, utm_campaign)
    select gen_random_uuid()::text, gen_random_uuid()::text, '${after.site}', now(), now(), 'https://www.google.com/', 'United States', 'America/New_York', null, null, null from generate_series(1, 20000)`);
  await after.db.exec(`insert into public.click_events (site_id, visitor_id, session_id, page_view_id, page_path, name, clicked_at)
    select '${after.site}', gen_random_uuid()::text, gen_random_uuid()::text, gen_random_uuid()::text, '/pricing', 'hero-cta', now() from generate_series(1, 20000)`);
  await after.db.exec(`insert into public.page_structure_versions (site_id, page_path, device_class, fingerprint, headers, page_height)
    select '${after.site}', '/page-' || g, 'desktop', md5(g::text), (select jsonb_agg(jsonb_build_object('i', i, 'text', 'Section heading number ' || i, 'tag', 'h2', 'y', i * 640)) from generate_series(0, 7) i), 5200 from generate_series(1, 2000) g`);
  await after.db.exec("analyze public.sessions; analyze public.click_events; analyze public.page_structure_versions;");
  for (const t of ["sessions", "click_events", "page_structure_versions"]) extra[t] = await sizes(after.db, t);

  const per = (s) => ({ total: (s.total / s.n).toFixed(1), heap: (s.heap / s.n).toFixed(1), idx: (s.idx / s.n).toFixed(1) });
  console.log("\n=== visitors (" + N_VIS + " rows) ===");
  console.log("before:", per(vb), " total", vb.total, "B");
  console.log("after: ", per(va), " total", va.total, "B");
  console.log("per-row change (total):", ((va.total - vb.total) / N_VIS).toFixed(1), "B  =", (((va.total - vb.total) / vb.total) * 100).toFixed(1) + "%");
  console.log("insert time before/after (ms):", tb.tv.toFixed(0), "/", ta.tv.toFixed(0));
  console.log("\n=== page_views (" + N_PV + " rows) ===");
  console.log("before:", per(pb), " total", pb.total, "B");
  console.log("after: ", per(pa), " total", pa.total, "B");
  console.log("per-row change (total):", ((pa.total - pb.total) / N_PV).toFixed(1), "B  =", (((pa.total - pb.total) / pb.total) * 100).toFixed(1) + "%");
  console.log("insert time before/after (ms):", tb.tp.toFixed(0), "/", ta.tp.toFixed(0), " ratio", (ta.tp / tb.tp).toFixed(2));
  console.log("\n=== other tables written by the new code (per row, table+indexes) ===");
  for (const [t, s] of Object.entries(extra)) console.log(t, per(s), "rows", s.n);

  // column sizes
  const cs = await after.db.query("select attname, avg_width, null_frac from pg_stats where schemaname='public' and tablename in ('visitors','page_views') and attname in ('ip_hash','first_referrer','first_utm_source','first_utm_medium','first_utm_campaign','first_landing_path','first_touch_at','viewport_width','device_class','structure_id','ip_address') order by 1");
  console.log("\n=== new column widths (pg_stats) ===");
  for (const r of cs.rows) console.log(r.attname, "avg", r.avg_width, "B  null", Number(r.null_frac).toFixed(2));

  // lookup speed: the unique (site_id, visitor_id) key vs none
  const vid = (await before.db.query("select visitor_id from public.visitors offset 777 limit 1")).rows[0].visitor_id;
  const tl = async (db, label, n = 300) => {
    const t = performance.now();
    for (let i = 0; i < n; i++) await db.query("select id from public.visitors where visitor_id = $1 and site_id = $2", [vid, label]);
    return (performance.now() - t) / n;
  };
  const vid2 = (await after.db.query("select visitor_id from public.visitors offset 777 limit 1")).rows[0].visitor_id;
  const q = async (db, id, site, n = 300) => {
    const t = performance.now();
    for (let i = 0; i < n; i++) await db.query("select id from public.visitors where visitor_id = $1 and site_id = $2", [id, site]);
    return ((performance.now() - t) / n).toFixed(3);
  };
  console.log("\n=== visitor lookup by (visitor_id, site_id), ms per query ===");
  console.log("before (seq scan, 20k rows):", await q(before.db, vid, before.site), " after (unique index):", await q(after.db, vid2, after.site));
}
main().catch((e) => { console.error(e); process.exit(1); });
