# Main chart: data flow

How a page view gets from a visitor's browser into this chart, which
query runs when, and where the numbers can be briefly wrong.

## 1. Where `entered_at` and `left_at` come from

The chart reads only `page_views`, not `sessions` — see overview.md,
"Online means a page is actually open." Those two columns are written by
`app/api/track/route.js` in response to `public/tracker.js`:

| Moment | What writes it | Value |
|---|---|---|
| A page becomes visible | `page_view_start` event | new row, `entered_at` = server time |
| Tab closes / navigates away / goes idle | `page_view_end` (fires on `visibilitychange` hidden, ahead of `beforeunload` in effectively every browser) | `left_at` = server time |
| Tab crashed / killed, no `page_view_end` ever sent | `closeStaleSessions` sweep closes the session **and** any of its page views still open | `left_at` = the sweep's `endedAt` for that session |

A visitor navigating between pages on the same site produces a new
`page_view_start`/`page_view_end` pair per page — a brief, normal gap
between one page's `left_at` and the next page's `entered_at`, not a
departure. In practice this gap is sub-second, well under the chart's
finest bucket (5s), so it's absorbed without a visible flicker.

One consequence worth knowing:

- **Away time no longer counts as online.** A visitor who leaves for 10
  minutes and comes back later produces two separate page views with a
  real gap between them: `left_at` on the first, a later `entered_at` on
  the second. The chart bumps down the instant the first one closes and
  bumps back up when the second one opens — it does not assume the
  visitor is still there just because their underlying `sessions` row
  (which has its own, longer idle-timeout lifecycle — see
  `mds/database.md`) stays open across the gap. FramePlate still shows
  that same gap as a purple "away" frame; this chart now treats it as a
  real departure instead.

## 2. Ghost tabs: what the "last 30 minutes" label is about

History comes out correct. When the sweep closes a dead tab's session, it
also closes that session's still-open page view, backdated to the same
moment, so the bump-down lands where it really happened.

The issue is only **before** the sweep runs:

1. The tab dies at 10:00. No `page_view_end` arrives, so `left_at` stays null.
2. The sweep only closes sessions (and their open page views) whose
   `last_activity_at` is more than 30 minutes old. It runs piggybacked on
   `/api/track` requests (any site, 20 sessions per run), not on a timer.
3. From 10:00 until at least 10:30, plus however long until the next
   tracker request arrives anywhere, the page view is still open in the
   database. The chart, reading the database, counts it through "now".
4. When the sweep finally runs, `left_at` becomes 10:00. The chart's next
   poll picks that up and the bump retroactively drops at 10:00.

So for a stretch that is at least 30 minutes, the **right edge and the
live "open right now" number can include people who already left**. Then
it corrects itself. That's why the last 30 minutes are drawn in a
different color with a label, rather than presented as final.

Two related things:

- **`page_views` has no heartbeat column**, so the chart can't tell a
  crashed tab's open page view apart from someone genuinely still reading
  it — both just look like "still open" until the sweep (or a real
  `page_view_end`) says otherwise.
- **The "Active Now" tile is a different measure.** It counts sessions
  whose `last_activity_at` is in the last 30 seconds, which undercounts
  anyone reading a page without navigating. The chart counts open page
  views. The two numbers will differ on the dashboard, sitting near each
  other.

## 3. Lifecycle of one chart on the dashboard

```
mount (live mode, 10s interval)
  store.ensureBounds()
     -> getActivityBounds            first + latest page view entered: left edge of history, opening zoom; also serverNow
  view = last 360 buckets (1 hour), pinned to now,
         or, if nobody visited in that hour, wide enough to include the latest visit
  store.ensureRange(view start - one screen, Infinity)
     -> getOnlineSpans(now-2h, now+1h)   range + carry-in, paged  (example for the 1-hour view)
     -> covered = [now-2h, Infinity), live cursor = serverNow
  draw

every 1s (no request)
  now moves; if pinned, the view slides with it; recompute + draw;
  "open right now" = valueAt(now)

every 15s, tab visible, view reaches now
  getLiveSpanUpdates(cursor - 30s, openIds)
     entered since last poll   -> new page views
     re-read every open id     -> page views closed normally or by the sweep (backdated)
  merge by id, cursor = serverNow, rebuild timeline, draw

tab becomes visible again, or the dashboard is opened again
  poll immediately (catches up from the old cursor, nothing is skipped)

drag left / zoom out past loaded history
  store.ensureRange(viewFrom - one screen, Infinity)
     -> only the missing piece is fetched; ranges merge into one
  unloaded area is shaded, never drawn as zero

custom range [a, b]
  store.ensureRange(a, b)        or (a, Infinity) if b reaches now
  anything already loaded is reused
```

All requests go through one queue per site, so two overlapping requests
never fetch the same range twice.

### Marker layers

```
tick "Conversions"
  store.ensureMarkers("conversions", view start - one screen, Infinity)
     -> getMarkerEvents: form_submissions in that range (only what was never loaded)
     -> its own live cursor starts at serverNow
  every redraw: placePointMarkers(conversions in view, the line's series) -> dots

tick "Team joined"
  store.ensureMarkers("teamJoins")  -> getMarkerEvents: this site's active members, whole list, once
  every redraw: eventsInView(...) -> vertical lines

drag left / zoom out (conversions on)
  same "missing stretch only" load as page views, for conversions too

every live poll (same single server call as page views)
  for each TICKED layer: conversions submitted since that layer's own cursor,
  or the whole (tiny) team list, which replaces the old one, so removed
  members disappear

untick
  the layer stops being drawn and stops being polled. Its data stays in
  memory. Tick it again: the next poll catches up from where its cursor
  stopped, so nothing that happened while it was off is missed.
```

Conversion markers never feed into online spans, and online-span data
never feeds into markers. The only thing they share is the computed line,
which the marker code reads to know where to put a dot.

## 3b. What does and doesn't hit the database (audited)

| Action | Database request? |
|---|---|
| Clock tick (every second), "now" moving | no |
| Hover | no |
| Pan or zoom over already-loaded time | no |
| Pan or zoom past loaded history | yes, once, for the missing stretch only (plus one screen ahead) |
| Change interval | no |
| Switch Smooth / Steps / Trend | no |
| Switch to a Custom range already loaded | no |
| Switch to a Custom range not loaded | yes, once, for the missing part |
| Live poll (every 15s, tab visible, view reaches now) | yes: rows touched since the last poll + still-open ids. Never the whole history. |
| Leave the dashboard and come back (same browser tab) | one catch-up poll; everything else is reused from memory |
| Full page reload | first-session time + the visible window (~2 hours), then polling |
| Tick a marker checkbox | yes, once: that layer for what's on screen + one screen back (team list: whole, once ever) |
| Untick / re-tick a marker checkbox | untick: no. Re-tick: no load (already in memory), the next poll catches up |
| Live poll with markers ticked | no extra call: a few rows ride along in the same 15s call |
| Hover a marker | no |

In short, after the first load the only recurring cost is the small live
poll. See architecture.md, "Why it fetches only what changed", for the
numbers against refetching everything.

## 4. Inside the browser

```
SpanPayload {ids[], starts[], ends[]}        columnar, epoch ms
   -> SpanStore.merge                         Map<id, {start, end}>, last write wins
   -> SpanStore.timeline()                    buildTimeline, rebuilt only when a span actually changed
   -> computeSeries(...)  Smooth / Steps      or  computeTrend(...)  Trend
        (timeline, view, now, dataFrom, interval, plotWidth)
   -> uPlot.setData([xs, peak, low]) + setScale(x, view)
```

- `dataFrom` is the start of the loaded stretch reaching the right edge.
  Buckets before it aren't computed at all.
- `now` is the browser clock **corrected by the server's clock** (every
  response carries `serverNow`). Page views are stamped by the server, so
  a browser clock running minutes off would otherwise draw "now" in the
  wrong place. The live cursor is in server time for the same reason.

Marker events follow the same path, in their own lane:

```
MarkerPayload {ids[], times[], labels[]}     columnar, epoch ms
   -> SpanStore.mergeMarkers                  per-layer Map<id, {t, label}>, sorted list memoized
   -> placePointMarkers(events, series)       conversions: snapped dots, height = the line's own
      eventsInView(events)                    team joins: exact-time vertical lines
   -> uPlot draw hook                         drawn after (on top of) the line
```

## 5. Security

Every action calls `requireSiteAccess(siteId)` before querying. Page views
and form submissions are read with the Clerk-JWT client, so RLS also
applies. `site_members` is service-role only under RLS, so it's read with
the service role, but only after the access check, and only for that one
site. `users` is never read: its signups belong to every Jellyhook customer
and would leak across tenants. Nothing is cached outside memory, and the
store is per-site, so switching sites never shows another site's data.

## 6. What the in-browser store saves

Everything the chart has loaded (page views and every marker layer) lives
in one in-memory store per site, inside the open tab. The chart reads
from that store, never straight from the database. The database is only
asked for two things:

- time it has **never** loaded (a stretch further left, a custom range
  not seen yet, a layer ticked for the first time);
- what **changed** since the last poll.

Everything else comes from memory, at zero database cost: every second's
redraw, panning and zooming inside loaded time, interval and line-style
switches, hovering, unticking and re-ticking a marker, leaving the
dashboard and coming back.

What that saves, measured (140 bytes per page-view row from the
database), for a site with 20,000 page views, one dashboard open for one
hour:

| | Read from the database each time | In-memory store (built) |
|---|---|---|
| Page views, per hour | ~672 MB, 4,800 requests | ~0.2 MB, ~480 requests |
| Conversion markers ticked | another full read of `form_submissions` per poll | the few submissions since the last poll, in the same call |
| Team markers ticked | read every redraw | a handful of rows once, refreshed in the poll |
| A full page reload | (same as above, again) | ~2 hours of page views (~3 KB here) + markers for that window, then polling |

Kept in memory, not in the browser's localStorage: localStorage would
only save that small first load after a reload, while costing part of a
~5 MB quota shared with the app's other caches and a main-thread parse on
every page load (see architecture.md, "Memory"). If people often scroll
far back after every reload, IndexedDB is the upgrade.
