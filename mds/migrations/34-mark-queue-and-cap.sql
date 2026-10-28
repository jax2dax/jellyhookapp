-- 34-mark-queue-and-cap.sql
-- Crowd test 2026-10-28 (mds/crowd-test/v2/run-2026-10-28-heavy-marks.md): with 5 heavy marks checked on every lead during a
-- burst, the database stopped answering; without marks the same burst passed. Founder's decision: (1) the marks no live
-- hook uses are checked from a background queue that gives way to the hook lane, (2) a cap on mark work per minute.
-- Design: mds/build/marks/queue-and-cap.md. Only ADDS things. Safe to run twice. Test project first, then production.

-- (1) The background queue: one row per lead whose other marks are still to be checked.
create table if not exists public.mark_jobs (
  lead_id uuid primary key references public.form_submissions(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  created_at timestamptz not null default now(),
  run_after timestamptz not null default now(),
  attempts int not null default 0,
  last_error text
);
create index if not exists mark_jobs_site_idx on public.mark_jobs (site_id, run_after);
alter table public.mark_jobs enable row level security; -- server only (service role); no policy for signed-in users

-- (2) Mark work per minute: lead checks (leads x marks), per site and for the whole database (the all-zero id).
create table if not exists public.mark_work (
  site_id uuid not null,
  minute timestamptz not null,
  checks int not null default 0,
  primary key (site_id, minute)
);
create index if not exists mark_work_minute_idx on public.mark_work (minute);
alter table public.mark_work enable row level security;

-- Takes up to p_want lead checks from this minute's budget and returns how many were granted (0 when the budget is used).
-- p_force: the hook lane. Always granted (a hook is never held back by the cap), but counted, so the background work of
-- that minute gets less. One row per site per minute plus one for all sites; rows older than a day are removed.
create or replace function public.jh_take_mark_work(p_site uuid, p_want int, p_site_cap int, p_all_cap int, p_force boolean default false)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  m timestamptz := date_trunc('minute', now());
  all_id constant uuid := '00000000-0000-0000-0000-000000000000';
  site_used int;
  all_used int;
  granted int;
begin
  if p_want <= 0 then return 0; end if;
  insert into mark_work (site_id, minute) values (p_site, m) on conflict do nothing;
  insert into mark_work (site_id, minute) values (all_id, m) on conflict do nothing;
  -- always the site row first, then the all-sites row: no two callers wait on each other in a circle
  select checks into site_used from mark_work where site_id = p_site and minute = m for update;
  select checks into all_used from mark_work where site_id = all_id and minute = m for update;
  granted := case when p_force then p_want else greatest(0, least(p_want, p_site_cap - site_used, p_all_cap - all_used)) end;
  if granted > 0 then
    update mark_work set checks = checks + granted where (site_id = p_site or site_id = all_id) and minute = m;
  end if;
  if extract(second from now()) < 1 then delete from mark_work where minute < now() - interval '1 day'; end if;
  return granted;
end $$;

revoke all on function public.jh_take_mark_work(uuid, int, int, int, boolean) from public, anon, authenticated;
grant execute on function public.jh_take_mark_work(uuid, int, int, int, boolean) to service_role;

notify pgrst, 'reload schema';
