-- 19-heading-time (2026-10-19): time per heading on each page view. Run once in the Supabase SQL editor. Safe to run
-- twice. The track route works before it has run (it then stores the page view without heading time), so the order of
-- deploy and migration does not matter.
--
-- One small jsonb value on the existing page_views row, NOT a row per heading: about 40-150 bytes per page view,
-- no new index, grows exactly with page views. Shape and rules: lib/tracking/headingTime.js, mds/build/heading-time/plan.md.
--   { "t": 1, "h": [["k3j9a", 1, 0, 120, 2], ["^", 0, -1, 30, 1]] }
--   t = the page's top heading level; h = [heading key, level, order on the page, tenths of a second, times it became active]

alter table public.page_views add column if not exists heading_time jsonb null;
