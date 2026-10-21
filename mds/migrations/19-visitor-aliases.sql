-- 19-visitor-aliases (2026-10-17): one person, one visitor. Run once in the Supabase SQL editor BEFORE deploying the
-- code that calls jh_resolve_visitor. Safe to run twice. The routes survive without it (they use the id as sent, as
-- before), so the order is not dangerous, only the merging does not happen until it has run.
--
-- The problem: the tracker mints a visitor id per browser storage. A person who opens the site in several private
-- windows, clears site data, or uses a browser that blocks storage becomes several "visitors" (six France visitors with
-- one session each were one person: Vercel Analytics, which counts by IP + browser, said 1). Every chart, rate and
-- lead count then over-counts.
--
-- The fix, at ingestion so every number downstream agrees (Vercel's method, with guardrails): when a NEW visitor id
-- arrives from the same IP hash and the same browser (user-agent hash) as a visitor who FIRST appeared EARLIER TODAY
-- (UTC) and who has NEVER sent a form, the new id is an alias of that visitor: events keep their own ids on the wire,
-- the server stores them under the original visitor. Guardrails: same day only; never merge into someone who is
-- already a lead; both hashes must exist (needs IP_HASH_SALT); a visitor who already exists is never re-pointed.
-- Known trade-off (the same as Vercel's): two people on one network with the same browser version, both new on the
-- same day, count as one visitor until one of them sends a form.
--
-- Sessions follow: a merged visitor's refresh would otherwise still be a new SESSION each time (a browser that blocks
-- storage also loses the session on every page load). jh_resolve_session joins a merged visitor's new session to that
-- visitor's still-active one (idle under 30 minutes, not ended), so a refresh is a page view of one visit.
--
-- visitor_aliases   alias id -> the visitor (kind visitor) or the session (kind session) it counts as
-- visitors.ua_hash  salted hash of the browser string (never the string)

alter table public.visitors add column if not exists ua_hash text null;

create table if not exists public.visitor_aliases (
  site_id uuid not null references public.sites (id) on delete cascade,
  alias_id text not null,
  visitor_id text not null,          -- the canonical id: a visitor id, or a session id when kind = 'session'
  created_at timestamptz not null default now(),
  primary key (site_id, alias_id)
);
alter table public.visitor_aliases add column if not exists kind text not null default 'visitor';
alter table public.visitor_aliases enable row level security;
revoke all on table public.visitor_aliases from anon, authenticated;
grant select on table public.visitor_aliases to authenticated;
drop policy if exists visitor_aliases_select_members on public.visitor_aliases;
create policy visitor_aliases_select_members on public.visitor_aliases for select to authenticated
  using (exists (select 1 from public.site_members m where m.site_id = visitor_aliases.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active'));

create index if not exists visitors_site_device_idx on public.visitors (site_id, ip_hash, ua_hash, first_seen) where ip_hash is not null and ua_hash is not null;

-- Resolves a visitor id sent by the tracker to the visitor it counts as, creating the visitor when it is new and not a
-- twin. p_row carries the columns of a new visitors row (as the track route builds it). One call per visitor per request.
create or replace function public.jh_resolve_visitor(p_site uuid, p_visitor text, p_row jsonb, p_now timestamptz default now())
returns text language plpgsql security definer set search_path = public as $$
declare
  canon text;
  twin text;
  iph text := nullif(p_row ->> 'ip_hash', '');
  uah text := nullif(p_row ->> 'ua_hash', '');
begin
  select a.visitor_id into canon from visitor_aliases a where a.site_id = p_site and a.alias_id = p_visitor;
  if found then return canon; end if;
  if exists (select 1 from visitors v where v.site_id = p_site and v.visitor_id = p_visitor) then return p_visitor; end if;

  -- a new visitor. One arrival of a device at a time, so two ids that arrive together find each other.
  if iph is not null and uah is not null then
    perform pg_advisory_xact_lock(hashtext(p_site::text || '|' || iph || '|' || uah));
    if exists (select 1 from visitor_aliases a where a.site_id = p_site and a.alias_id = p_visitor) then
      select a.visitor_id into canon from visitor_aliases a where a.site_id = p_site and a.alias_id = p_visitor;
      return canon;
    end if;
    select v.visitor_id into twin from visitors v
      where v.site_id = p_site and v.ip_hash = iph and v.ua_hash = uah
        and v.first_seen >= (date_trunc('day', p_now at time zone 'UTC') at time zone 'UTC')
        and not exists (select 1 from form_submissions f where f.site_id = p_site and f.visitor_id = v.visitor_id)
      order by v.first_seen asc limit 1;
    if twin is not null then
      insert into visitor_aliases (site_id, alias_id, visitor_id) values (p_site, p_visitor, twin) on conflict do nothing;
      return twin;
    end if;
  end if;

  insert into visitors (site_id, visitor_id, ip_address, ip_hash, ua_hash, first_seen, last_seen, device_type, first_referrer, first_utm_source, first_utm_medium, first_utm_campaign, first_landing_path, first_touch_at)
  values (p_site, p_visitor, p_row ->> 'ip_address', iph, uah, coalesce((p_row ->> 'first_seen')::timestamptz, p_now), coalesce((p_row ->> 'last_seen')::timestamptz, p_now),
          p_row ->> 'device_type', p_row ->> 'first_referrer', p_row ->> 'first_utm_source', p_row ->> 'first_utm_medium', p_row ->> 'first_utm_campaign', p_row ->> 'first_landing_path', (p_row ->> 'first_touch_at')::timestamptz)
  on conflict (site_id, visitor_id) do nothing;
  return p_visitor;
end $$;
revoke all on function public.jh_resolve_visitor(uuid, text, jsonb, timestamptz) from public, anon, authenticated;

-- A merged visitor's session id -> the session it counts as. p_visitor is the CANONICAL visitor. Returns the id to use.
create or replace function public.jh_resolve_session(p_site uuid, p_session text, p_visitor text, p_now timestamptz default now())
returns text language plpgsql security definer set search_path = public as $$
declare
  canon text;
  act text;
begin
  select a.visitor_id into canon from visitor_aliases a where a.site_id = p_site and a.alias_id = p_session and a.kind = 'session';
  if found then return canon; end if;
  -- a session that already exists keeps its own id (it was created before any merge)
  if exists (select 1 from sessions s where s.site_id = p_site and s.session_id = p_session) then return p_session; end if;
  perform pg_advisory_xact_lock(hashtext(p_site::text || '|session|' || p_visitor));
  select a.visitor_id into canon from visitor_aliases a where a.site_id = p_site and a.alias_id = p_session and a.kind = 'session';
  if found then return canon; end if;
  select s.session_id into act from sessions s
    where s.site_id = p_site and s.visitor_id = p_visitor and s.ended_at is null
      and coalesce(s.last_activity_at, s.started_at) > p_now - interval '30 minutes'
    order by s.started_at desc limit 1;
  if act is null then return p_session; end if;
  insert into visitor_aliases (site_id, alias_id, visitor_id, kind) values (p_site, p_session, act, 'session') on conflict do nothing;
  return act;
end $$;
revoke all on function public.jh_resolve_session(uuid, text, text, timestamptz) from public, anon, authenticated;
