# Local browser storage schema (localStorage / sessionStorage)

Every place this codebase reads or writes `localStorage`/`sessionStorage`, and what's
in each key. Two completely separate browsers are involved — keep them apart:

1. **The SaaS dashboard** (`app/`, `components/`, `lib/`) — storage lives in the
   browser of a *jellyhook customer* using their own dashboard (e.g. viewing
   `/platform/leads/[lead_id]`). Origin: this app's own deployed domain.
2. **The tracked site** (`public/tracker.js`) — storage lives in the browser of
   an *end visitor* browsing a jellyhook customer's website (the site that has
   `<script src=".../tracker.js">` embedded). Origin: the customer's domain,
   not this app's — this app never reads it directly, only the rows it POSTs
   to `/api/track` derived from it.

None of this is a source of truth — every key here is a cache/derived value.
The database (`mds/database.md`) is the source of truth for the dashboard's
data; the tracker's storage exists only to give one visitor a stable identity
and to throttle redundant network sends.

---

## 1. SaaS dashboard — `lib/leadSessionsCache.js`

Backs `components/leads/LeadSessionExplorer.tsx` (the FramePlate chart's data
source). Two independently-timed tiers, not one blob-level TTL — see that
file's header comment for why.

### `jh_leadsess_<visitorId>` (localStorage)

One entry per visitor being viewed on a lead profile page.

```ts
{
  fetchedAt: number, // Date.now() at write time
  data: {
    sessions: SessionRow[],        // raw sessions rows for this visitor
    pageViews: PageViewRow[],      // raw page_views rows for this visitor
    submissions: SubmissionRow[],  // raw form_submissions rows for this visitor
    hasLiveSession: boolean,       // true if any session has ended_at === null
  }
}
```

Row shapes mirror `mds/database.md` exactly (`sessions`, `page_views`,
`form_submissions`) — see `components/leads/LeadSessionExplorer.tsx`'s
`SessionRow`/`PageViewRow`/`SubmissionRow` interfaces for the exact fields kept.

- TTL is chosen at **read time**, not fixed: `SESSIONS_TTL_LIVE_MS` (15s) if
  `data.hasLiveSession` is true, else `SESSIONS_TTL_CLOSED_MS` (5min) — a
  session that's still open can change any second; a fully closed one never
  will again.
- Written: once on mount (seeded from the server-rendered initial fetch, zero
  extra network round trip) and again after every manual/auto refresh.
- Cleared: `clearCachedSessionRows(visitorId)` (not currently called anywhere
  in the UI, but exported for a future "reset" action).

### `jh_leadstruct_<siteId>` (localStorage)

One entry per site — `page_structure` (headers + page height per path) is
shared across every visitor/lead on that site, not per-visitor.

```ts
{
  fetchedAt: number,
  data: PageStructureRow[] // { page_path, header_index, header_text, position_y, page_height }[]
}
```

- TTL: fixed `STRUCTURE_TTL_MS` (30min) — page layout doesn't change moment
  to moment, and this cache only ever grows (new `page_path`s get appended,
  existing ones are trusted as-is).
- Read via a lazy `useState` initializer at mount (not an effect) so the
  first paint can use it synchronously; refetched in an effect whenever a
  page_path shows up that isn't already cached or the cache is stale.

---

## 2. SaaS dashboard — `lib/intentCache.ts`

Backs `app/platform/intent/IntentPageClient.tsx` (the Intent Failure Analysis
page).

### `jh_intent_<siteId>` (localStorage)

```ts
{
  fetchedAt: number,
  data: IntentFailureResult // see lib/algorithms/pageAnalysis.ts / lib/actions/intentFailure.action.ts
}
```

- TTL: fixed `CACHE_TTL_MS` (1 minute).
- Written on mount (seeding from server-rendered `initialData` if nothing
  fresh is cached yet) and on manual refresh (`handleRefresh`, which first
  calls `clearCachedIntent` then re-fetches and re-caches).

### `jh_devmode` (localStorage)

```
"true" | "false"  // plain string, not JSON
```

A single global (not per-site) UI toggle for a developer-facing mode on the
Intent page. Read with `getDevMode()` / written with `setDevMode()`, both of
which just compare/stringify against the literal string `"true"`.

---

## 3. Tracked site (visitor's browser) — `public/tracker.js`

This is what the tracker script itself keeps in an END VISITOR's browser on a
customer's site — never read by the SaaS dashboard directly, only indirectly
via what the tracker POSTs to `/api/track` / `/api/track-structure`.

### `visitor_id` (localStorage)

```
"<uuid>"  // crypto.randomUUID(), plain string
```

- Created once per browser (persists across tabs and sessions — localStorage
  survives closing the tab). This is the stable identity that ties multiple
  sessions from the same browser together in `visitors.visitor_id`.

### `jh_session_id` (sessionStorage)

```
"<uuid>"  // crypto.randomUUID(), plain string
```

- One per tab/window, per browsing session — sessionStorage is cleared when
  the tab closes, which is the intentional session boundary: a new tab (or a
  cleared tab) is a new `sessions` row, not a continuation of the old one.
- `isNewSession` is computed by checking for this key's ABSENCE *before*
  `getSessionId()` has a chance to create it — reversing that order would
  make every page look like a new session.

### `jh_ph_<pathname>` (sessionStorage)

One entry per page path visited in this tab, e.g. `jh_ph_/pricing`.

```ts
{
  height: number, // last-sent page height in px (document.documentElement-based, see getPageHeightPx())
  ts: number       // Date.now() when it was last sent
}
```

- Throttle cache for `page_height`, not a value cache the tracker ever reads
  back into the UI. `getPageHeightPayload()` only re-sends `page_height` to
  `/api/track` when either `PAGE_HEIGHT_UPDATE_INTERVAL_MS` (6 minutes) has
  elapsed since `ts`, or the measured height has changed by more than 50px —
  otherwise the outgoing event's `page_height` is omitted (null) and the
  backend keeps whatever it already has for that path. This is why
  `page_views.page_height` is frequently `null` in the DB on repeat visits to
  a path within the same tab within 6 minutes — that's expected, not a bug.
