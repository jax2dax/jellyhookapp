-- 16 (2026-10-14): form study signals. Run once in the Supabase SQL editor BEFORE deploying the code that writes them
-- (the form-engagement route inserts these columns; without them every insert fails). Safe to run twice.
-- Details: mds/build/form-study/tracker-changes.md.
--
-- form_fields               the form's fields as seen: [{"key":"email","type":"email","required":true}, ...].
--                           Keys, types and the required flag only. NEVER values. Lets the page show fields nobody
--                           touched (skipped) and "3 of 7 fields". Respects data-track-field marking.
-- onscreen_before_start_ms  time the form was at least half on screen, with the tab visible, before the first input.
--                           Set once, when the form is first started.
-- No new column for the per-field signals: visits, filled, edits and errors live inside the existing field_timings
-- jsonb (see lib/tracking/formEngagement.js).

alter table public.form_engagement add column if not exists form_fields jsonb null;
alter table public.form_engagement add column if not exists onscreen_before_start_ms integer null;
