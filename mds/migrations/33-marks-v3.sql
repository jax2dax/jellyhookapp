-- 33-marks-v3.sql
-- When marks run (mds/build/marks/when-marks-run.md, v3 of the crowd-test roadmap):
--   - a mark checks NEW leads while it is on; "off" means not checked (before: every mark, on or off, was checked);
--   - past leads are a choice made at save or when it is turned on (last 30 days, last 90 days, all, or none), checked in
--     the BACKGROUND, newest first, in small chunks (lib/marks/backfill.ts). Nothing waits in the save any more;
--   - editing the rule makes a new version: the old results are cleared, never shown under the new rule.
-- The columns below are written by the server only (service role); signed-in users can read them (the existing select
-- grant) but not change them (the update grant of 16-marks.sql lists its columns one by one).
-- Run in Supabase: the test project first, then production at the deploy that ships v3. Safe to run twice. Before it has
-- run, the app falls back to the old behaviour (every lead checked inside the save).

alter table public.marks add column if not exists rule_version integer not null default 1;
-- leads sent at or after this are checked (the past-leads choice); null = all leads (marks made before v3)
alter table public.marks add column if not exists checked_from timestamptz null;
-- the mark was turned off at this time: leads sent after it were not checked
alter table public.marks add column if not exists off_since timestamptz null;

-- the background check of past leads (one at a time per mark)
--   backfill_state     running | done | failed | stopped (turned off before it finished); null = never ran
--   backfill_run       goes up by one each time a new check of past leads is started; a runner that sees it move stops
--   backfill_from      the oldest sending time it covers (null = all); backfill_until: the newest (the moment it started;
--                      newer leads are checked by the lead lane)
--   backfill_cursor_at, backfill_cursor_id: the oldest lead checked so far (it goes newest first)
--   backfill_total, backfill_done: leads to check, leads checked
--   backfill_lease     a runner holds the mark until then (a crashed runner frees it by itself)
--   backfill_failures  failed chunks in a row; after 5 the state is 'failed'
alter table public.marks add column if not exists backfill_state text null;
alter table public.marks add column if not exists backfill_run integer not null default 0;
alter table public.marks add column if not exists backfill_from timestamptz null;
alter table public.marks add column if not exists backfill_until timestamptz null;
alter table public.marks add column if not exists backfill_cursor_at timestamptz null;
alter table public.marks add column if not exists backfill_cursor_id uuid null;
alter table public.marks add column if not exists backfill_total integer null;
alter table public.marks add column if not exists backfill_done integer not null default 0;
alter table public.marks add column if not exists backfill_lease timestamptz null;
alter table public.marks add column if not exists backfill_failures integer not null default 0;
alter table public.marks add column if not exists backfill_error text null;

alter table public.marks drop constraint if exists marks_backfill_state_check;
alter table public.marks add constraint marks_backfill_state_check check (backfill_state is null or backfill_state in ('running', 'done', 'failed', 'stopped'));

-- the drainer looks for marks with a check of past leads to continue
create index if not exists marks_backfill_running_idx on public.marks (backfill_lease) where backfill_state = 'running';
-- past leads newest first, per site (the backfill's chunks, the counts shown at save, the preview's last 100 leads)
create index if not exists form_submissions_site_submitted_idx on public.form_submissions (site_id, submitted_at desc, id desc);
