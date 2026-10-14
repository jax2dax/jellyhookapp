-- 15 (2026-10-14): "abandoned" now means STARTED and not submitted. A form that was only seen (status 'viewed', no
-- field ever focused) is no longer abandoned: it stays 'viewed'. Founder decision 2026-10-14 (form activities plan,
-- mds/build/form-study/plan.md). Run once in the Supabase SQL editor. Safe to run twice.
--
-- 1. The idle sweep (jh_close_stale, from 07-ingestion-hardening.sql) only abandons forms that were started.
-- 2. Existing rows that were abandoned without ever being started go back to 'viewed'.
-- The matching code changes: public/tracker.js (session end), app/api/track/route.js (session_end),
-- lib/closeStaleFormEngagement.js (fallback sweep).

create or replace function public.jh_close_stale(p_idle interval default interval '30 minutes')
returns table (closed_sessions integer, closed_page_views integer, abandoned_forms integer)
language sql security definer set search_path = public as $$
  with stale as (
    select s.id, s.session_id,
           coalesce((select max(coalesce(pv.left_at, pv.entered_at)) from public.page_views pv where pv.session_id = s.session_id), s.last_activity_at) as ended
    from public.sessions s
    where s.ended_at is null and s.last_activity_at < now() - p_idle
    order by s.last_activity_at
    limit 5000
  ), upd as (
    update public.sessions s set ended_at = stale.ended, last_activity_at = stale.ended
    from stale where s.id = stale.id
    returning s.session_id as session_id, stale.ended as ended
  ), pv as (
    update public.page_views p
    set left_at = upd.ended,
        time_on_page = greatest(0, (extract(epoch from (upd.ended - p.entered_at)) * 1000)::integer)
    from upd where p.session_id = upd.session_id and p.left_at is null
    returning p.id
  ), fm as (
    update public.form_engagement f
    set status = 'abandoned', ended_at = coalesce(f.last_activity_at, f.viewed_at)
    where f.status = 'started'
      and coalesce(f.last_activity_at, f.viewed_at) < now() - p_idle
    returning f.id
  )
  select (select count(*)::integer from upd), (select count(*)::integer from pv), (select count(*)::integer from fm);
$$;
revoke all on function public.jh_close_stale(interval) from public, anon, authenticated;
grant execute on function public.jh_close_stale(interval) to service_role;

-- Repair: abandoned rows that were never started (no first input) were only seen.
update public.form_engagement
set status = 'viewed', ended_at = null
where status = 'abandoned' and first_input_at is null;
