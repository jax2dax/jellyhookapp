-- 29-control-room.sql
-- The founder's control room (app/admin, mds/build/control-room.md): what every site does and what it costs.
--   1. site_usage_daily gets the work behind the traffic: server time and database calls, time and rows of the tracker
--      requests (counted by lib/metrics/meter.ts), next to the event counts it already has.
--   2. pipeline_runs: one row per batch of new leads (marks, hooks, notifications) and per mark applied to old leads.
--   3. Read-only reports for the control room, computed in the database in one query each:
--        jh_admin_sites(since)          one row per site: traffic, leads, marks, hooks, form-to-Slack time, work
--        jh_admin_daily(site, days)     one row per day for one site (all sites when site is null)
--        jh_admin_now()                 the queue right now: waiting leads, oldest wait, pending and failed messages
-- Only the service role may call them; no table here is readable by signed-in users.

-- 1 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.site_usage_daily add column if not exists server_ms bigint not null default 0;
alter table public.site_usage_daily add column if not exists db_calls bigint not null default 0;
alter table public.site_usage_daily add column if not exists db_ms bigint not null default 0;
alter table public.site_usage_daily add column if not exists db_rows bigint not null default 0;

create or replace function public.jh_usage_add(p_site uuid, p_day date, p jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.site_usage_daily as u
    (site_id, day, requests, events, session_starts, session_ends, page_view_starts, page_view_ends, forms, engagement, structure, clicks, dropped, bytes_in,
     server_ms, db_calls, db_ms, db_rows)
  values (p_site, p_day,
    coalesce((p->>'requests')::int, 0), coalesce((p->>'events')::int, 0),
    coalesce((p->>'session_starts')::int, 0), coalesce((p->>'session_ends')::int, 0),
    coalesce((p->>'page_view_starts')::int, 0), coalesce((p->>'page_view_ends')::int, 0),
    coalesce((p->>'forms')::int, 0), coalesce((p->>'engagement')::int, 0),
    coalesce((p->>'structure')::int, 0), coalesce((p->>'clicks')::int, 0),
    coalesce((p->>'dropped')::int, 0), coalesce((p->>'bytes_in')::bigint, 0),
    coalesce((p->>'server_ms')::bigint, 0), coalesce((p->>'db_calls')::bigint, 0),
    coalesce((p->>'db_ms')::bigint, 0), coalesce((p->>'db_rows')::bigint, 0))
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
    bytes_in = u.bytes_in + excluded.bytes_in,
    server_ms = u.server_ms + excluded.server_ms,
    db_calls = u.db_calls + excluded.db_calls,
    db_ms = u.db_ms + excluded.db_ms,
    db_rows = u.db_rows + excluded.db_rows;
$$;
revoke all on function public.jh_usage_add(uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.jh_usage_add(uuid, date, jsonb) to service_role;

-- 2 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.pipeline_runs (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  kind text not null check (kind in ('leads', 'mark_apply')),
  leads integer not null default 0,
  marks integer not null default 0,
  hooks integer not null default 0,
  fires integer not null default 0,
  deliveries integer not null default 0,
  wait_ms integer null,
  marks_ms integer null,
  hooks_ms integer null,
  total_ms integer not null,
  db_calls integer not null default 0,
  db_ms integer not null default 0,
  db_rows integer not null default 0,
  error text null,
  created_at timestamptz not null default now()
);
create index if not exists pipeline_runs_site_time_idx on public.pipeline_runs (site_id, created_at desc);
create index if not exists pipeline_runs_time_idx on public.pipeline_runs (created_at desc);
alter table public.pipeline_runs enable row level security;

-- the form-to-Slack report reads sent messages by time
create index if not exists notification_deliveries_sent_idx on public.notification_deliveries (sent_at) where status = 'sent';

-- 3 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.jh_admin_sites(p_since timestamptz)
returns table (
  site_id uuid, domain text, name text, created_at timestamptz, verified boolean, is_active boolean, last_event_at timestamptz,
  members bigint,
  requests bigint, events bigint, visits bigint, page_views bigint, forms bigint, dropped bigint, bytes_in bigint,
  server_ms bigint, db_calls bigint, db_ms bigint, db_rows bigint,
  leads bigint, leads_total bigint,
  marks bigint, marks_on bigint, hooks bigint, hooks_live bigint,
  sent bigint, failed bigint, slack_p50_ms double precision, slack_p95_ms double precision, slack_max_ms double precision,
  runs bigint, run_leads bigint, run_ms bigint, run_p95_ms double precision, run_wait_p95_ms double precision,
  run_db_calls bigint, run_db_ms bigint, run_db_rows bigint, run_errors bigint,
  applies bigint, apply_ms bigint, apply_db_rows bigint
)
language sql stable security definer set search_path = public as $$
  with
  u as (
    select site_id, sum(requests) requests, sum(events) events, sum(session_starts) visits, sum(page_view_starts) page_views, sum(forms) forms,
           sum(dropped) dropped, sum(bytes_in) bytes_in, sum(server_ms) server_ms, sum(db_calls) db_calls, sum(db_ms) db_ms, sum(db_rows) db_rows
    from site_usage_daily where day >= p_since::date group by site_id
  ),
  m as (select site_id, count(*) members from site_members where status = 'active' and user_id not like 'pending:%' group by site_id),
  l as (select site_id, count(*) filter (where submitted_at >= p_since) leads, count(*) leads_total from form_submissions group by site_id),
  k as (select site_id, count(*) marks, count(*) filter (where active) marks_on from marks where kind = 'lead' group by site_id),
  h as (select site_id, count(*) hooks, count(*) filter (where active) hooks_live from notification_rules group by site_id),
  d as (
    select d.site_id,
           count(*) filter (where d.status = 'sent') sent,
           count(*) filter (where d.status = 'failed') failed,
           percentile_cont(0.5) within group (order by extract(epoch from (d.sent_at - f.submitted_at)) * 1000) filter (where d.status = 'sent') slack_p50_ms,
           percentile_cont(0.95) within group (order by extract(epoch from (d.sent_at - f.submitted_at)) * 1000) filter (where d.status = 'sent') slack_p95_ms,
           max(extract(epoch from (d.sent_at - f.submitted_at)) * 1000) filter (where d.status = 'sent') slack_max_ms
    from notification_deliveries d
    join notification_events e on e.id = d.event_id
    join form_submissions f on f.id = e.lead_id
    where d.created_at >= p_since
    group by d.site_id
  ),
  r as (
    select site_id,
           count(*) filter (where kind = 'leads') runs,
           coalesce(sum(leads) filter (where kind = 'leads'), 0) run_leads,
           coalesce(sum(total_ms) filter (where kind = 'leads'), 0) run_ms,
           percentile_cont(0.95) within group (order by total_ms) filter (where kind = 'leads') run_p95_ms,
           percentile_cont(0.95) within group (order by wait_ms) filter (where kind = 'leads' and wait_ms is not null) run_wait_p95_ms,
           coalesce(sum(db_calls) filter (where kind = 'leads'), 0) run_db_calls,
           coalesce(sum(db_ms) filter (where kind = 'leads'), 0) run_db_ms,
           coalesce(sum(db_rows) filter (where kind = 'leads'), 0) run_db_rows,
           count(*) filter (where error is not null) run_errors,
           count(*) filter (where kind = 'mark_apply') applies,
           coalesce(sum(total_ms) filter (where kind = 'mark_apply'), 0) apply_ms,
           coalesce(sum(db_rows) filter (where kind = 'mark_apply'), 0) apply_db_rows
    from pipeline_runs where created_at >= p_since group by site_id
  )
  select s.id, s.domain, s.name, s.created_at, coalesce(s.verified, false), coalesce(s.is_active, false), s.last_event_at,
         coalesce(m.members, 0),
         coalesce(u.requests, 0), coalesce(u.events, 0), coalesce(u.visits, 0), coalesce(u.page_views, 0), coalesce(u.forms, 0), coalesce(u.dropped, 0), coalesce(u.bytes_in, 0),
         coalesce(u.server_ms, 0), coalesce(u.db_calls, 0), coalesce(u.db_ms, 0), coalesce(u.db_rows, 0),
         coalesce(l.leads, 0), coalesce(l.leads_total, 0),
         coalesce(k.marks, 0), coalesce(k.marks_on, 0), coalesce(h.hooks, 0), coalesce(h.hooks_live, 0),
         coalesce(d.sent, 0), coalesce(d.failed, 0), d.slack_p50_ms, d.slack_p95_ms, d.slack_max_ms,
         coalesce(r.runs, 0), coalesce(r.run_leads, 0), coalesce(r.run_ms, 0), r.run_p95_ms, r.run_wait_p95_ms,
         coalesce(r.run_db_calls, 0), coalesce(r.run_db_ms, 0), coalesce(r.run_db_rows, 0), coalesce(r.run_errors, 0),
         coalesce(r.applies, 0), coalesce(r.apply_ms, 0), coalesce(r.apply_db_rows, 0)
  from sites s
  left join u on u.site_id = s.id
  left join m on m.site_id = s.id
  left join l on l.site_id = s.id
  left join k on k.site_id = s.id
  left join h on h.site_id = s.id
  left join d on d.site_id = s.id
  left join r on r.site_id = s.id
  where s.deleted_at is null
  order by coalesce(u.events, 0) desc, s.created_at;
$$;

create or replace function public.jh_admin_daily(p_site uuid, p_days integer)
returns table (
  day date, events bigint, visits bigint, page_views bigint, forms bigint, server_ms bigint, db_calls bigint, db_ms bigint,
  runs bigint, run_leads bigint, run_ms bigint, run_p95_ms double precision, sent bigint, slack_p95_ms double precision
)
language sql stable security definer set search_path = public as $$
  with days as (select generate_series(current_date - (greatest(p_days, 1) - 1), current_date, interval '1 day')::date as day),
  u as (
    select day, sum(events) events, sum(session_starts) visits, sum(page_view_starts) page_views, sum(forms) forms,
           sum(server_ms) server_ms, sum(db_calls) db_calls, sum(db_ms) db_ms
    from site_usage_daily where (p_site is null or site_id = p_site) and day >= current_date - (greatest(p_days, 1) - 1) group by day
  ),
  r as (
    select created_at::date as day, count(*) runs, sum(leads) run_leads, sum(total_ms) run_ms, percentile_cont(0.95) within group (order by total_ms) run_p95_ms
    from pipeline_runs where kind = 'leads' and (p_site is null or site_id = p_site) and created_at >= current_date - (greatest(p_days, 1) - 1) group by 1
  ),
  d as (
    select d.sent_at::date as day, count(*) sent,
           percentile_cont(0.95) within group (order by extract(epoch from (d.sent_at - f.submitted_at)) * 1000) slack_p95_ms
    from notification_deliveries d
    join notification_events e on e.id = d.event_id
    join form_submissions f on f.id = e.lead_id
    where d.status = 'sent' and (p_site is null or d.site_id = p_site) and d.sent_at >= current_date - (greatest(p_days, 1) - 1)
    group by 1
  )
  select days.day, coalesce(u.events, 0), coalesce(u.visits, 0), coalesce(u.page_views, 0), coalesce(u.forms, 0),
         coalesce(u.server_ms, 0), coalesce(u.db_calls, 0), coalesce(u.db_ms, 0),
         coalesce(r.runs, 0), coalesce(r.run_leads, 0), coalesce(r.run_ms, 0), r.run_p95_ms, coalesce(d.sent, 0), d.slack_p95_ms
  from days left join u using (day) left join r using (day) left join d using (day)
  order by days.day;
$$;

create or replace function public.jh_admin_now()
returns table (
  people bigint, queue_leads bigint, queue_oldest_ms double precision, queue_parked bigint,
  pending_messages bigint, failed_messages_24h bigint, runs_last_hour bigint, run_errors_24h bigint
)
language sql stable security definer set search_path = public as $$
  select
    (select count(distinct user_id) from site_members where status = 'active' and user_id not like 'pending:%'),
    (select count(*) from check_jobs where run_after <= now() + interval '1 hour'),
    (select extract(epoch from (now() - min(created_at))) * 1000 from check_jobs where run_after <= now() + interval '1 hour'),
    (select count(*) from check_jobs where run_after > now() + interval '1 hour'),
    (select count(*) from notification_deliveries where status = 'pending'),
    (select count(*) from notification_deliveries where status = 'failed' and created_at >= now() - interval '24 hours'),
    (select count(*) from pipeline_runs where created_at >= now() - interval '1 hour'),
    (select count(*) from pipeline_runs where error is not null and created_at >= now() - interval '24 hours');
$$;

revoke all on function public.jh_admin_sites(timestamptz) from public, anon, authenticated;
revoke all on function public.jh_admin_daily(uuid, integer) from public, anon, authenticated;
revoke all on function public.jh_admin_now() from public, anon, authenticated;
grant execute on function public.jh_admin_sites(timestamptz) to service_role;
grant execute on function public.jh_admin_daily(uuid, integer) to service_role;
grant execute on function public.jh_admin_now() to service_role;

-- Keep 90 days of runs (one row per batch: small, but it grows). Run by hand, or schedule with pg_cron:
--   select cron.schedule('jh-prune-runs', '17 3 * * *', $$delete from public.pipeline_runs where created_at < now() - interval '90 days'$$);
