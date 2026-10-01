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
  -- migrated to timestamptz on 2026-09-29, same reason/method as sessions above
  first_seen timestamp with time zone null,
  last_seen timestamp with time zone null,
  device_type text null,
  browser text null,
  os text null,
  language text null,
  ip_address text null,
  constraint visitors_pkey primary key (id)
);
```
`device_type` was only ever set at INSERT time, from whichever event
happened to create the row first — `session_start` never carries a
device_type at all (only `page_view_start`/`page_view_end` do), so a race
between those two network calls decided whether a visitor ever got one,
permanently. Fixed 2026-09-29: the UPDATE path in `/api/track` now also
backfills `device_type` whenever a later event carries one, instead of
only ever setting it once at insert.

## sessions
```sql
create table public.sessions (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  session_id text null,
  visitor_id text null,
  site_id uuid null default gen_random_uuid (),
  -- started_at/ended_at/last_activity_at were originally `timestamp without
  -- time zone` — migrated to timestamptz on 2026-09-29 (see
  -- mds/progress_timeline.md) after that mismatch against form_submissions'
  -- timestamptz columns caused real conversion-attribution bugs. The
  -- migration was non-lossy (`... at time zone 'UTC'` just tags the
  -- already-correct UTC digits, no numeric shift).
  started_at timestamp with time zone null,
  ended_at timestamp with time zone null,
  last_activity_at timestamp with time zone null,
  referrer text null,
  country text null,
  timezone text null,
  -- added 2026-09-29 — see "UTM + referrer attribution" note below
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  constraint sessions_pkey primary key (id),
  constraint sessions_session_id_key unique (session_id)
);
create index if not exists sessions_visitor_id_idx on public.sessions using btree (visitor_id);
```

**UTM + referrer attribution.** `referrer` is raw `document.referrer` —
only ever correct for a visitor who *clicked straight through* from a
referring page; it cannot know "saw an ad, then searched for us instead."
`utm_source`/`utm_medium`/`utm_campaign` are read from the landing URL's own
query string at `session_start` (`?utm_source=facebook&utm_medium=paid...`),
with a fallback: if a marketer forgot to tag a link, the presence of
Google/Meta's own auto-appended click-ids (`gclid`/`fbclid`) infers
`utm_source`/`utm_medium` instead (see `getUtmParams()` in
`public/tracker.js`). When building anything source-attribution related,
`utm_source` always takes priority over `referrer` — see
`lib/analytics/classifyReferrer.js`.

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
  -- entered_at/left_at/max_scroll_reached_at migrated to timestamptz on
  -- 2026-09-29, same reason/method as sessions above
  entered_at timestamp with time zone null,
  time_on_page integer null,
  scroll_depth real null,
  visitor_id text null,
  left_at timestamp with time zone null,
  max_scroll_depth real null,
  max_scroll_reached_at timestamp with time zone null,
  -- added 2026-09-23 — see "Scroll geometry" note below
  page_height integer null,
  entry_scroll_depth real null,
  revisit_start_scroll_depth real null,
  viewport_height integer null,
  constraint page_views_pkey primary key (id),
  constraint page_views_page_view_id_key unique (page_view_id)
);
create index if not exists page_views_session_id_idx on public.page_views using btree (session_id);
create index if not exists page_views_site_id_idx on public.page_views using btree (site_id);
```

Migration for `viewport_height` if it doesn't exist yet:
```sql
alter table public.page_views
  add column if not exists viewport_height integer null;
```

**Scroll geometry — read this before touching anything that interprets these
columns.** The single most expensive mistake available here is assuming the
`*_scroll_depth` columns are fractions of the page. They are not:

```
scroll fraction = scrollY / (page_height - viewport_height)
```

The denominator is the **scrollable range**, not `page_height`. The two
differ on every page taller than the viewport — on a page 1.25x the
viewport, `scroll_depth = 1.0` means the viewport's TOP is only 20% down the
page (its bottom is what reaches 100%, exactly one viewport height further).
Converting a scroll fraction into a position on the page needs all three
columns:

```
vFrac          = viewport_height / page_height    -- one screen, as a page fraction
scrollableFrac = 1 - vFrac                        -- how far the viewport TOP can travel
pageTop(s)     = s * scrollableFrac               -- scroll fraction -> page position
pageBottom(s)  = pageTop(s) + vFrac               -- what's visible from there
```

A visitor who lands on a 1.25-screen page and scrolls nothing has already
seen 80% of it. Anything that reports 0% seen for that visit is wrong. The
canonical implementation is `framePlate/geometry/deriveVisitGeometry.ts`.

Column meanings (`*_scroll_depth` are 0-1 fractions of the **scrollable
range** per the formula above; `page_height` and `viewport_height` are real
px — `document.documentElement.scrollHeight` and `window.innerHeight`):
- `entry_scroll_depth` — where the visitor's viewport was when this page_view opened. Never assume 0 — a page_view can open mid-scroll (tab regains focus without reloading the DOM). `max_scroll_depth` is seeded from this same measurement (not from 0) for the same reason: seeding at 0 would make scrolling *up* from a mid-page entry look like "reaching a new deepest point" the instant it dipped below the entry depth.
- `max_scroll_depth` / `max_scroll_reached_at` — the deepest point ever reached and when.
- `revisit_start_scroll_depth` — null if the visitor never backtracked below their deepest point; otherwise the shallowest point they climbed back up to after reaching `max_scroll_depth`. Only ever decreases, and is never reset once set — including when a later, deeper `max_scroll_depth` is reached — so it tracks the global minimum reached after the first backtrack, correctly spanning multiple separate descend/backtrack phases in one visit. `[revisit_start_scroll_depth, max_scroll_depth]` was necessarily crossed at least twice (once descending, once climbing back up), regardless of how much bouncing happened in between — this is what FramePlate's "seen more than once" (dark green) band renders directly, no derivation needed.
- `scroll_depth` — where they were when they left (existing column).
- `viewport_height` — `window.innerHeight` at page_view_start. Not optional for correctness: it is the denominator every `*_scroll_depth` value on the row was divided by, so without it none of them can be placed on the page. Null on rows predating this column — consumers fall back to a device-typical estimate and should mark the result as estimated (see `VisitGeometry.viewportEstimated`) rather than presenting it as measured.

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
  -- added 2026-09-29 — sales's manual real/junk flag, see below
  qualified boolean null default null,
  constraint form_submissions_pkey primary key (id)
);
create index if not exists form_submissions_visitor_id_idx on public.form_submissions using btree (visitor_id);
create index if not exists form_submissions_site_id_idx on public.form_submissions using btree (site_id);
```
`qualified` is a human sales judgment, set from `/platform/leads` or the
lead profile page (`LeadQualifyToggle` → `lib/actions/leadQualify.action.js`)
— null = not reviewed yet, true = qualified/real, false = junk. Not the
same thing as `confidence`, which is an automatic email-presence heuristic
computed at submit time, not a person's judgment.

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

## form_engagement
```sql
create table public.form_engagement (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  site_id uuid not null,
  visitor_id text not null,
  session_id text not null,
  page_view_id text not null,  -- informational only since 2026-09-29 — see unique key note below
  page_path text null,
  form_index integer not null,
  status text not null default 'viewed'::text, -- 'viewed' | 'started' | 'submitted' | 'abandoned'
  last_field_type text null,                    -- 'name' | 'email' | 'phone' | 'custom'
  last_field_key text null,                     -- raw field name/id/placeholder when last_field_type = 'custom'
  viewed_at timestamp with time zone not null default now(),
  first_input_at timestamp with time zone null,
  ended_at timestamp with time zone null,        -- set when status becomes 'submitted' or 'abandoned' — always the real last activity, never "now"
  -- added 2026-09-29 — see "Per-field timing" note below
  field_timings jsonb null default '{}'::jsonb,
  last_activity_at timestamp with time zone null,
  constraint form_engagement_pkey primary key (id)
);
create unique index if not exists form_engagement_session_path_form_idx
  on public.form_engagement (session_id, page_path, form_index);
create index if not exists form_engagement_site_status_idx on public.form_engagement using btree (site_id, status);
```
form_index is the form's position among `document.forms` on that page,
same identity scheme `page_structure.header_index` uses for headers.

**Unique key (changed 2026-09-29).** Was `(page_view_id, form_index)`;
now `(session_id, page_path, form_index)`. Tabbing away and back (or a
full page reload) always mints a fresh `page_view_id` — keying identity
on it would fork the same in-progress form-fill into a disconnected new
row every time. `page_view_id` is still stored, just informational now
("most recently touched by this page_view").

**Per-field timing.** `field_timings` holds one entry per field the
visitor has ever focused, keyed by its classified type (`name`/`email`/
`phone`) or `custom:<raw_key>` for anything else:
```json
{ "email": { "order": 1, "firstFocusAt": "...", "firstKeydownAt": "...", "lastUnfocusAt": "...", "totalFocusedMs": 4200 } }
```
`order` is assigned once, server-side, the first time a field is ever
focused. `totalFocusedMs` is **cumulative** across every visit to that
field — the client only ever reports one visit's delta; the server
additively merges it (`mergeFieldTimings` in
`app/api/track-form-engagement/route.js`). See `mds/features.md`'s "Form
Engagement Tracking" entry for the full lifecycle and why this design
isn't a per-keystroke network request.

`last_activity_at` is distinct from `ended_at` — it's bumped by field
focus/blur/submit/session-end, and IS what `ended_at` gets set to on
abandonment (never "now").

**Consumed by FramePlate's form mini-plate (2026-10-01, renamed from
"form imitation" 2026-10-01).** `form_top_y`/`form_bottom_y`/`status`/
`field_timings` from this table feed the session-replay chart's form
mini-plate box (see `framePlate/components/FullPagePlate.tsx` and
`/docs/concepts/session-replay`). Three things worth knowing if you touch
this table:
- Position is captured the moment a form is first ≥50% visible
  (`viewed` or later) — that needs no interaction at all, so the chart can
  show a form's location on a visit that never converted and never even
  started filling it in.
- `field_timings`' key count is used as the chart's field-stripe count. It
  is a **lower bound**, not the form's real field count — a field nobody
  ever focused has no entry and is invisible to both this column and the
  chart, same caveat as "Per-field timing" above.
- `status === 'submitted'` is what makes the chart draw the box in a
  brighter yellow; anything else measured (`viewed`/`started`/`abandoned`)
  gets the ordinary converted-adjacent color.

RLS: insert/update `to public` (unconditional), select `to authenticated`
scoped by site membership — see "Row Level Security" at the bottom of this
file for the full design and why `to public` rather than `to anon`.

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

## Row Level Security

Active as of 2026-09-30 (see `mds/progress_timeline.md` for the full story
of how this was decided, including a real bug caught and fixed in it).
Replaced an earlier state where every table had one blanket `using (true)`
policy to `anon, authenticated` — functionally identical to RLS being off,
since the Supabase anon key is a `NEXT_PUBLIC_*` env var visible in any
browser's Network tab.

**The split, and why.** This app has two fundamentally different kinds of
traffic hitting these tables: anonymous visitors on *customers'* websites
(the tracker — authenticated by nothing but an `api_key` check in the
route code, never a Clerk session, by design) and actual logged-in
Jellyhook customers (real Clerk sessions). A JWT-based ownership policy is
correct for the second group and cannot apply to the first — no code
change gives an anonymous website visitor a Jellyhook login.

**Two tables genuinely can't be expressed safely in RLS at all**: `sites`
and `site_members`. Invite handling matches `site_members.user_id` against
a sentinel string (`pending:<email>`) that has no relation to a real Clerk
user id until the invite is accepted; `createSite` also does a
cross-tenant domain-duplicate check (looking up ANY site by domain, not
just the caller's own). No policy can express "this pending row belongs to
you" without trusting an email claim that may not even exist in the JWT.
These two tables, plus `users`/`subscriptions`/`billing_events` (already
exclusively service-role-accessed in live code, confirmed by grep), grant
**nothing at all** to `anon`/`authenticated` — every access goes through
the service-role key in `permission.actions.js`, `settings.actions.js`,
`site-management.actions.js`, `profile.actions.js`, `billing.actions.ts`,
and the webhook handler, each of which already has its own `auth()` +
ownership check before querying. That app-layer check is the real
authorization for these five tables — RLS is not a backstop here, by
deliberate choice, because encoding the above into policy SQL untestable
against the real project was judged riskier than trusting the (already
correct, already-existing) application checks.

**One narrow exception on `site_members`**: `authenticated` may `select`
rows where `user_id` matches their own id. Required for every OTHER
table's ownership check below to resolve at all — Postgres RLS applies to
subqueries the same as top-level queries, so if `site_members` granted
`authenticated` nothing, the `exists (select 1 from site_members ...)`
clause inside every other table's policy would also silently return
nothing for everyone, not just for non-members.

**Every other table** (`visitors`, `sessions`, `page_views`,
`form_submissions`, `form_engagement`, `page_structure`, `page_insights`)
keeps the two-layer design: the app's `requireSiteAccess()` /
per-function ownership check, *and* a real RLS policy underneath it as an
independent backstop. Specifically:
- `insert`/`update` wide open **to public** (not `to anon` — an
  authenticated-ish client with an `accessToken()` callback configured,
  even one that resolves to nothing for an anonymous tracker request,
  doesn't reliably land in the `anon` role; `to public` matches regardless
  of role, discovered the hard way on `form_engagement`, 2026-09-29,
  applied to every table consistently rather than one-off this time).
  `form_submissions` is insert-only here — the tracker never updates it.
- `select` restricted **to authenticated**, scoped by:
  ```sql
  exists (
    select 1 from site_members
    where site_members.site_id = <table>.site_id
      and site_members.user_id = (auth.jwt() ->> 'sub')
      and site_members.status = 'active'
  )
  ```
  `form_submissions` additionally has this same scoping on `update` (the
  qualify/junk toggle — a dashboard action, never the tracker).
- No `delete` policy anywhere — the app never deletes rows in any of
  these tables, so default-deny costs nothing.

**`auth.jwt() ->> 'sub'`, not `auth.uid()`.** `auth.uid()` is Supabase's
*native* auth helper — its implementation casts the JWT `sub` claim to
Postgres's `uuid` type internally. Clerk user ids
(`user_3CWPiUysltfw2WiuspYCuA6XDxs`) aren't UUID-shaped, so that cast
throws, which surfaced as `invalid input syntax for type uuid` across
every ownership-checked query the first time this was deployed.
`auth.jwt() ->> 'sub'` reads the same claim as plain text, no casting,
cannot throw this way. Don't reintroduce `auth.uid()` into any future
policy on a table Clerk users touch.

**Gap closed (2026-09-30, same day)**: every siteId-taking function in
`lib/actions/supabase.actions.js` and `pagesOverview.action.js`'s
`getSitePagesOverview` now calls `requireSiteAccess(siteId)` first too —
the full two-layer design (app-layer check + RLS backstop) is consistent
across every table in this file, not just the ones added since this
section was first written.