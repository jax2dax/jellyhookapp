-- 2026-10-12: repair values the server stored as 0 when the tracker sent "not measured" (null).
-- Run once in the Supabase SQL editor, AFTER the fixed lib/tracking/server.js is deployed (otherwise new rows keep
-- arriving broken). Safe to run twice.
--
-- The bug: cleanNum() used Number(v), and Number(null) is 0. Since 2026-10-06 (commit 49c7f8c) this turned:
--   1. page_views.revisit_start_scroll_depth: null ("never scrolled back up") into 0 ("scrolled back to the very top"),
--      so every page view without a backtrack was drawn with a dark green "seen twice" band from the top of the page.
--   2. form_engagement.form_top_y / form_bottom_y: every "started" / field event sends null for the position, which
--      overwrote the position measured when the form was first seen with 0 / 0.
--   3. page_views.page_height: a page_view_end with no new height (null) overwrote the measured height with 0.
--
-- What this cannot tell apart: a visitor who really scrolled back to the very top (a true 0) on a page view after
-- 2026-10-06. Those few lose their "seen twice" band. Every other 0 since then is the bug, so clearing them is far
-- closer to the truth than leaving them.

-- 1. "never scrolled back up"
update public.page_views
set revisit_start_scroll_depth = null
where revisit_start_scroll_depth = 0
  and entered_at >= '2026-10-06';

-- 2. form position wiped to 0 / 0 (a real form cannot start and end at pixel 0)
update public.form_engagement
set form_top_y = null, form_bottom_y = null
where form_top_y = 0 and form_bottom_y = 0;

-- 3. page height wiped to 0 (the chart then falls back to the height recorded with the page's structure)
update public.page_views
set page_height = null
where page_height = 0;
