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

## 2026-09-29 — Leads Origin radar chart + conversions page layout

- `/platform/conversions`: Referrer donut now takes the left half of the
  row instead of full width; new `LeadOriginRadarChart` (interactive,
  hover a point for its tooltip) takes the right half.
- New `getLeadOriginBreakdown` action — same first-touch classification as
  the referrer donut, but restricted to visitors who actually converted
  (at least one `form_submissions` row), so it answers "which channel
  produced leads," not just "which channel produced traffic."
- Radar always renders a **fixed 6 axes** so the shape stays visually
  stable over time: real sources (sorted by lead count) fill in first,
  `DEFAULT_PLACEHOLDERS` (`Direct, Facebook, Instagram, Google, LinkedIn,
  TikTok`) fill any remaining slots at 0 rather than the chart looking
  sparse with a single real axis. A placeholder is never duplicated
  against a real source with the same name — it just becomes that real
  slot. Verified directly: only-Direct data correctly shows Direct real +
  5 placeholders at 0; a 7th distinct real source correctly displaces the
  lowest-priority placeholder (TikTok) rather than growing past 6 axes.

## 2026-09-29 — Per-field form dwell-time tracking (major)

- **Schema fork resolved by explicit decision**: `form_engagement` was keyed
  by `(page_view_id, form_index)`, but tabbing away and back always mints a
  fresh `page_view_id` — meaning "resume the same form-fill in progress"
  would otherwise fork into a disconnected new row on every tab switch.
  Re-keyed to `(session_id, page_path, form_index)` — resumes across
  tab-hidden/visible cycles and revisits to the SAME page; a different page
  is treated as a different form (safe default — the same form_index on
  two different pages could be two unrelated forms).
- **Design choice, not left to guess**: the client never tracks a running
  cumulative total per field — it only ever reports "how long was I
  focused on this field just now" (this visit's delta). The **server**
  additively merges each delta into the durable total
  (`mergeFieldTimings` in the route). This is what makes a full page
  reload mid-fill (which wipes all client-side JS state) still accumulate
  correctly without the client needing to remember or re-fetch anything —
  verified directly: simulated a full "page reload" mid-lifecycle and
  confirmed the field's total correctly added across visits, `order` and
  `firstFocusAt`/`firstKeydownAt` stayed pinned to their first-ever values,
  `lastUnfocusAt` tracked the latest.
- **Chattiness — direct answer to the "will JSON hurt the visitor's
  browser" question**: keydown is LOCAL ONLY, never a network call (that
  would have been the real chattiness risk, not payload size). Only three
  things trigger a request: the form's very first focus (viewed→started),
  a field actually blurring (flushes that one field), and finalization.
  A typical form generates roughly one request per field visited, not one
  per keystroke.
- **Real behavior change from what shipped earlier this session**:
  ordinary page-leave (tab hidden, SPA route change) no longer finalizes
  the form as abandoned — it only flushes whatever field was open.
  Finalization now only happens at a TRUE session end, via a new
  `sessionEndListeners` hook (parallel to the existing `pageLeaveListeners`,
  fired from `fireSessionEnd()` and `startNewSessionAfterIdle()`) — and,
  authoritatively, via a server-side sweep inside `/api/track`'s
  `session_end` handling, which finalizes ALL of that session's still-open
  forms (including ones on pages the visitor has since navigated away from
  entirely, which have no live client-side JS context left to finalize
  themselves). `ended_at` is always the form's real last recorded
  activity, never "now."
- New `lib/closeStaleFormEngagement.js` — crash-case safety net (tab killed,
  no session_end ever arrives), mirroring `closeStaleSessions.js` exactly.
- New "Field Timing" card on the lead profile page — reused the existing
  `LeadTimeBar` component rather than building a new chart, since the
  shape (label + timeMs, ordered, one highlighted) already fit exactly.
  Shows fields in the order they were actually filled, longest one
  highlighted.
- Caught and fixed a real bug of my own while implementing this: `ended_at`
  on abandon was reading the PRE-update `last_activity_at` instead of the
  value being resolved in that same request — would have silently dropped
  the final field's dwell time from the abandon timestamp. Fixed before
  shipping, not after.

## 2026-09-30 — Real orphaned page_view bug found via docs work, plus a self-inflicted one

- **Real production bug, found while writing the session-replay docs page**:
  `lib/closeStaleSessions.js` and `/api/track`'s explicit `session_end`
  sweep close a stale *session*, but neither ever touched that session's
  underlying `page_views` rows. A page_view still sitting at `left_at:
  null` keeps recomputing its own duration against "now" forever, every
  time anyone opens that chart — this is what produced frames showing
  hundreds of thousands of minutes. Fixed in both places: closing a
  session now also backfills any of its still-open page_views, dated to
  the same real closure moment, never "now." Ran the actual cleanup
  against production: found and fixed all 161 existing orphaned rows,
  verified zero remain.
- **Separate, self-inflicted bug in the docs example itself**: the
  session-replay page's own teaching fixture (`exampleSession.ts`)
  anchored its "still open" demo page to a hardcoded absolute date
  (2026-01-15) instead of computing relative to render time. Every day
  that passed made that demo's duration grow by another day — by
  2026-09-30 it was showing 371,154 minutes, ironically demonstrating the
  exact bug it exists to explain. Diagnosed precisely from the user's
  reported number alone (371,154 min is almost exactly the day-count
  between the hardcoded date and today) before touching any code. Fixed
  by making the fixture a function, called fresh via `useMemo` on every
  real page load instead of a module-level constant.
- Lesson for future fixtures: **never anchor a "still open"/live demo to
  an absolute date**. Anchor to `Date.now()` at the moment it's actually
  used, always.
- `/docs/troubleshooting` (Section 4 of the roadmap) built, seeded with
  this exact case as its first real entry, plus pending-verification and
  referrer-shows-Direct pointers back to the relevant Core Concepts pages
  rather than duplicating their content.

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

## 2026-09-30 (later) — Custom auth cards, custom pricing cards, two-tier billing model decided

- **Profile pictures no longer touch Clerk at all.** Found and closed three
  separate leaks where Clerk's own `imageUrl` (which always returns
  something, even an auto-generated default, whether or not the person
  ever uploaded a real photo) could end up in `users.pfp`: the upload
  flow's fallback in `UserPageClient.tsx`, the Clerk webhook's
  `has_image`-gated sync on every `user.created`/`user.updated`, and an
  ungated backfill inside `getMyProfile()`. Replaced the whole thing with
  `uploadMyAvatar` in `lib/actions/profile.actions.js`, which uploads
  straight into this app's own Supabase Storage bucket (`avatars`) and is
  now the *only* writer of `pfp`. Clerk is never consulted for avatars
  anywhere in the app, not even as a last-resort fallback.
- **Sign-in and sign-up are fully custom**, built on Clerk's newer
  "Future" headless hooks (`useSignUp`/`useSignIn` → `.password()`,
  `.sso()`, `.verifications.*`, `.finalize()` — Clerk v7's replacement for
  the older imperative `create()`/`prepareEmailAddressVerification()` API
  pattern). No `<SignIn />`/`<SignUp />`/`<SignInButton>`/`<SignUpButton>`
  anywhere in the codebase anymore — every entry point (landing page,
  header, pricing, about) links to `/sign-in` or `/sign-up` directly.
  `AuthCardFrame.tsx` gives both cards their visual identity: an ambient
  lime glow (`jh-glow-pulse`, same breathing-light language as the hero
  image), viewfinder corner brackets that sharpen on hover, and a top
  accent bar that draws in left-to-right — on-brand with the mono/terminal
  aesthetic used everywhere else, instead of a generic boxed form.
- **Decided: subscriptions will eventually come in two scopes, not one.**
  Upgrading a *site*'s plan gives everyone invited to that site the
  upgraded tier, and is what unlocks inviting team members at all (a
  Free-tier site can't invite anyone). Upgrading *personally* gives just
  the signed-in person that tier's access, solo, with no team invites.
  Same price, same features per tier, different blast radius. This isn't
  built yet — today's `subscriptions` table is still a single per-user row
  (see `upsertUserSubscription` in `app/api/webhooks/clerk/route.ts`), and
  actually wiring this up will need real thought about whether "site"
  billing rides on Clerk Organizations or stays on this app's own
  sites/team-members model. Recorded here so the decision isn't lost
  before the schema work happens.
- **Both PricingTable surfaces replaced with custom cards, preview-only.**
  Clerk's `<PricingTable />` in `/platform/subscription` and the plain
  TIERS grid on the public `/pricing` page are both gone, replaced by
  `components/billing/DashboardPricingCards.tsx` (shadcn tokens, fits the
  dashboard's light/dark shell) and `components/marketing/PricingCards.tsx`
  (lime/dark, same bracket/glow language as the auth cards) — sharing one
  data source, `lib/pricing/tiers.ts`, so the tiers and the new
  site-vs-personal scope copy can't drift between the two surfaces. Both
  are genuinely free/no-op right now (pricing isn't live) — per the user,
  once approved these go back into hiding until real pricing launches,
  the same way the old "Free now" grid did.
- **Feature text blurred on both pricing surfaces.** The checkmark stays
  sharp; the text after it (every feature bullet, every scope note like
  "Elite for you alone on this site. No team invites.") is blurred with
  `blur-[5px]` + `select-none`, because the actual feature copy is still
  provisional and will change before pricing is real — the checkmarks
  communicate "a plan structure exists" without committing to wording
  that's going to get rewritten.

## 2026-09-30 (later still) — Feedback + bug-report system

- **Sidebar**: the old plain "Support" row (`NavSecondary`, always a dead
  `#` link) is now a single bordered button split in half —
  `components/feedback/SupportFeedbackButton.tsx`. Left half is still
  Support, unchanged. Right half is new: Feedback, opens a 1–5 star +
  optional-comment dialog.
- **Feedback nudge**: the Feedback half gets a quiet attention-getter — a
  green sweep crosses left → fully covers → exits right over ~1.3s
  (`jh-feedback-sweep` keyframes, `app/globals.css`), up to twice a day
  with a real 10-minute gap enforced both between the two and before the
  first one (`jh_glow_*` in localStorage). Respects
  `prefers-reduced-motion`. This is independent of, and unrelated to, the
  auto-popup below — one is a passive reminder on a button, the other is a
  popup that actually interrupts.
- **User-card dropdown** (`nav-user.tsx`): "Notifications" removed — it
  was routing to `/platform/network` anyway, not a real notifications
  feature — replaced with "Report a bug" (bug icon), opening
  `BugReportDialog.tsx`: one description textarea, with the current page
  path and `navigator.userAgent` attached automatically so the reporter
  never has to type either.
- **Auto feedback popup** (`FeedbackAutoPrompt.tsx`, mounted once in
  `app/platform/layout.jsx`): a 15-second heartbeat accumulates actual
  *visible-tab* time per calendar day in localStorage (not wall-clock
  time since mount, which would also count a backgrounded tab). Once one
  day crosses 10 minutes, that day is marked "qualified"; the first
  **later** calendar day that also crosses 10 minutes triggers the
  popup — once ever (`jh_fb_prompted`). The user was explicit this exact
  rule will likely be tuned or replaced; the thresholds are two constants
  at the top of that file for exactly that reason.
- **Storage**: new `lib/actions/feedback.actions.js` (`submitFeedback`,
  `submitBugReport`), same `supabaseAdmin` service-role pattern as
  `profile.actions.js`. Needs two new tables (`feedback`, `bug_reports`)
  that the user runs themselves — see the SQL handed over in that
  conversation turn, not reproduced here.
- **New shared UI primitives**: `components/ui/dialog.tsx` and
  `components/ui/textarea.tsx` didn't exist before this — built from the
  same `radix-ui` package and `cn`/`data-slot` conventions already used by
  `sheet.tsx`/`input.tsx`, so any future modal work has a real `Dialog` to
  reach for instead of another one-off.
- **Bug fix, same day**: switching sidebar tabs briefly flashed the (real,
  thin, green-styled — not actually hidden despite the `no-scrollbar`
  class SidebarContent carries, which isn't a real defined utility
  anywhere in this codebase) scrollbar in underneath the new
  Support/Feedback button. Root cause: the button lived inside
  `SidebarContent`, the scrollable (`overflow-auto`) region NavMain also
  lives in — NavMain's own active-tab transition could shift its height
  by a sub-pixel amount mid-animation, enough to momentarily overflow that
  region. Fixed by moving `SupportFeedbackButton` out of `SidebarContent`
  entirely, into its own sibling row between it and `SidebarFooter` — it
  can no longer be part of that scrollable area no matter what NavMain's
  animation does, without touching NavMain itself.

  - Feed back -5 star + description was added.

## 2026-09-30 (production prep) — Pre-launch security audit: cross-tenant data leak, fixed

Context: domain switch to jellyhook.com is in progress (DNS processing).
Before standing up Clerk's production instance, did the "find major
API/security leaks" pass the user asked for — specifically whether any
frontend code talks to Supabase directly (it doesn't — confirmed, zero
client-reachable file anywhere imports `@supabase/supabase-js` or
references `NEXT_PUBLIC_SUPABASE_*` outside the two server-only client
factories, `lib/supabase.ts` / `lib/supabase/server.ts`), and whether
relying on "requests only come from my backend" is actually safe with RLS
off on every table (it is NOT, and this audit is why).

- **Found: `setLeadQualified` was an unauthenticated cross-tenant write.**
  It updated `form_submissions` by `leadId` alone — no `auth()` check at
  all, no site-ownership check, not even scoped by `site_id`. With RLS
  off, a request with no valid session still hits the DB through the anon
  key's default grants. Anyone who knew (or guessed) a `form_submissions`
  UUID could qualify/junk any customer's lead. Fixed: now takes `siteId`,
  requires a real session, and requires that session to have `site_members`
  access to that exact site before touching anything.
- **Found: `getMembers` leaked team rosters (names + emails) for any
  siteId**, no ownership check. Fixed the same way.
- **Found this was systemic, not isolated**: every analytics-reading
  action taking a client-supplied `siteId` — `getReferrerBreakdown`,
  `getLeadOriginBreakdown`, `getNewReachOverTime`,
  `getUniqueConversionsOverTime`, `getUniqueConversionRate`,
  `getVisitsOverTime`, `getIntentFailureAnalysis` (had an auth() check,
  but only "is someone logged in," never "does THIS someone own THIS
  site"), `getConversionRateData`, `getConversionPaths`, the three
  functions in `leadSessions.action.js`, and `getRecentActivity` — had
  zero verification that the siteId belonged to the caller. Any signed-in
  user could read any other customer's full analytics by siteId alone.
  "The request comes from my backend" was the exact wrong assumption here
  — the backend code still has to check ownership on every call; without
  RLS there's no second layer underneath it doing that automatically.
- **Fix**: one shared helper, `lib/actions/siteAccess.js`'s
  `requireSiteAccess(siteId)` — checks `auth()`, then `site_members`
  (falling back to legacy `sites.user_id`, same pattern as
  `settings.actions.js`'s existing `verifyOwner`), throws if the caller
  doesn't belong to that site. Added as the first line of every function
  above.
- **Not yet touched, lower urgency**: `lib/actions/supabase.actions.js`
  has ~19 more siteId-taking functions with the same gap, but — checked —
  all are currently called only from server components (siteId always
  server-resolved via `requireSite`/`getUserSite`, never client input), so
  not actually exploitable today. Same for `pagesOverview.action.js`'s
  `getSitePagesOverview`. Worth the same treatment eventually for
  defense-in-depth (a future refactor could easily wire one into a client
  component and silently reopen this), just not urgent the way the
  client-reachable ones were. `lib/actions/analytic.actions.js` is dead
  code — not imported anywhere — left alone.
- **Also noted, not a vulnerability**: three files
  (`lib/actions/supabase.actions.js`, `site-management.actions.js`,
  `permission.actions.js`) all independently define overlapping functions
  (`getUserSite`, `requireSite`, `getSiteMembers`, `createSite`,
  `inviteMember`...). Different pages import different ones. Not fixed
  here — out of scope for a security pass — but worth a real cleanup
  later, since duplicated security-relevant logic is exactly how the
  `setLeadQualified`-style gap happens again.
- Fixed in the same pass: `SettingsClients.jsx` had `trackerScript`
  hardcoded to `http://localhost:3000` unconditionally (marked with a
  `🚀 DEPLOY` TODO) — every customer's copied install snippet from Settings
  was broken on any real deployment. Now uses `NEXT_PUBLIC_TRACKER_URL`,
  matching the already-correct pattern in `create-site/page.jsx`.

## 2026-09-30 (still production prep) — RLS was effectively off; real policies + service-role split

User had already turned RLS "on," but every table's actual policy was a
single `"all"` rule — `using (true)` to both `anon` and `authenticated` —
which permits anyone, logged in or not, to read/write/delete every row.
Functionally identical to RLS being disabled. Why this mattered now, not
before: the public Supabase anon key is a `NEXT_PUBLIC_*` env var, visible
in any browser's Network tab in seconds, no account needed.

**The architectural wrinkle that made this non-trivial**: this app has two
fundamentally different kinds of traffic hitting the same tables —
anonymous visitors on *customers'* websites (the tracker, authenticated by
nothing but an `api_key` check in the route code — never a Clerk session,
ever, by design) and actual logged-in Jellyhook customers (real Clerk
sessions, real JWTs). RLS policies keyed on `authenticated` + a real JWT
claim are correct for the second group and structurally cannot apply to
the first — no amount of code changes gives an anonymous website visitor a
Jellyhook login, because they were never meant to have one. Previously
confirmed (2026-09-29, form_engagement) that this app's Clerk-JWT Supabase
client (`accessToken()` callback present even when it returns nothing)
doesn't resolve anonymous requests cleanly to `anon` either — `to public`
was needed there, not `to anon`. Decided not to re-fight that same
uncertainty table by table: moved every tracker-facing write path to the
**service-role key** instead, sidestepping the anon/public role-resolution
question entirely for ingestion.

**Found while tracing exactly what needed service role — two tables
(`sites`, `site_members`) turned out far more complex than the simple
tracking tables**: `site-management.actions.js` alone has a cross-tenant
domain-duplicate check (`createSite` looking up ANY site by domain, not
just the caller's own), and five separate functions querying
`site_members` by `user_id = 'pending:<email>'` — a sentinel string with
no relationship to a real Clerk user id, used for invites before the
invitee has ever logged in. No RLS policy can safely express "this pending
row belongs to you" without trusting an email claim in the JWT that may
not even exist. Rather than encode all of that into live SQL with no way
to test it against the real Supabase project before shipping, moved
**all** of `sites`/`site_members` access in `permission.actions.js`,
`settings.actions.js`, and `site-management.actions.js` to the service-role
client — each of those already had a correct `auth()` + ownership check
(`verifyOwner`, membership lookups) in application code before touching
the DB; that check is unchanged and is still the real authorization, just
now executed through a client that isn't also fighting RLS trying (and
failing) to re-derive the same thing. Verified every exported function in
both files has that check before making the swap (two exceptions, both
confirmed harmless: `getSiteMembers` in `site-management.actions.js` is
dead code — nothing imports it; `getSiteVerifiedStatus` returns only a
boolean).

**Code changes (all service-role swaps, auth logic inside each function
untouched):**
- `app/api/track/route.js`, `app/api/track-form/route.js`,
  `app/api/track-form-engagement/route.js`, `app/api/site-config/route.js`,
  `app/api/track-structure/route.js` (a 6th tracker-facing route, found
  during this pass — missed in the earlier security audit because it
  wasn't in the first grep's result set), `app/api/close-stale-sessions/route.js`
  (inherently cross-tenant — sweeps stale sessions across every site, no
  per-user scope would make sense) — all switched from the Clerk-JWT client
  to service role.
- `lib/actions/permission.actions.js`, `lib/actions/settings.actions.js`,
  `lib/actions/site-management.actions.js` — same swap, for the
  `sites`/`site_members` reasoning above.
- **Deleted** `app/api/debug/route.js` and `app/api/debug-leads/route.js` —
  found in the same pass, completely unauthenticated, returning the 50 most
  recent `page_views`/`form_submissions` (real lead PII) across *every*
  site to anyone who hit the URL. No production purpose, pure leftover.
  `app/api/debug-site/route.js` and `app/api/get-analytics/route.ts` are
  also leftover debug routes but not active leaks (the first is properly
  auth-scoped; the second is dead code, nothing calls it) — left alone,
  worth deleting eventually but not urgent.

**RLS policy design that ships with this** (SQL handed to the user
directly, not reproduced here in full):
- `sites`, `site_members`, `users`, `subscriptions`, `billing_events`:
  **no policy at all** for `anon`/`authenticated` — total deny for both,
  service role (which bypasses RLS unconditionally) is the only way in.
  Confirmed via grep that nothing outside the already-converted
  service-role files touches these.
  - One deliberate exception: `site_members` gets ONE minimal policy —
    `authenticated` may `select` rows where `user_id` matches their own
    JWT `sub` claim. Without this, every other table's ownership check
    (an `exists (select 1 from site_members where ...)` subquery) would
    silently return nothing for every single user, because Postgres RLS
    applies to subqueries the same as top-level queries — a table with
    zero `authenticated` access can't be read even indirectly through
    another table's policy. Caught this before writing any SQL, not after
    a broken dashboard.
- `visitors`, `sessions`, `page_views`, `form_engagement`, `page_structure`:
  `insert`/`update` wide open `to public` (matches the tracker's actual,
  unauthenticated write path — same reasoning as the 2026-09-29
  `form_engagement` fix, now applied consistently instead of one-off).
  `select` restricted `to authenticated`, scoped through the
  `site_members` ownership check above. No `delete` policy anywhere — the
  app never deletes these rows, so default-deny there costs nothing.
- `form_submissions`: `insert to public` (tracker-written), but `update`
  restricted `to authenticated` + ownership (only the qualify/junk toggle
  touches this, from the dashboard, never the tracker).
- `page_insights`: `authenticated` + ownership for select/insert/update,
  no public access at all — visitors never touch this table, only the
  dashboard's intent-analysis feature does.

**Bug found applying the above, same day**: every "members can select"
policy used `(auth.uid())::text`, matching the pattern already visible in
the user's existing `users`-table policies (`"Allow select own user"`).
Wrong call — `auth.uid()` is Supabase's *native* auth helper and its
implementation casts the JWT `sub` claim to Postgres's `uuid` type
internally; Clerk's user ids (`user_3CWPiUysltfw2WiuspYCuA6XDxs`) aren't
UUID-shaped, so the cast throws *inside* `auth.uid()`, before any `::text`
cast on its result ever runs. Surfaced as `invalid input syntax for type
uuid` in `getTotalSessions`/`getActiveVisitors`/`getPageViewsLast24h`/
`getLeads`/`getSitePagesOverview` (all of which correctly logged the raw
Postgres error) and as a misleading clean "you don't have access to this
site" from `requireSiteAccess` (which did NOT check the `error` field on
its queries, so the same underlying crash got silently swallowed into the
generic denial message instead of surfacing the real cause).
Two fixes: every policy's `(auth.uid())::text` replaced with
`(auth.jwt() ->> 'sub')` (plain text extraction, no casting, can't throw
this way), and `lib/actions/siteAccess.js` moved to the service-role
client (same reasoning as everywhere else this pass — the ownership check
now happens in JS against the real Clerk `userId`, not inside a policy)
plus now actually logs `error` from both its queries instead of silently
discarding it. The `users`-table policies that originally suggested
`auth.uid()` was the right pattern were never actually exercised by real
traffic (only service role touches `users` in live code) — the bug in
them just never got the chance to surface before now.

**Confirmed fixed, same day**: the `auth.uid()` → `auth.jwt() ->> 'sub'`
SQL patch had to be run twice — the user's first attempt didn't take (a
re-check query afterward still showed every policy with `auth.uid()` in
it), second attempt confirmed via the same query returning zero rows.
After that, the dashboard, leads, and intent analysis all loaded real data
again — the RLS design itself was correct from the start, the only actual
bug was the `auth.uid()` typing issue.

**Separate, unrelated bug found right after, in the same dashboard load**:
a React hydration mismatch in `components/dashboard/FramePlatePreviewCard.tsx`.
Its `useVisitorSessions` hook read the localStorage session cache
synchronously inside two `useState` lazy initializers
(`readInitialSessionsRaw`) — the exact anti-pattern already called out as
a standing convention earlier this session ("cache reads/writes only
inside useEffect, never a lazy useState initializer"), just missed in
this one file. Server-side, `localStorage` doesn't exist, so SSR always
rendered the "loading" placeholder; client-side, hydration found a real
cache entry and rendered the actual chart immediately — two different
trees for the same initial render, which is exactly what a hydration
mismatch is. `components/leads/LeadSessionExplorer.tsx` already does this
correctly (empty `useState`, cache read only in `useEffect`) — this file
didn't match it. Fixed by starting both server and client from the same
`"loading"`/`"empty"` state unconditionally, and moving the cache read
into the existing `useEffect` (which already ran a live fetch afterward
regardless, so no behavior changed beyond removing the SSR/client
divergence). Unrelated to the RLS work — this bug could have existed
before it and just never had enough cached data to make the mismatch
visible until now.

**What actually changed, end to end, and what it means for you:**
- **Safe now, wasn't before**: nobody — logged in or not — can read or
  write `sites`, `site_members`, `users`, `subscriptions`, or
  `billing_events` directly against Supabase anymore; only your own server
  code (via the service-role key) can. A signed-in customer can only ever
  see/modify their own site's `visitors`/`sessions`/`page_views`/
  `form_submissions`/`form_engagement`/`page_structure`/`page_insights` —
  enforced at the database itself now, not just in application code.
- **Unchanged**: the tracker's actual behavior. Every write path a real
  visitor's browser triggers works exactly as before — nothing about
  install, tracking, or form capture changed from a customer's or a
  website visitor's perspective.
- **Still open, not forgotten**: `lib/actions/supabase.actions.js` has
  ~19 more siteId-taking functions with the same missing-ownership-check
  shape `setLeadQualified` had — not currently exploitable (everything
  that calls them today resolves `siteId` server-side first), but worth
  the same `requireSiteAccess` treatment eventually. `app/api/debug-site/route.js`
  and `app/api/get-analytics/route.ts` are harmless leftover debug routes,
  not deleted, not urgent. The `users` table policies shown earlier in
  this conversation were never recreated (nothing live uses the JWT client
  against `users`) — if a "delete my account" feature gets built later, it
  needs its own policy or, more likely given everything else in this
  pass, its own service-role action.

## 2026-09-30 (production, continued) — Closed the defense-in-depth gap, fixed a real tracker outage

**Closed the known gap**: every siteId-taking function in
`lib/actions/supabase.actions.js` (19 functions) and
`pagesOverview.action.js`'s `getSitePagesOverview` now calls
`requireSiteAccess(siteId)` first, matching every other analytics action
in the codebase. Explicitly did **not** move these tables to service
role when asked, and explained why: `visitors`/`sessions`/`page_views`/
etc. are protected by two independent layers right now — the app-layer
`requireSiteAccess` check, and the RLS policy underneath it. Moving them
to service role would strip the RLS layer entirely and put the app back
to "one missed check away from a leak," which is exactly the class of bug
`setLeadQualified` already was. Confirmed first that service-role vs.
anon+JWT has zero effect on request count or latency beyond RLS no longer
evaluating per-row (it's never a database-hits tradeoff, only a
security-model one) — `sites`/`site_members`/`users`/`subscriptions`/
`billing_events` are on service role because their access patterns are
genuinely inexpressible in RLS (pending invites, cross-tenant duplicate
checks), not because service role is simply "safer."

**Real, live bug found and fixed**: after switching `NEXT_PUBLIC_TRACKER_URL`
to `https://jellyhook.com`, every tracker request from a real customer's
site started failing — CORS preflight rejected on every `POST` route
(`Redirect is not allowed for a preflight request`) and a raw 308 on the
`GET` route. Root cause: `middleware.ts`'s matcher ran Clerk's middleware
on literally every `/api/*` route, including the fully public,
anonymous, api-key-authenticated tracker endpoints
(`/api/track`, `/api/track-form`, `/api/track-form-engagement`,
`/api/track-structure`, `/api/site-config`, `/api/close-stale-sessions`)
and the webhook (`/api/webhooks/clerk`). Clerk's middleware performs a
"handshake" redirect to itself to verify/refresh session cookie state —
very likely triggered here because `jellyhook.com` was newly added and
not yet fully recognized by the (still dev/test) Clerk instance, which
was configured against `jellyhookapp.vercel.app`. Browsers categorically
refuse to follow a redirect during a CORS preflight, breaking every
cross-origin `POST` to these routes outright; a followed `GET` redirect
can also just land somewhere without the right CORS headers attached.
These 7 routes have zero legitimate reason to ever go through Clerk's
middleware — none of them use a Clerk session, ever, by design — so
fixed by excluding them explicitly from the matcher (not just relying on
the broad catch-all to happen not to include them), and removed the
now-redundant `/(api|trpc)(.*)` matcher entry that was explicitly
re-including everything under `/api` right after the main pattern tried
to exclude it. Verified the new matcher against every relevant path
before shipping it (tracker/webhook routes skip middleware, dashboard/
sign-in/other API routes still get it) rather than trusting the regex by
eye.

**Docs updated**: `mds/database.md` gained a full "Row Level Security"
section — the two-tier design (service-role-only tables vs.
app-check-plus-RLS tables), why `auth.jwt() ->> 'sub'` and not
`auth.uid()`, and the now-closed defense-in-depth gap.

## 2026-10-01 — FramePlate: form imitation box replaces the converted bulb

Before writing any code, confirmed two data-availability questions the
user asked directly: (1) form position IS available independent of
conversion — `form_engagement`'s `viewed` status is captured via
`IntersectionObserver` the moment a form crosses 50% visible
(`public/tracker.js`), which needs zero interaction, so a session that
never converted can still carry real form position data; (2) field COUNT
is NOT reliably available — `field_timings` only ever gains an entry once
a field is focused (`focusin` listener, no proactive scan of `form.elements`
the way `page_structure` scans headers), so any field never clicked is
invisible to tracking entirely. Both confirmed by reading the tracker code
directly, not recalled from memory.

- **Data pipeline** (`lib/leadSessions/transform.js`): removed the
  `isConverted ?` gate on `formTopY`/`formBottomY` — position now flows
  through for any page view with a `form_engagement` row, submitted or
  not. Added `formStatus` and `formFieldCount` (distinct `field_timings`
  key count — a lower bound, documented as such everywhere it appears,
  never presented as the form's true field count).
- **Types** (`framePlate/types.ts`): `formStatus`/`formFieldCount` added
  to both `PageVisitRaw` and `VisitGeometry`; new `formImitation` theme
  section (width fraction, two colors, stripe thickness bounds).
- **Rendering** (`framePlate/components/FullPagePlate.tsx`, new
  `FormImitation` component): the old edge-protruding "converted bulb" is
  replaced by an INSET box drawn inside the plate at 62% of its width,
  centered — seen/seen-twice stay visible either side of it, matching the
  user's reference screenshots. Renders whenever the form was ever
  measured at all (independent of `converted` now), in the ordinary
  converted-yellow unless `formStatus === "submitted"`, in which case it
  switches to a brighter yellow. Field stripes: one per
  `formFieldCount`, each sized `boxHeight / count` and clamped between a
  min/max thickness so they always fit inside the box and read as thin
  lines rather than a filled block even with only 1-2 fields. The old
  single-point bulb is now only a fallback for a conversion recorded
  before form position tracking existed at all.
- **Theme validation** (`framePlate/theme/validateTheme.ts`): added
  `formImitation` validation — without this, `FramePlateChart`'s call to
  `validateTheme()` (which reconstructs the theme object field-by-field
  from an explicit whitelist) would have silently stripped the new
  section from every theme, defaults included.
- **Docs updated same day**: `/docs/concepts/session-replay` gained a
  dedicated "form imitation box" section, the terminology section grew
  from three concepts to four, `TerminologyDiagram.tsx` now draws and
  labels the box + stripes using real theme geometry (not approximated,
  same standard as the rest of that diagram), and the example fixture
  (`exampleSession.ts`) was updated — it already set `formTopY`/
  `formBottomY` on its converted visit but not the new `formStatus`/
  `formFieldCount`, which would have rendered in the wrong color; also
  added form data to the previously form-less abandoned-form visit so the
  live example demonstrates both colors side by side. `mds/database.md`'s
  `form_engagement` section and `mds/documentation/doc_source_map.md`'s
  session-replay row both updated to match.
- **Not done**: `framePlate/fakeData/generateFakeSession.ts` (the
  `/dev/frame-plate` playground) still doesn't generate form position
  data, so this feature is real-data-only for now — flagged to the user,
  not fixed, since nobody asked for the playground specifically.

## 2026-10-01 — Conversions page: "Top paths to conversion" replaced with per-lead truncated charts

Asked two structural questions before building anything, since the answer
changes the component shape, not just styling: (1) does each row show its
chart inline, or expand on click → card-per-lead with the chart inline,
confirmed; (2) does the frame-click detail panel live per-card or in one
shared spot at the bottom → per-card, self-contained, confirmed.

- **Removed**: the "Top paths to conversion" list and its backing
  `getConversionPaths(siteId)` in `lib/actions/supabase.actions.js` —
  confirmed it had exactly one call site before deleting it outright
  (there's a SEPARATE, same-named `getConversionPaths` in
  `lib/actions/conversionPath.action.ts` powering an unrelated chart on
  the lead profile page — `components/charts/lineConversionPath.tsx` — not
  touched, different feature entirely despite the name collision).
- **New**: `components/leads/ConvertedLeadsExplorer.tsx` — one card per
  converted lead (`ConvertedLeadCard.tsx`), date-range filter (last 3
  days/week/month, all time default, or a custom start/end via
  `datetime-local` inputs — "time flexibility" taken literally, not just
  a date picker), client-side pagination (5 cards/page) over whatever the
  filter returned.
- **The actual ask, precisely**: each card's `FramePlateChart` shows ONLY
  that lead's start-of-session → conversion path — any visits after the
  converted page view are dropped, even if the real session kept going.
  New `truncateSessionToSubmission()` in `lib/leadSessions/transform.js`
  does this: re-derives the cutoff from the submission's own
  `submitted_at` (same heuristic `findConvertedPageViewIds` already uses
  elsewhere) rather than trusting the generic `visit.converted` flag,
  because one session can hold more than one submission and each one's
  card must cut at ITS OWN moment. Also forces `endedAt` to the cutoff
  visit's own `leftAt` — this is presented as a finished, bounded story,
  so it must never show the "session still live" border past where it
  was cut. Each card also has a "View full information" link to that
  lead's real `/platform/leads/[lead_id]` page for the untruncated story.
- **Per-card frame inspection**: `ConvertedLeadCard` owns its own
  `selectedFrame` state and renders `SelectedFrameDetails` directly
  underneath its own chart — the exact same mechanism
  `LeadSessionExplorer` uses on the lead profile page, just scoped per
  card instead of per whole page, so multiple cards' charts can be
  inspected independently at once.
- **Data fetching**: new `lib/actions/conversionLeads.action.js` — raw
  rows only (form_submissions in the date range, then sessions/page_views/
  page_structure/form_engagement batched by the resulting session_ids in
  one round trip each), same "raw rows out, SessionRaw built client-side"
  split `leadSessions.action.js` already established. Client component
  fetches directly (same pattern `NewReachChart`/`ReferrerDonutChart`
  etc. use) and refetches whenever the date filter changes, rather than
  the server page fetching "all time" speculatively upfront.
- **Caught before it shipped**: the custom-range `datetime-local` inputs'
  default values were originally computed via `Date.now()` inside a lazy
  `useState` initializer — the exact hydration-mismatch shape fixed in
  `FramePlatePreviewCard` a few turns earlier. These specific inputs are
  never rendered during the initial SSR pass (hidden behind `preset ===
  "custom"`, itself a post-hydration user action), so it likely wouldn't
  have surfaced as a visible warning today — fixed anyway, into an empty
  initial state filled by an effect, rather than leave a latent copy of a
  bug already fixed once this session.
- **Docs updated**: `/docs/reference/conversions` gained a "Conversions
  list" section; `doc_source_map.md`'s row for it updated to list every
  new file and note the removed feature.

## 2026-10-01 (later) — Conversions cards collapsed by default, plus a new FramePlate variety

- **Collapsed by default**: `ConvertedLeadCard` now starts collapsed —
  only the identity row (name, converted page, date, "View full
  information") shows until clicked. Clicking the row toggles it; the
  "View full information" link inside that same row stops propagation so
  it navigates instead of also toggling the card.
- **New FramePlate variety — `compactFrameHeight`** (`framePlate/theme/variants.ts`,
  a new file, separate from `deviceThemes.ts` since this is an orthogonal
  axis — layout strategy, not device). Off by default on every existing
  chart (`FramePlateTheme.frame.dynamicHeight: false`); when a theme
  override turns it on, every frame in that one render shares a height
  computed from the TALLEST plate actually being drawn in that view +
  a small padding (`dynamicHeightPadding`, default 8px), capped at the
  ordinary fixed height — it can only ever shrink the frame, never grow
  it past today's default. Built because the new conversions cards are
  reliably short, single-page paths-to-conversion, where the fixed
  340px frame height left a large empty gap below a 60-80px plate.
  Computed inside `SessionStrip.tsx`'s existing layout `useMemo` (which
  already computes every plate's scaled height via `scalePlateHeights`
  for unrelated reasons — reusing that instead of a second pass), which
  then builds one adjusted theme object for that render and passes it to
  every `<Frame>` instead of the original. `ConvertedLeadCard` is the
  first and so far only consumer — applied there, not anywhere else,
  per the user's framing of this as "a variety, not a permanent
  modification."

## 2026-10-01 (later still) — Conversions cards: caching, UI, animation

User confirmed the feature works, then asked for three fixes plus full
documentation (this entry + `mds/features.md`'s new "Conversions List"
entry + `mds/local_cache_schema.md`'s new section).

- **It was never caching at all.** `ConvertedLeadsExplorer` called
  `getConvertedLeadSessions` directly on every mount/filter-change, no
  cache layer whatsoever — confirmed by reading the code, not assumed.
  Fixed with a new, dedicated module, `lib/convertedLeadsCache.ts`
  (deliberately NOT folded into the existing `lib/chartRangeCache.ts`,
  even though the shape is near-identical, specifically so this TTL —
  `CONVERTED_LEADS_CACHE_TTL_MS`, a single clearly-labeled constant at
  the top of that file, currently 2 minutes — can be changed later
  without touching the reach/conversions/merged charts that share
  chartRangeCache.ts's own TTL). Same raw-rows-cached /
  built-client-side-via-useMemo split `LeadSessionExplorer` already
  established — `ConvertedLeadsExplorer` now holds `rawData` in state,
  derives `sessionsRaw`/`cards` via `useMemo`, exactly mirroring that
  component's architecture.
- **Identity row redesigned.** Name (or email, if no name) now renders
  in `#eab308` — the exact same yellow `framePlate/theme/defaultTheme.ts`
  uses for the "converted" outcome everywhere else, a deliberate color
  tie-back rather than a random pick. Added a small sparkle icon, split
  the subtitle into icon-labeled page/date, and stopped repeating the
  email when there's no separate name to justify showing it twice.
- **Smooth expand/collapse.** Added `.jh-collapsible` to
  `app/globals.css` — a `grid-template-rows: 0fr → 1fr` transition, not
  `max-height` (which has to guess an upper bound and animates linearly
  against that guess rather than the content's real height — looks subtly
  wrong for a card holding a variable-height chart). Content stays
  mounted regardless of expanded state; collapsing only zeroes the grid
  row. Reusable anywhere else in the app that wants the same effect, not
  built as a one-off inline style.

## 2026-10-01 (later still) — "Form imitation" renamed to "form mini-plate"; docs rewrite

User called "form imitation" a bad name and asked for "form mini-plate"
instead, plus a rewrite of the session-replay and conversions docs so
every visual element explicitly states what it represents, and asked the
writing style itself be grounded in how professional SaaS products write
docs (researched via WebFetch against Stripe's docs before writing —
pattern taken: state the concept plainly, then its exact values/behavior
as a flat list or table, callouts for edge cases, explicit statement of
what a reserved-but-unused value is for rather than silently omitting
it).

- **Renamed everywhere, not just in prose.** This app's own documentation
  philosophy (stated on the session-replay page itself: "matching exactly
  what the code itself calls them") meant code identifiers had to change
  too, not just doc text. Renamed `theme.formImitation` →
  `theme.formMiniPlate` (`framePlate/types.ts`, `defaultTheme.ts`,
  `validateTheme.ts` — including the explicit-whitelist final object
  construction line, the one place a renamed-but-not-added-there field
  would silently vanish), and `FormImitation`/`computeFormImitationGeometry`/
  `FormImitationGeometry` → `FormMiniPlate`/`computeFormMiniPlateGeometry`/
  `FormMiniPlateGeometry` in `framePlate/components/FullPagePlate.tsx`.
  `TerminologyDiagram.tsx`'s `FORM_IMITATION` constant, its rendered
  callout label, and its `aria-label` all renamed too. Grepped the whole
  repo afterward to confirm zero stray references outside this file and
  `mds/database.md`'s intentional "renamed from" note.
- **Session-replay page (`/docs/concepts/session-replay`) rewritten** so
  the terminology section states explicitly what each element represents,
  per the user's own framing: plate → the entire real page's true height
  (scaled by a fixed ratio, clamped, never relative to other pages in the
  session); bulb position → where on the page that specific moment
  happened; frame width → how long the visit lasted; frame color → the
  visit's outcome; form mini-plate → the form's own real measured
  position/span, not a single point. Also added a short note to "Frame
  colors, exact values" that `active`/`expired` exist in the theme but
  are never actually produced by real code today (confirmed by reading
  `components/leads/ChartLegend.tsx`'s own identical caveat, which already
  excludes them from the in-app legend for the same reason) — deliberately
  disclosed rather than silently left out, the way a reserved-but-unused
  API field gets called out rather than hidden.
- **Conversions reference page (`/docs/reference/conversions`) — the
  existing brief "Conversions list" section expanded**, not replaced: now
  covers the collapsed-by-default cards, the yellow identity-name color
  tying back to the session-replay chart's own converted color, and a
  plain-language caching note (mirroring the existing wording style on
  `/docs/troubleshooting` about session data caching) — deliberately no
  internal file/function names on this page, since it's user-facing,
  unlike `doc_source_map.md`.
- `mds/database.md`'s `form_engagement` section and
  `mds/documentation/doc_source_map.md`'s session-replay row updated to
  the new name, with an explicit "renamed from X" note rather than
  silently rewriting history. `mds/features.md` was already clean (never
  referred to it as "form imitation" to begin with). Verified with
  `npx tsc --noEmit -p .` and `npx next build`, both clean.
- **Noticed, not fixed (out of scope for this request):**
  `framePlate/components/FullPagePlate.tsx` still has a `console.log`
  block marked `// TEMP DEBUG — remove once the page-height investigation
  is done`, firing on every render (visible in the build output). Worth
  removing in a future pass.

## 2026-10-01 (later still) — Main chart: sessions online over time

Built the TradingView-style "busiest times" chart the user specced in
`mds/todos.md`, in its own module `main-chart/` (docs inside it:
`overview.md`, `docs/architecture.md`, `docs/data-flow.md`,
`docs/ui-ux.md`; renamed the pre-created `architucture.md` typo).

Decisions taken with the user before building:
- **Peak during bucket**, not sampled-at-tick. Both give identical results
  for every example in the spec; peak additionally never hides a visit
  that starts and ends between two ticks.
- **uPlot + custom** (new dependency, `uplot` 1.6.32) over TradingView's
  Lightweight Charts: Lightweight Charts spaces bars evenly and caps
  zoom-out at ~3,000 bars, which makes "5s interval over five months"
  (variety 1) impossible. uPlot has a continuous time axis; the chart
  draws per-pixel high/low ranges when buckets outnumber pixels.
- **Ghost tabs labeled, not fixed.** User pointed out history is already
  correct (the sweep backdates `ended_at`); agreed, the effect is only on
  the live edge before the sweep runs. Last 30 min drawn in FramePlate's
  "live" cyan with an explanation instead of a tracker heartbeat (which
  would multiply `/api/track` traffic).

How it works: raw spans (`id, started_at, ended_at`) come from
`lib/actions/mainChart.action.ts` (paged, carry-in for sessions open
across a range edge, live poll by `last_activity_at` + re-read of open ids
to catch backdated sweep closes, server clock returned for skew
correction). Everything else is computed in the browser per frame:
`engine/computeSeries.ts` skips event-free bucket runs in one step, so 5s
over 5 months (2.5M buckets, 100k sessions) recomputes in ~9 ms. Placed
full-width under the key stats on `/platform/dashboard`.

Verified: engine against the spec's examples, edge cases and 40 random
brute-force comparisons; store against a mocked DB (20 cases incl.
reopened sessions, clock skew, empty site); `tsc`, `eslint`, `next build`
clean. NOT verified in a real browser (behind Clerk sign-in).

Open items: run the two `sessions` indexes (SQL in `mds/database.md`);
marker layers (conversions, `users.created_at`) designed in
architecture.md but not built; `reachOverTime.action.ts` and similar don't
page past PostgREST's 1,000-row cap. 

## 2026-10-01 (later still) — Main chart: smooth line, zoom controls, header fix

User feedback on the first version:
- **Line shape.** Wanted points joined smoothly (like the shadcn area
  chart), not steps. Default is now a monotone cubic curve (`uPlot.paths.spline`),
  chosen over a "natural" spline because it can't overshoot: no curve below
  0 or above the real peak between two points. The stepped version was kept
  as a variety (Smooth / Steps toggle); both share the same computed data.
- **Wheel no longer zooms.** It was capturing page scroll whenever the
  cursor was over the chart. Now only a trackpad pinch zooms (ctrl+wheel in
  Chrome/Edge/Firefox, gesture events in Safari), plus new +/- buttons at
  the plot's top right. Plain wheel scrolls the page.
- **Readout line moved to its own fixed-height line**, so its changing text
  no longer pushes the controls down.
- **Marker placement decided by the user:** an event snaps forward to the
  next point (10:43 on the 5s chart -> the 10:45 point). Recorded in
  `main-chart/docs/architecture.md`; markers themselves still not built.

## 2026-10-01 (later still) — Main chart: Trend variation, fetch audit

**Trend line style (third variation, Smooth | Steps | Trend).** The user's
"smooth" meant something different from a curved line: a session that
starts at 2:30 am, with the next change at 9:30 pm, should make the line
travel slowly between those two moments, not sit flat at 1 all day, so
bumps only appear where many sessions arrive close together. Built as
`main-chart/engine/computeTrend.ts`:
- a point only in buckets where the count changed (an arrival or departure);
  empty buckets get none, so the curve runs straight across them;
- each point = time-weighted average online across its bucket;
- the ends are anchored on the real change just before / just after the
  view (or "now"), never on the view's edges. The first version used the
  edges and would have reshaped the line while panning; caught while
  testing the user's own example, fixed, and covered by a pan-stability
  test (two different views agree point for point);
- more change points than pixels: averaged per pixel column.
Tradeoff stated in the UI and docs: being averages, a very short spike
looks smaller in Trend than in Smooth/Steps, which never hide anything.

**Fetch audit.** Confirmed: after the first load, nothing but the 15s live
poll touches the database. Pan/zoom/interval/style/hover/clock never do,
and the poll only asks for rows touched since the last poll plus open ids,
never the whole history. Two fixes from the audit:
- the store's change counter also bumped on every request start/finish,
  forcing two full timeline rebuilds per poll even with no new data;
  spans now carry their own counter that only moves on a real row change
  (CPU only, not DB);
- coming back to the dashboard waited up to 15s before catching up; it
  now polls immediately on mount.

**User question answered with numbers** (measured: 140 B/row DB->server,
67 B/row server->browser; example site with 20k sessions, one tab open
one hour, 240 polls): refetching everything every poll = 4,800 DB
requests and ~672 MB DB->server per hour, growing every day; what's built
(load once, then only changes) = ~480 requests and ~0.2 MB, flat as
history grows. ~10x fewer requests, over 3,000x less data. Persisting to
localStorage on top would only save the ~2-hour first load (~3 KB here),
so not worth the quota and main-thread parse cost yet. Also recorded:
"fetch only sessions started after X" alone would miss closes, reopens and
backdated sweep closes. Full write-up in `main-chart/docs/architecture.md`
("Why it fetches only what changed") and `docs/data-flow.md` (section 3b).

## 2026-10-01 (later still) — Main chart: marker layers (conversions, team joins)

Built the two marker layers from the plan, each behind a checkbox (off by
default), drawn on top of the session line without ever changing it.

- **Conversions:** yellow dot on the line per `form_submissions` row,
  snapped FORWARD to the next point (10:43 on the 5s chart -> the 10:45
  point, the user's rule). Height = the line's own height at that point;
  in Trend it's evaluated on the drawn curve itself (`monotoneCubicAt`,
  same Fritsch-Carlson construction uPlot uses), so dots sit exactly on the
  line in all three styles. Several on one point = one dot with a count.
- **Team joined:** vertical line per active `site_members` row of THIS
  site. The user's note said `users.created_at`; asked first and the user
  chose site team joins, because `users` is Jellyhook's global signup table
  and would show other customers' signups on everyone's chart (a
  cross-tenant leak).
- **Found while building:** accepting an invite UPDATES the pending row in
  place, so `site_members.created_at` is the invite-SENT time. Added
  `joined_at` (SQL in mds/database.md, not yet applied), set by
  `acceptInvite`; chart reads `joined_at ?? created_at`. Both
  `acceptInvite` and the chart retry without the column if it doesn't exist
  yet, so invite acceptance can never break over it.
- **Data:** `getMarkerEvents` (range loads; team list whole, once) and
  markers riding inside the existing live poll call, each layer with its own
  cursor, so a layer switched off for a while catches up when switched back
  on, and switching markers on adds no server calls. Separate maps and
  coverage in `SpanStore`; kept in memory (the user chose in-memory over
  IndexedDB), documented with numbers in `main-chart/docs/data-flow.md` §6.
- **Testing caught two placement bugs before shipping:** a conversion from
  before the view got pulled onto the first visible point, and the fix for
  that then dropped conversions whose next point hadn't happened yet.
  Both fixed and covered. Marker store tests: range-only loads, no
  refetch, live arrival in the single poll call, catch-up after re-tick,
  removed members disappear.
- New SQL to run (none are deploy blockers): `form_submissions
  (site_id, submitted_at)` index, `site_members.joined_at` column, plus the
  two `sessions` indexes from before.
- Not verified in a real browser (behind Clerk sign-in).

Next, per the user: the live "now" item from `mds/todos.md`.

## 2026-10-01 (later still) — "No data in the chart" + LiveTicker hydration error

User report: a hydration error on the dashboard, and the main chart showing
no data. Diagnosed with read-only queries against the real database
(service role, the chart's exact queries) instead of guessing:

- **The chart's queries were fine** (carry-in `or` filter included). The
  test site (`localhost:3003`) had 58 sessions, latest started 6.4h ago,
  zero in the last 2h. The chart opened on "last hour at 10s", which was
  correctly all zeros, and looked like nothing loaded.
- **Real bug that made it worse:** the "No sessions yet. This fills in as
  soon as your first visitor arrives." message was keyed on
  `store.size === 0`, i.e. *loaded* sessions, so a site with 58 sessions
  and none in the loaded hour was told it had never had a visitor. Now
  decided from the site's latest session time (`getSessionBounds`, renamed
  from `getFirstSessionAt`, now also returns the latest `started_at`).
- **Opening view:** if nobody visited in the default window, live mode
  opens wide enough to include the most recent visit
  (`theme.lastVisitPadding`). Panning/zooming into an empty stretch shows
  "Nobody was online in this stretch · last visit Xh ago" with a
  **Show the last visit** button.
- **Hydration error (separate, pre-existing, `LiveTicker`):** each row's
  "Xh Ym ago" was computed from `Date.now()` during render. The server said
  "23h 48m ago", the browser a minute later "23h 49m ago", so React threw
  away the server HTML and rebuilt the page. Now read through
  `useSyncExternalStore` with a clock that's null on the server and during
  hydration, then ticks every second.
- **Also:** `storeFor()` no longer registers stores during server rendering
  (they'd have lived in server memory forever, one per site).
- The same check confirmed `site_members.joined_at` doesn't exist yet
  (error 42703): exactly the case the fallback in `getMarkerEvents` and
  `acceptInvite` handles.
- Store tests extended with the quiet-site case. All engine, trend, marker
  and store tests pass; tsc, eslint and `next build` clean.

## 2026-10-02 — Dashboard/network/billing polish pass (7 separate fixes)

A batch of smaller UX fixes across the dashboard, network, billing and
live-ticker surfaces, from direct user feedback.

- **FramePlatePreviewCard renamed "Lead footprints".** Each slot now labels
  itself "{name}'s footprints" instead of a generic "Session Playback"
  title. Which lead lands in each slot changed from `Math.random()` to
  frequency-based: the lead with the most `form_submissions` rows (someone
  who's shown up/converted repeatedly) gets slot A, the next-most-frequent
  distinct lead gets slot B — see `rankByFrequency()`. The component now
  takes the site's `leads` array directly (name/email included) instead of
  a bare list of visitor ids, so it can compute this itself without an
  extra query.
- **"Active Now" tile now updates live, no reload.** It used to be a
  one-shot `getActiveVisitors()` server query at page load — stale until a
  full reload, while the main chart right below it kept counting live and
  visibly disagreed with it. Replaced with `useSessionsOnlineNow(siteId)`
  (new hook in `main-chart/hooks/`), which reads the EXACT SAME per-site
  store the main chart uses (`storeFor`), so the two numbers aren't just
  "close" — they're the literal same computation over the literal same
  data. Self-loads a small window so it also works if the main chart isn't
  mounted on a page. `getActiveVisitors` itself left in place (unused for
  now) rather than deleted, in case something else still wants a 30s-window
  definition of "active" later.
- **New Reach / Conversions mini charts link to `/platform/conversions`.**
  Only the `mini` (dashboard-preview) variant — the full chart doesn't
  link to itself.
- **User settings → Billing: "everything free" instead of a real plan
  card.** Replaced the `{plan} plan` / `ACTIVE` badge display with a gift
  ribbon ("Free for now") and a blurred, non-interactive ghost of what a
  real plan card would show, matching the exact blur treatment
  `/pricing`'s `PricingCards.tsx` already uses for locked-feature text.
  The upgrade/manage-billing button is gone (nothing to manage); replaced
  with a link to `/pricing` for what's coming later. Scoped to this one
  card only — `/platform/billing`'s own full page (`BillingClient.tsx`) was
  left untouched, since the request was specifically about the user
  settings page.
- **Network tab: sidebar instead of oversized cards.** The old layout
  (two `StatTile`s — "Members"/"Declined" — plus a big owner "hero" card
  and a grid of 260px-min member cards) spent most of its width on padding
  around one line of text each. Replaced with a right sidebar
  (`<aside>`, members for now per the user's framing — declined invites
  get their own small section below it): each row is avatar on the left,
  name (+ owner crown / "(you)") on the right, email/role underneath. The
  invite form and pending-invites list stay in the main column, unchanged
  functionally — only the display/layout of owner+members+declined
  changed, `handleInvite`/`handleRemove`/state all untouched.
- **Live Ticker: Realtime push, polling kept as backstop.** User's own
  clarification: the actual complaint wasn't poll *speed*, it was that a
  new visitor sometimes doesn't update the UI promptly even within the
  existing polling window. True instant cross-browser delivery can't come
  from polling at all (the ticker runs in the SITE OWNER's browser, a new
  visitor's session starts in a completely different visitor's browser —
  the owner's tab can only ever find out by asking the server). Added a
  Supabase Realtime subscription (`postgres_changes` INSERT on
  `page_views`, filtered to `site_id`) that pushes a new row over the
  existing websocket the instant Postgres inserts it, merged into the same
  `mergeIncoming()` the poll path already uses. New
  `lib/supabase/browser.ts`: a browser-side Supabase client authenticated
  via Clerk's client-side `getToken()` (the `useAuth()` hook), mirroring
  `lib/supabase/server.ts`'s server-side `accessToken` pattern — this is
  what makes Realtime respect the exact same site_members-scoped RLS
  policy every other query already goes through, never a separate
  all-or-nothing Realtime auth model. Polling is left running unchanged as
  the fallback: requires `page_views` to be added to the
  `supabase_realtime` publication (SQL in `mds/database.md`, not applied
  yet as of writing) — until then, `.subscribe()` simply never calls back
  and the ticker behaves exactly as it already did.

Verified: `npx tsc --noEmit -p .`, `npx eslint` on every changed
file/directory, and `npx next build`, all clean. Not verified in a real
browser (every page here is behind Clerk sign-in) — in particular, the
Realtime subscription's actual behavior once the publication SQL is run is
unconfirmed; it's additive and safe either way, but worth a manual check
once that SQL has been applied.

## 2026-10-02 (later) — /pricing and /about: removed fabricated claims, de-featured About

User called out that the Pro/Elite FAQ and the site-vs-personal-upgrade
copy were asserting things nobody has actually decided yet.

- **Removed the "What's the difference between Pro and Elite going to be?"
  FAQ entirely** (`app/pricing/page.tsx`'s `FAQS`). It described specific
  Pro/Elite feature splits that were never decided anywhere else in the
  codebase, invented for this one answer.
- **Stopped promising site-upgrade/personal-upgrade parity.** Both the
  last remaining FAQ and the "Where pricing is headed" paragraph used to
  say the two paths "cost the same and unlock the same features," and
  `lib/pricing/tiers.ts`'s own code comment said personal upgrades get
  "Same tier access as the site version." None of that is decided. All
  three now say plainly that pricing/feature parity between the two isn't
  finalized and shouldn't be assumed identical. Also removed one em dash
  from the FAQ answer ("everyone on it — anyone you" → "everyone on it:
  anyone you").
- **About page: replaced the feature list with outcomes.** "One product,
  five working parts" (Tracking & session replay / Lead intelligence /
  Page health intent analysis / Team access / Billing, handled) read as a
  spec sheet. Replaced with what it actually changes for the business —
  lead footprints, conversion path tracking, form friction spotted,
  marketing decisions you can check, spotting confusion before it costs
  you — same persuasion-over-feature-list approach as the 2026-10-01
  landing-page rewrite. Every claim still traces to a real shipped
  capability; nothing invented. Dropped Team access/Billing from this
  section entirely (administrative, not persuasive) rather than forcing a
  fifth outcome to keep the old count.
- Verified: `npx tsc --noEmit -p .`, `npx eslint`, `npx next build`, all
  clean.
- **Noticed, not touched (out of scope for this request):** `/pricing`'s
  hero paragraph still says "page health scoring," the same
  already-flagged, not-a-real-feature claim from the 2026-10-01 landing
  page cleanup (see that entry). Left alone since this request didn't
  mention it.

## 2026-10-02 (later) — Full /docs audit: new-user completeness pass

User asked whether a brand new person could read the entire /docs site
and understand + use the whole SaaS with no prior experience, with zero
fabrication and no em dashes. Read every existing doc page, then read
every real screen under /platform (not just the ones already documented)
to find what was missing, comparing claims against the actual code behind
them rather than assuming the existing prose was still accurate.

**Real product bugs found and fixed along the way (not just doc issues):**
- `/platform/leads/[lead_id]` (the Lead Profile page) was wrapped in
  `<PlanGate required="pro">`, meaning a free-plan user's own leads list
  (itself `required="free"`, always unlocked) led into a blurred "Pro plan
  required" wall on every single lead. This directly contradicted
  "everything free during early access" and would have made the already-
  written `/docs/reference/lead-profile` page describe a feature most
  users couldn't actually reach. Removed the gate, same fix already
  agreed for `/platform/acquisition` earlier this session.
- `/platform/acquisition`: per the user's decision, removed its
  `PlanGate required="pro"` and commented its entry out of the sidebar
  nav (`components/app-sidebar.tsx`), since it isn't considered to have
  real content yet. Deliberately not documented anywhere, per the user's
  explicit instruction.
- `/platform/billing`'s "Upgrade Plan"/"Manage Plan" button linked to
  `/platform/billing/portal`, a route that has never existed, a
  guaranteed 404. Pointed it at `/platform/subscription`, the real
  in-app upgrade preview page, which is obviously what it was supposed to
  reach.
- `app/pricing/page.tsx`, `app/privacy/page.tsx`, `app/docs/installation`:
  removed the last remaining "page health scoring" mentions (metadata
  description and two visible paragraphs) — the same already-flagged,
  never-fixed fabrication from the 2026-10-01 and 2026-10-02 earlier
  passes, now fully gone. Per `mds/documentation/roadmap.md`'s own
  explicit writing rule, the Intent/"page health" heuristic is excluded
  from documentation entirely (it is real code, but "if-condition
  template sentences dressed up as analysis," not a measured fact) —
  confirmed this rule is still correct and left it untouched rather than
  second-guessing it.
- Removed six rendered (not comment) em dashes found across
  `app/platform/leads/[lead_id]/page.jsx`, `app/platform/create-site/page.jsx`,
  and `app/platform/settings/SettingsClients.jsx`. Left the many `"—"`
  single-character fallbacks alone (StatTile/table "no value" placeholder,
  an existing, consistent, unrelated convention, not discourse
  punctuation).

**Doc pages added (two real screens had no doc page at all):**
- `/docs/reference/team`: Network page, Settings' embedded team section
  (confirmed to be the exact same underlying list, just two layouts),
  and the invite accept/decline screen. States plainly that there is no
  self-serve way for a member to leave a site today, even though
  `InviteClient.jsx`'s own accept screen claims "You can leave at any
  time from Settings" — that claim is false as of writing; documented
  honestly rather than repeated.
- `/docs/reference/billing`: what `/platform/billing` and
  `/platform/subscription` show during early access. Does not describe
  `BillingClient.tsx`'s per-feature checkmark row in detail, since during
  early access it can show a locked ✗ next to features that are actually
  fully unlocked for everyone, which is misleading on the page itself;
  noted as a known, not-yet-fixed issue in `doc_source_map.md` instead of
  silently repeating it as fact.

**Existing pages updated with real, previously-undocumented features:**
- `/docs/reference/dashboard`: added the live "Sessions online" chart
  (Smooth/Steps/Trend, drag/pinch/zoom, the two marker checkboxes, the
  honest 30-minute provisional-data caveat) and the "Lead footprints"
  preview card (now frequency-ranked, not random). Corrected "Active Now"
  to describe its current live, second-by-second behavior instead of the
  old one-shot snapshot. Clarified "Visits over time" is a different
  chart from the new one, not a restatement of it. Noted the mini
  New Reach/Conversions charts now link to the full Conversions page.
  Mentioned the Live Ticker's Realtime push alongside its polling
  backstop.
- `/docs/reference/settings`: added Team members (cross-linking to the
  new Team page) and a Danger Zone section distinguishing Deactivate
  (one-way, removes the site from your account's list, confirmed via
  reading `deactivateSite()`: no un-delete path exists anywhere) from
  Pause (fully reversible).
- `/docs/installation`: mentioned multi-site support (one account can
  switch between several sites), previously undocumented anywhere on the
  whole docs site.

**Deliberately still not documented, confirmed correct to exclude:**
`/platform/intent` and its Engagement Score sibling (roadmap.md's
existing rule, re-confirmed, not revisited), `/platform/visitors` (an
empty stub, no real content), the shadcn demo stub at the `/platform`
root route (never linked, not a real screen), `/platform/intent/debug`.

`docsNav.ts`, `doc_source_map.md`, and `roadmap.md` all updated to match.
Verified with `npx tsc --noEmit -p .` and `npx next build`, both clean,
after every batch of changes. Not verified in a real browser.

## 2026-10-02 (later still) — Dashboard chart fixes: bucketing, labels, layout

Four fixes to dashboard charts from direct user feedback.

- **Visits Over Time was mislabeling and mis-bucketing its own data.**
  `lib/actions/visitsOverTime.action.ts`'s "Last 7 Days" preset used a
  1-day bucket size, but its label formatter branched on `bucketMs <= DAY`
  for the "show date + time" case — since the bucket IS exactly one day,
  that branch fired, producing "Sep 25 10:54" instead of "Sep 25" for
  every tick. Separately, bucket START times were computed as
  `now - N*day`, which carries whatever time-of-day "now" happens to be,
  not aligned to a day boundary at all, so even a correctly-labeled day
  bucket wouldn't have actually split the data into real calendar days.
  "Last Month" used 4-day buckets (labeled as ranges like "16-20") instead
  of daily ones. Fixed:
  - "Last 3 Days" replaced with "Last 24 Hours" (24 hourly buckets,
    rolling from now, not day-aligned, since an hour-of-day window has no
    natural day boundary to align to).
  - "Last 7 Days": 7 buckets, one real calendar day each.
  - "Last Month": 30 buckets, one real calendar day each (was 7 buckets
    of 4 days).
  - "Last 3 Months": unchanged in size (13 weekly buckets, this one was
    already correct), now aligned the same way as the others.
  - Day/week bucket edges now align to the VIEWER's local midnight, not
    the server's. Since this is a `'use server'` action, the server has
    no idea what timezone the browser is in: the client now sends its own
    `Date.prototype.getTimezoneOffset()` along with the request, and the
    server uses it only to align bucket boundaries, never to format text.
  - Label TEXT moved out of the server action entirely and into the
    client component instead, formatted from each bucket's ISO boundary
    with `toLocaleDateString`/`toLocaleTimeString` running in the actual
    browser locale/timezone — the server previously built the label
    string itself, which would have been silently wrong in whatever
    timezone the server happens to run in (typically UTC on Vercel),
    regardless of the alignment fix above. The server now returns a
    single `granularity` ("hour"/"day"/"week"/"month") per result instead
    of a per-bucket label, removing the ambiguous `bucketMs` threshold
    check that caused the original bug.
  - Verified the alignment math directly (not just via the UI, which
    can't be checked here): 13 cases including a cross-timezone check
    that the same instant produces different, correctly-aligned local
    midnights for US Eastern vs. Tokyo. All pass.
- **`DateRangePicker.tsx`** (shared by the full New Reach / Conversions
  charts on `/platform/conversions`): added "Last 24 hours" / "Last 7
  days" / "Last month" quick presets alongside the existing "All time"
  and "Custom range". Which preset is selected is now tracked in its own
  state, not derived from the resulting start/end values — deriving it
  would have been ambiguous (a custom range that happens to span exactly
  7 days is indistinguishable from the "Last 7 days" preset in start/end
  terms alone).
- **Mini New Reach / Conversions charts on the dashboard** (no controls
  at all) now say "Last 3 days" under their title, matching the actual
  window `miniRangeStart(3)` already uses, instead of leaving the window
  unstated.
- **"Pages" card on the dashboard**: the bar chart and the table used to
  stack vertically, each full width, for what is the same data shown two
  ways. Now side by side on wide screens (`grid lg:grid-cols-2`), stacked
  only on narrow ones.

Verified with `npx tsc --noEmit -p .`, `npx eslint`, and `npx next build`,
all clean. Not verified in a real browser.

## 2026-10-02 — Main chart: "online" now means a page view is open, not a session

User request: when a visitor leaves the site (not necessarily closes a
session), the chart should bump down immediately rather than counting
them as online until the session formally closes, and bump back up if
they return.

- **Root cause of the old behavior.** A `sessions` row stays open across
  a visitor leaving entirely and coming back, right up to the 30-minute
  idle sweep (`lib/closeStaleSessions.js`) — see `mds/database.md`'s
  "Away gaps" note. Sourcing the chart from `sessions` therefore counted
  genuine away-time as online.
- **Fix: source from `page_views` instead.** `main-chart/types.ts`'s
  `SessionSpan` → `OnlineSpan`; every span is now one `page_views` row
  (`entered_at`/`left_at`), not one `sessions` row. A session with two
  page visits separated by a real gap now produces two separate spans —
  a visible dip and recovery — instead of one unbroken stretch.
  `lib/actions/mainChart.action.ts` rewritten: `getSessionBounds` →
  `getActivityBounds`, `getSessionSpans` → `getOnlineSpans`, both now
  querying `page_views`. `getLiveSpanUpdates`'s "touched since" filter
  changed from `sessions.last_activity_at` to `page_views.entered_at`,
  since `page_views` has no heartbeat column — closes (normal or
  sweep-backdated) are still caught via the existing re-read-every-open-id
  mechanism, so no schema change was needed for live polling.
  `main-chart/data/spanStore.ts` renamed its bounds fields
  (`firstSessionAt`/`lastSessionAt` → `firstActivityAt`/`lastActivityAt`)
  to match. The engine files (`buildTimeline.ts`, `computeSeries.ts`,
  `computeTrend.ts`, `markers.ts`) needed only renames/comment updates —
  they were already generic over `{start, end}`.
- **Judgment call: no grace period.** Same-site page navigation creates a
  brief real gap between one page view's `left_at` and the next one's
  `entered_at`, but it's sub-second in practice and is absorbed by the
  chart's existing peak-based bucketing (finest granularity 5s) without a
  visible flicker. Decided against introducing a `minGapMs`-style buffer
  (unlike FramePlate's own `DEFAULT_MIN_GAP_MS` for its "away" frame
  detection) since it wasn't needed and would add a tunable with no clear
  correct value. Not explicitly confirmed with the user before
  implementing — flagged in case a buffer turns out to be wanted later.
- **Added `page_views_site_entered_idx` (site_id, entered_at)** to
  `mds/database.md` as a hand-off migration (not yet run). Removed the
  now-wrong "required by the main chart" note from the old
  `sessions_site_started_idx`/`sessions_site_last_activity_idx` pair
  (still required, just by `getVisitsOverTime` now, not the main chart).
- **Docs updated:** `main-chart/overview.md` gained a new "Online means a
  page is actually open" section (the promise `mainChart.action.ts`'s own
  header comment now makes); `docs/architecture.md` and `docs/data-flow.md`
  had every `sessions`-sourced claim corrected, including removing the
  now-false "away time counts as online" line from `data-flow.md`;
  `docs/ui-ux.md` had its factual (not just cosmetic) `sessions`
  references updated. The public `/docs/reference/dashboard` page gained
  a paragraph explaining the bump-down/bump-up behavior in plain terms.
- **Tests.** Scratchpad mock DB and store test harness updated to the
  `page_views` model; one old test case (a closed row "reopening," valid
  for `sessions`' reload-triggered dedup logic) was removed rather than
  fixed, since nothing in the real `page_views` lifecycle can reopen a
  closed row — confirmed by reading `app/api/track/route.js`'s
  `page_view_start`/`page_view_end` handling, which always mints a new row
  rather than clearing an old `left_at`. Added a new test exercising the
  actual requested behavior directly: online while on a page, bump down
  the instant it closes, bump back up on the next page view. All pass.
- Verified with `npx tsc --noEmit -p .`, `npx eslint`, and
  `npx next build`, all clean. Not verified in a real browser.

---

## 2026-10-02 — Hook engine (/dev/hook), v1 then v2

- New module `jh-hook/` (docs and engine), `lib/actions/hook.action.ts`,
  `lib/hook/pgDb.ts`, `app/dev/hook/page.tsx`. A query is a typed JSON
  spec (Hook's own language) that the engine compiles to one SQL statement.
  Full decisions, trade-offs and roadmap are in `jh-hook/` (start at
  `plan.md`).
- Same day, rebuilt as v2 after Joshua's correction that v1 only covered
  the literal examples: a generic typed language (`jh-hook/schema.ts` +
  `engine/sqlmap.ts`), any operator on any field, related-row measures,
  AND/OR/NOT, and real tunnels (any value can be another hook's output,
  shape- and type-checked). Recursive builder in
  `components/hook/HookBuilder.tsx`.
- Decided with Joshua: own language compiled to SQL; direct `pg` connection
  as a read-only `hook_reader` role (`jh-hook/setup.sql`, RLS policies, no
  BYPASSRLS); auto AND manual order with a guard; no AI yet; credits from
  EXPLAIN, checked before running. `/dev/hook` is Joshua's test bench; a
  dedicated, authorized Hook page comes later.
- New dependency `pg` (+ `@types/pg`), new env var `HOOK_DATABASE_URL`.
- Also this session: dashboard Pages table narrowed; /conversions lead cards
  collapsed to one short line.
- Verified with tsc, eslint, next build, and 44 engine checks on in-memory
  Postgres (PGlite), which caught two real bugs (NOT dropping empty values;
  LEAST ignoring NULL making unmeasured pages read 100% seen). Not run
  against the real database or in a browser.

---

## 2026-10-06 — Hook: future-proofing, form friction, canvas features, docs

- Query format v3 + `jh-hook/migrate.ts`: every query (URL, paste, engine
  entry) is upgraded to the current format, so saved and shared queries
  survive shape changes. Keys are permanent ids; labels are free.
- New Hook entity **form fields** (per-field form friction from
  `form_engagement.field_timings`), so the product's "form friction"
  promise is queryable in Hook.
- Error policy (`HookError` shown verbatim, everything else as a reference
  code), `[hook]` logging, on-screen notices. The builder gains names,
  notes, collapse, vertical drag spacing, "Use this hook as a sub-hook", a
  `</>` code panel and Copy link.
- Engine tests now live in the repo: `npm run test:hook` (61 checks;
  `@electric-sql/pglite` and `jiti` added as dev dependencies).
- Docs: `jh-hook/user-guide.md`, `docs-brief.md` (for the public docs),
  `architecture.md` (developer guide part 1, engineering) and
  `data-flow.md` (part 2, data flow).
- Verified with tsc, eslint, next build and the test suite. Not checked in
  a browser.

---

## 2026-10-06 (later) — /platform/hook, sequences, silhouette preview v2

- `/platform/hook` (sidebar: Hook, all plans) and `/dev/hook` share
  `components/hook/HookWorkspace.tsx`; the product mode hides SQL, the
  Postgres cost and raw ids. Hook's server action now resolves the site with
  `getUserSite`, exactly like every platform page.
- Engine: sequence connections on page views (next page, previous page,
  pages after it, pages before it), 5 new checks (66 total).
- New `silhouette/` module: a live, faint FramePlate preview beside the
  builder, derived from the hook alone (`silhouette/rules.md` is the
  contract for when each shape is drawn; 23 checks,
  `npm run test:silhouette`). Every shape records the condition that drew
  it, ready for the interactive v3.
- Decided with Joshua: sticky right sidebar; one pulse per edit; ranges as
  minimum solid + faint "?" extras; smaller labelled sub-hook figures; page
  results get a page figure plus a session figure only when the session is
  involved; folder named `silhouette/`.
- Verified with tsc, eslint, next build, both test suites, and a server
  render of both pages. Not clicked through in a browser.

---

## 2026-10-06 (evening) — Hook output engine + results canvas

- New `output/` module (rules in `output/rules.md`): Hook results are drawn
  as what they are, never as ids. Numbers come with a base rate; breakdowns
  become bars; lists become session replays (FramePlate), lead mini profiles
  (raw form answers behind a reveal), and visitor, page, form and field
  views.
- Evidence, only when the hook filtered on connected rows: the matched
  visits are ringed inside the replays, using a new optional
  `highlightIds` prop on `FramePlateChart` (unchanged when omitted). Leads
  show their converting session; visitors show up to 2 matching sessions.
- "Show more" loads from sealed AES-GCM tokens (site- and view-bound, 24 h):
  no re-run, no credits, no readable ids in the browser.
- Two-hook comparison with a formula (A / B, %, difference, change).
- Hook's server actions now share `lib/hook/site.ts` (same site rule as
  every platform page, same error policy).
- Silhouette fixes: outlines were nearly invisible in dark mode (checked by
  rendering the SVG to images in both themes); described pages now end with
  "+" when no page count is given.
- Verified with tsc, eslint, next build and three test suites (66 + 24 + 28
  checks). Not exercised against real data in a browser.

---

## 2026-10-06 (night) — Dashboard tiles, Visits over time, Hook card, Support

- Dashboard: Site Health removed; a green Hook shortcut card (swinging hook,
  white in light mode) in its place. The top tiles (Page Views, Sessions,
  Leads, Conversion Rate) each have a 24h / 7d / 30d menu and a change vs
  the previous window ("50% fewer form submissions than the previous 24
  hours" on hover; the rate in percentage points). Active now is a round
  badge with a pulsing dot; its description shows on hover. Every updated
  tile and chart has an (i) explanation (`components/InfoTip.tsx`).
- Fixed along the way: the old tiles read rows, so "Total Sessions" was
  silently capped at 1,000 by PostgREST; the new ones use exact counts.
  Visits over time also read rows unpaged; it now pages (up to 100,000 per
  window, stated on the chart beyond that).
- Visits over time: Unique visitors (once per person per bar) and Split by
  referrer / device / country as stacked bars, with a legend, a tooltip
  naming every colour, top 7 + Other, and colours fixed per group across
  bars and the Unique toggle. Counting extracted to
  `lib/analytics/visitsAggregate.ts` and tested (`npm run test:visits`).
- New Reach / Conversions minis draw a flat 0 line instead of an empty
  message.
- Sidebar Support opens a message dialog (no rating) stored in a new
  `support_requests` table. Joshua must run its SQL (`mds/database.md`).
- Conversions page: the all-time total became the same windowed tile (All
  by default); "View full information" is now "View lead information".
- Docs: `/docs/reference/dashboard` and `/docs/reference/conversions`
  updated; developer notes in `mds/documentation/dashboard-2026-10-06.md`.
- Verified with tsc, eslint (new code), next build and the test suites. Not
  checked in a browser.

---

## 2026-10-07 — Calendar, leads, lead profile, conversions, URL state

- New range calendar (`components/ui/DateRangeField.tsx`) replaces every
  default date input: chart range pickers, the main chart, the conversions
  list, the leads filter and Hook's exact-date fields.
- Dashboard top tiles gained an "All time" option.
- /platform/conversions: the Conversion Rate Over Time chart was deleted
  (it repeated the Conversions chart); "In range" and "Growth" moved into
  New Reach and Conversions (`ChartFacts`).
- /platform/leads: opens on All time (not Today), a whole row opens the
  lead, and the bottom fade only shows when there are more rows.
- Lead profile: engagement score removed (code, chart and the score in
  `leadProfile.js`); new "at a glance" stats card with pages per visit;
  form details show 4 fields and a "+N more" button; conversion events are
  one row of badges; the session chart's (i) "Read docs" now points at
  /docs/concepts/session-replay.
- State in the URL (`lib/urlState.ts`, keys in
  `mds/documentation/url-state.md`): leads search/date/status, conversions
  layout/range/page, the lead's selected session. Local cache schema updated
  with the per-browser preferences.
- Billing line without an em dash.
- Docs: public pages for leads, lead profile, conversions and dashboard;
  `mds/documentation/leads-conversions-calendar-2026-10-06.md`.
- Verified with tsc, eslint (new code), next build. Not checked in a
  browser.

---

## 2026-10-07 — Tracker and backend audit, ingestion hardening

Full write-up: `mds/reports/tracker-backend-audit-2026-10-07.md`.

- **Audit.** Read the tracker, all ingestion routes, sweeps, site and settings actions. Ten high and eleven medium findings; the worst: a debug overlay
  shipped on every customer page, any hit from any website verifying a site, PII and API keys in server logs, another account's API key returned when a
  domain was "taken", and a visitor-insert race that created unbounded duplicates.
- **Tracker.** Debug HUD removed; silent unless `data-debug`; shared session in localStorage ended only by 30 min idle (no end on unload); one active window
  (BroadcastChannel + storage fallback); heartbeat every 5 min; `text/plain` sends (no CORS preflight); `host` and the key in the body; tightened fetch
  interceptor; `data-track-field`, `data-track-click`; viewport width; first-touch flag; structure on every page view; health reports; guards for http pages,
  async loads, blocked storage and double install. Verified in real Chrome (`scripts/tracker-e2e/run.js`).
- **Routes.** `/api/track` rewritten (visitor upsert, no cross-session closing, reopen, validation, usage counters, host and key checks, no PII logging);
  `/api/track-structure` writes versions; `/api/track-form*` validated and quiet; `/api/close-stale-sessions` needs `CRON_SECRET`; `/api/debug-site` deleted.
- **Sites, keys, roles.** Claims with 3-day expiry and first-to-verify ownership; host matching and allowed hosts; 72 h key grace; owner / admin / member with
  one permission table; ownership transfer; Settings "Tracking" section (status, allowed hosts, attribute check); Event Limit removed from Settings.
- **Replay.** Each visit drawn with the structure version it was recorded under; a quiet session is drawn as ended, not live; leftover TEMP DEBUG logging removed.
- **Usage.** `site_usage_daily`, `/dev/usage` (per-event cost, measured table and column sizes, capacity calculator).
- **Storage.** Measured: `page_views` +34 B per row (+5.4%), `visitors` +202 B per visitor, inserts about +6%. An index that would have added 88 B per
  page view was removed from the migration because of the measurement.
- **Docs.** Developer docs in `mds/documentation/*-2026-10-07.md`, audit in `mds/reports/`; public pages for installation, tracking attributes (new), settings,
  team, sessions and troubleshooting; privacy copy; `database.md`, `local_cache_schema.md`, `doc_source_map.md`.
- **To do by hand before deploying matching code:** run the migration; set `IP_HASH_SALT` and `CRON_SECRET`; in production set `DEV_USAGE_USER_IDS`.
- **Not built:** `<p>` tag statistics (to be discussed first). Not verified: the Settings and create-site screens in a browser against a real Supabase.

## 2026-10-08 - Ask Hook (AI question to Hook query)

- **What.** A box above the Hook builder: the person types a question, GPT-5.6 Terra returns a Hook spec (never SQL), it is normalized and validated (validateSpec + dry compile) with one repair retry, and the builder fills in. Nothing runs until the person presses Run. Vague questions get one clarifying question; impossible ones get an explanation.
- **Built.** `jh-ai/` (prompt, generated schema card, glossary, 52 examples, model registry, OpenAI provider, normalize, check, translate, tests, eval), `lib/ai/ledger.ts`, `lib/actions/hookAi.action.ts`, `components/hook/AskHook.tsx`, AI section on `/dev/usage`, migration `2026-10-08-ai-requests.sql`, docs in `mds/build/ai-hook-translate/`.
- **Measured (real API).** 39/39 valid queries, 90% exact on the honest set (37/41), about $0.0023 per question, 97% of input cached, median 1.5 s. 50 offline checks pass (`npm run test:ai`).
- **Decisions.** Spec not SQL; Terra default with `AI_HOOK_MODEL` to swap; thinking off; AI cost charged in Hook credits (recorded and shown, not yet deducted: no balance exists); a person gets 20 questions a day, the product $25 a day; fails closed; vague question means ask back.
- **To do by hand.** Run the migration; set `OPENAI_API_KEY` in Vercel (plus a spend limit in the OpenAI dashboard); redeploy.
- **Not built / not verified.** Events table with labels, credit balance, assistant, docs wizard, tiers, BYOK (see roadmap.md). The UI and `/dev/usage` section were type-checked and linted but not exercised in a browser. Luna was never called. Public docs page and privacy-policy mention of OpenAI not written yet.
