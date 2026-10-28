-- 32-other-marks-runs.sql
-- v2 of the lead lane (lib/notifications/check.ts) checks the marks live hooks use first, sends the hooks' messages, and
-- checks the site's other marks after the lane is released. That last step is recorded in pipeline_runs as its own kind,
-- 'other_marks', so the control room's batch times (kind 'leads') stay comparable with v1 and the work is still counted.
-- Run in Supabase: the test project first, then production at the next deploy. Safe to run twice. Before it has run,
-- recording that step fails quietly (lib/metrics/runs.ts never throws) and only its log line remains.

alter table public.pipeline_runs drop constraint if exists pipeline_runs_kind_check;
alter table public.pipeline_runs add constraint pipeline_runs_kind_check check (kind in ('leads', 'mark_apply', 'other_marks'));
