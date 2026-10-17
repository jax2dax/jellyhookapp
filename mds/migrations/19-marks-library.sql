-- 19-marks-library (2026-10-16): the marks library (copies and connected marks, page variables) and per-site
-- statistics. Run once in the Supabase SQL editor AFTER 18-marks.sql and BEFORE deploying. Safe to run twice.
-- Design: mds/build/marks/marks.md ("Library", "Site statistics").
--
-- marks.source        'own' (built by the person), 'copy' (copied from a published mark: theirs, editable, no
--                     updates), 'connected' (uses a published mark: its updates apply; only its page variables are
--                     the person's own)
-- marks.source_key    the published mark it came from (jh-marks/catalog.ts key)
-- marks.source_version the published version the stored results were made with (a new version re-checks the leads)
-- marks.var_values    the page variables chosen for it, e.g. {"pricing": "/plans"}
-- marks.locked        the publisher locked it: the formula is hidden, only the page variables can be changed
-- site_stats          one row per site: "normal" durations (jh-stats/typical.ts), refreshed at most once a day

alter table public.marks add column if not exists source text not null default 'own' check (source in ('own', 'copy', 'connected'));
alter table public.marks add column if not exists source_key text null;
alter table public.marks add column if not exists source_version text null;
alter table public.marks add column if not exists var_values jsonb not null default '{}';
alter table public.marks add column if not exists locked boolean not null default false;
-- a connected mark has no formula of its own: the published one is used
alter table public.marks alter column spec drop not null;

-- the person may set their own page variables; the source and lock are set by the app only
grant update (var_values) on table public.marks to authenticated;

-- limits: 5 marks built by the person (source own), 15 in their library in all (the app says so first)
create or replace function public.jh_marks_limit() returns trigger language plpgsql set search_path = public as $$
begin
  if new.source = 'own' and (select count(*) from public.marks where site_id = new.site_id and created_by = new.created_by and source = 'own') >= 5 then
    raise exception 'mark_limit: at most 5 marks of your own per site';
  end if;
  if (select count(*) from public.marks where site_id = new.site_id and created_by = new.created_by) >= 15 then
    raise exception 'mark_limit: at most 15 marks per person per site';
  end if;
  return new;
end $$;

create table if not exists public.site_stats (
  site_id uuid not null primary key references public.sites (id) on delete cascade,
  stats jsonb not null,
  computed_at timestamptz not null default now()
);
alter table public.site_stats enable row level security;
revoke all on table public.site_stats from anon, authenticated;
grant select on table public.site_stats to authenticated;
drop policy if exists site_stats_select_members on public.site_stats;
create policy site_stats_select_members on public.site_stats for select to authenticated
  using (exists (select 1 from public.site_members m where m.site_id = site_stats.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active'));
