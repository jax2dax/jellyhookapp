# Main chart: architecture

## Files

```
main-chart/
  overview.md                 what x and y mean
  index.ts                    public exports
  types.ts                    OnlineSpan, SpanPayload, EventTimeline, ComputedSeries, MarkerLayer/Event/Payload
  theme.ts                    every color/size/constant (light + dark), marker sizes and colors
  engine/
    intervals.ts              interval list, bucket alignment (local hour/day for >= 1h)
    buildTimeline.ts          spans -> sorted +1/-1 events with running totals
    computeSeries.ts          events + view -> points (peak per bucket, or per pixel column); valueAt()
    computeTrend.ts           events + view -> Trend points (only where the count changed, bucket average)
    markers.ts                marker events + the computed line -> where each marker lands (pure)
  data/
    spanStore.ts              per-site in-browser store: spans + marker layers, what's loaded, live polling, clock skew
  components/
    MainChart.tsx             uPlot host + controls (Live / Custom range, intervals, pan/zoom, marker checkboxes)
lib/actions/mainChart.action.ts   the only code that reads the database for this chart
lib/actions/site-management.actions.js   acceptInvite now records site_members.joined_at
app/platform/dashboard/page.jsx   renders <MainChart siteId={site.id} /> under the key stats
```

Same layering idea as `framePlate/`: raw data in, pure geometry in the
middle, rendering at the edge. The engine never knows about React, uPlot or
Supabase. Its correctness is tested on its own (see "Verification" below).

## The four layers

```
 Postgres `page_views`        id, entered_at, left_at   (no heartbeat column; see "Why two queries for live")
        |  server action, raw rows only, paginated
        v
 SpanStore (browser)          Map<id, {start, end}>  + which time ranges are fully loaded
        |  rebuilt only when data changes
        v
 EventTimeline                sorted times[], deltas[] (+1/-1), cum[] (running count)
        |  recomputed every frame: pan, zoom, interval change, clock tick
        v
 ComputedSeries -> uPlot      xs[], peak[], low[]  (at most one point per pixel column)
```

Spans come from `page_views`, not `sessions` — see overview.md, "Online
means a page is actually open," for why. A session can stay open across a
visitor leaving the site entirely and coming back later; a page view
can't.

**Why the browser does the math.** Only three columns per page view cross
the network. Every interval change, pan, zoom and clock tick is computed
locally from what's already loaded, so none of them ever cost a database
query. The same split is used across the rest of the app: cache raw rows,
derive everything else.

## How a bucket's value is computed

`buildTimeline` turns every page view into a +1 at `entered_at` and a -1
at `left_at`. Open page views get no -1, so they count through now. Events
are sorted (ends before starts at the same instant), with a running total.

`computeSeries` then walks buckets left to right:

- **A bucket with events in it:** its value is the highest running total
  reached inside it, including its value at its first instant.
- **A run of buckets with no events:** every one of them equals the current
  count. The whole run is handled in one step, not bucket by bucket.

That second rule is what makes it cheap. Cost grows with *events in view +
points drawn*, not with the number of buckets. When there are more buckets
than pixels, each point covers several buckets and keeps their highest and
lowest value (see overview.md, "When the window is wider than the screen").

A few edge rules are guaranteed and tested:

- a visit shorter than the interval still shows;
- a zero-length page view still counts for 1ms;
- a page view that started before the window counts from the window's first bucket;
- a bucket that would start before the loaded data is skipped, never drawn half-empty.

## How a Trend point is computed

`computeTrend` runs over the same event timeline, so switching to Trend
costs no request.

- **Which buckets get a point:** only buckets with at least one event
  (an arrival or a departure). Empty buckets get nothing, so the curve
  runs straight across them.
- **Its value:** the time-weighted average number online across that
  bucket. A visitor present for 5 of 10 seconds adds 0.5.
- **The ends:** the first point is the last change *before* the view, and
  the last point is the first change *after* it (or "now", at the real
  current count). If nothing ever happened before the view, the line is
  flat at 0 until the bucket just before the first change. Anchoring the
  ends on real changes, never on the view's edges, is what keeps the line
  identical while panning; a test checks two different views agree point
  for point.
- **More changes than pixels:** the change points sharing one pixel
  column are averaged into one. The two outside anchors are kept as-is.
- **The curve:** the same monotone cubic as Smooth, so it can't overshoot
  between two changes.

## Data fetching: where and what

Every query lives in `lib/actions/mainChart.action.ts`. Each one calls
`requireSiteAccess(siteId)` first. Page views and form submissions are read
with the Clerk-JWT Supabase client, so RLS applies on top. `site_members`
is service-role only under RLS, so it's read with the service role, after
the access check, filtered to that one site.

| Function | What it reads | Used for |
|---|---|---|
| `getActivityBounds` | `page_views`: earliest and latest `entered_at` for the site | left edge of live mode; how far the chart opens (see ui-ux.md, "Opening view") |
| `getOnlineSpans(from, to)` | `page_views` `id, entered_at, left_at`: `entered_at` in [from, to) **plus carry-in** (entered up to 24h before `from`, `left_at >= from` or null) | loading any time range |
| `getMarkerEvents(conversions, from, to)` | `form_submissions` `id, submitted_at, name, email`: `submitted_at` in [from, to) | loading conversion markers for a range |
| `getMarkerEvents(teamJoins)` | `site_members` `id, user_email, role, created_at, joined_at`: `status = 'active'` | the team list, whole (a handful of rows) |
| `getLiveSpanUpdates(since, openIds, markerSince)` | page_views: `entered_at >= since` **plus** `id in openIds` (batches of 100); and, for each switched-on layer, conversions with `submitted_at >= that layer's since`, or the whole team list | live refresh every 15s, all in **one** server call |

All range queries page through results 1,000 rows at a time. PostgREST stops at
1,000 rows per request by default without any error, so a query that
doesn't page just quietly loses data.

**Carry-in** is what lets a range be drawn on its own. It covers page
views that began before the range but were still open inside it. The
24-hour lookback keeps that query to an index range instead of the site's
whole history. A page view left open that long (someone just leaving a
tab on a page) is unusual but not impossible, unlike a session, which the
idle-timeout sweep would have closed long before — so this stays
generous rather than tuned tight to a typical visit length.

**Why two queries for live.** Unlike `sessions`, `page_views` has no
heartbeat column (`last_activity_at`) — nothing bumps on an open page
view just because the visitor is still there. So `entered_at >= since`
only ever catches *new* page views, never a close. Every page view the
browser still holds as open is therefore re-read by id on every poll,
which is how both a normal close and a sweep-backdated close (see
`closeStaleSessions.js`) get picked up. This exact case is covered by a
test.

## Indexes (run this once)

`page_views` has no composite index on `(site_id, entered_at)` today.
Every query above filters on it.

```sql
create index if not exists page_views_site_entered_idx
  on public.page_views using btree (site_id, entered_at);

-- conversion markers: range and live queries filter by site + submitted_at
create index if not exists form_submissions_site_submitted_idx
  on public.form_submissions using btree (site_id, submitted_at);

-- team-joined markers: the real moment an invite was accepted
alter table public.site_members add column if not exists joined_at timestamp with time zone null;
```

None of these block a deploy. Everything works before they run; the
indexes make it fast, and `joined_at` makes team-join times exact.

The first index serves `getActivityBounds`, `getOnlineSpans` and the
carry-in. The open-ids lookup uses the primary key.

## Efficiency and cost per business

Measured on this code (Node 24, see "Verification"):

| Work | Size | Time |
|---|---|---|
| `computeSeries` (runs every frame) | 2.5M buckets (5s over 5 months), 100k page views, 1,500 px | ~9 ms |
| `buildTimeline` (runs once per data change) | 100k page views | ~125 ms |

**Network and database**, per open dashboard tab:

- **Opening the chart:** 1 query for the first page view, then 2 queries
  (range + carry-in) for the last ~2 hours. For a typical small business
  that's a handful of rows.
- **Live, while the tab is visible:** one server action every 15s, which is
  1 query plus one per 100 open page views. About **240 calls per open hour**.
  Polling stops when the tab is hidden and catches up immediately when it
  comes back.
- **Scrolling back:** one request each time the left edge passes what's
  loaded, prefetching one extra screen. Ranges are never fetched twice.
- **Payload:** about 70 bytes per page view (columnar JSON).
- **Markers:** nothing while their checkboxes are off. Switched on, each
  adds one small query *inside the same 15s server call* (new conversions
  since the last poll; the team list, a handful of rows). The number of
  server calls doesn't change, only a few rows ride along. Ticking a
  checkbox loads that layer once for what's on screen (plus one screen
  back), and later scrolling fetches only the missing stretch, like
  page views.

**What this means at scale.** Live polling is the cost that grows with your
customer count. It scales with *open dashboards*, not with their traffic. Ten
businesses each keeping the dashboard open 8 hours a day is about 576k
server-action calls a month. Your traffic report flagged Vercel Hobby's 1M
monthly invocations as a ceiling, so this matters. The knobs, in order of
impact:

1. `POLL_MS` in `MainChart.tsx` (15s): 30s halves it.
2. Share one poll across tabs (the LiveTicker localStorage pattern).
3. Supabase Realtime instead of polling. That needs an RLS-safe channel
   design, since `sessions` isn't client-readable.

### Why it fetches only what changed: the numbers

The question: is refetching every page view each time the same as
fetching once, storing it, and then only asking for what's new? It is
not. Measured row sizes: **140 bytes** per page view from Postgres to the
server, **67 bytes** from the server to the browser.

Example: a site with 20,000 page views of history (about 500 a day for
six weeks), one dashboard tab open for one hour, polling every 15s (240
polls).

| | A: refetch everything every poll | B: load once, then only changes (what's built) |
|---|---|---|
| Rows per poll | 20,000 | ~5 (page views entered in the last ~15s) + currently-open ids |
| DB requests per poll | 20 (1,000-row pages) | ~2 (entered-since + open ids) |
| DB requests per hour | 4,800 | ~480 |
| DB -> server per hour | ~672 MB | ~0.2 MB |
| Server -> browser per hour | ~322 MB | ~0.1 MB |
| Time per poll | seconds (20 sequential pages) | one fast round trip |
| As history grows | gets worse every day (a year in: ~6 GB per open hour) | stays flat: depends on current activity only |

So B uses about **10x fewer database requests** and over **3,000x less
data** here, and the gap keeps widening as history grows. The number of
server-action calls is the same in both (one per poll). What differs is
the work and bytes behind each call.

**"Only fetch page views that started after time X" is not enough on its
own.** A page view that's still open needs to be re-checked for whether
it has closed since, and `page_views` has no heartbeat column to filter
a "touched since" query by. That's why each poll asks for rows *entered*
since the last poll, plus re-reads every page view still held as open by
id, and not for "entered after X" alone.

**Saving it to the browser (localStorage) on top of B.** B already avoids
refetching the whole history. Even right after a full reload, it loads
only the visible window: about two hours, or ~42 rows (~3 KB) at this
traffic. Persisting would only save that small first load, plus any
history someone scrolled back through before reloading. It would cost:

- part of the ~5 MB storage quota shared with the app's other caches;
- parsing megabytes on the main thread at every page load;
- a revalidation of open sessions on every load anyway.

Not worth it today. IndexedDB is the right tool if "scroll a month back
after every reload" ever becomes common.

**One wasted cost found and fixed while checking this.** The browser
rebuilt its whole event timeline twice per poll, even when the poll
returned nothing new: the store's change counter also bumped when a
request started or finished. Spans now carry their own counter that only
moves when a row actually changes, so a quiet poll costs no rebuild. CPU
only, never a database cost.

**Big sites, all-time views.** Zooming out to "all time" downloads every
page view in that range: about 7 MB at 100k page views. Fine for small
and mid-size sites. The upgrade path when a site outgrows that:

1. A Postgres function that returns per-bucket peaks instead of raw rows,
   for windows too wide to need individual page views.
2. A per-minute rollup table storing *peak visitors per minute*. Because a
   peak of peaks is still the exact peak, it answers every interval of 1m
   and up **exactly**. This only works because the chart uses peak, not
   average. Raw spans would then only be needed for 5s/10s/30s on recent
   windows.

The engine wouldn't change for either. Only where the numbers come from.

**Memory (the browser-side store).** The store lives at module level, one
per site, holding online spans and every marker layer. It survives moving
between dashboard pages but not a full reload. It deliberately does not
use localStorage: a few MB of spans would compete with the other caches
for the ~5MB quota, and parsing it would block the main thread on every
load. IndexedDB is the right home if persistence across reloads is ever
needed. See data-flow.md, section 6, for exactly what this saves.

## Flexibility: what can change without touching the engine

- **Intervals:** add or remove entries in `engine/intervals.ts`.
- **Colors, sizes, zoom limits, provisional window:** `theme.ts`.
- **Default zoom:** `DEFAULT_BUCKETS_IN_VIEW` (360 buckets: 10s gives 1h, 1m gives 6h).
- **Poll rate:** `POLL_MS`.
- **Line style:** Smooth / Steps pick a path at draw time (`linePath` in
  `MainChart.tsx`) over the same peak data. Trend swaps the computation
  (`computeTrend` instead of `computeSeries`) and reuses the smooth path.
  A new style is one entry in `LINE_STYLES` plus either a path builder or
  a compute function.
- **Conditional line color:** the line, fill and band are drawn from a
  function, `zoneStyle` in `MainChart.tsx`. Today it splits by time
  (history vs. the provisional last 30 minutes). Any other condition is a
  different set of color stops: by value (a vertical gradient above a
  threshold), or by marked time ranges (one stop pair per range).

## Varieties

| | Live (variety 2) | Custom range (variety 1) |
|---|---|---|
| Window | `[now - span, now]`, moves every second while pinned | fixed `[from, to]` |
| Pan/zoom | drag; pinch or +/- buttons; clamped to `[first page view, now]` | none |
| Loading | on demand as you pan left | the whole window at once |
| Polling | yes | only if the window reaches the last 30 minutes |

Both use the same store, so a custom window over a range already loaded
in live mode costs nothing.

## Marker layers (built)

Events from other tables, drawn on top of the online line and never
changing it. Two layers today, each off until its checkbox is ticked:

| Layer | Source | Drawn as | Time used |
|---|---|---|---|
| Conversions | `form_submissions.submitted_at` (every submission, same as the Leads page) | yellow dot **on the line** | snapped forward to the next point |
| Team joined | `site_members` of **this site**, `status = 'active'` | full-height vertical line | exact moment: `joined_at`, else `created_at` |

Team joins deliberately don't use `users.created_at`. `users` is
Jellyhook's own global signup table: on a customer's chart it would show
when *other businesses* joined Jellyhook, which leaks their data and means
nothing to that customer.

**How the layers coexist with the line.** Four separate pieces, each with
one job:

1. **Data, kept apart.** `SpanStore` holds each layer in its own map, with
   its own loaded ranges and its own live cursor, completely separate from
   the online spans. Turning a layer on or off never touches that data,
   so the line can't change because of a marker.
2. **Placement, pure.** `engine/markers.ts` takes the layer's events plus
   the series *already computed for the line* and returns positions:
   - **Conversions** snap forward to the next point:
     `alignUp(t, interval, offset)` on the same bucket grid the line uses.
     A form submitted at 10:43 on the 5s chart lands on the 10:45 point;
     exactly 10:45 stays at 10:45.
   - In Smooth/Steps the dot's height is that point's own value. In Trend
     the point may fall between change points, so its height is computed
     on the drawn curve itself (`monotoneCubicAt`: the same Fritsch-Carlson
     construction uPlot uses), so the dot sits exactly on the line in
     every style.
   - A conversion whose next point hasn't happened yet waits at "now",
     the line's live end.
   - Several conversions on one point become one dot with a count above it.
   - In envelope mode, they snap to the first pixel column at or after
     the point.
3. **Drawing.** In uPlot's `draw` hook, after the series, so markers are
   always on top. Vertical lines first (translucent), then dots (each with
   a thin ring in the card's background color so it stays readable over
   the line and fill).
4. **Hover.** A marker within 8px of the cursor takes over the readout
   line: "2 conversions on the 10:45:05 point: Jane Doe, john@x.com", or
   "amy@x.com joined the team · Oct 1, 10:42:13".

**Adding another layer later** (for example a custom event table):

1. A key in `MarkerLayer` (`types.ts`).
2. A query in `getMarkerEvents` + `getLiveSpanUpdates` (`mainChart.action.ts`).
3. An entry in `MARKER_LAYERS` (`MainChart.tsx`).
4. A color in `theme.ts`.

Placement, loading, polling and hover are generic over layers.

## Verification

- **Engine:** the documented examples, edge cases, and 40 randomized
  comparisons against a brute-force reference in both bucket and envelope
  modes. All pass.
- **Trend:** the 2:30 am / 9:30 pm example, pan stability (two views agree
  point for point), bursts, half-bucket averages, anchors past both
  edges, and pixel decimation. All pass.
- **Store:** tested against a mocked database that mirrors the real
  queries: first load + carry-in, merging ranges, no refetching, live
  arrivals, sweep-closed backdated page views, clock-skew correction,
  windows before the first page view, disjoint windows, an empty site
  getting its first visitor, and the away-gap case itself (a visitor's
  page view closes, the count bumps down, a later page view reopens it
  and the count bumps back up). All pass.
- **Markers, placement:** 10:43 -> 10:45 snapping, exactly-on-a-point,
  grouping, waiting at "now", events before the view not pulled in,
  envelope columns, the Trend curve passing through its points and never
  overshooting, dots exactly on the Trend curve. All pass (testing caught
  two real bugs here before they shipped).
- **Markers, store:** loads only the requested range, never refetches a
  loaded range, scrolling left fetches only the missing stretch, live
  conversions arrive in the same single poll call, a layer switched off
  for a while catches up when switched back on, the team list loads once
  and a removed member disappears. All pass.
- **Not yet verified:** the UI in a real browser.
