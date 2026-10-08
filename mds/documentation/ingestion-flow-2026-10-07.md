# Ingestion flow and what gets saved (2026-10-07)

For developers. How a tracker event becomes rows in the database, route by
route, and every table and column involved. Tracker side:
`mds/documentation/tracker-spec-2026-10-07.md`. Audit:
`mds/reports/tracker-backend-audit-2026-10-07.md`.

## The path of one request

```
browser (customer's site)
  POST /api/track            text/plain, JSON array, api_key in the body
        |
  [1] reject early      body over 64 KB, bad JSON, not an array, unknown event types,
        |               more than 25 events (extra ignored), bot user agent  -> 200 or 4xx, no DB
  [2] find the site     sites where api_key = key OR previous_api_key = key
        |               evaluateKey(): current key ok; previous key ok until its deadline
        |               unknown / retired key -> 403
  [3] decide            decideIngest(site, host): inactive, host not allowed, claim expired
        |               -> dropped silently (200), counted, reason remembered
        |               host = browser Origin header first, then body host, page_url, Referer
  [4] site effects      verified (if first event from its own host), new_key_first_hit_at,
        |               last_event_at (at most once a minute), unmatched host/count
  [5] write events      visitor upsert, then per event: session / page view / click / health
        |
  response 200          { success: true }
  after() response:     usage counters (jh_usage_add RPC), idle sweep (at most every 5 min)
```

The same steps 2 to 4 (`authorizeRequest` + `applySiteEffects` in
`lib/tracking/server.js`) run in `/api/track-form`, `/api/track-form-engagement`
and `/api/track-structure`. `/api/site-config` only needs the key.

Code map:

| Concern | File |
|---|---|
| Request handling, per-event writes | `app/api/track/route.js` |
| Leads | `app/api/track-form/route.js` |
| Form engagement | `app/api/track-form-engagement/route.js` |
| Structure versions | `app/api/track-structure/route.js` |
| Auth, validation helpers, site effects, usage flush | `lib/tracking/server.js` |
| Host rules | `lib/tracking/hosts.js` |
| Key rotation | `lib/tracking/keys.js` |
| Accept / verify decision | `lib/tracking/verification.js` |
| Structure fingerprint, version guard | `lib/tracking/structure.js` |
| IP hash, country | `lib/tracking/ip.js` |
| Idle sweep | `lib/tracking/sweep.js`, SQL `jh_close_stale()` |
| Usage counters | `lib/tracking/usage.js`, table `site_usage_daily` |

## Per event: what is written

Every event first needs a valid `visitor_id` and `session_id` (8 to 64 url-safe characters).
Strings are trimmed to a length, numbers clamped to a range (`cleanStr`, `cleanNum`,
`cleanTime`); anything else is dropped.

| Event | Writes |
|---|---|
| any (once per visitor per request) | `visitors` upsert on `(site_id, visitor_id)`, ignoring duplicates; then a conditional update of `last_seen`, `device_type`, `ip_hash` only if `last_seen` is over a minute old. First-touch columns are written once, only when the event carries `is_first_visit` |
| `session_start` | `sessions` insert, or for an existing `session_id` of this site: `last_activity_at = now`, `ended_at = null`. **Never closes another session** |
| `session_end` | sets `ended_at` (= now minus `ended_ago_ms`) if not already set, then closes the session's open page views and abandons its open forms at that time. Ignored if the session is under 5 seconds old and no end time was given (old trackers) |
| `heartbeat` | `sessions.last_activity_at = now`, `ended_at = null` |
| `page_view_start` | reopens the session (same update as heartbeat), then `page_views` insert with `viewport_width`, `device_class`, `structure_id` (newest version for that page and device class, cached 60 s per instance). A duplicate key means the end arrived first: fill in the path, title and structure |
| `page_view_end` | update by `page_view_id` and `site_id`: duration, scroll fields, `left_at`. No matching row: insert a placeholder. Then `last_activity_at` on a still-open session |
| `click` | `click_events` insert; stamps `tracking_health.last_event_at` for `click_attr` |
| `health` | `tracking_health` upsert per check (`details`, `last_seen_at`) |

Reopening matters: the idle sweep can close a session a moment too early (a long quiet read
before the first heartbeat). The next page view or heartbeat sets `ended_at = null` again.

## Tables

New in the 2026-10-07 migration are marked **new**. All other columns are as in `mds/database.md`.

### `visitors`

New: `ip_hash`, `first_referrer`, `first_utm_source`, `first_utm_medium`,
`first_utm_campaign`, `first_landing_path`, `first_touch_at`. Unique index
`visitors_site_visitor_key (site_id, visitor_id)`.

`ip_address` is now written only when no country is available from the platform header
(it is the input to the fallback lookup), and is set to null again once the lookup is
done. `ip_hash` is `HMAC-SHA256(ip, IP_HASH_SALT)`; null if the salt is not configured.
First-touch columns are set once, from the visitor's first session, and never overwritten.
Existing visitors have them null (unknown, not "direct").

### `sessions`

Unchanged columns. Semantics changed: a session now ends only by idle; `ended_at` is set by
the tracker's idle `session_end` or by the sweep; `last_activity_at` moves with every page
view event and heartbeat. `country` is set at insert from the platform header when present.

### `page_views`

New: `viewport_width` (int), `device_class` (`desktop` | `mobile`, from the width: under 768
is mobile), `structure_id` (uuid, references `page_structure_versions`, null on delete).
No new index on purpose (see the migration comment and the usage doc).

### `page_structure_versions` (new)

`site_id, page_path, device_class, fingerprint, headers jsonb [{i,text,tag,y}], page_height,
text_stats (reserved), first_seen_at, last_seen_at, seen_count`. Unique on
`(site_id, page_path, device_class, fingerprint)`. Backfilled from `page_structure` with
fingerprint `legacy`. RLS: members of the site can select.

### `page_structure`

Kept: equal to the newest desktop version, for readers that need the current page only.

### `click_events` (new)

`site_id, visitor_id, session_id, page_view_id, page_path, name, clicked_at`. Indexes on
`(site_id, clicked_at)` and `(site_id, name)`.

### `tracking_health` (new)

`site_id, page_path, check_key (conversion_form | field_attr | click_attr), details jsonb,
first_seen_at, last_seen_at, last_event_at`. Unique on `(site_id, page_path, check_key)`.
`details` is what the tracker found; `last_event_at` is the last real event that check
produced, the proof it works.

### `site_usage_daily` (new)

One row per site per UTC day: `requests, events, session_starts, session_ends,
page_view_starts, page_view_ends, forms, engagement, structure, clicks, dropped, bytes_in`.
Written with the `jh_usage_add(site, day, jsonb)` RPC (adds, atomically). No read policy:
only the developer usage page reads it, with the service role.

### `sites`

New: `previous_api_key`, `previous_key_expires_at`, `key_rotated_at`, `new_key_first_hit_at`,
`allowed_hosts text[]`, `last_event_at`, `last_unmatched_host`, `last_unmatched_at`,
`unmatched_count`, `claim_started_at`. Partial unique index
`sites_verified_domain_key` on `lower(domain)` where `verified` and not deleted: one verified
site per domain. See `mds/documentation/sites-keys-roles-2026-10-07.md`.

### Database functions (new)

| Function | Purpose |
|---|---|
| `jh_usage_add(p_site, p_day, p jsonb)` | add counters to `site_usage_daily` |
| `jh_close_stale(p_idle default '30 minutes')` | the idle sweep as one statement: closes sessions, their open page views, abandons stale forms; returns counts |
| `jh_storage_report()` | table sizes and estimated rows, for `/dev/usage` |
| `jh_column_report(tables[])` | average column widths and null shares, for `/dev/usage` |

All are `security definer` and granted to `service_role` only.

## The idle sweep

`jh_close_stale()` closes sessions with no activity for 30 minutes, dated to the last real
activity (the latest page view's `left_at` or `entered_at`, else the session's `last_activity_at`), closes
their open page views at the same time, and abandons forms whose last activity is over 30
minutes old. It runs: after tracker traffic, at most every 5 minutes per server instance
(`lib/tracking/sweep.js`); from `GET /api/close-stale-sessions` with `CRON_SECRET`; and
optionally from pg_cron every 5 minutes (migration section 7). Before the migration is run it
falls back to the older per-session code (`lib/closeStaleSessions.js`).

## What the dashboard reads

- **Replay (frames).** `lib/leadSessions/transform.js` builds sessions from `sessions`,
  `page_views`, `form_engagement` and structure rows. Structure rows now come from
  `lib/leadSessions/structureRows.js` as every version of each page (legacy-shaped rows
  tagged with version id); `resolveStructureVersion` picks one per visit. A session with no
  `ended_at` whose last activity is over 7 minutes old is drawn as ended, its open page views
  closed at that last activity (`LIVE_WINDOW_MS`).
- **Main chart "online".** Counts open `page_views` (unchanged); correctness of open rows now
  rests on page views closing at idle, on `pagehide`, and on the sweep.
- **Settings, Tracking.** `getIngestionStatus` in `lib/actions/settings.actions.js`.

## Environment variables

| Variable | Needed for |
|---|---|
| `IP_HASH_SALT` | hashing IPs. Long random string. Without it `ip_hash` stays null (the code never hashes with an empty salt). Do not change it later: hashes would stop matching |
| `CRON_SECRET` | enables `GET /api/close-stale-sessions` (send `Authorization: Bearer <secret>`) |
| `DEV_USAGE_USER_IDS` | production only: comma-separated Clerk user ids allowed into `/dev/usage` |

## Running the checks

```
npm run test:tracking       pure rules (hosts, keys, claims, structure, permissions, health, cost model, replay)
npm run test:tracking-sql   the migration on a real Postgres, twice; RLS; sweep; usage RPC
npm run bench:storage       measured storage and write cost of the new columns
node scripts/tracker-e2e/run.js   real Chrome against a mock server (npm i --no-save puppeteer-core first)
```
