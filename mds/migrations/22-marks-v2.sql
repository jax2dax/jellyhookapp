-- 22-marks-v2 (2026-10-24): marks built with the new builder (visit blocks, answers, form activity; jh-marks/v2) are
-- checked by their own checker (lib/marks/journey.ts), not by a Hook query, so they have no `spec`.
-- Run once in the Supabase SQL editor BEFORE deploying the code that uses it. Safe to run twice. Needs 16-marks.sql.
-- Design: mds/build/marks/marks-v2-plan.md.
alter table public.marks alter column spec drop not null;

-- every mark still has a way to decide who has it: a Hook query (spec), a published mark it is connected to
-- (source = 'connected': its query is built at each check from the library, so it was already stored without one), or a
-- v2 rule ({"v": 2, ...}). Fixed 2026-10-24: the first version forgot connected marks and failed on them.
alter table public.marks drop constraint if exists marks_spec_or_v2;
alter table public.marks add constraint marks_spec_or_v2 check (
  spec is not null
  or source = 'connected'
  or (rule is not null and rule->>'v' = '2')
);
