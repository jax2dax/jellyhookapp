-- 21-form-field-names (2026-10-24): names the site's people give to form fields, for marks on form answers.
-- Run once in the Supabase SQL editor BEFORE deploying the code that uses it. Safe to run twice.
-- Design: mds/build/marks/marks-v2-plan.md (section 2, decision 6).
--
-- A form field is identified by its key from the tracker ("custom:<name|id|placeholder>", or email / name / phone).
-- The tracker reads each field's visible label from the page; many real forms have none ("field_3"), so a person can
-- name it once here ("Budget"). The name is used by the mark builder and by Enter with AI. No answers are stored here.
-- Any active member of the site can name a field (it is a site setting, not personal).

create table if not exists public.form_field_names (
  site_id uuid not null references public.sites (id) on delete cascade,
  field_key text not null check (char_length(field_key) between 1 and 107),
  name text not null check (char_length(name) between 1 and 60),
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (site_id, field_key)
);

alter table public.form_field_names enable row level security;
revoke all on table public.form_field_names from anon, authenticated;
grant select on table public.form_field_names to authenticated;

drop policy if exists form_field_names_select on public.form_field_names;
create policy form_field_names_select on public.form_field_names for select to authenticated using (
  exists (select 1 from public.site_members m where m.site_id = form_field_names.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active')
);
-- writes: the server (service role) after checking the person is an active member (lib/actions/formFields.action.ts)
