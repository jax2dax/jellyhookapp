-- 23-announcements (2026-10-24): updates from Jellyhook (the founder) to every user, shown in Notifications with a red
-- dot in the sidebar. In-app only: never sent to Slack or webhooks. Run once in the Supabase SQL editor BEFORE deploying
-- the code that uses it. Safe to run twice.
--
-- announcements        one update (title, body). Written only by the server, for the user ids in the
--                      JELLYHOOK_ADMIN_USER_IDS environment variable (lib/actions/announcements.action.ts).
-- announcement_reads   which signed-in user has seen which update (the red dot disappears once all are seen).

create table if not exists public.announcements (
  id uuid not null default gen_random_uuid() primary key,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists announcements_created_idx on public.announcements (created_at desc);

create table if not exists public.announcement_reads (
  user_id text not null,
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
revoke all on table public.announcements, public.announcement_reads from anon, authenticated;
grant select on table public.announcements to authenticated;
grant select on table public.announcement_reads to authenticated;

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select to authenticated using (true);
drop policy if exists announcement_reads_select on public.announcement_reads;
create policy announcement_reads_select on public.announcement_reads for select to authenticated using (user_id = (auth.jwt() ->> 'sub'));
-- writes: the server (service role) only
