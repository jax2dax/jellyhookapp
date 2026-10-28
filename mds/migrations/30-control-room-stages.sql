-- 30-control-room-stages.sql
-- The control room's "form to Slack" split into the stages a message goes through, so a slow message can be traced to a
-- stage instead of one number. Run in Supabase (production, and the test project) after 29-control-room.sql. Read-only
-- report, service role only; changes no table.
--
--   form_to_saved   the form was submitted (form_submissions.submitted_at) to the lead row being saved (created_at):
--                   the tracker request, including the browser's network time
--   saved_to_hook   the lead saved to the hook firing (notification_events.created_at): waiting in the queue, the mark
--                   check and the hook rules
--   hook_to_sent    the hook firing to Slack accepting the message (notification_deliveries.sent_at): building the
--                   message (visit summary included) and the send
--   total           the whole way, the same number as the control room's "form to Slack"
-- A message with several events counts once per delivery. Only sent messages in the period.

create or replace function public.jh_admin_stages(p_since timestamptz)
returns table (sent bigint,
               saved_p50_ms double precision, saved_p95_ms double precision, saved_max_ms double precision,
               hook_p50_ms double precision, hook_p95_ms double precision, hook_max_ms double precision,
               send_p50_ms double precision, send_p95_ms double precision, send_max_ms double precision,
               total_p50_ms double precision, total_p95_ms double precision, total_max_ms double precision)
language sql stable security definer set search_path = public as $$
  with x as (
    select extract(epoch from (f.created_at - f.submitted_at)) * 1000 saved,
           extract(epoch from (e.created_at - f.created_at)) * 1000 hook,
           extract(epoch from (d.sent_at - e.created_at)) * 1000 send,
           extract(epoch from (d.sent_at - f.submitted_at)) * 1000 total
    from notification_deliveries d join notification_events e on e.id = d.event_id join form_submissions f on f.id = e.lead_id
    where d.status = 'sent' and d.sent_at >= p_since
  )
  select count(*),
         percentile_cont(0.5) within group (order by saved), percentile_cont(0.95) within group (order by saved), max(saved),
         percentile_cont(0.5) within group (order by hook), percentile_cont(0.95) within group (order by hook), max(hook),
         percentile_cont(0.5) within group (order by send), percentile_cont(0.95) within group (order by send), max(send),
         percentile_cont(0.5) within group (order by total), percentile_cont(0.95) within group (order by total), max(total)
  from x;
$$;

revoke all on function public.jh_admin_stages(timestamptz) from public, anon, authenticated;
grant execute on function public.jh_admin_stages(timestamptz) to service_role;
