-- 26-hook-message-options (2026-10-24): what each hook's Slack message shows besides its subject and message ("Customize
-- the Slack message" in the hook editor): the "Came from" line, the ad's thumbnail, the "Watch the ad" and "Open the
-- lead" buttons, the hook / site / time line. An empty object = everything shown (lib/notifications/send.ts
-- DEFAULT_MESSAGE_OPTIONS). Run once in the Supabase SQL editor BEFORE deploying the code that uses it. Safe to run twice.
alter table public.notification_rules add column if not exists message_options jsonb not null default '{}'::jsonb;
