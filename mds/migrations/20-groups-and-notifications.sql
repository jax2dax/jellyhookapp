-- 20-groups-and-notifications (2026-10-22): lead groups, notification rules, in-app notifications, Slack channels and
-- the per-site check lane. Run once in the Supabase SQL editor BEFORE deploying the code that uses them. Safe to run
-- twice. Needs 16-marks.sql (marks, lead_marks). Design: mds/build/notifications/.
--
-- lead_groups               a box of leads ("Deal done"). Visible to the team (default) or only its creator. 30 per site.
-- lead_group_members        which lead is in which group, added by a person or by a notification rule.
-- notification_rules        "notify when a new lead has all of [marks]". An asset of the SITE (not of its creator): it keeps
--                           running when its creator leaves. 10 per person per site.
-- notification_events       one rule firing for one lead (never twice: unique per rule + lead).
-- notifications             one in-app notification for one member. Readable only by that member, and only while they
--                           are an active member of the site (leaving the site = no access, even to their own).
-- notification_channels     Slack (and later other) destinations of a site. The URL is a secret: the server only.
-- notification_deliveries   one event sent to one channel, with retries.
-- check_jobs, site_check_leases   the per-site lane: new leads wait here when their site is already being checked.

-- ── groups ──────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.lead_groups (
  id uuid not null default gen_random_uuid() primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  visibility text not null default 'team' check (visibility in ('team', 'private')),
  created_by text not null,
  created_by_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lead_groups_site_idx on public.lead_groups (site_id);

create table if not exists public.lead_group_members (
  group_id uuid not null references public.lead_groups (id) on delete cascade,
  lead_id uuid not null references public.form_submissions (id) on delete cascade,
  site_id uuid not null,
  added_by text null,         -- a member's user id, or null when a notification rule added it
  added_by_rule uuid null,    -- the rule that added it
  added_at timestamptz not null default now(),
  primary key (group_id, lead_id)
);
create index if not exists lead_group_members_site_idx on public.lead_group_members (site_id, lead_id);

create or replace function public.jh_groups_limit() returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.lead_groups where site_id = new.site_id) >= 30 then
    raise exception 'group_limit: at most 30 groups per site';
  end if;
  return new;
end $$;
drop trigger if exists lead_groups_limit on public.lead_groups;
create trigger lead_groups_limit before insert on public.lead_groups for each row execute function public.jh_groups_limit();

-- ── notification rules, events, in-app notifications ────────────────────────────────────────────────────────────────
create table if not exists public.notification_rules (
  id uuid not null default gen_random_uuid() primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 300),
  mark_ids uuid[] not null check (cardinality(mark_ids) between 1 and 10),
  recipients text[] not null default '{}',     -- member user ids; empty = all members
  channel_ids uuid[] not null default '{}',    -- external channels (Slack ...)
  add_to_group_id uuid null references public.lead_groups (id) on delete set null,
  active boolean not null default true,
  created_by text not null,
  created_by_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notification_rules_site_idx on public.notification_rules (site_id) where active;

create or replace function public.jh_rules_limit() returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.notification_rules where site_id = new.site_id and created_by = new.created_by) >= 10 then
    raise exception 'rule_limit: at most 10 notification rules per person per site';
  end if;
  return new;
end $$;
drop trigger if exists notification_rules_limit on public.notification_rules;
create trigger notification_rules_limit before insert on public.notification_rules for each row execute function public.jh_rules_limit();

create table if not exists public.notification_events (
  id uuid not null default gen_random_uuid() primary key,
  site_id uuid not null,
  rule_id uuid not null references public.notification_rules (id) on delete cascade,
  lead_id uuid not null references public.form_submissions (id) on delete cascade,
  visitor_id text null,
  created_at timestamptz not null default now(),
  unique (rule_id, lead_id)
);
create index if not exists notification_events_cooldown_idx on public.notification_events (rule_id, visitor_id, created_at desc);

create table if not exists public.notifications (
  id uuid not null default gen_random_uuid() primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  event_id uuid null references public.notification_events (id) on delete cascade,
  rule_id uuid null references public.notification_rules (id) on delete set null,
  user_id text not null,
  title text not null,
  body text not null,
  lead_id uuid null references public.form_submissions (id) on delete cascade,
  mark_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  read_at timestamptz null
);
create index if not exists notifications_user_idx on public.notifications (site_id, user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (site_id, user_id) where read_at is null;

-- ── external channels and deliveries ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.notification_channels (
  id uuid not null default gen_random_uuid() primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  kind text not null check (kind in ('slack', 'webhook')),
  name text not null check (char_length(name) between 1 and 60),
  secret text not null,                       -- the Slack / webhook URL. Never readable by a signed-in user.
  hint text null,                             -- a masked form shown in the app ("hooks.slack.com/…/XXXX")
  signing_secret text null,                   -- webhooks: the HMAC key their server uses to check our signature
  status text not null default 'ok' check (status in ('ok', 'failing')),
  consecutive_failures integer not null default 0,
  last_error text null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid not null default gen_random_uuid() primary key,
  site_id uuid not null,
  event_id uuid not null references public.notification_events (id) on delete cascade,
  channel_id uuid not null references public.notification_channels (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  response_code integer null,
  last_error text null,
  sent_at timestamptz null,
  payload jsonb not null default '{}'::jsonb,  -- what is sent (no personal data), fixed when the rule fired
  created_at timestamptz not null default now()
);
create index if not exists notification_deliveries_site_day_idx on public.notification_deliveries (site_id, created_at);
create index if not exists notification_deliveries_pending_idx on public.notification_deliveries (next_attempt_at) where status = 'pending';

-- ── the per-site lane ───────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.check_jobs (
  lead_id uuid not null primary key references public.form_submissions (id) on delete cascade,
  site_id uuid not null,
  attempts integer not null default 0,
  run_after timestamptz not null default now(),
  last_error text null,
  created_at timestamptz not null default now()
);
create index if not exists check_jobs_site_idx on public.check_jobs (site_id, run_after);

create table if not exists public.site_check_leases (
  site_id uuid not null primary key,
  holder text not null,
  until timestamptz not null
);

-- Take the site's lease for p_seconds when it is free (or expired). True = you have it. A crashed holder's lease ends by
-- itself, so a site can never be stuck.
create or replace function public.jh_take_site_lease(p_site uuid, p_holder text, p_seconds integer default 60)
returns boolean language plpgsql security definer set search_path = public as $$
declare got text;
begin
  insert into site_check_leases (site_id, holder, until) values (p_site, p_holder, now() + make_interval(secs => p_seconds))
  on conflict (site_id) do update set holder = excluded.holder, until = excluded.until
    where site_check_leases.until < now() or site_check_leases.holder = excluded.holder
  returning holder into got;
  return coalesce(got = p_holder, false);
end $$;

create or replace function public.jh_release_site_lease(p_site uuid, p_holder text)
returns void language sql security definer set search_path = public as $$
  delete from site_check_leases where site_id = p_site and holder = p_holder;
$$;
revoke all on function public.jh_take_site_lease(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.jh_release_site_lease(uuid, text) from public, anon, authenticated;

-- ── who may see what ────────────────────────────────────────────────────────────────────────────────────────────────
-- Writes go through the server (service role), which checks the person's role first. Signed-in users only READ, and
-- only while they are an active member of the site.
alter table public.lead_groups enable row level security;
alter table public.lead_group_members enable row level security;
alter table public.notification_rules enable row level security;
alter table public.notification_events enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_channels enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.check_jobs enable row level security;
alter table public.site_check_leases enable row level security;
revoke all on table public.lead_groups, public.lead_group_members, public.notification_rules, public.notification_events,
  public.notifications, public.notification_channels, public.notification_deliveries, public.check_jobs,
  public.site_check_leases from anon, authenticated;
grant select on table public.lead_groups, public.lead_group_members, public.notification_rules, public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

drop policy if exists lead_groups_select on public.lead_groups;
create policy lead_groups_select on public.lead_groups for select to authenticated using (
  exists (select 1 from public.site_members m where m.site_id = lead_groups.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active')
  and (visibility = 'team' or created_by = (auth.jwt() ->> 'sub'))
);
drop policy if exists lead_group_members_select on public.lead_group_members;
create policy lead_group_members_select on public.lead_group_members for select to authenticated using (
  exists (select 1 from public.lead_groups g where g.id = lead_group_members.group_id
    and exists (select 1 from public.site_members m where m.site_id = g.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active')
    and (g.visibility = 'team' or g.created_by = (auth.jwt() ->> 'sub')))
);
drop policy if exists notification_rules_select on public.notification_rules;
create policy notification_rules_select on public.notification_rules for select to authenticated using (
  exists (select 1 from public.site_members m where m.site_id = notification_rules.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active')
);
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (
  user_id = (auth.jwt() ->> 'sub')
  and exists (select 1 from public.site_members m where m.site_id = notifications.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active')
);
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for update to authenticated
  using (user_id = (auth.jwt() ->> 'sub')) with check (user_id = (auth.jwt() ->> 'sub'));

-- the bell updates live: new rows reach the signed-in member through Realtime (still filtered by the policy above)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when undefined_object then null; -- no realtime publication (local Postgres): the bell polls instead
end $$;

-- ── optional: drain the lane every 5 seconds with Supabase Cron ─────────────────────────────────────────────────────
-- Needs the pg_cron and pg_net extensions (Database → Extensions), the app's address and the CRON_SECRET you set in
-- Vercel. Without it, waiting leads are still checked by the next submission on their site; with it, within seconds.
--   select cron.schedule('jh-drain', '5 seconds', $c$
--     select net.http_post(url := 'https://YOUR-APP/api/jobs/drain',
--                          headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb)
--   $c$);
