-- mds/migrations/2026-10-07-ingestion-hardening.sql
-- One-time migration for the 2026-10-07 tracker / ingestion audit
-- (mds/audit/tracker-backend-audit-2026-10-07.md). Run the WHOLE file once in
-- the Supabase SQL editor (New query, paste, Run). Safe to run twice: every
-- statement is idempotent.
--
-- Run it BEFORE deploying the matching code. The new code tolerates a
-- missing table or column by logging and skipping the feature, but it only
-- does its job once this has run.
--
-- Sections:
--   0. checks to run first (read-only)
--   1. visitors: no more duplicate rows, hashed IP, first-touch attribution
--   2. page_views: viewport width, device class, link to the page structure it saw
--   3. page_structure_versions: page headers WITH history (replaces overwrite-in-place)
--   4. sites: key rotation grace, allowed hosts, last event, claim start, domain uniqueness
--   5. tracking_health, click_events, site_usage_daily (+ jh_usage_add)
--   6. jh_close_stale(): the idle sweep as one set-based function
--   7. optional: schedule the sweep every 5 minutes with pg_cron
--   8. optional: erase the raw IPs already stored (hash them first)

-- ──────────────────────────────────────────────────────────────────────────
-- 0. CHECKS (read-only). Run these first. Each should return zero rows; if
--    one returns rows, resolve them before the matching section below.
-- ──────────────────────────────────────────────────────────────────────────
-- 0a. verified sites sharing a domain would block the unique index in section 4:
--   select lower(domain) as domain, count(*) from public.sites
--   where verified = true and deleted_at is null group by 1 having count(*) > 1;
-- 0b. duplicate visitor rows (section 1 merges them):
--   select site_id, visitor_id, count(*) from public.visitors
--   where visitor_id is not null group by 1,2 having count(*) > 1;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. visitors
-- ──────────────────────────────────────────────────────────────────────────
-- Why: /api/track looked a visitor up with .single() and inserted when none
-- was found. Two events arriving together for a NEW visitor both inserted;
-- .single() then errors on two rows, so EVERY later event inserted another
-- row. The fix is a unique key + upsert.
alter table public.visitors add column if not exists ip_hash text null;
alter table public.visitors add column if not exists first_referrer text null;
alter table public.visitors add column if not exists first_utm_source text null;
alter table public.visitors add column if not exists first_utm_medium text null;
alter table public.visitors add column if not exists first_utm_campaign text null;
alter table public.visitors add column if not exists first_landing_path text null;
alter table public.visitors add column if not exists first_touch_at timestamp with time zone null;

-- merge duplicates: keep the oldest row, with the earliest first_seen and latest last_seen
update public.visitors v
set first_seen = g.min_first, last_seen = g.max_last
from (
  select site_id, visitor_id, min(first_seen) as min_first, max(last_seen) as max_last
  from public.visitors where visitor_id is not null
  group by site_id, visitor_id having count(*) > 1
) g
where v.site_id = g.site_id and v.visitor_id = g.visitor_id;

delete from public.visitors v
using (
  select id, row_number() over (partition by site_id, visitor_id order by created_at, id) as rn
  from public.visitors where visitor_id is not null
) d
where v.id = d.id and d.rn > 1;

create unique index if not exists visitors_site_visitor_key on public.visitors using btree (site_id, visitor_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 3 (before 2: page_views links to it). page_structure_versions
-- ──────────────────────────────────────────────────────────────────────────
-- One row per DISTINCT structure a page has had, per device class
-- (mobile / desktop lay a page out differently). A change in headers or
-- layout makes a NEW row; the old one stays, with first_seen_at / last_seen_at,
-- so a session recorded last month still draws with last month's headers.
create table if not exists public.page_structure_versions (
  id uuid not null default gen_random_uuid() primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  page_path text not null,
  device_class text not null default 'desktop', -- 'desktop' | 'mobile'
  fingerprint text not null,                    -- see lib/tracking/structure.js
  headers jsonb not null,                       -- [{ "i": 0, "text": "...", "tag": "h2", "y": 640 }]
  page_height integer not null default 0,
  text_stats jsonb null,                        -- reserved (paragraph counts), unused for now
  first_seen_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  seen_count integer not null default 1,
  constraint page_structure_versions_unique unique (site_id, page_path, device_class, fingerprint)
);
create index if not exists page_structure_versions_lookup_idx
  on public.page_structure_versions using btree (site_id, page_path, device_class, first_seen_at desc);
alter table public.page_structure_versions enable row level security;

-- backfill ONE legacy version per page from the old overwrite-in-place table,
-- dated from its oldest row. The next real capture is a different
-- fingerprint, so it becomes version 2 and the legacy one is kept as history.
insert into public.page_structure_versions (site_id, page_path, device_class, fingerprint, headers, page_height, first_seen_at, last_seen_at)
select ps.site_id, ps.page_path, 'desktop', 'legacy',
       jsonb_agg(jsonb_build_object('i', ps.header_index, 'text', ps.header_text, 'tag', ps.header_tag, 'y', ps.position_y) order by ps.header_index),
       max(ps.page_height),
       min(coalesce(ps.created_at, now())),
       max(coalesce(ps.created_at, now()))
from public.page_structure ps
join public.sites st on st.id = ps.site_id -- skip rows of sites that no longer exist (they would break the foreign key)
group by ps.site_id, ps.page_path
on conflict (site_id, page_path, device_class, fingerprint) do nothing;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. page_views
-- ──────────────────────────────────────────────────────────────────────────
alter table public.page_views add column if not exists viewport_width integer null;
alter table public.page_views add column if not exists device_class text null;      -- 'desktop' | 'mobile', from viewport_width
alter table public.page_views add column if not exists structure_id uuid null references public.page_structure_versions (id) on delete set null;
-- No extra index here on purpose: a (session_id, entered_at) index was measured at ~88 bytes per page view row
-- (about 74% of this table's growth from this migration) and the existing page_views_session_id_idx already serves every lookup by session.

-- ──────────────────────────────────────────────────────────────────────────
-- 4. sites
-- ──────────────────────────────────────────────────────────────────────────
alter table public.sites add column if not exists previous_api_key text null;
alter table public.sites add column if not exists previous_key_expires_at timestamp with time zone null;
alter table public.sites add column if not exists key_rotated_at timestamp with time zone null;
alter table public.sites add column if not exists new_key_first_hit_at timestamp with time zone null;
alter table public.sites add column if not exists allowed_hosts text[] not null default '{}';
alter table public.sites add column if not exists last_event_at timestamp with time zone null;
alter table public.sites add column if not exists last_unmatched_host text null;
alter table public.sites add column if not exists last_unmatched_at timestamp with time zone null;
alter table public.sites add column if not exists unmatched_count integer not null default 0;
alter table public.sites add column if not exists claim_started_at timestamp with time zone not null default now();
create index if not exists sites_api_key_idx on public.sites using btree (api_key);
create index if not exists sites_previous_api_key_idx on public.sites using btree (previous_api_key) where previous_api_key is not null;
create index if not exists sites_domain_lower_idx on public.sites using btree (lower(domain));
-- A domain belongs to the first site that PROVES it (a verified one). Several
-- people may be pending for the same domain; the first to verify wins.
-- Run check 0a first: this fails if two verified live sites share a domain.
create unique index if not exists sites_verified_domain_key
  on public.sites using btree (lower(domain)) where verified = true and deleted_at is null;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. tracking_health, click_events, site_usage_daily
-- ──────────────────────────────────────────────────────────────────────────
-- What the tracker SAW on each page (is data-conversion on a <form>? are the
-- fields marked?) and whether a real event ever followed. Powers the
-- "Tracking health" card in Settings.
create table if not exists public.tracking_health (
  id uuid not null default gen_random_uuid() primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  page_path text not null,
  check_key text not null,           -- 'conversion_form' | 'field_attr' | 'click_attr'
  details jsonb not null default '{}'::jsonb,
  first_seen_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  last_event_at timestamp with time zone null, -- the last REAL event this check produced (proof it works)
  constraint tracking_health_unique unique (site_id, page_path, check_key)
);
alter table public.tracking_health enable row level security;

-- clicks on elements the owner marked with data-track-click="name"
create table if not exists public.click_events (
  id uuid not null default gen_random_uuid() primary key,
  created_at timestamp with time zone not null default now(),
  site_id uuid not null references public.sites (id) on delete cascade,
  visitor_id text null,
  session_id text null,
  page_view_id text null,
  page_path text null,
  name text not null,
  clicked_at timestamp with time zone not null default now()
);
create index if not exists click_events_site_clicked_idx on public.click_events using btree (site_id, clicked_at);
create index if not exists click_events_site_name_idx on public.click_events using btree (site_id, name);
alter table public.click_events enable row level security;

-- events a site sent per day, by kind: what a site "burns" (dev usage page)
create table if not exists public.site_usage_daily (
  site_id uuid not null references public.sites (id) on delete cascade,
  day date not null,
  requests integer not null default 0,
  events integer not null default 0,
  session_starts integer not null default 0,
  session_ends integer not null default 0,
  page_view_starts integer not null default 0,
  page_view_ends integer not null default 0,
  forms integer not null default 0,
  engagement integer not null default 0,
  structure integer not null default 0,
  clicks integer not null default 0,
  dropped integer not null default 0,    -- bots, wrong host, expired claim, invalid
  bytes_in bigint not null default 0,
  primary key (site_id, day)
);
alter table public.site_usage_daily enable row level security;

create or replace function public.jh_usage_add(p_site uuid, p_day date, p jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.site_usage_daily as u
    (site_id, day, requests, events, session_starts, session_ends, page_view_starts, page_view_ends, forms, engagement, structure, clicks, dropped, bytes_in)
  values (p_site, p_day,
    coalesce((p->>'requests')::int, 0), coalesce((p->>'events')::int, 0),
    coalesce((p->>'session_starts')::int, 0), coalesce((p->>'session_ends')::int, 0),
    coalesce((p->>'page_view_starts')::int, 0), coalesce((p->>'page_view_ends')::int, 0),
    coalesce((p->>'forms')::int, 0), coalesce((p->>'engagement')::int, 0),
    coalesce((p->>'structure')::int, 0), coalesce((p->>'clicks')::int, 0),
    coalesce((p->>'dropped')::int, 0), coalesce((p->>'bytes_in')::bigint, 0))
  on conflict (site_id, day) do update set
    requests = u.requests + excluded.requests,
    events = u.events + excluded.events,
    session_starts = u.session_starts + excluded.session_starts,
    session_ends = u.session_ends + excluded.session_ends,
    page_view_starts = u.page_view_starts + excluded.page_view_starts,
    page_view_ends = u.page_view_ends + excluded.page_view_ends,
    forms = u.forms + excluded.forms,
    engagement = u.engagement + excluded.engagement,
    structure = u.structure + excluded.structure,
    clicks = u.clicks + excluded.clicks,
    dropped = u.dropped + excluded.dropped,
    bytes_in = u.bytes_in + excluded.bytes_in;
$$;
revoke all on function public.jh_usage_add(uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.jh_usage_add(uuid, date, jsonb) to service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. jh_close_stale(): the idle sweep, set-based
-- ──────────────────────────────────────────────────────────────────────────
-- A session ends only by IDLE (no activity for 30 minutes), never on page
-- navigation or tab close. Same rule as lib/closeStaleSessions.js, in one
-- statement, so it can run on a schedule (section 7) instead of only riding
-- on tracker traffic. Closing a session also closes its still-open page
-- views and abandons its still-open forms, all dated to the session's real
-- last activity (never "now").
create or replace function public.jh_close_stale(p_idle interval default interval '30 minutes')
returns table (closed_sessions integer, closed_page_views integer, abandoned_forms integer)
language sql security definer set search_path = public as $$
  with stale as (
    select s.id, s.session_id,
           coalesce((select max(coalesce(pv.left_at, pv.entered_at)) from public.page_views pv where pv.session_id = s.session_id), s.last_activity_at) as ended
    from public.sessions s
    where s.ended_at is null and s.last_activity_at < now() - p_idle
    order by s.last_activity_at
    limit 5000
  ), upd as (
    update public.sessions s set ended_at = stale.ended, last_activity_at = stale.ended
    from stale where s.id = stale.id
    returning s.session_id as session_id, stale.ended as ended
  ), pv as (
    update public.page_views p
    set left_at = upd.ended,
        time_on_page = greatest(0, (extract(epoch from (upd.ended - p.entered_at)) * 1000)::integer)
    from upd where p.session_id = upd.session_id and p.left_at is null
    returning p.id
  ), fm as (
    update public.form_engagement f
    set status = 'abandoned', ended_at = coalesce(f.last_activity_at, f.viewed_at)
    where f.status in ('viewed', 'started')
      and coalesce(f.last_activity_at, f.viewed_at) < now() - p_idle
    returning f.id
  )
  select (select count(*)::integer from upd), (select count(*)::integer from pv), (select count(*)::integer from fm);
$$;
revoke all on function public.jh_close_stale(interval) from public, anon, authenticated;
grant execute on function public.jh_close_stale(interval) to service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 7. OPTIONAL: run the sweep every 5 minutes with pg_cron.
--    First enable it: Supabase dashboard, Database, Extensions, pg_cron.
--    Then uncomment and run:
-- ──────────────────────────────────────────────────────────────────────────
-- select cron.schedule('jh-close-stale', '*/5 * * * *', $$select public.jh_close_stale()$$);
-- To remove: select cron.unschedule('jh-close-stale');

-- ──────────────────────────────────────────────────────────────────────────
-- 8. OPTIONAL: stop storing raw IP addresses (visitors.ip_address).
--    Hash what is there, then erase it. Replace YOUR_IP_HASH_SALT with the
--    SAME value you put in the IP_HASH_SALT environment variable (long, random).
--    Needs pgcrypto: create extension if not exists pgcrypto with schema extensions;
-- ──────────────────────────────────────────────────────────────────────────
-- update public.visitors
-- set ip_hash = encode(extensions.hmac(ip_address, 'YOUR_IP_HASH_SALT', 'sha256'), 'hex'), ip_address = null
-- where ip_address is not null and ip_hash is null;

-- ──────────────────────────────────────────────────────────────────────────
-- 9. Read access for the dashboard (same pattern as every other data table)
-- ──────────────────────────────────────────────────────────────────────────
-- The tracker writes with the service role (bypasses RLS). The dashboard reads
-- as the signed-in user, so each new table needs the same "active member of
-- the site" select policy the existing tables have (mds/database.md, RLS).
-- site_usage_daily gets none on purpose: only the dev usage page reads it,
-- with the service role.
grant select on table public.page_structure_versions to authenticated;
grant select on table public.click_events to authenticated;
grant select on table public.tracking_health to authenticated;

drop policy if exists page_structure_versions_select_members on public.page_structure_versions;
create policy page_structure_versions_select_members on public.page_structure_versions for select to authenticated
  using (exists (select 1 from public.site_members m where m.site_id = page_structure_versions.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active'));

drop policy if exists click_events_select_members on public.click_events;
create policy click_events_select_members on public.click_events for select to authenticated
  using (exists (select 1 from public.site_members m where m.site_id = click_events.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active'));

drop policy if exists tracking_health_select_members on public.tracking_health;
create policy tracking_health_select_members on public.tracking_health for select to authenticated
  using (exists (select 1 from public.site_members m where m.site_id = tracking_health.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active'));

-- ──────────────────────────────────────────────────────────────────────────
-- 10. Storage measurements for the developer usage page (/dev/usage)
-- ──────────────────────────────────────────────────────────────────────────
-- Read-only. They report what the database really spends per table and per
-- column so event limits can be set from measurements, not guesses. Service
-- role only (the page runs server-side).
create or replace function public.jh_storage_report()
returns table (table_name text, approx_rows bigint, total_bytes bigint, table_bytes bigint, index_bytes bigint)
language sql security definer set search_path = public as $$
  select c.relname::text, greatest(c.reltuples, 0)::bigint, pg_total_relation_size(c.oid), pg_relation_size(c.oid), pg_indexes_size(c.oid)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc;
$$;
revoke all on function public.jh_storage_report() from public, anon, authenticated;
grant execute on function public.jh_storage_report() to service_role;

-- average stored width and share of NULLs per column, from the planner's own
-- statistics (refreshed by autovacuum/ANALYZE, so it is an estimate)
create or replace function public.jh_column_report(p_tables text[])
returns table (table_name text, column_name text, avg_bytes integer, null_fraction real)
language sql security definer set search_path = public as $$
  select tablename::text, attname::text, avg_width, null_frac
  from pg_stats where schemaname = 'public' and tablename = any (p_tables)
  order by tablename, attname;
$$;
revoke all on function public.jh_column_report(text[]) from public, anon, authenticated;
grant execute on function public.jh_column_report(text[]) to service_role;
