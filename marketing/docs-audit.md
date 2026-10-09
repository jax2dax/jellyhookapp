# Docs audit

Owner: docs-writer. Last updated 2026-10-09. Standard: `mds/documentation/docs-standard.md`. Keep this file current: strike a row when the page exists.

## 1. Screen and feature coverage

Sidebar labels are from `components/app-sidebar.tsx`. Hidden in the sidebar (Visitor Journeys, Intent Signals, Acquisition) are excluded on purpose; not listed.

| Screen / feature (on-screen label) | Docs page | State |
|---|---|---|
| Sidebar "Overview": stats row (Active now, Page Views, Sessions, Leads, Conversion Rate) | reference/dashboard | Covered. Trap on Leads vs Conversion Rate is stated in one line each but never side by side with an example. |
| "Sessions online" chart | reference/dashboard | Covered, but mechanism (what "online" means, the last-30-minutes colour) is mixed into the reference page. |
| "Visits over time" (Unique visitors, Split by) | reference/dashboard | Covered. |
| "Pages" table | reference/dashboard | Covered in 2 lines. Does not say where average time and scroll come from. |
| "New Reach", Conversions minis, Hook card, "Lead footprints", "Live Ticker" | reference/dashboard | Covered. |
| Sidebar "Leads" | reference/leads | Covered. Says "Every form submission, one row each": true, but never contrasted with Conversions (people). |
| Qualified / Junk toggle | concepts/leads-qualification | Covered. |
| Lead profile: header, stats card (visits, page views, pages per visit, time engaged, avg scroll, time to convert), Form Engagement, Field Timing, Path to Conversion, Conversion Events, submitted form details, Session History | reference/lead-profile | Covered, but each stat is one clause. "Time engaged" rule is not explained anywhere. |
| Visit chart: "Selected page details" panel (Time on page, Page height, Seen once, Seen 2x+, Not seen, "Headers on this page" with Seen / Not seen) | concepts/session-replay | GAP. The page explains the bands but never names these six facts or the percentages, and never states the heading rule. Written in section 2 below as a to-do (not yet done in this run). |
| Sidebar "Conversion Paths" | reference/conversions | Covered, but the docs call it "Conversions page" while the sidebar says "Conversion Paths". Reader cannot match name to link. Page title should mention both. |
| Conversions: In range / Growth, Separate/Split/Merged, Referrers donut, Leads Origin radar, list with "View lead information" | reference/conversions | Covered. The people-vs-submissions trap is only implied. |
| Sidebar "Hook" (build, preview, results, Ask Hook, sub-hooks, field reference, glossary) | hook/*, preview/*, results/* | Covered in depth (13 pages). No "start from a real question" bridge from the dashboard. |
| Sidebar "Settings" (Site Name, Domain, API key, Tracking mode, Allowed hosts, Pause, Team members, Deactivate) | reference/settings | Covered. |
| Tracker health / attribute check | concepts/tracking-attributes | Covered. |
| Sidebar "Network" (teams, invites) | reference/team | Covered. Docs title "Team and invites" does not say "Network"; reader looking for the sidebar word will not find it. |
| Sidebar "Subscription", Billing page | reference/billing | Covered, deliberately vague. |
| Account page `/platform/user` | none | GAP. Not documented. Needs a read of `UserPageClient.tsx` before writing. |
| Create-site flow, Pending Verification | installation, troubleshooting | Covered. |
| Public sample lead page `/demo` | none | GAP. Not linked from docs. Link it from the new use-cases page (done) and the Introduction (done). |
| Consent mode, GPC / Do Not Track | concepts/privacy-consent | Covered. |
| "What Jellyhook is for" (problem, who it is for, who it is not for, situation to screen map) | none | GAP. Written in this run: `/docs/use-cases`. |
| Introduction routes a stranger to the right next page | `/docs` | Weak. Rewritten in this run. |

## 2. Missing or generic

1. No page says who Jellyhook is not for, or what it does not do (no company identification, no video, no CRM sync, no consent banner). Fixed in use-cases page.
2. No end-to-end scenario links a situation to a screen. Fixed in use-cases page. Feature pages still lack their own one-scenario "When you would use it" section: the standard requires it on every feature reference page. Missing on: dashboard, leads, lead-profile, conversions, settings, team, billing. Still to do.
3. Feature reference pages do not follow the required section order (What it answers, When you would use it, What you see, What it needs, How it is calculated, When it is empty, Limits, Related). They use ad-hoc `h2`s. Largest rewrite job: dashboard, lead-profile, conversions.
4. No "when it is empty" wording on dashboard, leads, lead-profile or conversions pages (except a flat-zero note on the minis).
5. Several older pages use inline classes instead of `app/docs/ui.tsx`. Visual result is the same; only matters for maintenance.
6. Visit chart "Selected page details" panel is undocumented (see table).
7. Pages table: "average time" and "average scroll" are not defined.
8. `/platform/user` page undocumented.
9. Docs index did not mention the sample page, the use cases, or the limits of the product.

## 3. Numbers with traps that are not (fully) explained

| Trap | Where the reader hits it | Documented? | Rule, verified in code |
|---|---|---|---|
| Leads counts every submission; Conversions and Conversion Rate count people | Overview tiles, Leads page, Conversions page | Partly. Dashboard says it in a clause. No side-by-side example. Conversions page says "one person counted once per time period" but does not tie it back to Leads. | Leads = rows in form_submissions in the window. Conversion Rate = distinct people who submitted / distinct people who visited, in the window. Example needed: one person submits 3 times = Leads 3, Conversions 1. Covered in use-cases page example; still needs the full explanation on the dashboard reference rewrite. |
| "Active now" vs "Sessions online" vs "Sessions" | Overview | Partly. Active now = visitors on the site this second. Sessions tile = visits started in the window. Sessions online = chart of how many were open at once. Three similar words, three different things, never compared. | `ActiveNowTile.tsx`, `WindowStatTile.tsx`, `main-chart/overview.md`. |
| "Sessions online" meaning | Overview chart | Yes, in dashboard page ("a page is actually open"). Missing: the chart is by page-open, so a person who switches tab dips. Last 30 minutes drawn in another colour. | Documented, but mixed into reference. Move to a How it works page. |
| "Seen once / Seen 2x+ / Not seen" | Click a frame on any visit chart | NO | `computeSeenBreakdown` in `framePlate/format.ts`. The visitor's scroll position is sampled over the visit. Seen once = from the top-most scroll position reached down to the first spot the scroll passed over at least twice (or to the lowest point seen, if no spot was passed twice). Seen 2x+ = from that first doubly-passed spot down to the lowest point seen. Not seen = the rest (100% minus the two). Note: bands are one continuous stretch, so a short revisit near the top still makes everything below it count as Seen 2x+; this is an approximation, and the docs must say so. Percentages are of page height, not of time. Low point seen = deepest scroll position plus one screen height. Needs a How it works section on the visit chart page. |
| Heading "Seen" / "Not seen" | Same panel | NO | A heading is "Seen" if its position is between the top of the highest scroll position and the lowest point seen. A heading is checked by position only: a heading passed in a fast scroll counts as Seen. Only the first 80 h1 to h3 on a page are captured (`tracker-spec`). |
| Time on page | Visit chart, Hook, Pages table | Only in Hook how-it-works ("left at minus entered at, stamped by our server"). Not on any dashboard page. | One page view lasts from when the page becomes the active one until: another page, the tab hidden, the visitor using another window of the same site, or 30 minutes idle. So reading in a background tab is not counted, and two windows are never counted twice. Needs a plain explanation on the visit chart page and the Pages table. |
| Time engaged (lead profile) | Lead profile stats card | One clause only | Tooltip in `LeadStatsCard.tsx`: total time this person had one of your pages open, across every visit. |
| Session end | Lead profile, charts | Yes (visitors-sessions): 30 minutes idle; closed at the real last activity. Trap: closing a tab does NOT end a session. | Covered. Mention on dashboard Sessions tile. |
| "Direct" referrer | Referrers donut, Visits over time | Yes (referrers-attribution, troubleshooting). | Covered. |
| Phone vs laptop = two visitors | Leads, Conversions | Yes (visitors-sessions). | Covered. |
| Conversions card cuts the session at the submission | Conversions list | Yes. | Covered. |
| New Reach vs Conversions Growth "looks low" while interval is in progress | Conversions | Yes. | Covered. |
| Time to convert | Lead profile | Clause only | From first visit to submission; can be days. Needs a line. |

## 4. Pages that mix kinds of content

- `reference/dashboard`: reference + mechanism ("Online means a page is actually open", the 30-minute colour). Split mechanism into a How it works section or page.
- `reference/conversions`: reference + a caching note ("cached in your browser for a couple of minutes") that is implementation detail.
- `concepts/session-replay` ("Visit chart"): reference of colours + mechanism + a legend. Needs a clean How to read it / How it works split; also a reference for the Selected page details panel.
- `installation`: Start here + What gets collected + Ingestion endpoints (developer reference). Move the last two to a How it works / privacy page or mark as developer notes.
- `troubleshooting`: first item (impossible duration) is a historic bug note, not a symptom a new user hits.
- `/docs` index: was intro + Hook pitch + one link. Rewritten.

## 5. Next jobs, in order

1. Visit chart page: add "Selected page details" reference and the exact Seen rules (highest value remaining).
2. Dashboard reference: rewrite to the standard section order, add the Leads vs Conversion Rate worked example and the Active now / Sessions / Sessions online comparison.
3. Add one scenario to each feature page.
4. Document `/platform/user`.
5. Rename or retitle: "Conversions page" to also say "Conversion Paths"; "Team and invites" to say "Network".
6. Real screenshots: needs the founder. Not invented.

## 6. UNVERIFIED (do not state in docs until checked)

- Production state of Hook (ledger #15). The use-cases page therefore points at Hook only as a place to look, never as the headline.
- `/platform/user` contents.
- Whether "Seen once" percentages are used elsewhere with a different definition.
