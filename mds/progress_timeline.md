# Progress Timeline

Running log of what got built, fixed, and decided, in order, with the why
behind each. Written for us (Joshua + Claude) to pick up context fast in a
future session — not user-facing. Update this whenever a work session ends
with real changes, not every micro-edit.

---

## 2026-09-28 — Live Ticker scalability + tracker capacity analysis

- Diagnosed and fixed the Live Ticker's polling cost: tightened bounds
  (500ms–4s) with a cross-tab localStorage cache (`lib/liveTickerCache.js`)
  so N open tabs on the same site never multiply the real network hit.
- Delivered a numbers-grounded scalability report
  (`mds/reports/Traffic.md`): the real bottleneck on the current free stack
  (Vercel Hobby + Supabase Free) is Supabase's fixed connection ceiling
  under **traffic clustering**, not total monthly volume — Vercel Hobby's
  1M invocation budget is not the limiting factor. Also flagged: Vercel
  Hobby's ToS prohibits commercial use, independent of traffic.
- Root-caused why every `/api/track` request was slow: a synchronous,
  uncached call to a 3rd-party IP-geolocation API on every hit, plus fully
  serial (not parallelized) DB queries per event.

## 2026-09-29 — Decoupled country lookup, fixed session lifecycle bugs

- **Country resolution decoupled from the request path.** Removed the
  blocking `ip-api.com` call from `/api/track`. Sessions insert with
  `country: null`; a separate `lib/resolvePendingCountries.js` backfills it
  via Next 16's `after()` (runs post-response, rides on real traffic, no
  cron needed — Vercel Hobby cron is capped at once/day anyway). Provider
  list is now pluggable/loggable (`lib/countryProviders.js`), with a
  fallback provider (`ipwho.is`) already wired.
- **Timestamp timezone bug (major, cross-cutting).** `page_views`,
  `sessions`, and `visitors` had several columns stored as `timestamp
  without time zone` while `form_submissions` used `timestamptz`. Comparing
  the two in JS silently misattributed which page a conversion happened on
  (the bug behind "the yellow/converted frame follows me to whatever page I
  navigate to next"). Fixed via a non-lossy migration
  (`alter column ... type timestamptz using ... at time zone 'UTC'`) — the
  stored values were already correct UTC digits, just untagged.
- **Session idle-timeout — two real bugs found and fixed:**
  1. The idle-timeout split (30 min inactivity → new session) only ran
     inside the `visibilitychange` handler. A page that resumes via a
     **fresh full load** instead (tab restore, OS/browser reloading a
     suspended tab) skipped it entirely — this produced multi-hour "away"
     gaps inside one session instead of two split sessions. Fixed by
     extracting the check into `checkIdleAndMaybeSplitSession()` and
     calling it from both the initial-load path and the visibility handler.
  2. Added a server-side safety net (`lib/closeStaleSessions.js`) for
     sessions that never come back at all (tab killed, crash) — closes them
     with `ended_at` = the last page_view's real `left_at`, never "now."
     Rides on `/api/track` traffic via `after()`, same pattern as country
     resolution.

## 2026-09-29 — Form abandonment tracking (new feature)

- New `form_engagement` table: one row per (page_view, form), status
  progresses `viewed → started → submitted/abandoned`. Field-level
  abandonment reuses the exact name/email/phone classifier
  submission-capture already has; unmatched fields are recorded as a raw
  custom key instead of being dropped.
- `public/tracker.js`: IntersectionObserver-based view detection (records
  the form's real pixel position via `getBoundingClientRect` the moment
  it's ≥50% visible), a delegated `focusin` listener for field classification,
  and finalization hooked into the same page-leave signal analytics already
  detects (`pageLeaveListeners`, fired from `firePageViewEnd`) — no new
  leave-detection invented.
- **Two real bugs found during rollout, both fixed:**
  1. `document.body` didn't exist yet when the install snippet runs from
     `<head>` (its documented, normal placement) — `MutationObserver(...).
     observe(document.body, ...)` threw synchronously and silently killed
     the entire engagement setup. Deferred to `DOMContentLoaded` when needed.
  2. A form's "viewed" state was flagged permanently on the DOM element
     (`form.__jhEngagementObserved = true` forever), but engagement state
     resets per page view — a form surviving across page views (SPA nav,
     idle-split) only ever got "viewed" once, ever. Changed to stamp the
     element with the page_view_id it was last armed for, and re-arm on
     every new page view.
  3. `form_engagement`'s RLS policies were scoped `to anon`, but the app's
     `createSupabaseClient()` wires in a Clerk `accessToken()` callback that
     changes the effective role for an anonymous tracker request — every
     write silently failed with a swallowed 42501 until policies were
     changed to `to public`.
- Root-cause debugging note worth remembering: **the deployed tracker.js
  and the local file are two different things.** Most of the "still not
  working" back-and-forth this session traced back to testing against
  `jellyhookapp.vercel.app`'s already-deployed script while editing the
  local repo — nothing takes effect until committed, pushed, and deployed.

## 2026-09-29 — FramePlate chart: abandoned outcome, form-position bulb, theme cleanup

- Added a real `abandoned` frame outcome (orange, `#cc5624`) — a page whose
  form was engaged with but never submitted now renders distinctly from a
  plain `exitedNormally` page. Wired through `transform.js` →
  `deriveVisitGeometry.ts` → the existing generic outcome→color lookup, no
  Frame.tsx changes needed.
- The "converted" bulb now stretches from the form's actual measured top to
  bottom (`form_engagement.form_top_y/form_bottom_y`) instead of a single
  point at exit position — falls back cleanly to the old point marker for
  conversions recorded before this data existed.
- Blue "live" frame now keys off that exact page's own `left_at` (page-level),
  not the session's `ended_at` — a session can stay live after the visitor
  already left the page currently rendered. Session-liveness got its own
  signal instead: a themed border around the whole chart.
- Theme values are now all flexible (no hardcoded hex outside
  `defaultTheme.ts`) — darkened seenOnce green (`#068e1d`), applied
  playground-tuned frame widths (`74/120/310`), added a `sessionLiveBorder`
  theme block (fixed a hardcoding slip I made earlier in the same session).
- Session list table: removed the redundant "Outcome" badge column (a lead
  converts at most once, so it added nothing) — row background now carries
  the signal (yellow = converted, green = live). Newest session row now
  reads "Latest" instead of a number.
- Added `ChartLegend` — a click-to-open (not hover), auto-closing (20s) "i"
  button above the session chart explaining every frame/bulb color, reading
  live from `defaultTheme` so it can't drift from what the chart actually
  draws once per-user color customization exists later.

## 2026-09-29 — Lead profile: real form-engagement facts

- New "Form Engagement" card on `/platform/leads/[lead_id]`: time the form
  sat on screen before any input, time actually spent filling it in, and a
  count of other forms this same visitor started/viewed elsewhere but never
  submitted. Only rendered when there's a real fact to show — never a
  fabricated "0 abandoned forms" for every lead.

## 2026-09-29 — Dashboard cleanup + Leads search/filter

- Dashboard: removed Device/Country breakdown cards, capped the Pages
  table at a fixed height with internal scroll, shrunk the 5 top stat tiles
  (new `compact` mode on `StatTile`), reworded "Sessions started per
  interval" to plain language.
- `/platform/leads`: added client-side search (name/email) + date filter
  (defaults to Today; Custom date via native picker; All time) — explicitly
  a stopgap ahead of a bigger planned system ("Hook," not yet designed).

## 2026-09-29 — Conversion rate redefinition + New Reach / Conversions charts

- Dashboard's Conversion Rate is now **unique converting visitors / unique
  visitors** (deduped by person on both sides), not raw
  `form_submissions` rows / `sessions` rows — the old metric double-counted
  anyone who submitted or visited more than once.
- Two new, fully independent area charts: **New Reach** (new unique
  visitors over time, theme-linked black/white by light/dark mode) and
  **Conversions** (unique conversions over time, deduped per bucket, fixed
  yellow). Both ship in two modes: a locked-down "mini" version on the
  dashboard (fixed last-3-days, no picker), and a full interactive version
  on `/platform/conversions` with a free-form date-range picker (defaults
  to all time).
- `/platform/conversions` got a 3-view-mode section: **Separate** (both
  charts full-width, independent), **Split** (same two charts side by side
  in one shared card via a new `embedded` prop, still independent ranges),
  **Merged** (a genuinely different component — one chart, one shared
  range, both series together — not the same two components restyled).
- Added client-side caching (`lib/chartRangeCache.ts`) for all three charts:
  keyed by `(chart kind, siteId, exact range)`, 2-minute TTL, zero network
  request on a fresh hit. Mini charts round their "now" to a 15-minute step
  first so repeated dashboard reloads within that window share one cache
  entry instead of computing a new key (and missing cache) every time.
  Documented in `mds/local_cache_schema.md` — always update that file when
  a new browser-storage schema is added.

## 2026-09-29 — Business validation: dashboard by role, lead qualify flag

- Confirmed the marketing/sales/manager split isn't a guess — it matches
  the industry-standard pattern (HubSpot's own guidance: "a single
  dashboard cannot serve an executive, a manager, and a rep at once, they
  need fundamentally different answers") and the exact split WhatConverts
  (a direct competitor) already ships to paying customers.
- Found two concrete, competitor-validated gaps by comparing to WhatConverts
  and CallRail: (1) sales has no way to manually mark a lead real vs. junk
  (WhatConverts calls this "Quotable") — `confidence` is an automatic
  email-presence heuristic, not a human judgment; (2) the Conversions page
  showed volume over time but no source/channel breakdown, which is
  literally marketing's job to prove (CallRail's whole product).
- Built (1): `form_submissions.qualified` (nullable boolean — null =
  unreviewed, true/false = sales's own call). `LeadQualifyToggle` on both
  `/platform/leads` (replacing the removed `confidence` badge entirely —
  it was providing no real signal) and the lead profile page header.
- Removed `confidence` from every UI display (still stored, just not
  surfaced) — user's call: an automatic high/low email-presence guess
  wasn't adding real value next to a human qualify judgment.

## 2026-09-29 — UTM capture, referrer classification, device_type fix

- Validated first: UTM parameter *names* (`utm_source/medium/campaign/
  term/content`) are universal across every ad platform — only the values
  a marketer types in vary, not the keys. No format-variation risk to
  design around.
- `public/tracker.js` now reads UTM params off the landing URL at
  `session_start` (`getUtmParams()`), with a free fallback: if a marketer
  forgot to tag a link, Google/Meta's own auto-appended `gclid`/`fbclid`
  infers `utm_source`/`utm_medium` instead — directly answers the "what if
  they saw the ad but searched instead" worry for the two dominant
  platforms, at zero extra schema cost (folds into the same utm_source/
  medium columns).
- New `sessions.utm_source/utm_medium/utm_campaign` columns. Classification
  (`lib/analytics/classifyReferrer.js`) always prefers `utm_source` over
  raw `referrer` when present — raw referrer alone can't distinguish
  "saw an ad, then searched" from "never saw any ad," which is a universal
  limit of referrer-based tracking, not specific to this implementation.
- New `getReferrerBreakdown` action + `ReferrerDonutChart` (interactive —
  hover a slice or legend row to highlight) on `/platform/conversions`.
  Counts **unique visitors by first-touch source only** — a returning
  visitor's later sessions never re-attribute or double-count them, since
  marketing needs credit for the channel that actually brought someone in
  the door the first time, not every subsequent visit's referrer.
- **Real bug found and fixed while investigating device data**:
  `visitors.device_type` was only ever set at INSERT time, and
  `session_start` (very often the first event for a new visitor) never
  carries a `device_type` at all — only `page_view_start`/`page_view_end`
  do. Whichever event's network call happened to reach the server first
  decided, permanently, whether a visitor ever got a device type. Fixed:
  the UPDATE path in `/api/track` now also backfills `device_type`
  whenever any later event carries one.
- Also caught and fixed while touching these tables: `mds/database.md` had
  gone stale on the `sessions`/`visitors`/`page_views` timestamp columns —
  still documented as `timestamp without time zone` despite the
  2026-09-29 timestamptz migration earlier this session. Corrected.

## Standing decisions / conventions established this session

- **Deploy gap awareness**: always confirm whether a bug report is against
  `localhost` or the deployed production URL before debugging tracker.js
  changes — this cost significant back-and-forth at least twice.
- **Cache reads/writes belong inside `useEffect`, never a lazy `useState`
  initializer**, for any component that's server-rendered once before
  hydration (i.e. anything not `dynamic(..., {ssr:false})`) — localStorage
  doesn't exist during that first pass, and reading it synchronously there
  desyncs the first client render from the server-rendered HTML.
- **Theme values live in `defaultTheme.ts`, never inline hex in a
  component** — set up specifically so per-user color customization (a
  stated future feature) only has to change one resolved-theme source, not
  hunt through components.
- **"Real algorithms" bar** (user's standing philosophy): any new
  analysis/metric must be deterministic and factual — no ML, no
  probability, no business-specific heuristics, no if-condition template
  sentences dressed up as insight. Applies to `formEngagementFacts`,
  the unique-conversion-rate redefinition, and is the bar for whatever
  comes next.
