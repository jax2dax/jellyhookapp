# SaaS Product Overview

## 1. Executive Summary & Value Proposition

This product is a first-party website analytics and lead-intelligence platform that connects anonymous visitor journeys, session and page behavior, form engagement, submitted lead details, and first-touch acquisition into one site-level workspace. It helps revenue teams see not only how much traffic and how many submissions they receive, but which channels and on-site experiences preceded those submissions and where visitors disengaged.

The core problem is the gap between aggregate web analytics and actionable sales context: page counts do not tell a team which individual converted, what that visitor did beforehand, or which form field introduced friction. The primary buyer is a B2B SaaS or high-ticket lead-generation operator; e-commerce teams can use its traffic, attribution, and form telemetry, but the analyzed implementation does not expose product, cart, order, or revenue analytics.

The value is practical rather than predictive: acquisition reporting credits first touch, lead profiles preserve the observed journey, and a human can qualify or reject a submission. Engagement scores and form timings are behavioral signals, not an AI lead-quality prediction or proof of purchase intent.

## 2. Core Functional Pillars

### Visitor & Session Lifecycle

**Identity and opening.** `public/tracker.js` creates a persistent `visitor_id` in `localStorage` and a tab-scoped `jh_session_id` in `sessionStorage`. The tracker checks whether the session key existed before calling `getSessionId()`, allowing `fireSessionStart()` to emit one `session_start` per new tab session rather than on each internal navigation. The start event records `document.referrer`, timezone, user agent, and UTM source/medium/campaign. `gclid` and `fbclid` provide fallback `google/cpc` and `facebook/paid_social` values only when `utm_source` is absent.

**Page visits.** A page view starts on a visible initial load, when a hidden tab becomes visible, or after a real path change intercepted through `history.pushState`, `replaceState`, or `popstate`. Same-path history operations are ignored. `page_view_end` is sent when the visitor hides/leaves the page or changes route; scroll telemetry includes entry and exit position, maximum scroll, the start of a revisited band, page height, viewport height, and duration. Page height is re-sent when it changes by more than 50 px or after six minutes; viewport height is sent at each page-view boundary because scroll-depth fractions cannot be interpreted without it.

**Idle split and close.** `SESSION_IDLE_TIMEOUT_MS` is 30 minutes. When a tab becomes visible or reloads with a prior `jh_last_hidden_at` older than that threshold, `checkIdleAndMaybeSplitSession()` closes the prior session at the recorded hidden time, runs session-end listeners, assigns a new UUID, and starts a new session. Normal route navigation does not split the session. A normal unload also emits `session_end`; the API ignores a close for a session younger than five seconds to guard against reload/unload noise.

**Ingestion and cleanup.** `app/api/track/route.js` rejects malformed event batches and silently drops bot-like user agents before database writes. It validates the API key/site and flips `sites.verified` on the first accepted tracker hit. A same-ID `session_start` refreshes its existing row; a different ID for a visitor checks for an open session within a separate three-minute server reconciliation window and closes an older open row before inserting. This three-minute check is for ID reconciliation, not the tracker’s 30-minute same-tab idle policy. `page_view_start`/`page_view_end` update activity and create/update `page_views` rows.

`closeStaleSessions()` is the server-side safety net when the browser never sends an end event. It processes up to 20 stale sessions per invocation, using the same 30-minute threshold and dates `ended_at` to the last page view’s `left_at` (then `entered_at`, then `last_activity_at`). It also closes any still-open page-view rows at that time so duration does not keep growing indefinitely. `/api/track` schedules pending country resolution, stale-session closure, and stale form-engagement closure after responding, keeping geolocation latency off the tracking request.

### Form Engagement Analytics

**Conversion capture gates.** The tracker first loads `/api/site-config`. With `specify_form=false`, it captures forms that pass `shouldSkip()`; with `specify_form=true`, a form must also have `data-conversion="true"`. Password forms, search forms, and single-field non-email forms are skipped. Native submit capture and a fetch interceptor cover conventional and client-rendered submissions, with a three-second signature window suppressing a duplicate capture. A missing config response defaults to global capture mode to avoid silently losing submissions. The server-side `/api/track-form` repeats the `specify_form` guard, so a client cannot bypass labelled-form mode by sending an unlabelled payload. Email presence sets the submitted `confidence` field to `high`; absence sets it to `low`. This is an email-presence heuristic, not lead scoring.

**Lifecycle states.** `/api/track-form-engagement` stores `viewed`, `started`, `submitted`, or `abandoned` per `(session_id, page_path, form_index)`. `viewed` is recorded when an `IntersectionObserver` sees at least 50% of a qualifying form and captures its pixel `form_top_y`/`form_bottom_y` with `getBoundingClientRect()` plus page scroll. The first field focus moves the form to `started`; successful form capture marks it `submitted`; leaving the site/session without submitting eventually marks it `abandoned`. Leaving a page alone does not abandon a form, since the visitor may return. Status rank is monotonic (`viewed < started < submitted/abandoned`) so delayed events cannot reopen a completed form.

**Field-level timing.** `classifyField()` uses input name, id, placeholder, `aria-label`, and `autocomplete` to classify known name/email/phone fields; other fields retain a `custom:<identifier>` key. On focus, the client starts an in-memory clock. `keydown` records only the first keystroke time for that focus visit and makes no request. On blur, submit, or page/session leave, it sends a delta containing `firstFocusAt`, `firstKeydownAt`, `lastUnfocusAt`, and `totalFocusedMsDelta`. Thus `totalFocusedMs` measures focused dwell time, not time to type a character or time spent on the form as a whole.

The API’s `mergeFieldTimings()` adds deltas server-side, retains the first-ever focus/keydown timestamps, updates the latest unfocus timestamp, and assigns `order` the first time a field key is seen. The additive server merge lets a form resume across page views and full reloads without the client persisting cumulative totals. The unique key deliberately excludes `page_view_id`; the latest `page_view_id` is informational only.

**Friction evidence and commercial use.** `buildLeadProfile()` exposes the submitted form’s `timeToFirstInputMs` (from `viewed_at` to `first_input_at`), `timeFillingFormMs` (from first input to submission), per-field `fieldTimings` in observed fill order, and the slowest field highlight. It also counts other abandoned forms for that visitor. These facts can point teams toward a form or field worth testing, while avoiding an unsupported claim about why a person stopped. Current code shows per-lead facts and the form’s position in replay; the analyzed routes do not implement an aggregate form-friction heatmap, field-level abandonment rate, or causal diagnosis.

### Geometric Session Replay (FramePlate Engine)

FramePlate is a visual reconstruction from page-view checkpoints, not a video recording, DOM snapshot, or pointer replay. `lib/leadSessions/transform.js#buildSessionsRaw` maps database rows into the renderer’s generic `SessionRaw[]` and `PageVisitRaw[]` contract. A session uses `sessions.session_id`, `visitor_id`, `started_at`, and `ended_at`; its visits are associated page views ordered by `entered_at`. A visit uses `page_view_id`, path/timestamps, measured page and viewport heights, and scroll checkpoint columns. Page height falls back to the matching `page_structure.page_height`; missing viewport height is estimated for seen-region math and marked `viewportEstimated`.

The transform synthesizes a compact `scrollTrace` from `entry_scroll_depth`, `max_scroll_depth`, `revisit_start_scroll_depth`, and exit `scroll_depth`. It removes duplicate/rounding-close waypoints to avoid false “seen twice” bands. Headers come from `page_structure` positions normalized by page height. A form submission is associated heuristically with the last page view in the same session entered at or before `submitted_at`; that visit becomes `converted`. A submitted `form_engagement` row supplies the actual form span, while an abandoned engagement marks the visit `abandonedForm`. Orphan page views without a matching session row are stitched into synthetic sessions instead of disappearing.

`deriveVisitGeometry()` is the sole scroll-coordinate conversion boundary. Raw `ScrollSample.y` is a fraction of the scrollable range (`page_height - viewport_height`), whereas rendered geometry is a fraction of full page height. With `vFrac = viewport_height / page_height`, it maps viewport top to page position with `top(y) = y * (1 - vFrac)` and extends the visible region to `top + vFrac`. The result includes `seenOnceTop`, `seenTwiceTop`, `seenBottom`, `enterY`, `exitY`, and `maxScrollY`. If viewport height is missing, a device-typical fallback is used for visible-region math only; plate height remains based on page height. Form pixel coordinates are normalized to `formTopFrac`/`formBottomFrac`.

`buildTimeline()` sorts visits and inserts an `away` gap frame when the interval between a page’s `leftAt` and the next page’s `enteredAt` exceeds 15 seconds by default. It marks only the final visit `live` when that exact page view remains open; an open session alone does not make every frame live. Converted outcome takes precedence over live. `FrameOutcome` distinguishes `converted`, `abandoned`, `exitedNormally`, `live`, and `away` (as well as active/expired theme states).

In the UI, `FullPagePlate` draws unseen background, once-seen and revisited bands, header zigzags, repeated viewport ruler marks, and entry/exit/deepest-scroll bulbs. The converted bulb stretches over the measured form’s actual vertical span when available and otherwise falls back to a point marker. Theme colors make outcomes visually distinct; selected-frame details report status, time on page, page height, seen-once/seen-2x/not-seen percentages, and which recorded headers fall within the seen range. The session summary owns session-wide facts; selected-frame details are deliberately limited to one visit.

### Lead Qualification & Attribution

**From anonymous visitor to lead.** `/api/track-form` inserts one `form_submissions` row per accepted form capture with site, visitor/session IDs, page path, name/email/phone, raw scalar form data, confidence, and submission timestamp. Email-based duplicate submissions from the same visitor/site within 60 seconds are dropped. A lead is a submission row, not a separate `leads` entity. The profile fetch (`getLeadProfileByLeadId`) is keyed by that submission’s own ID for identity, then gathers visitor, sessions, page views, submissions, and form engagement through client-generated `visitor_id`/`session_id` strings. Other submissions from that browser remain visible as context.

**Qualification is human-controlled.** `setLeadQualified(leadId, qualified)` updates `form_submissions.qualified`: `null` is unreviewed, `true` qualified, and `false` junk. This operational sales judgment is distinct from `confidence`, which is only the automatic email-presence heuristic. The leads table can filter all/qualified/junk/unreviewed, and qualification can be changed from both the table and profile.

**Attribution.** `classifyReferrer()` gives `utm_source` precedence, title-casing it for display. Without a UTM source, it parses the referrer hostname and maps common search/social/video domains (Google, Bing, DuckDuckGo, Yahoo, Facebook, Instagram, LinkedIn, Twitter/X, TikTok, YouTube, Reddit, Pinterest) to labels; unknown hosts are displayed as their hostname, and missing/invalid referrers become `Direct`. UTM medium and campaign are recorded on sessions but do not currently change the displayed source classification.

`getReferrerBreakdown()` credits each visitor exactly once to the source of their earliest session (first touch), not every subsequent session. `getLeadOriginBreakdown()` applies the same first-touch logic but only to unique visitors with at least one form submission. It produces six radar axes, filling unused slots with zero-valued placeholders and showing only the top six real sources when there are more. Neither action attributes revenue or proves that a channel caused conversion. `buildLeadProfile()` separately computes an engagement heuristic: `pageViews * 3 + timeMinutes * 4 + avgScrollPct * 0.3 + 10` for more than one visit, rounded and clamped to 0–100. It is an activity summary, not a propensity model.

## 3. Dashboard & Telemetry Guide

The application’s canonical workspace routes are `/platform/...`. `/dashboard` redirects to `/platform/dashboard`; it is an alias, not a separate dashboard implementation. All analyzed platform pages are scoped to the authenticated user’s required site, with plan gates on lead details (`pro`) and the leads list (`free`).

### `/dashboard` → `/platform/dashboard` (Overview)

| Visual | Rendered metric/data | Business decision enabled |
|---|---|---|
| Site header and tracking badge | Site name/domain and `is_active` state | Confirm which property is being measured and whether tracking is active or paused. |
| Active Now stat | Count of session rows with `last_activity_at` in the last 30 seconds; this is sessions, not necessarily distinct people | Gauge current activity during a launch, campaign, or incident. |
| Page Views (24h) | Page-view rows with `entered_at` in the last 24 hours | Check near-term content traffic. |
| Total Sessions | All-time session-row count | Understand cumulative visit volume. |
| Total Leads | All-time `form_submissions` count | Track captured demand volume. |
| Conversion Rate | Unique converting `visitor_id`s divided by unique visitor rows, expressed as a percentage | Compare visitor-to-lead yield without counting multiple submissions from one visitor multiple times. |
| Visits Over Time bar chart | Session starts, with 3-day, 7-day, 1-month, 3-month, and all-time windows | Spot traffic growth, seasonality, or periods needing campaign review. |
| Site Health panel | Average of `intentFailureScore` values converted to `100 - average score`, plus count above an adaptive threshold | Identify pages flagged for attention and open the full intent analysis. This is a separate intent diagnostic, not a replay-derived conversion metric. |
| New Reach mini area chart | New visitors bucketed by `visitors.first_seen` for a short recent range | See whether the site is adding net-new audience. |
| Conversions mini area chart | Unique converting visitors per time bucket | Compare conversion activity against acquisition of new visitors. |
| Pages bar chart and table | Top 10 bar series by page views; all-time table of path, views, unique visitors, average time, average exit scroll depth | Prioritize high-traffic pages and locate pages with weak engagement or shallow scrolling. `Avg Scroll` uses `scroll_depth`, not the maximum-scroll field. |
| Session Playback preview | Two sampled lead sessions rendered as compact FramePlate charts | Quickly inspect examples of visitor movement and direct analysts to full lead-session exploration. |
| Live Ticker | Up to 10 latest page-view rows: path, truncated visitor ID, and elapsed time; refreshes adaptively and shares a cross-tab cache | Observe whether activity is arriving now; it is an attention-oriented feed, not an exportable audit log. |
| Site-created timestamp | `sites.created_at` rendered in local date form | Establish site setup age when interpreting sparse history. |

`getSitePagesOverview()` groups all page-view rows by path and reports view count, distinct visitor IDs, average available `time_on_page`, and average available exit `scroll_depth`. The bar visual only encodes views; its tooltip surfaces the companion visitor/time/scroll values. The `Pages` table is capped in height and scrolls internally.

### `/platform/leads`

The server loads all site `form_submissions` newest-first; `LeadsTable` currently applies search and filters in the browser. The default date filter is the user’s local today. Search matches name/email; date choices are today/custom/all time; qualification choices are all, qualified, junk, or unreviewed.

| Visual | Rendered fields | Business decision enabled |
|---|---|---|
| All leads table | Name (links to profile), email, submission page, submitted date, and qualification toggle | Triage inbound demand, find a known contact, and mark sales disposition. |
| Search/date/qualification controls | Client-side filters over the fetched submission set | Narrow follow-up work to a relevant contact, date, or review state. |

This is a simple client-side filtering implementation, not server pagination or a CRM queue. Each row represents a form submission; repeat submissions by a visitor can appear as separate leads.

### `/platform/leads/[lead_id]`

The detail page is keyed by the selected submission ID; that submission anchors displayed identity even if the same browser has submitted multiple forms. Access is gated to the Pro plan. The page includes:

| Visual | Rendered metric/data | Business decision enabled |
|---|---|---|
| Identity header | Name/email/phone, converted badge, first-time vs returning-convert label and prior visit count, last active, first seen, device | Decide who to contact and how many visits preceded conversion. |
| Submitted form details | Scalar raw fields as compact values and complex raw objects in expandable JSON blocks | Review qualification context captured at submission. |
| Qualify control | Human `qualified` state for the focused submission | Record sales disposition independently of automatic confidence. |
| Activity stat tiles | Total visits, total page views, total time-on-page, average exit scroll depth, time from first seen to focused conversion | Assess observed depth, engagement, and time-to-convert. |
| Form Engagement facts | Time to first input, time filling the submitted form, and count of other abandoned forms | Identify observed hesitation and repeat form drop-off for follow-up or UX investigation. |
| Field Timing bar chart | `fieldTimings` dwell time per recognized/custom field, in first-observed fill order; longest field highlighted | Choose fields and form steps to usability-test. Dwell is not itself proof of friction. |
| Path to Conversion bar chart | Page-view sequence through conversion (or current journey if not converted), bar length as time on page, with scroll and visit context | See which content was traversed and where time was spent before submission. |
| Conversion Events list | Other submissions from the same browser, with page and timestamp | Disambiguate repeat form activity and shared-browser cases. |
| Session History explorer | Every converted and non-converted visit, a FramePlate chart for the selected session, session summary, and selected-frame detail panel | Inspect actual recorded scroll coverage, revisit bands, gaps, live/converted/abandoned outcomes, and page-level context. |

The profile preserves orphan activity when page views or submissions lack a matching session row, synthesizing a session from available page-view timestamps. The conversion page association is a same-session timestamp heuristic, not a direct foreign-key link from submission to page-view.

### `/platform/conversions`

| Visual | Rendered metric/data | Business decision enabled |
|---|---|---|
| Reach & Conversions mode control | Separate (stacked independent charts), Split (side-by-side independent ranges), or Merged (same range and shared timeline) | Choose between independent trend inspection and direct acquisition/conversion comparison. |
| New Reach area series | New visitor rows grouped by `first_seen` over a selectable date range | Determine whether net-new reach is changing. |
| Conversions area series | Unique visitors per bucket with one conversion per visitor per bucket; the same visitor may count again in a later bucket | Track conversion events over time without duplicate submissions inflating one interval. |
| Referrers donut and legend | Unique visitors assigned once to the source of their earliest session; top seven sources plus an `Other` rollup, total in center | Allocate marketing attention based on first-touch audience acquisition. |
| Leads Origin radar | Unique converted visitors by first-touch source, with six stable axes/placeholders | Compare which channels are associated with converted leads. |
| Conversion Rate Over Time bar chart | Raw `form_submissions.created_at` rows by interval, plus first-to-last bucket growth, selected-window total, average per interval, and all-time submissions; windows are 3d/7d/1m/3m/all | Monitor submission volume and direction, then investigate changes. Despite its title, this chart counts submission rows, unlike the dashboard’s unique-visitor conversion-rate tile. |
| Top paths to conversion list | Up to 10 most common full page-path sequences among visitors with submissions, with count | Identify commonly traversed content sequences to inform navigation and campaign landing-page choices. |

The three reach/conversion area modes default to separate. The two standalone series maintain independent ranges there; merged mode requests both over one shared range. The top-path implementation aggregates the visitor’s chronological page views into a full sequence and counts sequence frequency; it is descriptive correlation, not proof of path causality.

### `/platform/settings` (requested `/settings` workspace screen)

The route is `/platform/settings`; the product-facing Settings screen is not a bare `/settings` route. It is a site and access administration surface rather than an analytics dashboard.

| Section/control | Rendered fields and actions | Business decision enabled |
|---|---|---|
| Site information | Editable site name and domain | Keep the tracked property’s identity and domain current. |
| Overview facts | Site ID, plan, monthly event limit, creation date, status, and a displayed `Teams involved` value sourced from `visitorCount` | Check account configuration and event allowance. The `Teams involved` label/data pairing currently shows visitor count, not team-member count. |
| Tracking status | Active/inactive badge plus Pause/Resume action | Stop or resume event collection without deleting stored data. |
| Team members | Member email/ID and role; owner-only invite and remove controls; pending invites shown locally | Grant or remove team access to the site. |
| API key | Copy and regenerate | Install the tracker or rotate credentials; regeneration requires updating installed scripts. |
| Tracker snippet | Copyable script tag with the site API key | Install tracking on the customer website. The current snippet source contains a `localhost:3000` URL marked with a deployment TODO, so production suitability must be checked before treating it as a production install instruction. |
| Danger zone | Confirmed site deactivation | Retire tracking while retaining existing data. |

There is no Settings UI in the inspected component to change `specify_form` after site creation. Form selection is enforced by the tracker configuration and server-side submission guard; do not infer that the Settings page offers a form-selection editor.

## 4. Business ROI & Competitive Utility Matrix

| Raw telemetry | Converted business insight | Concrete sales/marketing action |
|---|---|---|
| `visitor_id`, `session_id`, page-view timestamps | A browser’s first-touch identity and sequence of visits, including repeat sessions | Prioritize follow-up with context about whether a lead converted immediately or returned later. |
| `page_path`, `time_on_page`, `scroll_depth`, `page_height`, `viewport_height` | Which pages attract attention and how much content visitors actually reached | Rework high-traffic pages with short dwell or shallow reach; compare page changes against later engagement. |
| `entry_scroll_depth`, `max_scroll_depth`, `revisit_start_scroll_depth`, exit scroll | A geometry of seen-once, seen-again, and unseen content per page visit | Move key proof points or calls to action into content regions that visitors reach; validate through subsequent telemetry. |
| Page-view gaps and open/closed timestamps | Navigation cadence, extended away periods, and whether the final page is still live | Separate natural navigation from extended absence and avoid interpreting an open session as someone still viewing an earlier page. |
| `form_engagement.status` plus `viewed_at`, `first_input_at`, `ended_at` | Form exposure, start, completion, and abandonment at a factual lifecycle level | Investigate forms with repeat abandonment and test reducing friction, without assuming why a visitor left. |
| `field_timings` field keys, order, focused duration, first keydown | Which field consumed attention and in what sequence | Review high-dwell fields, labels, validation, and field requirements in a controlled UX test. |
| `form_top_y`/`form_bottom_y` with conversion page geometry | The location and vertical extent of the form that converted | Compare converted-form placement with seen regions and reposition or clarify calls to action. |
| First-session `utm_source` and `document.referrer` | First-touch channel mix among unique visitors and converted visitors | Rebalance acquisition spend or investigate channels that bring reach but few submitted leads. |
| `form_submissions` contact/raw fields and `qualified` state | Identified inbound contacts with human sales disposition | Route qualified leads to sales, filter junk, and improve campaign targeting from review outcomes. |
| Visits, page views, pages per visit, time engaged, scroll depth and time to convert | A factual activity summary per lead (the 0-100 engagement score was removed 2026-10-06: it could not be proven from the data) | Read the numbers themselves, or ask a precise question in Hook. |
| Session and submission counts over time | Trend-level traffic and lead volume, with unique-vs-row-based definitions visible | Compare campaign periods while avoiding apples-to-oranges comparisons between unique visitors and raw submissions. |

### Interpretation Boundaries

- FramePlate visualizes scroll and page structure checkpoints; it is not session video or full DOM replay.
- First-touch source is a deterministic attribution rule, not multi-touch attribution or causal channel lift.
- Field dwell and abandonment identify where investigation may be useful; neither establishes user intent or the reason for friction.
- `confidence` reflects email presence in the tracked submission payload; `qualified` is a separate human judgment.
- The analyzed screens do not include e-commerce order/revenue tracking, CRM synchronization, predictive lead scoring, or aggregate form-field friction analytics.