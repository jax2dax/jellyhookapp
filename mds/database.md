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
  -- added 2026-09-23 — see "Scroll geometry" note below
  page_height integer null,
  entry_scroll_depth real null,
  revisit_start_scroll_depth real null,
  constraint page_views_pkey primary key (id),
  constraint page_views_page_view_id_key unique (page_view_id)
);
create index if not exists page_views_session_id_idx on public.page_views using btree (session_id);
create index if not exists page_views_site_id_idx on public.page_views using btree (site_id);
```
**Scroll geometry** (all 0-1 fractions of `page_height`, except `page_height` itself which is real px — `document.documentElement.scrollHeight`, the page's actual content height, not viewport height):
- `entry_scroll_depth` — where the visitor's viewport was when this page_view opened. Never assume 0 — a page_view can open mid-scroll (tab regains focus without reloading the DOM). `max_scroll_depth` is seeded from this same measurement (not from 0) for the same reason: seeding at 0 would make scrolling *up* from a mid-page entry look like "reaching a new deepest point" the instant it dipped below the entry depth.
- `max_scroll_depth` / `max_scroll_reached_at` — the deepest point ever reached and when.
- `revisit_start_scroll_depth` — null if the visitor never backtracked below their deepest point; otherwise the shallowest point they climbed back up to after reaching `max_scroll_depth`. Only ever decreases, and is never reset once set — including when a later, deeper `max_scroll_depth` is reached — so it tracks the global minimum reached after the first backtrack, correctly spanning multiple separate descend/backtrack phases in one visit. `[revisit_start_scroll_depth, max_scroll_depth]` was necessarily crossed at least twice (once descending, once climbing back up), regardless of how much bouncing happened in between — this is what FramePlate's "seen more than once" (dark green) band renders directly, no derivation needed.
- `scroll_depth` — where they were when they left (existing column).

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
Append-only audit log — one row per Clerk Billing webhook event. Never read
for access-gating (see `subscriptions` below and the note on `PlanGate`).

## subscriptions
```sql
-- Not previously documented here even though app/api/webhooks/clerk/route.ts
-- and lib/actions/billing.actions.ts have depended on it since the billing
-- feature was built. Columns below are the ones the webhook actually writes;
-- run this ALTER if plan_started_at doesn't exist yet (added 2026-09-23):
alter table public.subscriptions
  add column if not exists plan_started_at timestamp with time zone null;
```
One row per Clerk user — the CURRENT-plan mirror, upserted only by
`subscription.*` webhook events (never by `subscriptionItem.*` — see the long
comment in the webhook route for why a lone item can't safely decide this).
Columns: `id, user_id, plan, status, current_period_start, current_period_end,
cancel_at_period_end, cancelled_at, plan_started_at, updated_at`.

**This table is NOT what gates plan-restricted UI.** `PlanGate` reads
Clerk's own live entitlement check (`auth().has({ plan })`, via
`getPlanLabel()`/`isProOrHigher()`/`isElite()` in
`lib/actions/permission.actions.js`) — Clerk is the system of record for
billing, this table is a display/audit mirror for the Billing page (current
plan, renewal/cancellation date, history). `sites.plan` is unrelated to
either of these — it's set to `'free'` at site creation and never updated
again; nothing currently overrides it per-site.

Cancelling a plan does not revoke access immediately: Clerk marks the old
subscription item `status: 'canceled'` right away but access should persist
until its `period_end`. The webhook's `pickCurrentDisplayItem()` treats a
canceled item as still "current" as long as `period_end` hasn't passed yet,
so this table (and the Billing page's "cancels on X" messaging) reflect that
correctly. Real access is governed by Clerk's own `has({ plan })`, which is
expected to implement the same grace period on Clerk's end.
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