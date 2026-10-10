# Tracker specification (2026-10-07)

For developers. What `public/tracker.js` does, exactly. If this and the code
disagree, the code wins; fix this file in the same change. Audit and reasons:
`mds/reports/tracker-backend-audit-2026-10-07.md`.

## Install

```html
<script src="https://YOUR-APP/tracker.js" data-key="API_KEY"></script>
```

- Works in `<head>` (recommended) or before `</body>`. Synchronous, no `defer` needed.
- `data-debug` on the tag, or `localStorage.setItem("jh_debug", "1")`, turns the
  console logging on. Otherwise the tracker prints nothing (except the one error
  for a missing `data-key`).
- Installing it twice does nothing the second time (`window.__jhTrackerLoaded`).
- Needs `localStorage`. If it is blocked (some private modes) the tracker falls
  back to memory for the current page load; a visitor then looks new on each load.
- `crypto.randomUUID` is used when present, with a fallback for http pages.

## What it stores in the visitor's browser

| Key | Where | Holds | Lifetime |
|---|---|---|---|
| `visitor_id` | localStorage | random UUID of this browser (name kept from before so existing visitors stay the same) | until cleared |
| `jh_session` | localStorage | `{ id, last, started }` of the shared session | idle 30 min ends it |
| `jh_active` | localStorage | `{ tab, ts }`: which window last claimed "active" | overwritten constantly |
| `jh_sc` | localStorage | map path to `{ h, t }`: fingerprint last sent for page structure | bounded to 100 paths |
| `jh_hr` | localStorage | map path to `{ sig, t }`: last health report | bounded to 100 paths |
| `jh_ph_<path>` | sessionStorage | last page height sent and when (the throttle) | tab |
| `jh_debug` | localStorage | `"1"` enables logging | until cleared |

## Sessions

One session is one continuous visit by one browser, shared by every window
and tab (`jh_session` in localStorage).

- **Start.** When a window becomes active (`activate()`), `ensureSession()` reads
  `jh_session`. If it exists and its `last` is under 30 minutes old it is
  adopted (no event: the window that created it already announced it). Otherwise
  a new session starts: the old one (if any) gets a `session_end` with how long ago
  it really ended, and a `session_start` is sent for the new one.
- **Keeping it alive.** `last` is refreshed by user activity (throttled to once
  per 5 seconds) and by the heartbeat.
- **End.** Only by idle. There is no `session_end` on tab close, reload or
  navigation (the old `beforeunload` send is gone). A session nobody closes is closed
  by the server sweep, dated to its last real activity.
- **Race.** Two windows finding the session expired at the same instant each write a
  new one, then read it back; if the stored one is not theirs they adopt it. Not
  atomic; rare.

## One active window

At most one window of a site records a page view at a time.

- `jh_active` plus a `BroadcastChannel("jh_<first 8 of key>")` carry the claim. The
  `storage` event is the fallback (it reaches every other window of the origin).
- A window **claims** when the visitor uses it: `pointerdown`, `keydown`, `touchstart`,
  `wheel` (only `isTrusted` events; `scroll` and `mousemove` do not claim, because pages
  scroll themselves), or when it gains focus/visibility.
- A window that hears another claim closes its page view, dated to the claim time, and
  pauses. Using it again claims back and opens a fresh page view.
- A new window loads and claims only if it has focus, or if no other window was
  active in the last 60 seconds. A window loaded in a background tab waits for
  `visibilitychange`.

## Page views

`openPageView()` / `closePageView(endAtMs)` are the only places a page view starts and
ends. They are called by: visibility (hidden closes, visible opens), focus, `pagehide`,
bfcache restore (`pageshow` persisted), SPA route changes, losing the active claim, and
idle.

- **SPA navigation.** `history.pushState/replaceState` and `popstate` are wrapped. A path
  change closes the page view and opens a new one 50 ms later. Calls that keep the same
  path (Next.js bookkeeping) do nothing. A paused window just notes the new path.
- **Idle.** A 30-second timer closes the page view when nothing was used for 30 minutes,
  dated to the last use. The visitor coming back starts a new session.
- **Heartbeat.** Every 5 minutes while a page view is open and not idle:
  `{ type: "heartbeat" }`. It exists so the server does not sweep a long, quiet read as idle.
- **Scroll.** Unchanged from before: `entry_scroll`, `scroll_depth`, `max_scroll_depth`,
  `max_scroll_reached_at`, `revisit_start_scroll` (see `getScrollDepth` and the scroll
  tracker in the file). Depths are fractions of `page_height - viewport_height`.

## Events sent to `/api/track`

POST, `Content-Type: text/plain;charset=UTF-8`, body a JSON array. Every event also
carries `api_key` and `host` (`location.hostname`). No custom headers, so no preflight.

| `type` | When | Main fields |
|---|---|---|
| `session_start` | a new session begins | `visitor_id, session_id, referrer, timezone, user_agent, page_url, page_path, device_type, is_first_visit, utm_source/medium/campaign` |
| `session_end` | the previous session had idled out (sent by the window that notices) | `visitor_id, session_id, ended_ago_ms` |
| `page_view_start` | a page view opens | `page_view_id, page_url, page_path, page_title, referrer, language, user_agent, device_type, entry_scroll, viewport_height, viewport_width, page_height?` |
| `page_view_end` | it closes | `duration, scroll_depth, max_scroll_depth, max_scroll_reached_at, revisit_start_scroll, page_height?, viewport_height, device_type, ended_ago_ms?` |
| `heartbeat` | every 5 min while active | `visitor_id, session_id` |
| `click` | a click on `[data-track-click]` | `page_view_id, page_path, name` (max 100 per page view; one per name per second) |
| `health` | once per page per 6 h after load | `page_path, page_url, report` (what attributes it found) |

`is_first_visit` is true only on the very first session of a visitor the tracker just
minted: it is what lets the server record first-touch attribution.
`ended_ago_ms` is a duration, not a clock time (visitor clocks are wrong).

`page_height` is throttled: sent only when it changed by more than 50 px or 6 minutes passed.

**Page height is the tallest the page was during the page view** (2026-10-09). A height read at one instant is often too short:
images and lazy content load after first paint, and a single-page app renders the new route after the URL changes. The tracker
keeps `observedMaxHeight`: updated when the page loads (and 1.5 s later), when the `<html>`/`<body>` box changes size
(ResizeObserver, debounced 300 ms) and while the visitor scrolls. It starts empty on every page view (so a new route never inherits the
previous route's height) and `page_view_end` reports the larger of the current height and this maximum. Install snippets now carry
`defer` (the tracker finds itself with `document.currentScript`, which works with `defer`). Test: a page that grows after load, and
an app that swaps in the next route before changing the URL (old tracker reported 800 px for a 3480 px page; new reports 3480).

## Other endpoints it calls

| Endpoint | When | Sent |
|---|---|---|
| `GET /api/site-config?key=` | once per load | reads `specify_form` |
| `POST /api/track-form` | a form submission is captured | `visitor_id, session_id, page_url, page_path, name, email, phone, confidence, raw_data, is_labelled_conversion` |
| `POST /api/track-form-engagement` | form viewed / started / a field blurs / submitted / abandoned | `form_index, status, last_field_type/key, form_top_y/bottom_y, field_timings_delta, last_activity_at, has_marked_fields` |
| `POST /api/track-structure` | a page view opened and the structure changed (or 24 h passed) | `page_view_id, page_path, page_height, viewport_width, structures[{header_index, header_text, header_tag, position_y}]` |

All use `_originalFetch` (never the patched `window.fetch`), `credentials: "omit"`,
`keepalive: true`, and `text/plain`.

## Forms

- **Marking.** `data-conversion="true"` on the form OR on any ancestor (`isMarkedConversion`), so vendor-rendered forms (HubSpot, Marketo, plugins) can be marked with a wrapper.
- **Names.** First + last are joined (`extractName`), using field names, `autocomplete` and label text; company, username and similar are never a person's name.
- **HubSpot.** HubSpot form markup (`form.hs-form`, `#hsForm_*`) is captured only by the HubSpot section, which reads the shared form mode (`jhState`) and starts its DOM observer once `<body>` exists.
- **Iframe forms.** Typeform, Calendly and Jotform announce submissions with `postMessage`; the tracker sends one lead without name or email (`raw_data._kind = "iframe_submission"`). Other iframe forms are reported in the health report (`iframe_forms`) and cannot be tracked.
- **Which forms count.** `specify_form = false`: every form that passes `shouldSkip()` (no
  password field, not a search form, not a single non-email field). `specify_form = true`:
  only `<form data-conversion="true">`. The server enforces this too.
- **Two capture paths**, deduplicated within 3 seconds: the native `submit` event, and the
  `fetch` interceptor.
- **Fetch interceptor** acts only when all hold: the request is not GET/HEAD; its URL is not
  one of the tracker's own (`API_BASE/api/`); the visitor typed in, focused or clicked inside
  a form within the last 15 seconds and that form is still on the page; the form passes the
  same gates; it holds an email. It captures only that form.
- **`data-track-field`.** If a form has any marked field, only marked fields are tracked
  (engagement timings and `raw_data`); with none marked, all are. Name, email and phone
  detection for the lead is not restricted. Marking is on the input or a wrapper inside the form.
- **Engagement** keeps its model: one row per `(session_id, page_path, form_index)`, additive
  per-field timing deltas merged on the server. Because sessions now end only by idle, a form
  left mid-fill is abandoned by the session end or the sweep, not by closing the tab.

## Page structure

Per page view, 2.5 seconds after load: the first 80 `h1`-`h3` (text up to 200 characters,
position from `getBoundingClientRect` + scroll). Sent when its fingerprint
(tag, text, position/50, page height/100) differs from the last sent for that path or 24 hours
passed. Linked to the page view with `page_view_id`.

## Health reports

After the page settles (3 s), once per page per 6 hours unless the report changed:

```
report.conversion_form = { forms, marked, wrong_value, wrong_element }
report.field_attr      = { marked, in_form, outside_form }
report.click_attr      = { marked }
```

"Found" comes from this. "Working" comes from real events on the server
(`tracking_health.last_event_at`). See `lib/tracking/health.js`.

## What it does not collect

No keystroke content, no field values except what a submitted lead form holds, no clicks
except on marked elements, no cross-site identity, no IP address (the server sees it on the
request and stores only a hash).
