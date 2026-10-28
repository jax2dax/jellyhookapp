-- 35-privacy-retention-and-erasure.sql (2026-10-28)
-- 1. Retention: each site keeps visit and lead data for 6, 13 (default) or 25 months, or for as long as it is active
--    (null). Older rows are deleted in small batches by the drainer (lib/privacy/retention.ts), at most once a day per site.
-- 2. Erasure: an owner or admin erases one person by the email they sent in a form: every lead with that email, the
--    visitors who sent them, and those visitors' sessions, page views, form activity, clicks and aliases. Children of a
--    lead (marks, groups, hooks, notifications, queued jobs) go with it (on delete cascade). The log keeps only a hash of
--    the email (lib/privacy/erase.ts).
-- Run in BOTH the test project and production. Safe to run twice. Docs: /docs/concepts/privacy-consent.

alter table public.sites add column if not exists retention_months integer null default 13;
alter table public.sites drop constraint if exists sites_retention_months_check;
alter table public.sites add constraint sites_retention_months_check check (retention_months is null or retention_months in (6, 13, 25));
alter table public.sites add column if not exists purged_at timestamptz null;

-- the retention sweep reads each table by site and age
create index if not exists page_views_site_created_idx on public.page_views (site_id, created_at);
create index if not exists form_engagement_site_created_idx on public.form_engagement (site_id, created_at);

create table if not exists public.erasure_requests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  requested_by text not null,      -- the Clerk user id of the owner or admin who ran it
  email_hash text not null,        -- sha256 of the lowercased email; the email itself is never kept
  leads integer not null default 0,
  visitors integer not null default 0,
  rows_deleted integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists erasure_requests_site_idx on public.erasure_requests (site_id, created_at desc);
alter table public.erasure_requests enable row level security;
revoke all on table public.erasure_requests from anon, authenticated;

-- Retention: deletes up to p_batch rows per table older than p_before. Returns how many rows went, so the caller can
-- come back while a site still has a backlog.
create or replace function public.jh_purge_site(p_site uuid, p_before timestamptz, p_batch integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  c integer;
begin
  delete from public.page_views where id in (select id from public.page_views where site_id = p_site and created_at < p_before limit p_batch);
  get diagnostics c = row_count; n := n + c;
  delete from public.form_engagement where id in (select id from public.form_engagement where site_id = p_site and created_at < p_before limit p_batch);
  get diagnostics c = row_count; n := n + c;
  delete from public.click_events where id in (select id from public.click_events where site_id = p_site and clicked_at < p_before limit p_batch);
  get diagnostics c = row_count; n := n + c;
  delete from public.form_submissions where id in (select id from public.form_submissions where site_id = p_site and coalesce(submitted_at, created_at) < p_before limit p_batch);
  get diagnostics c = row_count; n := n + c;
  delete from public.sessions where id in (select id from public.sessions where site_id = p_site and coalesce(last_activity_at, started_at, created_at) < p_before limit p_batch);
  get diagnostics c = row_count; n := n + c;
  delete from public.visitors where id in (select id from public.visitors where site_id = p_site and coalesce(last_seen, first_seen, created_at) < p_before limit p_batch);
  get diagnostics c = row_count; n := n + c;
  delete from public.visitor_aliases where (site_id, alias_id) in (select site_id, alias_id from public.visitor_aliases where site_id = p_site and created_at < p_before limit p_batch);
  get diagnostics c = row_count; n := n + c;
  return n;
end;
$$;

-- Erasure: everything about the person who sent p_email on this site. Returns counts.
create or replace function public.jh_erase_person(p_site uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ids text[];
  lead_count integer := 0;
  total integer := 0;
  c integer;
begin
  if p_email is null or length(trim(p_email)) < 3 then
    return jsonb_build_object('leads', 0, 'visitors', 0, 'rows', 0);
  end if;
  -- the visitors who sent a form with this email, and every id merged into them (aliases), both ways
  select coalesce(array_agg(distinct v), '{}') into ids from (
    select visitor_id as v from public.form_submissions where site_id = p_site and lower(trim(email)) = lower(trim(p_email)) and visitor_id is not null
  ) s;
  select coalesce(array_agg(distinct x), '{}') into ids from (
    select unnest(ids) as x
    union select alias_id from public.visitor_aliases where site_id = p_site and visitor_id = any(ids)
    union select visitor_id from public.visitor_aliases where site_id = p_site and alias_id = any(ids)
  ) a;

  delete from public.form_submissions where site_id = p_site and (lower(trim(email)) = lower(trim(p_email)) or visitor_id = any(ids));
  get diagnostics lead_count = row_count; total := total + lead_count;
  delete from public.page_views where site_id = p_site and visitor_id = any(ids);
  get diagnostics c = row_count; total := total + c;
  delete from public.form_engagement where site_id = p_site and visitor_id = any(ids);
  get diagnostics c = row_count; total := total + c;
  delete from public.click_events where site_id = p_site and visitor_id = any(ids);
  get diagnostics c = row_count; total := total + c;
  delete from public.sessions where site_id = p_site and visitor_id = any(ids);
  get diagnostics c = row_count; total := total + c;
  delete from public.visitor_aliases where site_id = p_site and (visitor_id = any(ids) or alias_id = any(ids));
  get diagnostics c = row_count; total := total + c;
  delete from public.visitors where site_id = p_site and visitor_id = any(ids);
  get diagnostics c = row_count; total := total + c;

  return jsonb_build_object('leads', lead_count, 'visitors', coalesce(array_length(ids, 1), 0), 'rows', total);
end;
$$;

revoke all on function public.jh_purge_site(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.jh_erase_person(uuid, text) from public, anon, authenticated;
grant execute on function public.jh_purge_site(uuid, timestamptz, integer) to service_role;
grant execute on function public.jh_erase_person(uuid, text) to service_role;
