/* eslint-disable @typescript-eslint/no-explicit-any -- bench fixtures are plain rows */
// scripts/bench/seed.ts
// Shared by planner.bench.ts and planner-verify.ts: the synthetic skewed dataset and the HookDb wrapper.
import { PGlite } from "@electric-sql/pglite";
import type { HookDb } from "../../jh-hook/engine/run";

export const SITE = "11111111-1111-1111-1111-111111111111";
export const N_VISITORS = 100_000;
export const N_SESSIONS = 300_000;
export const N_PAGEVIEWS = 1_000_000;

export async function seed(pg: PGlite) {
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

export function makeDb(pg: PGlite, flat: boolean): HookDb {
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

