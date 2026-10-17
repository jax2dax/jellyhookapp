-- 17-form-versions (2026-10-15): form identity and form versions. Run once in the Supabase SQL editor BEFORE deploying the
-- code that writes form_key (the form-engagement route). Safe to run twice. Needs 16-form-signals.sql (form_fields).
-- Design and every rule: mds/build/form-study/averages-and-versions.md. Tested on PGlite: jh-forms/tests/versions.test.ts.
--
-- form_engagement.form_key         "id:<id>" | "name:<name>" | "path:<page>#<position>" (lib/tracking/formKey.js)
-- form_engagement.form_version_id  the version the row was placed in (null until its field list is known)
-- form_versions                    one row per lifespan of a form: started_at .. ended_at (null = current)
--
-- The version rule (jh_place_form_version), the founder's:
--   a new field list starts a new version AT ONCE, except within the first 24 h of the current version: changes then
--   join it. So a version lives at least a day. A field list already in the current version stays in it.
-- Storage: one small row per version (field list ~300 bytes, summary ~2 KB once frozen). At most 20 versions per form.

alter table public.form_engagement add column if not exists form_key text null;
alter table public.form_engagement add column if not exists form_version_id uuid null;

create table if not exists public.form_versions (
  id uuid not null default gen_random_uuid() primary key,
  site_id uuid not null references public.sites (id) on delete cascade,
  form_key text not null,
  fingerprints text[] not null,              -- every field list seen in this version (jh_form_fingerprint)
  fields jsonb not null,                     -- the field list it settled on: key, type, required. Never values
  pages text[] not null default '{}',        -- pages it was seen on, at most 20
  started_at timestamptz not null,
  ended_at timestamptz null,                 -- null = the current version
  last_seen_at timestamptz not null,
  summary jsonb null,                        -- frozen numbers of an ended version (jh-forms/reference.ts)
  summary_version smallint null,             -- the formula version that made it; a newer formula recomputes
  summary_at timestamptz null,
  unique (site_id, form_key, started_at)
);
create index if not exists form_versions_site_key_idx on public.form_versions (site_id, form_key, started_at desc);
create index if not exists form_engagement_site_form_idx on public.form_engagement (site_id, form_key, form_version_id, status);

alter table public.form_versions enable row level security;
revoke all on table public.form_versions from anon, authenticated;
grant select on table public.form_versions to authenticated;
-- the dashboard freezes an ended version's numbers; nothing else of a version can be changed by a signed-in user
grant update (summary, summary_version, summary_at) on table public.form_versions to authenticated;
drop policy if exists form_versions_select_members on public.form_versions;
create policy form_versions_select_members on public.form_versions for select to authenticated
  using (exists (select 1 from public.site_members m where m.site_id = form_versions.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active'));
drop policy if exists form_versions_update_members on public.form_versions;
create policy form_versions_update_members on public.form_versions for update to authenticated
  using (exists (select 1 from public.site_members m where m.site_id = form_versions.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active'))
  with check (exists (select 1 from public.site_members m where m.site_id = form_versions.site_id and m.user_id = (auth.jwt() ->> 'sub') and m.status = 'active'));

-- 16 hex chars for a field list: order, key, type and required count; nothing else (labels are not tracked)
create or replace function public.jh_form_fingerprint(f jsonb) returns text
language sql immutable set search_path = public as $$
  select left(md5(coalesce(string_agg(
    coalesce(e->>'key', '') || '|' || coalesce(e->>'type', '') || '|' || case when e->'required' = 'true'::jsonb then '1' else '0' end,
    E'\n' order by i), '')), 16)
  from jsonb_array_elements(case when jsonb_typeof(f) = 'array' then f else '[]'::jsonb end) with ordinality as t(e, i)
$$;

-- Places one form_engagement row in its form's version (creating or ending versions). Returns the version id, or null
-- when the row has no key or no field list yet. Idempotent: a row already placed keeps its version.
create or replace function public.jh_place_form_version(p_row uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r record;
  cur record;
  fp text;
  vid uuid;
  n int;
  path_key text;
begin
  select id, site_id, form_key, form_fields, viewed_at, page_path, form_index, form_version_id into r from form_engagement where id = p_row;
  if not found or r.form_key is null or jsonb_typeof(r.form_fields) is distinct from 'array' or jsonb_array_length(r.form_fields) = 0 then return null; end if;
  if r.form_version_id is not null then return r.form_version_id; end if;
  -- one placement at a time per form: two first rows of a new layout must not both start a version
  perform pg_advisory_xact_lock(hashtext(r.site_id::text || '|' || r.form_key));

  -- The form just got an id/name: its older rows were keyed by page + position. Move them under the new key once, and
  -- re-place everything of that key in time order (bounded: skipped above 20000 rows, they then stay unversioned).
  path_key := 'path:' || r.page_path || '#' || r.form_index;
  if r.form_key not like 'path:%' and exists (select 1 from form_engagement where site_id = r.site_id and form_key = path_key limit 1) then
    update form_engagement set form_key = r.form_key, form_version_id = null where site_id = r.site_id and form_key in (path_key, r.form_key);
    delete from form_versions where site_id = r.site_id and form_key in (path_key, r.form_key);
    select count(*) into n from form_engagement where site_id = r.site_id and form_key = r.form_key;
    if n <= 20000 then
      perform public.jh_place_form_version(x.id) from (
        select id from form_engagement where site_id = r.site_id and form_key = r.form_key and jsonb_typeof(form_fields) = 'array' order by viewed_at, id
      ) x;
    end if;
    select form_version_id into vid from form_engagement where id = p_row;
    return vid;
  end if;

  fp := public.jh_form_fingerprint(r.form_fields);
  select * into cur from form_versions where site_id = r.site_id and form_key = r.form_key order by started_at desc limit 1;

  if not found then
    insert into form_versions (site_id, form_key, fingerprints, fields, pages, started_at, last_seen_at)
      values (r.site_id, r.form_key, array[fp], r.form_fields, array[r.page_path], r.viewed_at, r.viewed_at) returning id into vid;
  elsif r.viewed_at < cur.started_at then
    -- a late row from before the current version: the version that was live then (or the first one, moved earlier)
    select id into vid from form_versions where site_id = r.site_id and form_key = r.form_key and started_at <= r.viewed_at order by started_at desc limit 1;
    if vid is null then
      select id into vid from form_versions where site_id = r.site_id and form_key = r.form_key order by started_at asc limit 1;
      update form_versions set started_at = r.viewed_at where id = vid;
    end if;
  elsif fp = any (cur.fingerprints) then
    vid := cur.id;
    update form_versions set last_seen_at = greatest(last_seen_at, r.viewed_at),
      pages = case when r.page_path = any (pages) or cardinality(pages) >= 20 then pages else pages || r.page_path end
      where id = vid;
  else
    select count(*) into n from form_versions where site_id = r.site_id and form_key = r.form_key;
    if r.viewed_at - cur.started_at < interval '24 hours' or n >= 20 then
      -- changed again within the version's first day (or the form has too many versions): same version
      vid := cur.id;
      update form_versions set fingerprints = fingerprints || fp,
        fields = case when r.viewed_at - started_at < interval '24 hours' then r.form_fields else fields end,
        last_seen_at = greatest(last_seen_at, r.viewed_at),
        pages = case when r.page_path = any (pages) or cardinality(pages) >= 20 then pages else pages || r.page_path end
        where id = vid;
    else
      update form_versions set ended_at = r.viewed_at where id = cur.id;
      insert into form_versions (site_id, form_key, fingerprints, fields, pages, started_at, last_seen_at)
        values (r.site_id, r.form_key, array[fp], r.form_fields, array[r.page_path], r.viewed_at, r.viewed_at) returning id into vid;
    end if;
  end if;

  update form_engagement set form_version_id = vid where id = p_row;
  return vid;
end $$;
revoke all on function public.jh_place_form_version(uuid) from public, anon, authenticated;

-- Backfill: every existing row gets its page + position key, then rows with a field list (forms seen since
-- 2026-10-14) are placed oldest first. Rows without a field list stay out of versions (shown in "All" only).
update public.form_engagement set form_key = 'path:' || page_path || '#' || form_index where form_key is null and page_path is not null;
do $$
declare x record;
begin
  for x in select id from public.form_engagement where form_version_id is null and form_key is not null and jsonb_typeof(form_fields) = 'array' order by viewed_at, id loop
    perform public.jh_place_form_version(x.id);
  end loop;
end $$;
