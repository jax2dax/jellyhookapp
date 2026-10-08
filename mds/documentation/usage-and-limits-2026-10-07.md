# Usage, storage and event limits (2026-10-07)

For developers. What a tracked event costs, the measured storage numbers for
the new columns, and how to turn that into event limits. The live version of
all this, for your own site and database, is the page `/dev/usage`.

## Why the limit number left Settings

`sites.monthly_event_limit` (10,000) was shown in Settings but never enforced
and never derived from anything. Showing it implied a promise. It is no longer
displayed. The column still exists; `/dev/usage` is where limits are worked out
from measurements.

## What is counted

`site_usage_daily`, one row per site per UTC day, added to after each request
(after the response, so a counter failure never loses an event):

| Column | Counts |
|---|---|
| `requests` | tracker POSTs received (one request can carry several events) |
| `events` | events accepted for storing |
| `session_starts`, `session_ends`, `page_view_starts`, `page_view_ends`, `clicks` | by event type |
| `forms`, `engagement`, `structure` | one per request to the lead, engagement and structure routes |
| `dropped` | rejected before storing: invalid ids, a host the site does not accept, an expired claim, an inactive site, specify-form mismatch |
| `bytes_in` | request body size, from `Content-Length` |

Bots are dropped before the site is looked up, so they are not counted anywhere (they cost
one request, no database work). Counters start from the first request after the migration and
the new code are live.

## What one event costs the database

An "event" here is one tracker event. A normal visit with three pages is about seven:
`session_start`, three `page_view_start`, three `page_view_end` (plus a heartbeat per 5 minutes).

| Event | Rows created | Queries |
|---|---|---|
| `session_start` | 1 `sessions` (+ a `visitors` row for a new visitor) | 4 |
| `page_view_start` | 1 `page_views` | 3 |
| `page_view_end` | none (updates a row) | 2 |
| heartbeat | none | 1 |
| click | 1 `click_events` | 3 |
| form (lead) | 1 `form_submissions` | 3 |
| engagement | about 0.15 `form_engagement` per event (modelled) | 3 |
| structure | about 0.02 `page_structure_versions` per event (modelled) | 4 |

Every request also pays two queries (site lookup, usage counter), shared by all events in it.
Source of truth for these: `EVENT_KINDS` in `lib/tracking/costModel.js`.

## Measured: the cost of the new columns

`npm run bench:storage` builds the tables exactly as in `mds/database.md` in a real Postgres
(PGlite), fills them with realistic rows, applies the migration, and measures. 20,000
visitors, 100,000 page views, run on 2026-10-07. Sizes are real Postgres sizes, table plus
indexes. Timings are PGlite (WebAssembly): trust the ratio, not the milliseconds.

| Table | Before, per row | After, per row | Change |
|---|---|---|---|
| `page_views` | 619 B | 653 B | **+34 B (+5.4%)** |
| `visitors` | 199 B | 401 B | **+202 B** (about 2x, per visitor, not per event) |

Where the bytes go:

| Column | Average width | Filled |
|---|---|---|
| `ip_hash` | 65 B | always |
| `first_referrer` | 25 B | 70% |
| `first_utm_source` / `medium` / `campaign` | 7 / 4 / 17 B | 25% / 25% / 20% |
| `first_landing_path` | 9 B | always |
| `first_touch_at` | 8 B | always |
| `viewport_width` | 4 B | always |
| `device_class` | 7 B | always |
| `structure_id` | 16 B | always |

- `page_views` grows by 34 B because of three small columns, the largest being `structure_id`.
- About half of the `visitors` growth is the unique index on `(site_id, visitor_id)`,
  about 103 B per visitor. It is what makes the visitor upsert possible and removes the race
  that created duplicate rows.
- The raw IP column is no longer filled (about 12 B saved per visitor); `ip_hash` is bigger
  than an IP. A 128-bit truncation (32 hex characters) would save about 32 B per visitor; not
  done, a full hash is stronger and visitors are few compared with page views.
- **An index was removed because of this measurement.** A `(session_id, entered_at)` index on
  `page_views` cost about 88 B per row, 74% of that table's growth, and the existing
  `session_id` index already serves every lookup by session. It is not in the migration.
- Write speed: inserting 100,000 page views took 6.0 s before and 6.4 s after (**+6%**), within
  run-to-run noise. Looking up a visitor by `(visitor_id, site_id)`: 8.1 ms before (no index,
  full scan of 20,000 rows) and 1.7 ms after, and the old code did that lookup on every event.

Other rows the new code writes (per row, table plus indexes): `sessions` 351 B, `click_events`
275 B, `page_structure_versions` about 1.4 KB (eight headings, one row per distinct structure,
capped at 50 per page per device class, so a few KB per page at most).

## Per event, real numbers

A visit with three pages by a new visitor: one `visitors` row (401 B) + one `sessions` row
(351 B) + three `page_views` rows (3 x 653 B) = about **2.7 KB for 7 events: about 390 B per
event**. A returning visitor: about 2.3 KB, about 330 B per event. So roughly:

| Events | Stored |
|---|---|
| 1,000 | about 0.35 MB |
| 1,000,000 | about 350 MB |
| 10,000,000 | about 3.5 GB |

This is table plus index size only. It leaves out write-ahead log, backups and the
bloat from updates (each `page_view_end` and heartbeat rewrites a row), so budget about 1.5x.
`/dev/usage` computes the same thing from your own event mix and your database's real row sizes.

## Setting limits

1. Decide the storage budget (what your Supabase plan includes, for the database), how long data
   is kept, how many sites share it, and the headroom to leave free (30% is sensible).
2. Per-site events per month = `budget x (1 - headroom) / (bytes per event x months kept) / sites`.
   `planCapacity` in `lib/tracking/costModel.js`, in the calculator on `/dev/usage`.
3. The compute limit is separate: function calls per month (Vercel) divided by requests per
   event. The tracker sends one event per request today (it does not batch), so calls per month roughly equal
   events per month. Batching events in the tracker lowers the calls per event; that, not storage, is
   what moves this limit.
4. The usable limit is the smaller of the two. Set the plan tiers above it.
5. Levers if the numbers are too tight: keep data for fewer months; thin out heartbeats and old
   structure rows; drop `device_class` (derivable from `viewport_width`, 7 B per page view);
   archive closed sessions older than N months.

Plan sizes and prices change: the calculator takes them as inputs and never assumes them.

## The page

`/dev/usage` (`app/dev/usage/page.tsx`, `components/dev/UsageLab.tsx`). In development any
signed-in user; in production only Clerk user ids in `DEV_USAGE_USER_IDS`, everyone else gets a
404. It shows the last 30 days for the selected site, per-kind cost, whole-database table sizes
(`jh_storage_report`), the new columns' widths (`jh_column_report`), and the calculator. If the
migration has not been run it says which function is missing.
