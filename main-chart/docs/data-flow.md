# Main chart: data flow

How a session gets from a visitor's browser into this chart, which query
runs when, and where the numbers can be briefly wrong.

## 1. Where `started_at` and `ended_at` come from

The chart reads only `sessions`. Those two columns are written by
`app/api/track/route.js` in response to `public/tracker.js`:

| Moment | What writes it | Value |
|---|---|---|
| Visitor arrives | `session_start` event | `started_at` = server time |
| Tab closes / navigates away | `session_end` (fired on `beforeunload`) | `ended_at` = server time |
| Tab idle in the background past 30 min | `session_end` with the tracker's own idle moment | `ended_at` = when they went idle, not when it was noticed |
| Same tab loads again (reload, next page on a multi-page site) | same `session_id` arrives again | `ended_at` is **cleared back to null**: the session reopens |
| Tab crashed / killed, no `session_end` ever sent | `closeStaleSessions` sweep | `ended_at` = the last page view's `left_at` (or its `entered_at` if that was never recorded) |

Two consequences worth knowing:

- **Reopening.** On a multi-page site, every page change fires
  `beforeunload`, which closes the session, and the next page load reopens
  it. The database keeps only the latest `ended_at`, so the chart sees one
  continuous session from first arrival to final exit. That's what you
  want. Between two polls, a session can briefly read as closed and then
  open again; the next poll heals it.
- **Away time counts as online.** A visitor who leaves for 10 minutes and
  comes back inside the same session counts as online during those 10
  minutes, because the session never closed. This follows from "bump up on
  session start, bump down on session close". FramePlate shows that gap as
  a purple "away" frame. Counting from `page_views` instead would exclude
  it, as a possible later precision mode.

## 2. Ghost tabs: what the "last 30 minutes" label is about

You're right that history comes out correct. When the sweep closes a dead
tab, it backdates `ended_at` to that visitor's last page, so the bump-down
lands where it really happened.

The issue is only **before** the sweep runs:

1. The tab dies at 10:00. No `session_end` arrives, so `ended_at` stays null.
2. The sweep only closes sessions whose `last_activity_at` is more than 30
   minutes old. It runs piggybacked on `/api/track` requests (any site,
   20 sessions per run), not on a timer.
3. From 10:00 until at least 10:30, plus however long until the next
   tracker request arrives anywhere, the session is still open in the
   database. The chart, reading the database, counts it through "now".
4. When the sweep finally runs, `ended_at` becomes 10:00. The chart's next
   poll picks that up and the bump retroactively drops at 10:00.

So for a stretch that is at least 30 minutes, the **right edge and the
live "open right now" number can include people who already left**. Then
it corrects itself. That's why the last 30 minutes are drawn in a
different color with a label, rather than presented as final.

Two related things:

- **`last_activity_at` only moves on page view start/end** (there's no
  heartbeat), so it can't be used to guess which open tabs are dead:
  someone reading one page for 20 minutes looks exactly like a crashed tab.
- **The "Active Now" tile is a different measure.** It counts sessions
  whose `last_activity_at` is in the last 30 seconds, which undercounts
  anyone reading a page without navigating. The chart counts open sessions.
  The two numbers will differ on the dashboard, sitting near each other.

## 3. Lifecycle of one chart on the dashboard

```
mount (live mode, 10s interval)
  store.ensureBounds()
     -> getSessionBounds             first + latest session start: left edge of history, opening zoom; also serverNow
  view = last 360 buckets (1 hour), pinned to now,
         or, if nobody visited in that hour, wide enough to include the latest visit
  store.ensureRange(view start - one screen, Infinity)
     -> getSessionSpans(now-2h, now+1h)   range + carry-in, paged  (example for the 1-hour view)
     -> covered = [now-2h, Infinity), live cursor = serverNow
  draw

every 1s (no request)
  now moves; if pinned, the view slides with it; recompute + draw;
  "open right now" = valueAt(now)

every 15s, tab visible, view reaches now
  getLiveSpanUpdates(cursor - 30s, openIds)
     touched since last poll  -> new, closed, reopened sessions
     re-read every open id     -> sessions closed by the sweep (backdated)
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
  same "missing stretch only" load as sessions, for conversions too

every live poll (same single server call as sessions)
  for each TICKED layer: conversions submitted since that layer's own cursor,
  or the whole (tiny) team list, which replaces the old one, so removed
  members disappear

untick
  the layer stops being drawn and stops being polled. Its data stays in
  memory. Tick it again: the next poll catches up from where its cursor
  stopped, so nothing that happened while it was off is missed.
```

Conversion markers never feed into sessions, and session data never
feeds into markers. The only thing they share is the computed line, which
the marker code reads to know where to put a dot.

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
  response carries `serverNow`). Sessions are stamped by the server, so a
  browser clock running minutes off would otherwise draw "now" in the
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

Every action calls `requireSiteAccess(siteId)` before querying. Sessions
and form submissions are read with the Clerk-JWT client, so RLS also
applies. `site_members` is service-role only under RLS, so it's read with
the service role, but only after the access check, and only for that one
site. `users` is never read: its signups belong to every Jellyhook customer
and would leak across tenants. Nothing is cached outside memory, and the
store is per-site, so switching sites never shows another site's data.

## 6. What the in-browser store saves

Everything the chart has loaded (sessions and every marker layer) lives
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

What that saves, measured (140 bytes per session row from the database),
for a site with 20,000 sessions, one dashboard open for one hour:

| | Read from the database each time | In-memory store (built) |
|---|---|---|
| Sessions, per hour | ~672 MB, 4,800 requests | ~0.2 MB, ~480 requests |
| Conversion markers ticked | another full read of `form_submissions` per poll | the few submissions since the last poll, in the same call |
| Team markers ticked | read every redraw | a handful of rows once, refreshed in the poll |
| A full page reload | (same as above, again) | ~2 hours of sessions (~3 KB here) + markers for that window, then polling |

Kept in memory, not in the browser's localStorage: localStorage would
only save that small first load after a reload, while costing part of a
~5 MB quota shared with the app's other caches and a main-thread parse on
every page load (see architecture.md, "Memory"). If people often scroll
far back after every reload, IndexedDB is the upgrade.
