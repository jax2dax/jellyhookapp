-- 28-lead-forms.sql
-- Which forms count as leads, per form (mds/build/forms/lead-forms.md).
--   form_submissions.form_key  the form a lead came from (lib/tracking/formKey.js: id:, name:, path:, hubspot:, embed:)
--   site_forms                 every form Jellyhook has seen on a site: its switch (counts_as_lead: true, false, or
--                              null = the site's default), how many leads and skipped submissions it had, where.
--   jh_form_seen()             counts one submission of a form, as a lead or skipped (atomic; no personal data).
-- Only the service role writes; members read their sites' rows (the Lead forms list in Settings).

alter table public.form_submissions add column if not exists form_key text;
create index if not exists form_submissions_site_form_key_idx on public.form_submissions (site_id, form_key);

create table if not exists public.site_forms (
  site_id uuid not null references public.sites (id) on delete cascade,
  form_key text not null,
  counts_as_lead boolean null,
  lead_count integer not null default 0,
  skipped_count integer not null default 0,
  last_page text null,
  -- the data-conversion value last seen on it ("true", "false" or null): a marked form ignores its switch
  last_mark text null check (last_mark in ('true', 'false')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_skipped_at timestamptz null,
  updated_by text null,
  updated_at timestamptz null,
  primary key (site_id, form_key),
  constraint site_forms_key_len check (char_length(form_key) <= 300)
);

alter table public.site_forms enable row level security;
drop policy if exists site_forms_member_read on public.site_forms;
create policy site_forms_member_read on public.site_forms for select using (
  exists (
    select 1 from public.site_members
    where site_members.site_id = site_forms.site_id
      and site_members.user_id = (auth.jwt() ->> 'sub')
      and site_members.status = 'active'
  )
);

create or replace function public.jh_form_seen(p_site uuid, p_key text, p_page text, p_skipped boolean, p_mark text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.site_forms as f (site_id, form_key, lead_count, skipped_count, last_page, last_mark, last_seen_at, last_skipped_at)
  values (p_site, left(p_key, 300), case when p_skipped then 0 else 1 end, case when p_skipped then 1 else 0 end, left(p_page, 500),
          case when p_mark in ('true', 'false') then p_mark else null end, now(), case when p_skipped then now() else null end)
  on conflict (site_id, form_key) do update set
    lead_count = f.lead_count + case when p_skipped then 0 else 1 end,
    skipped_count = f.skipped_count + case when p_skipped then 1 else 0 end,
    last_page = coalesce(excluded.last_page, f.last_page),
    last_mark = excluded.last_mark,
    last_seen_at = now(),
    last_skipped_at = case when p_skipped then now() else f.last_skipped_at end;
$$;

revoke all on function public.jh_form_seen(uuid, text, text, boolean, text) from public, anon, authenticated;

-- Leads from before this migration: keyed by their page (their form's id or position was not recorded then), so every
-- lead names a form and the Lead forms list has every form that ever sent one. Switches stay null: the site's default.
update public.form_submissions set form_key = 'path:' || coalesce(page_path, '/') || '#0' where form_key is null;

insert into public.site_forms (site_id, form_key, lead_count, last_page, first_seen_at, last_seen_at)
select site_id, form_key, count(*), max(page_path), min(submitted_at), max(submitted_at)
from public.form_submissions
where site_id is not null and form_key is not null
group by site_id, form_key
on conflict (site_id, form_key) do nothing;
