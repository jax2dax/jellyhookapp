-- 18-marks (2026-10-16): marks on leads ("Pricing reader", "Came back"...). Run once in the Supabase SQL editor BEFORE
-- deploying the code that uses them. Safe to run twice. Independent of the other migrations after 07.
-- Design: mds/build/marks/marks.md. The rule language: jh-marks/rule.ts.
--
-- marks        one row per mark. Personal by default: visible to its creator only, unless they share it with the team
--              or with chosen members. Only the creator can change or delete it. At most 5 per person per site.
-- lead_marks   which lead has which mark, and why (short phrases). Written ONLY by the server (service role): when a
--              lead sends a form, when its visit ends, and when a mark is saved or turned on. Read by anyone who can
--              see the mark.

create table if not exists public.marks (
  id uuid not null default gen_random_uuid() primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  kind text not null default 'lead' check (kind in ('lead', 'session', 'form')),   -- only 'lead' is built
  name text not null check (char_length(name) between 1 and 40),
  description text null check (description is null or char_length(description) <= 500),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  active boolean not null default true,
  visibility text not null default 'private' check (visibility in ('private', 'team', 'members')),
  shared_with text[] not null default '{}',   -- Clerk user ids, when visibility = 'members'
  rule jsonb null,                            -- the chip builder's rule; null = made in Hook (spec only)
  spec jsonb not null,                        -- the Hook query (entity lead) that decides who has the mark
  reads text null,                            -- the rule in plain English, as shown when it was saved
  template_key text null,                     -- which template it started from, if any
  created_by text not null,                   -- Clerk user id
  created_by_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  evaluated_at timestamptz null,
  match_count integer null
);
create index if not exists marks_site_creator_idx on public.marks (site_id, created_by);

create table if not exists public.lead_marks (
  mark_id uuid not null references public.marks (id) on delete cascade,
  lead_id uuid not null references public.form_submissions (id) on delete cascade,
  site_id uuid not null,
  reason jsonb null,                          -- {"parts": ["/pricing: 2 views, longest 40 s", "came 2 times"]}
  matched_at timestamptz not null default now(),
  primary key (mark_id, lead_id)
);
create index if not exists lead_marks_site_lead_idx on public.lead_marks (site_id, lead_id);

-- at most 5 marks per person per site (the app says so first; this is the backstop)
create or replace function public.jh_marks_limit() returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.marks where site_id = new.site_id and created_by = new.created_by) >= 5 then
    raise exception 'mark_limit: at most 5 marks per person per site';
  end if;
  return new;
end $$;
drop trigger if exists marks_limit on public.marks;
create trigger marks_limit before insert on public.marks for each row execute function public.jh_marks_limit();

alter table public.marks enable row level security;
alter table public.lead_marks enable row level security;
revoke all on table public.marks from anon, authenticated;
revoke all on table public.lead_marks from anon, authenticated;
grant select, insert, delete on table public.marks to authenticated;
-- the evaluation columns (match_count, evaluated_at), the owner and the site are never set by a signed-in user
grant update (name, description, color, active, visibility, shared_with, rule, spec, reads, updated_at) on table public.marks to authenticated;
grant select on table public.lead_marks to authenticated;

-- see a mark: a member of its site, and it is mine, or shared with the team, or shared with me
drop policy if exists marks_select on public.marks;
create policy marks_select on public.marks for select to authenticated using (
  exists (select 1 from public.site_members m where m.site_id = marks.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active')
  and (created_by = (auth.jwt() ->> 'sub') or visibility = 'team' or (visibility = 'members' and (auth.jwt() ->> 'sub') = any (shared_with)))
);
drop policy if exists marks_insert on public.marks;
create policy marks_insert on public.marks for insert to authenticated with check (
  created_by = (auth.jwt() ->> 'sub')
  and exists (select 1 from public.site_members m where m.site_id = marks.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active')
);
drop policy if exists marks_update on public.marks;
create policy marks_update on public.marks for update to authenticated
  using (created_by = (auth.jwt() ->> 'sub')) with check (created_by = (auth.jwt() ->> 'sub'));
drop policy if exists marks_delete on public.marks;
create policy marks_delete on public.marks for delete to authenticated using (created_by = (auth.jwt() ->> 'sub'));

-- a lead's mark is visible to whoever can see the mark (the marks policy applies inside this subquery)
drop policy if exists lead_marks_select on public.lead_marks;
create policy lead_marks_select on public.lead_marks for select to authenticated using (
  exists (select 1 from public.marks k where k.id = lead_marks.mark_id)
);
