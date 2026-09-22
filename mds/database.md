# Database schema (Supabase / Postgres)

Canonical schema, as provided directly from Supabase. This file was empty before —
keep it in sync with the live schema when tables/columns change.

Key facts about how the app joins these tables (see `lib/actions/*`, `app/api/track*`):

- There is **no `leads` table** and **no `conversions` table**. A "lead" is a
  `form_submissions` row. A "conversion" is the existence of a `form_submissions`
  row for a given `visitor_id`.
- Joins across `sessions` / `page_views` / `form_submissions` / `visitors` use the
  client-generated string columns `visitor_id` and `session_id` — **not** the
  tables' UUID primary keys (`id`).
- `visitors.site_id`, `sessions.site_id`, `page_views.site_id` all default to
  `gen_random_uuid()` if left unset on insert — the tracker code always sets it
  explicitly, but this default means a row inserted without `site_id` silently
  gets an unrelated random UUID instead of `null`/an error. Never rely on this
  default; always pass `site_id` explicitly on insert.
- A visitor can have `form_submissions` rows with **no matching `visitors` row**
  (e.g. the visitor's first tracked event was the form submit itself, or
  localStorage was cleared between page load and submit). Any query for "this
  lead's data" must not gate on the `visitors` row existing — treat
  `form_submissions` as the anchor and treat `visitors`/`sessions`/`page_views`
  as optional enrichment.

## sites
```sql
create table public.sites (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  name text null,
  domain text null,
  api_key text null,
  user_id text null,
  plan text null,
  monthly_event_limit integer null,
  is_active boolean null default true,
  deleted_at timestamp with time zone null,
  constraint sites_pkey primary key (id)
);
```
Note: `sites.user_id` is a legacy owner field — `site_members` is the real
source of truth for who can access a site.

## site_members
```sql
create table public.site_members (
  id uuid not null default gen_random_uuid (),
  site_id uuid not null,
  user_id text not null,
  user_email text not null,
  role text not null default 'member'::text,
  invited_by text null,
  created_at timestamp with time zone null default now(),
  constraint site_members_pkey primary key (id),
  constraint site_members_unique unique (site_id, user_id),
  constraint site_members_site_id_fkey foreign key (site_id) references sites (id) on delete cascade
);
create index if not exists site_members_user_id_idx on public.site_members using btree (user_id);
create index if not exists site_members_site_id_idx on public.site_members using btree (site_id);
```

## visitors
```sql
create table public.visitors (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  visitor_id text null,
  site_id uuid null default gen_random_uuid (),
  first_seen timestamp without time zone null,
  last_seen timestamp without time zone null,
  device_type text null,
  browser text null,
  os text null,
  language text null,
  ip_address text null,
  constraint visitors_pkey primary key (id)
);
```

## sessions
```sql
create table public.sessions (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  session_id text null,
  visitor_id text null,
  site_id uuid null default gen_random_uuid (),
  started_at timestamp without time zone null,
  ended_at timestamp without time zone null,
  last_activity_at timestamp without time zone null,
  referrer text null,
  country text null,
  timezone text null,
  constraint sessions_pkey primary key (id),
  constraint sessions_session_id_key unique (session_id)
);
create index if not exists sessions_visitor_id_idx on public.sessions using btree (visitor_id);
```

## page_views
```sql
create table public.page_views (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  page_view_id text null,
  session_id text null,
  site_id uuid null default gen_random_uuid (),
  page_url text null,
  page_path text null,
  page_title text null,
  entered_at timestamp without time zone null,
  time_on_page integer null,
  scroll_depth real null,
  visitor_id text null,
  left_at timestamp without time zone null,
  max_scroll_depth real null,
  max_scroll_reached_at timestamp without time zone null,
  constraint page_views_pkey primary key (id),
  constraint page_views_page_view_id_key unique (page_view_id)
);
create index if not exists page_views_session_id_idx on public.page_views using btree (session_id);
create index if not exists page_views_site_id_idx on public.page_views using btree (site_id);
```

## form_submissions
```sql
create table public.form_submissions (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  site_id uuid null,
  visitor_id text null,
  session_id text null,
  page_url text null,
  page_path text null,
  name text null,
  email text null,
  phone text null,
  confidence text null default 'high'::text,
  raw_data jsonb null,
  submitted_at timestamp with time zone null,
  constraint form_submissions_pkey primary key (id)
);
create index if not exists form_submissions_visitor_id_idx on public.form_submissions using btree (visitor_id);
create index if not exists form_submissions_site_id_idx on public.form_submissions using btree (site_id);
```
This is the "leads" table — a lead = a row here. `raw_data` is arbitrary
per-business form fields (jsonb, no fixed shape). `name`/`email`/`phone` are
best-effort extractions the tracker pulls out of the submitted form.

## page_structure
```sql
create table public.page_structure (
  id uuid not null default gen_random_uuid (),
  site_id uuid not null,
  page_path text not null,
  header_index integer not null,
  header_text text not null,
  header_tag text not null,
  position_y integer not null,
  page_height integer not null,
  created_at timestamp with time zone null default now(),
  constraint page_structure_pkey primary key (id),
  constraint page_structure_unique unique (site_id, page_path, header_index)
);
create index if not exists page_structure_site_path_idx on public.page_structure using btree (site_id, page_path);
```
Used for content/intent-failure analysis, not leads.

## page_insights
```sql
create table public.page_insights (
  id uuid default gen_random_uuid() primary key,
  site_id uuid not null references sites(id) on delete cascade,
  page_path text not null,
  label text null,               -- 'bad','warning','good','investigating'
  color text null,                -- 'red','yellow','green'
  retention_score real null,
  conversion_score real null,
  spotlight_score real null,
  checked_and_verified boolean default false,
  notes text null,                -- free text the owner can add
  auto_generated boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint page_insights_unique unique (site_id, page_path)
);
```

## billing_events
```sql
create table public.billing_events (
  id uuid not null default gen_random_uuid (),
  user_id text not null,
  event_type text not null,
  plan text null,
  status text null,
  amount_cents integer null,
  currency text null default 'usd'::text,
  subscription_id text null,
  period_start timestamp with time zone null,
  period_end timestamp with time zone null,
  raw_payload jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint billing_events_pkey primary key (id),
  constraint billing_events_user_id_fkey foreign key (user_id) references users (id) on delete cascade
);
create index if not exists billing_events_user_id_idx on public.billing_events using btree (user_id);
create index if not exists billing_events_subscription_id_idx on public.billing_events using btree (subscription_id);
```
References a `users` table not otherwise documented here (Clerk-synced, presumably via `app/api/webhooks/clerk/route.ts`).



create table public.users (
  id text not null,
  created_at timestamp with time zone not null default now(),
  email text null,
  pfp text null,
  phone bigint null,
  first_name text null,
  last_name text null,
  constraint users_pkey primary key (id)
) TABLESPACE pg_default;