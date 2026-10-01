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
