# Jellyhook Project Inventory

## Source and scope

This inventory is derived from the current workspace only. It distinguishes implementation from documentation, and it does not infer a shipped capability from a commented block, test-only file, or an unverified design note. File references are relative to the repository root. The API key embedded in the root layout is intentionally not repeated here.

---

## PART 1: PROJECT SUMMARY

Jellyhook is a B2B website analytics and lead-intelligence SaaS. Its primary users are business owners, marketing operators, and website managers who need to understand how visitors move through their site, where engagement breaks down, and which form submissions become actionable leads. The product is built around a small browser-side tracker that collects sessions, page views, scroll geometry, referrer/campaign data, and form interactions, then stores those records in Supabase/PostgreSQL and exposes them through authenticated dashboards and lead profiles.

The application is a Next.js 16 App Router product with a public marketing site, Clerk-authenticated platform routes, server actions that enforce application-level site access, a public tracker script, and anonymous tracking API routes authenticated by a per-site API key. Supabase is the primary persistence and query layer. Clerk supplies authentication, identity, and billing entitlement. Vercel Analytics provides application telemetry. The browser tracker uses local storage and session storage for visitor/session identifiers, while the backend stores the resulting analytics events.

The major subsystems are: public site and pricing; Clerk identity and billing; site creation and team membership; anonymous tracker ingestion; visitor/session/page-view storage; form submission and form-engagement capture; lead qualification and session replay; conversion and acquisition analytics; custom page-intent analysis; a typed Hook query engine; a custom FramePlate timeline renderer; and a live, range-aware chart system. The product also contains a separate development hook/test bench and a visual canvas/silhouette output system.

### Full verified stack

- Language/runtime: TypeScript, JavaScript, JSX, TSX, SQL, CSS, JSON, XML.
- Framework: Next.js 16.1.7, React 19.2.3, App Router, server actions, metadata routes, middleware.
- UI: Tailwind CSS 4, Radix UI primitives, shadcn/ui components, Lucide icons, custom CSS, Recharts, custom FramePlate and main-chart components.
- Database: Supabase/PostgreSQL; the repository documents table-level schema and indexes.
- Auth: Clerk Next.js SDK v7, Clerk sessions, Clerk Billing, Clerk webhooks.
- Backend API: Next.js Route Handlers and server actions; Supabase JavaScript client and service-role access.
- Browser tracking: standalone JavaScript tracker loaded from the public site, plus browser localStorage/sessionStorage.
- External services: Supabase, Clerk, ip-api.com, Vercel Analytics, Google Analytics and Google Search Console metadata; no direct OpenAI/Anthropic integration is visible.
- Data processing: custom Postgres query engine, SQL compilation, EXPLAIN-based cost estimation, range and live caching, stale-session sweeps, asynchronous background processing through scheduled route execution.
- Deployment: default configuration and documentation indicate Vercel; the verified package uses Next.js and Vercel Analytics integration.

---

## PART 2: FEATURE & CONSTRUCT INVENTORY

### 1. Data ingestion & tracking

1. Public tracker script: A standalone browser tracker executes on every third-party page that loads it and collects visitor, session, page-view, scroll, referrer, device, and form data. (Files: public/tracker.js)
2. Script bootstrap: The tracker reads the API key and script origin from `document.currentScript`, derives the API endpoint from the script URL, and exits if the key is absent. (Files: public/tracker.js)
3. Visitor identity: The tracker generates a UUID in localStorage and persists it as `visitor_id`. (Files: public/tracker.js)
4. Session identity: The tracker generates a session UUID in sessionStorage and preserves it across page navigations until the idle timeout or explicit session end. (Files: public/tracker.js)
5. Session start event: The tracker sends a `session_start` event on a new browser session, including referrer, timezone, user agent, and UTM parameters. (Files: public/tracker.js)
6. Session end event: The tracker sends session-end events on unload and uses a keepalive fetch with a sendBeacon fallback. (Files: public/tracker.js)
7. Page-view start event: The tracker captures the current page URL/path/title, referrer, language, device type, scroll geometry, viewport geometry, and page-view timing. (Files: public/tracker.js)
8. Page-view end event: The tracker sends the final page-view position, duration, maximum scroll depth, and revisit behavior when the page leaves or the session ends. (Files: public/tracker.js)
9. Scroll tracking: The tracker tracks scroll depth, maximum scroll depth, revisits, and page geometry from `scrollY`, page height, and viewport height. (Files: public/tracker.js)
10. Page visibility tracking: The tracker handles visibility changes and page lifecycle transitions for page-view and session behavior. (Files: public/tracker.js)
11. UTM attribution: The tracker reads `utm_source`, `utm_medium`, and `utm_campaign`, with inferred Google/Meta click-ID fallback behavior. (Files: public/tracker.js)
12. Device classification: The tracker classifies mobile versus desktop from the user agent. (Files: public/tracker.js)
13. API-key validation: The `/api/track` endpoint validates the key against `sites.api_key` before accepting data. (Files: app/api/track/route.js)
14. Anonymous tracking authorization: The tracking routes are intentionally designed for anonymous customer-site visitors and do not use Clerk authentication. (Files: app/api/track/route.js, middleware.ts)
15. Bot filtering: The tracker API rejects requests whose user agent matches known crawler and bot patterns before database writes. (Files: app/api/track/route.js)
16. CORS support: Tracking endpoints return permissive CORS headers and support OPTIONS requests. (Files: app/api/track/route.js, app/api/track-form/route.js)
17. Site activation guard: The tracking endpoint checks the site’s active state before processing events. (Files: app/api/track/route.js)
18. First-hit verification: The first accepted tracker hit sets the site’s verified flag to true. (Files: app/api/track/route.js)
19. Form submission capture: The tracker extracts form fields from a form and sends them to the form endpoint. (Files: public/tracker.js, app/api/track-form/route.js)
20. Labelled conversion mode: The tracker can mark a form with `data-conversion="true"`; the server only accepts such submissions when the site opts into labelled mode. (Files: public/tracker.js, app/api/track-form/route.js)
21. Form deduplication: Form submissions are deduplicated within 60 seconds by site, visitor, and normalized email. (Files: app/api/track-form/route.js)
22. Raw form payload storage: The server stores arbitrary form data as JSONB while also extracting name, email, phone, and confidence. (Files: app/api/track-form/route.js, mds/database.md)
23. Page-structure ingestion: The tracker captures heading tags, header text, indexes, positions, and page height and upserts them by site/path/header index. (Files: public/tracker.js, app/api/track-structure/route.js)
24. Form-engagement lifecycle: The tracker records viewed, started, submitted, and abandoned form states. (Files: public/tracker.js, app/api/track-form-engagement/route.js)
25. Form field timing: The tracker records focus and blur deltas locally and sends only initial focus, field blur, submit, or abandon events to the server. (Files: public/tracker.js, app/api/track-form-engagement/route.js)
26. Server-side field timing accumulation: The engagement endpoint adds each field’s incoming duration to the stored total and preserves the first focus order. (Files: app/api/track-form-engagement/route.js)
27. Form identity across reloads: Form engagement is keyed by session, page path, and form index rather than page-view ID, allowing progress to survive tab switches and reloads. (Files: app/api/track-form-engagement/route.js, mds/database.md)
28. Form status monotonicity: The engagement endpoint prevents out-of-order events from moving a completed form back to an earlier state. (Files: app/api/track-form-engagement/route.js)
29. Stale session sweep: A background route closes stale sessions and page views after the inactivity threshold. (Files: lib/closeStaleSessions.js, app/api/close-stale-sessions/route.js)
30. Stale form engagement sweep: A background route finalizes abandoned forms whose sessions have become stale. (Files: lib/closeStaleFormEngagement.js)

### 2. Visitor, lead identification & enrichment

31. Visitor upsert: The tracking endpoint finds an existing visitor by visitor ID and site ID, otherwise inserts one and updates last-seen metadata. (Files: app/api/track/route.js)
32. Visitor device enrichment: Later events can backfill `device_type` when a page-view event provides it. (Files: app/api/track/route.js)
33. Visitor first/last-seen data: Visitor records retain first-seen and last-seen timestamps and are queried by dashboard actions. (Files: app/api/track/route.js, lib/actions/supabase.actions.js)
34. Session deduplication: The API checks for an exact existing session ID before creating another session row. (Files: app/api/track/route.js)
35. Session lifecycle: Sessions have start, end, last-activity, referrer, country, timezone, and UTM fields. (Files: mds/database.md, app/api/track/route.js)
36. IP country lookup: The tracker sends the forwarded IP to ip-api.com and stores the resolved country name on sessions. (Files: app/api/track/route.js, lib/resolvePendingCountries.js)
37. Country resolution fallback: A separate asynchronous resolver handles pending country updates outside the main ingestion path. (Files: lib/resolvePendingCountries.js)
38. Lead identity anchor: A form submission is the canonical lead row, with optional visitor and session links. (Files: mds/database.md)
39. Lead confidence: The form endpoint assigns high confidence when an email is present and low otherwise. (Files: app/api/track-form/route.js)
40. Lead qualification: Sales can mark a lead qualified or junk through a user-facing action and persist the result. (Files: lib/actions/leadQualify.action.js, components/leads/LeadQualifyToggle.tsx)
41. Lead profile aggregation: A lead profile combines submission data with the visitor’s page views, sessions, and form activity. (Files: lib/actions/leadProfile.actions.js, lib/algorithms/leadProfile.js)
42. Conversion-session linkage: The application derives a conversion from a form submission’s session ID and its submitted timestamp. (Files: lib/leadSessions/transform.js)
43. Conversion path truncation: Conversion cards truncate a session at the exact submission event rather than using a generic converted flag. (Files: lib/leadSessions/transform.js, app/platform/conversions/page.jsx)
44. Lead timeline: The lead profile provides a timeline containing page visits, form submissions, and associated session behavior. (Files: components/leads/LeadSessionExplorer.tsx, lib/actions/leadProfile.actions.js)
45. Visitor-level lead lookup: The application can retrieve a visitor’s form submissions, sessions, and page history. (Files: lib/actions/supabase.actions.js)
46. Visitor browser/OS enrichment: The schemas retain browser, operating-system, and language fields, although the exact capture path should be verified against the live tracker code. (Files: mds/database.md, public/tracker.js)
47. Cross-table identity model: The analytics model joins records using client-generated `visitor_id` and `session_id` strings rather than UUID primary keys. (Files: mds/database.md)
48. Anonymous visitor fallback: Form submissions can exist without a matching visitor row, and the lead model treats the submission itself as the anchor. (Files: mds/database.md)
49. Referrer classification: The application classifies referrers using UTM priority and raw referrer data. (Files: lib/analytics/classifyReferrer.js)
50. Source attribution: Session records include raw referrer and UTM source, medium, and campaign values. (Files: app/api/track/route.js, mds/database.md)

### 3. Data pipelines & background processing

51. Event ingestion API: The `/api/track` Route Handler accepts a JSON array of analytics events and writes them through the service-role Supabase client. (Files: app/api/track/route.js)
52. Form ingestion API: The `/api/track-form` Route Handler accepts a form payload, validates the site, checks form mode, deduplicates, and inserts a lead. (Files: app/api/track-form/route.js)
53. Form engagement ingestion API: The `/api/track-form-engagement` Route Handler accepts lifecycle and field timing updates with status ordering and additive merge logic. (Files: app/api/track-form-engagement/route.js)
54. Structure ingestion API: The `/api/track-structure` Route Handler upserts page structure metadata keyed by site/path/header index. (Files: app/api/track-structure/route.js)
55. Stale session cleanup route: The API route invokes the stale-session cleanup library. (Files: app/api/close-stale-sessions/route.js)
56. Stale engagement cleanup: The cleanup library closes form engagements for sessions that have become stale. (Files: lib/closeStaleFormEngagement.js)
57. Country resolution worker: The resolver performs pending country updates separately from the main event path. (Files: lib/resolvePendingCountries.js)
58. Live polling: The dashboard polls analytics and activity data on a timer instead of relying only on Supabase Realtime. (Files: components/dashboard/LiveTicker.tsx, main-chart/components/MainChart.tsx)
59. Chart range caching: Database-backed chart range results are cached for two minutes and marked stale when reused. (Files: lib/chartRangeCache.ts)
60. Converted-lead caching: Converted lead queries use a separate two-minute cache keyed by site and date range. (Files: lib/convertedLeadsCache.ts)
61. Intent cache: Intent-analysis results are cached for one minute and have development-mode controls. (Files: lib/intentCache.ts)
62. Live ticker cache: The live ticker uses a module-level cache for its data. (Files: lib/liveTickerCache.js)
63. Lead-session cache: Lead session data has a dedicated cache module. (Files: lib/leadSessionsCache.js)
64. Cached chart ranges: The chart range cache supports a stale-result path and a minimum range helper. (Files: lib/chartRangeCache.ts)
65. Asynchronous external country resolution: Country lookup is separated from the immediate tracker response. (Files: lib/resolvePendingCountries.js)
66. Background stale-session threshold: The code uses a three-minute inactivity threshold for sessions and 30 minutes for idle session splitting. (Files: public/tracker.js, lib/closeStaleSessions.js)
67. Query cost gate: The Hook engine estimates Postgres cost before execution and can refuse runs over a configured credit limit. (Files: jh-hook/engine/run.ts)
68. Query estimate cache: The Hook engine caches EXPLAIN results for five minutes, up to 500 entries. (Files: jh-hook/engine/run.ts)
69. Query ordering guard: The Hook engine can override a manual condition order when a different order is at least ten times cheaper. (Files: jh-hook/engine/run.ts)
70. Staged query execution: The Hook engine uses a staged query strategy when condition estimates differ by a spread factor of ten. (Files: jh-hook/engine/run.ts)

### 4. Data model & storage

71. Site records: The sites table stores domain, name, API key, owner, plan, event limit, active state, and soft-delete timestamp. (Files: mds/database.md)
72. Site membership records: Site memberships store owner/member roles, invite state, and membership timestamps. (Files: mds/database.md)
73. Visitor records: Visitors store browser-level identity, first/last seen, IP, device, browser, OS, language, and site linkage. (Files: mds/database.md)
74. Session records: Sessions store visitor linkage, lifecycle timestamps, referrer, country, timezone, and campaign fields. (Files: mds/database.md)
75. Page-view records: Page views store URL/path/title, entry/exit timestamps, duration, scroll geometry, page dimensions, and visitor/session linkage. (Files: mds/database.md)
76. Form-submission records: Form submissions store contact fields, raw JSONB, page, visitor/session linkage, confidence, qualification, and submission time. (Files: mds/database.md)
77. Form-engagement records: Form engagement tracks form lifecycle, field timing, page position, and last activity. (Files: mds/database.md)
78. Page-structure records: Page structure stores per-page heading metadata and its vertical position. (Files: mds/database.md)
79. Page-insight records: Page insights persist label, color, retention/conversion/spotlight scores, verification status, notes, and generation metadata. (Files: mds/database.md)
80. Billing-event records: Billing events store an append-only Clerk event audit trail. (Files: mds/database.md)
81. Subscription records: Subscription records hold the current plan/status and billing-period dates as a display mirror. (Files: mds/database.md)
82. User records: User records mirror Clerk identity and profile fields. (Files: mds/database.md)
83. Multi-tenancy: Site, visitor, session, page-view, form, and engagement rows are linked to site IDs. (Files: mds/database.md)
84. Tenant membership checks: Application actions verify site membership and ownership before returning records. (Files: lib/actions/permission.actions.js)
85. Row-level security: The documented model scopes authenticated reads to active site memberships and uses public insert/update policies for tracker-facing tables. (Files: mds/database.md)
86. Soft deletion: Sites can be deactivated and marked with a deletion timestamp instead of a hard delete. (Files: lib/actions/site-management.actions.js, mds/database.md)
87. Table indexes: The schema documents indexes on site membership, visitor, session, page-view, form submission, form engagement, and billing records. (Files: mds/database.md)
88. Unapplied schema note: The database document states that some indexes and schema columns are not yet applied to the live database, so they are not treated as verified live configuration. (Files: mds/database.md)
89. Cookie state: Preferred site selection is stored in cookies. (Files: lib/actions/site-cookie.js)
90. In-memory caches: Analytics and intent results use module-local caches for fast repeated reads. (Files: lib/chartRangeCache.ts, lib/intentCache.ts, lib/liveTickerCache.js)

### 5. Scoring, segmentation & intelligence logic

91. Intent-failure page analysis: The application computes a page health score from engagement, retention, confusion, reading pace, and header visibility signals. (Files: lib/algorithms/pageAnalysis.ts, lib/algorithms/pageAnalysis.server.ts)
92. Page score throttling: The client-side analysis function uses a five-minute recalculation throttle. (Files: lib/algorithms/pageAnalysis.ts)
93. Reading-pace signal: The algorithm estimates reading pace from page-view durations and page geometry. (Files: lib/algorithms/pageAnalysis.ts)
94. Confusion signal: The algorithm derives confusion from pace, average time, and exit rate. (Files: lib/algorithms/pageAnalysis.ts)
95. Engagement signal: The algorithm combines the page’s behavioral measurements and visit-level data. (Files: lib/algorithms/pageAnalysis.ts)
96. Retention signal: The algorithm derives retention from the number and distribution of page-view outcomes. (Files: lib/algorithms/pageAnalysis.ts)
97. Spotlight signal: The algorithm compares page visibility against site-wide traffic and visitor counts. (Files: lib/algorithms/pageAnalysis.ts)
98. Conversion signal: The algorithm checks whether sessions containing page views also contain form submissions. (Files: lib/algorithms/pageAnalysis.ts)
99. Header visibility signal: The algorithm compares observed page-view data with page-structure header metadata. (Files: lib/algorithms/pageAnalysis.ts)
100. Intent failure labels: The algorithm assigns labels and colors based on the computed score and signals. (Files: lib/algorithms/pageAnalysis.ts)
101. Insight generation: The system generates a natural-language insight sentence from the page signals. (Files: lib/algorithms/pageAnalysis.ts)
102. Server-side score calculation: The server action loads page views, structure, and conversion data and invokes the page-analysis engine. (Files: lib/actions/intentFailure.action.ts)
103. Lead scoring: The application computes lead confidence and exposes a lead-profile score derived from page-view data. (Files: lib/algorithms/leadProfile.js, lib/actions/supabase.actions.js)
104. Page-level conversion rate: Dashboard actions calculate conversion rate from lead and session data. (Files: lib/actions/rateConversion.action.ts)
105. Unique conversion rate: The application calculates a distinct-conversion metric from the analytics tables. (Files: lib/actions/uniqueConversionRate.action.ts)
106. Conversion path analysis: The application groups sessions and page sequences around form submissions. (Files: lib/actions/conversionPath.action.ts)
107. Referrer breakdown: The application aggregates session referrers and source attributes. (Files: lib/actions/referrerBreakdown.action.ts)
108. Lead-origin breakdown: The application derives origin context for leads from their linked sessions and sources. (Files: lib/actions/leadOriginBreakdown.action.ts)
109. Time-series aggregation: The analytics layer builds buckets for chart data and handles range boundaries. (Files: lib/analytics/bucketRange.ts, lib/analytics/visitsAggregate.ts)
110. Acquisition grouping: The application aggregates visitor sessions by source/referrer and produces source summaries. (Files: lib/actions/supabase.actions.js, lib/analytics/classifyReferrer.js)
111. Device/country segmentation: Dashboard queries group visitors and sessions by device and country. (Files: lib/actions/supabase.actions.js)
111. Page segmentation: Page overview actions aggregate page views and lead submissions per path. (Files: lib/actions/pagesOverview.action.js)
113. Custom query language: Hook entities expose typed fields, relations, operators, aggregates, outputs, and nested conditions. (Files: jh-hook/schema.ts, jh-hook/types.ts)
114. Hook query migration: The engine upgrades saved specs to the current format before execution. (Files: jh-hook/migrate.ts)
115. Hook query validation: The engine validates the query specification before planning or executing it. (Files: jh-hook/engine/validate.ts)
116. Hook query planning: The engine uses Postgres EXPLAIN estimates to choose condition order and fused or staged execution. (Files: jh-hook/engine/run.ts)
117. Hook relationship traversal: The engine supports related-row conditions, including counts, totals, averages, and nested relations. (Files: jh-hook/schema.ts, jh-hook/engine/compile.ts)
118. Hook tunnel composition: Sub-hook outputs can be passed into another query and are type-checked before execution. (Files: jh-hook/types.ts, jh-hook/engine/compile.ts)
119. Hook output modes: The engine supports counts, distinct counts, IDs, values, aggregates, group-by breakdowns, and table results. (Files: jh-hook/types.ts, jh-hook/engine/compile.ts)
120. Hook cost controls: Query runs can be limited by estimated credits and return an error before execution when the budget is exceeded. (Files: jh-hook/engine/run.ts)
121. Hook query explanations: Results include the execution plan, selected order, estimated rows, tunnel values, SQL, and timing. (Files: jh-hook/engine/run.ts)

### 6. Backend/API design

122. Tracking API: The core anonymous POST endpoint accepts arrays of events and returns success/error JSON. (Files: app/api/track/route.js)
123. Form API: The form POST endpoint accepts raw form payloads, validates API key and site state, and returns success/error JSON. (Files: app/api/track-form/route.js)
124. Form-engagement API: The form-engagement POST endpoint accepts lifecycle and timing events. (Files: app/api/track-form-engagement/route.js)
125. Structure API: The structure POST endpoint accepts page-header metadata and upserts it. (Files: app/api/track-structure/route.js)
126. Site-config API: The GET endpoint returns the site’s labelled-form setting for a supplied API key. (Files: app/api/site-config/route.js)
127. Subscription API: The authenticated GET endpoint returns the current Clerk subscription. (Files: app/api/subscription/route.ts)
128. Analytics API: The authenticated GET endpoint returns page-view data for user-owned sites. (Files: app/api/get-analytics/route.ts)
129. Clerk webhook API: The signed webhook endpoint handles user and subscription events. (Files: app/api/webhooks/clerk/route.ts)
130. Stale-session API: The endpoint invokes the cleanup library for stale sessions. (Files: app/api/close-stale-sessions/route.js)
131. Debug APIs: Debug behavior exists in the tracking route and is explicitly marked temporary; no separate debug route files are present. (Files: app/api/track/route.js)
132. Server action authorization: Core server actions use Clerk authentication and explicit site ownership or membership checks. (Files: lib/actions/permission.actions.js)
133. Server action error handling: Action functions return null or empty data on query errors, with logs for failures. (Files: lib/actions/billing.actions.ts, lib/actions/supabase.actions.js)
134. Public CORS: Tracking endpoints use wildcard CORS headers and explicit OPTIONS handling. (Files: app/api/track/route.js, app/api/track-form/route.js)
135. Webhook signature verification: Clerk webhook requests are verified through Clerk’s webhook verifier. (Files: app/api/webhooks/clerk/route.ts)
136. No direct SQL endpoint: The product relies on Next.js routes and Supabase client calls rather than a custom SQL execution API. (Files: app/api)
137. API key regeneration: Owners can regenerate a site API key. (Files: lib/actions/settings.actions.js)
138. API key display: The site setup and settings UI can display or provide the installation key for the current site. (Files: app/platform/create-site/page.jsx, app/platform/settings/page.jsx)
139. Domain normalization: Site creation strips protocol, www, and trailing slash before storing the domain. (Files: lib/actions/site-management.actions.js)
140. Site existence checks: Site creation checks active records by normalized domain before creating a new site. (Files: lib/actions/site-management.actions.js)
141. Site activation checks: The tracking and form endpoints reject inactive sites. (Files: app/api/track/route.js, app/api/track-form/route.js)
142. Site ownership checks: Settings and member actions verify the current user through site membership or legacy owner identity. (Files: lib/actions/settings.actions.js)
143. Site-specific data access: Site ID is passed through server actions and queries to prevent cross-site reads. (Files: lib/actions/permission.actions.js)
144. Request validation: Tracking routes validate JSON arrays, API keys, required IDs, and expected form statuses. (Files: app/api/track/route.js, app/api/track-form/route.js, app/api/track-form-engagement/route.js)
145. Silent malformed admission: Some tracker routes return success on malformed or invalid site requests to reduce client noise. (Files: app/api/track-form-engagement/route.js)

### 7. Frontend/UI

146. Marketing landing page: The root homepage presents the product and calls to action. (Files: app/page.tsx, components/marketing/MarketingPage.tsx)
147. Relative marketing navigation: The public site includes header and footer components for navigation and pricing. (Files: components/marketing/SiteHeader.tsx, components/marketing/SiteFooter.tsx)
148. Pricing page: The public pricing page renders product plans and subscriptions. (Files: app/pricing/page.tsx, app/subscriptions/page.tsx)
149. About page: The public about page presents the organization and product context. (Files: app/about/page.tsx)
150. Terms and privacy pages: The product includes legal policy pages. (Files: app/terms/page.tsx, app/privacy/page.tsx)
151. Authentication pages: Clerk sign-in and sign-up routes provide the product’s authentication UI. (Files: app/sign-in/[[...sign-in]]/page.tsx, app/sign-up/[[...sign-up]]/page.tsx)
152. SSO callbacks: The application includes sign-in and sign-up SSO callback routes. (Files: app/sign-in/sso-callback/page.tsx, app/sign-up/sso-callback/page.tsx)
153. Platform shell: The authenticated platform provides a sidebar, site switcher, user area, and scoped navigation. (Files: app/platform/layout.jsx, components/app-sidebar.tsx, components/siteSwitcher.jsx)
154. Dashboard overview: The dashboard presents KPI tiles, the online-session chart, page health, recent activity, and source/device/country summaries. (Files: app/platform/dashboard/page.jsx)
155. Live ticker: The dashboard includes a live visitor ticker. (Files: components/dashboard/LiveTicker.tsx)
156. Main online chart: The custom main chart displays simultaneous visitors over time with interval, range, panning, zooming, line styles, and markers. (Files: main-chart/components/MainChart.tsx, main-chart/overview.md)
157. Chart range controls: The chart supports 5-second through one-day intervals and custom ranges. (Files: main-chart/overview.md)
158. Conversion markers: The chart overlays form submissions as conversion markers. (Files: main-chart/overview.md)
159. Team-join markers: The chart overlays site membership join times as vertical markers. (Files: main-chart/overview.md)
160. Dashboard stat tiles: The application renders active visitors, page views, sessions, leads, conversion rate, and related summary tiles. (Files: components/StatTile.tsx, app/platform/dashboard/page.jsx)
161. Website visitor feed: The visitors page displays visitor identity, sessions, device/browser information, and timeline data. (Files: app/platform/visitors/page.jsx)
162. Visitor detail interaction: Visitor pages use the shared analytics actions to fetch visitor-specific data. (Files: app/platform/visitors/page.jsx, lib/actions/supabase.actions.js)
163. Leads table: The leads page displays contact fields, page, date, confidence, and qualification state. (Files: app/platform/leads/page.jsx, components/leads/LeadsTable.tsx)
164. Lead detail page: The lead page displays the submission, visitor data, timeline, and session replay. (Files: app/platform/leads/[lead_id]/page.jsx)
165. Lead qualification control: The lead profile includes a visible qualified/junk toggle. (Files: components/leads/LeadQualifyToggle.tsx)
166. Session replay: The lead profile contains a dedicated session explorer with pages, form activity, and frame-level details. (Files: components/leads/LeadSessionExplorer.tsx)
167. Session summary drawer: The leads UI includes a session summary drawer for selected visitor/session data. (Files: components/leads/SessionSummaryDrawer.tsx)
168. Selected frame details: The replay UI supports selecting a frame and showing its details. (Files: components/leads/SelectedFrameDetails.tsx)
169. Conversion paths: The conversions page displays per-lead conversion paths with date filters and pagination. (Files: app/platform/conversions/page.jsx)
170. Conversion path charts: The application renders line-chart paths and per-conversion cards. (Files: components/charts/lineConversionPath.tsx, components/charts/ConversionsAreaChart.tsx)
171. Acquisition page: The acquisition page displays source/referrer performance. (Files: app/platform/acquisition/page.jsx)
172. Referrer chart: The referrer breakdown is rendered through a donut chart. (Files: components/charts/ReferrerDonutChart.tsx)
173. Intent analysis page: The intent page displays page-health scores, labels, insights, and page-level data. (Files: app/platform/intent/page.tsx)
174. Intent debug page: The debug page exposes the raw page-analysis score and breakdown. (Files: app/platform/intent/debug/page.tsx)
175. Page overview: The dashboard obtains page-level views and conversion summaries. (Files: lib/actions/pagesOverview.action.js, app/platform/dashboard/page.jsx)
176. FramePlate timeline: The custom renderer visualizes sessions, page visits, away periods, form activity, and conversion markers. (Files: framePlate/components/FramePlateChart.tsx, framePlate/components/FullPagePlate.tsx)
177. FramePlate session strip: The renderer includes compact session strips. (Files: framePlate/components/SessionStrip.tsx)
178. FramePlate error boundary: The visualization has an error boundary to isolate rendering failures. (Files: framePlate/components/FramePlateErrorBoundary.tsx)
179. FramePlate highlight IDs: The chart supports highlighting visits from Hook results while dimming non-matches. (Files: framePlate/ui-ux.md, output/components/Canvas.tsx)
180. Hook workspace: The product provides a builder for natural-language query conditions, output selection, ordering, comparison, and result rendering. (Files: components/hook/HookWorkspace.tsx)
181. Hook query serialization: The workspace stores the query in a URL-safe encoded parameter and supports copy/link loading. (Files: components/hook/HookWorkspace.tsx)
182. Hook query code panel: The workspace allows users to paste and load JSON query definitions and show the current query. (Files: components/hook/HookWorkspace.tsx)
183. Hook result canvas: Results render numbers, rankings, time series, values, lists, and matching sessions/leads/visitors. (Files: output/components/Canvas.tsx)
184. Hook paginated results: The canvas loads additional matching records using sealed tokens without rerunning the query. (Files: output/components/Canvas.tsx, lib/actions/canvas.action.ts)
185. Hook comparison: Two hook results can be compared with formulas. (Files: lib/actions/canvas.action.ts, components/hook/HookWorkspace.tsx)
186. Hook silhouette: A sticky silhouette preview is displayed alongside the query result. (Files: silhouette/components/SilhouettePanel.tsx, silhouette/components/SilhouetteFigure.tsx)
187. Site creation onboarding: The create-site page collects a domain and labelled-form choice and displays installation instructions. (Files: app/platform/create-site/page.jsx)
188. Verification pending UI: The setup page polls for site verification and shows the installation script and cancellation option. (Files: app/platform/create-site/page.jsx)
189. Team member network: The network page displays members, roles, pending invitations, and invite actions. (Files: app/platform/network/page.jsx)
190. Invite acceptance: The invite page accepts or declines a pending invitation. (Files: app/platform/invite/page.jsx)
191. Settings page: The settings page supports profile, site name/domain, API key, active state, and team controls. (Files: app/platform/settings/page.jsx)
192. Billing page: The billing page displays current plan, billing email, and transaction history. (Files: app/platform/billing/page.tsx)
193. User profile page: The user page displays and edits profile information. (Files: app/platform/user/page.tsx)
194. Plan gating: The product gates features based on Clerk plan entitlement. (Files: lib/actions/permission.actions.js, components/PlanGate.jsx)
195. Loading/error/empty states: The code includes loading markers, empty messages, retry paths, and error banners across product screens. (Files: app/platform/dashboard/page.jsx, app/platform/intent/page.tsx, components/hook/HookWorkspace.tsx)
196. Responsive layouts: Platform pages use responsive grid and flex layouts and include mobile-oriented navigation. (Files: app/platform/layout.jsx, components/app-sidebar.tsx)
197. Dark mode: The application provides a theme provider and dark-mode button. (Files: components/theme-provider.tsx, components/DarkButton.jsx)
198. UI primitives: The product includes accessible card, button, input, table, dialog, dropdown, tooltip, checkbox, badge, avatar, sidebar, and skeleton components. (Files: components/ui)
199. Chart primitives: The shared UI includes chart wrappers, tooltips, and Recharts integration. (Files: components/ui/chart.tsx, components/charts)
200. Support feedback: The application provides support feedback, bug report, and automatic feedback prompts. (Files: components/feedback)

### 8. Integrations

201. Clerk authentication: Clerk provides user identity and session management through ClerkProvider and middleware. (Files: app/layout.tsx, middleware.ts)
202. Clerk billing: Clerk Billing handles subscription plans and billing entitlement. (Files: app/subscriptions/page.tsx, app/platform/billing/page.tsx)
203. Clerk webhooks: The product verifies and processes user and subscription webhook events. (Files: app/api/webhooks/clerk/route.ts)
204. Supabase persistence: The product uses Supabase as its primary database and query layer. (Files: lib/supabase.ts, lib/supabase/server.ts, lib/supabase/browser.ts)
205. IP geolocation: The tracker uses ip-api.com to resolve country names from the visitor IP. (Files: app/api/track/route.js, lib/resolvePendingCountries.js)
206. Vercel Analytics: The root layout loads Vercel Analytics. (Files: app/layout.tsx)
207. Google Analytics: The root layout loads Google tag manager and gtag with a configured measurement ID. (Files: app/layout.tsx)
208. Google Search Console: Root metadata contains a Google verification token. (Files: app/layout.tsx)
209. Organization structured data: The root layout emits Schema.org Organization JSON-LD. (Files: app/layout.tsx)
210. Public tracker distribution: The tracker is served as a static JavaScript asset from the public directory. (Files: public/tracker.js)
211. Email fields: The product collects contact form email fields and uses them as lead identity. (Files: app/api/track-form/route.js, components/leads/LeadsTable.tsx)
212. Form data: The product captures arbitrary form fields as JSONB for later analysis and display. (Files: app/api/track-form/route.js)
213. No email provider: No direct resend, SMTP, or email-provider integration is visible in the codebase. (Files: [UNVERIFIED: repository-wide search])
214. No CRM provider: No direct Salesforce, HubSpot, Pipedrive, or other CRM API integration is visible in the codebase. (Files: [UNVERIFIED: repository-wide search])
215. No Slack integration: No direct Slack webhook or SDK integration is visible. (Files: [UNVERIFIED: repository-wide search])
216. No AI provider: No direct OpenAI, Anthropic, or other model API call is visible; page analysis is heuristic. (Files: lib/algorithms/pageAnalysis.ts, [UNVERIFIED: repository-wide search])
217. No file/object storage: No visible S3, Cloudflare R2, Azure Blob, or equivalent object-storage integration is documented in the code. (Files: [UNVERIFIED: repository-wide search])
218. No queue library: No visible BullMQ, SQS, Kafka, or equivalent queue package is present. (Files: package.json, [UNVERIFIED: repository-wide search])

### 9. Auth, security & access control

219. Clerk middleware: Clerk middleware protects authenticated routes and applies application middleware behavior. (Files: middleware.ts)
220. Clerk provider: The root layout installs ClerkProvider for all application routes. (Files: app/layout.tsx)
221. Server-side authentication: Server actions use `auth()` and `currentUser()` to obtain the authenticated identity. (Files: lib/actions/permission.actions.js)
222. Site membership authorization: Site actions verify active membership and role before exposing data. (Files: lib/actions/site-management.actions.js)
223. Legacy owner fallback: The authorization model falls back to the legacy `sites.user_id` owner field. (Files: lib/actions/permission.actions.js)
224. Preferred-site cookie: The app stores the selected site ID in a cookie and resolves it through site access checks. (Files: lib/actions/site-cookie.js)
225. API-key authentication: Tracking and configuration routes authenticate anonymous visitors with a per-site API key. (Files: app/api/track/route.js, app/api/site-config/route.js)
226. Bot filtering: The core tracking endpoint blocks known crawler and spider user agents. (Files: app/api/track/route.js)
227. CORS controls: The public tracker routes allow cross-origin POST requests and explicit OPTIONS handling. (Files: app/api/track/route.js, app/api/track-form/route.js)
228. Webhook signature verification: Clerk webhook requests are verified before processing. (Files: app/api/webhooks/clerk/route.ts)
229. Service-role separation: Sensitive reads/writes use Supabase’s service-role key while client-facing tables rely on application and RLS checks. (Files: lib/actions/permission.actions.js, app/api/webhooks/clerk/route.ts)
230. Site-scoped RLS: The documented RLS model scopes authenticated reads to active site membership. (Files: mds/database.md)
231. Tracker-table public insert policy: The documented model permits inserts to tracker-facing tables without an authenticated Clerk role. (Files: mds/database.md)
232. Input validation: The APIs check JSON shape, required IDs, status values, API keys, and active site state. (Files: app/api/track-form-engagement/route.js, app/api/track-form/route.js)
233. Duplicate suppression: Form submissions and tracking events use deduplication or idempotency-like checks. (Files: app/api/track-form/route.js, app/api/track/route.js)
234. API key regeneration: Site owners can rotate the API key. (Files: lib/actions/settings.actions.js)
235. Site deactivation: Site owners can deactivate a site and set a soft-delete timestamp. (Files: lib/actions/site-management.actions.js)
236. Cost gating: The Hook engine estimates query cost and refuses execution above the configured budget. (Files: jh-hook/engine/run.ts)
237. SQL safety: The Hook engine validates specs and uses typed SQL mappings rather than raw user SQL. (Files: jh-hook/engine/validate.ts, jh-hook/engine/sqlmap.ts)
238. Query type safety: Sub-hook values must match the target field type and shape. (Files: jh-hook/types.ts, jh-hook/engine/compile.ts)
239. No password storage: The application delegates authentication to Clerk rather than storing passwords in application code. (Files: app/layout.tsx, middleware.ts)
240. No direct user-role admin model: The code implements owner/member roles and invite states, not a broad administrator hierarchy. (Files: mds/database.md, app/platform/network/page.jsx)

### 10. Billing, onboarding & account management

241. Site onboarding: Users register a domain, choose labelled-form behavior, and receive installation instructions. (Files: app/platform/create-site/page.jsx)
242. Site verification: The pending state waits for the first accepted tracker hit before activating the site. (Files: app/platform/create-site/page.jsx, app/api/track/route.js)
243. Site cancellation: The onboarding flow can cancel an unverified site and start over. (Files: app/platform/create-site/page.jsx)
244. Site creation limits: The server action enforces one site for non-elite users and supports multiple sites for elite users. (Files: lib/actions/site-management.actions.js)
245. Billing plan tiers: Pricing tiers include free, basic, pro, and elite definitions. (Files: lib/pricing/tiers.ts)
246. Clerk plan entitlement: The app checks the authenticated user’s Clerk plan through `auth().has()` and an API fallback. (Files: lib/actions/permission.actions.js)
247. Billing webhook mirror: Clerk subscription events update a current-plan row. (Files: app/api/webhooks/clerk/route.ts)
248. Multi-item plan selection: The webhook chooses the highest-ranked active or canceled item with an unexpired period. (Files: app/api/webhooks/clerk/route.ts)
249. Billing event audit: Subscription and user events are persisted in an append-only billing-event table. (Files: app/api/webhooks/clerk/route.ts, mds/database.md)
250. Billing history: The billing page displays the latest event history and current plan. (Files: app/platform/billing/page.tsx, lib/actions/billing.actions.ts)
251. Plan status handling: The webhook handles active, past-due, canceled, and subscription lifecycle states. (Files: app/api/webhooks/clerk/route.ts)
252. Profile management: Users can update first name, last name, email, phone, and avatar. (Files: lib/actions/profile.actions.js)
253. Site settings: Users can change site name, domain, API key, and active state. (Files: lib/actions/settings.actions.js)
254. Member invitations: Owners can invite members by email and store pending-invite state. (Files: lib/actions/settings.actions.js)
255. Member roles: Site membership records support owner and member roles. (Files: mds/database.md)
256. Member removal: Owners or administrators can remove site members. (Files: lib/actions/settings.actions.js)
257. Invite acceptance/decline: Users can accept or decline pending invitations. (Files: lib/actions/site-management.actions.js)
258. Site switching: Users can select a preferred site and update session cookie state. (Files: lib/actions/site-management.actions.js, lib/actions/site-cookie.js)
259. No billing self-service UI: The code integrates with Clerk Billing and exposes pages/actions, but the exact payment form/checkout implementation is delegated to Clerk. (Files: app/subscriptions/page.tsx, app/platform/billing/page.tsx)
260. No user-defined plan model: The application’s billing is tied to Clerk plan slugs rather than a custom billing engine. (Files: lib/pricing/tiers.ts, app/api/webhooks/clerk/route.ts)

### 11. Performance & scalability work

261. Range caching: Chart payloads are cached by site and date range for two minutes. (Files: lib/chartRangeCache.ts)
262. Conversion cache: Converted leads are cached separately from other chart ranges for two minutes. (Files: lib/convertedLeadsCache.ts)
263. Intent cache: Page-intent results are cached for one minute. (Files: lib/intentCache.ts)
264. Live ticker cache: The live ticker shares cached values. (Files: lib/liveTickerCache.js)
265. Lead-session cache: Lead-session queries use a dedicated cache module. (Files: lib/leadSessionsCache.js)
266._paginated result loading: Hook result lists load more records from sealed tokens without rerunning the query. (Files: output/components/Canvas.tsx, lib/actions/canvas.action.ts)
267. Database indexes: The schema defines indexes for filtering by site, time, session, visitor, and membership. (Files: mds/database.md)
268. Staged query execution: Complex relation filters are executed in stages when estimates are highly separated. (Files: jh-hook/engine/run.ts)
269. Parallel estimation: The Hook engine estimates all top-level conditions concurrently. (Files: jh-hook/engine/run.ts)
270. Query estimate cache: Repeated estimates are reused for five minutes. (Files: jh-hook/engine/run.ts)
271. Browser session storage: Visitor/session IDs avoid repeated UUID generation within a tab. (Files: public/tracker.js)
272. Event batching: The tracker sends one event array per request and can batch page-view and other event types. (Files: public/tracker.js, app/api/track/route.js)
273. Polling fallback: The dashboard has polling-based live updates rather than depending solely on Realtime. (Files: components/dashboard/LiveTicker.tsx, main-chart/components/MainChart.tsx)
274. No explicit queue: The architecture does not contain a visible background job queue or message broker. (Files: package.json, [UNVERIFIED: repository-wide search])
275. No cache-aside database: Caches are in-process modules and do not prove a distributed cache. (Files: lib/chartRangeCache.ts, lib/intentCache.ts)
276. No load testing: No visible load-testing suite or benchmark script is present. (Files: [UNVERIFIED: repository-wide search])
277. No query profiling dashboard: The code uses EXPLAIN and logs timing, but it does not expose a production query-profiling UI. (Files: jh-hook/engine/run.ts)

### 12. Reliability & DevOps

278. Error boundaries: The FramePlate renderer has an error boundary. (Files: framePlate/components/FramePlateErrorBoundary.tsx)
279. Loaded/error/empty UI: Product screens provide user-visible error and empty states. (Files: components/hook/HookWorkspace.tsx, app/platform/dashboard/page.jsx)
280. Retry behavior: The tracker wraps sends in catch handling and logs failures. (Files: public/tracker.js)
281. Keepalive network delivery: Session-end requests use keepalive and a sendBeacon fallback. (Files: public/tracker.js)
282. Idempotent form handling: Form submissions use a 60-second duplicate check. (Files: app/api/track-form/route.js)
283. Stable form engagement status: The engagement API prevents regressions in lifecycle status. (Files: app/api/track-form-engagement/route.js)
284. Server-side form data merging: Field timing is additive and resilient to duplicate network messages. (Files: app/api/track-form-engagement/route.js)
285. Stale data cleanup: Stale sessions and forms are closed by background sweeps. (Files: lib/closeStaleSessions.js, lib/closeStaleFormEngagement.js)
286. Webhook error handling: Clerk webhook handlers return status codes and log database errors. (Files: app/api/webhooks/clerk/route.ts)
287. Billing defensive reads: The billing page reads the latest row instead of assuming a single historical row. (Files: lib/actions/billing.actions.ts)
288. Schema documentation: The database schema is documented directly in mds/database.md, including migration notes and limitations. (Files: mds/database.md)
289. Query migration: The Hook query engine upgrades old query formats before execution. (Files: jh-hook/migrate.ts)
290. Test scripts: Package scripts include tests for the Hook engine, silhouette output, and output behavior. (Files: package.json)
291. Test-first architecture: The repository includes tests for engine behavior and output derivation. (Files: jh-hook/tests/engine.test.ts, silhouette/tests/derive.test.ts, output/tests/output.test.ts)
292. TypeScript: The project uses TypeScript compiler configuration and strict type-checking. (Files: tsconfig.json)
293. ESLint: The project includes ESLint configuration and a lint script. (Files: eslint.config.mjs, package.json)
294. Build scripts: The package includes dev, build, start, and lint commands. (Files: package.json)
295. Environment configuration: Environment variables are consumed for Supabase, Clerk, and analytics integration. (Files: [UNVERIFIED: repository-wide environment usage])
296. Vercel Analytics: The root layout integrates with Vercel telemetry. (Files: app/layout.tsx)
297. Production metadata: The root layout sets SEO metadata, canonical URLs, Open Graph, Twitter, and Google verification fields. (Files: app/layout.tsx)
298. Public sitemap: The project serves a static XML sitemap with per-URL last-modified dates. (Files: public/sitemap.xml)
299. Robots rules: The app exposes a robots metadata route and points to the sitemap. (Files: app/robots.ts)
300. No CI/CD: No visible GitHub Actions, deployment workflow, or automated CI configuration is present. (Files: [UNVERIFIED: repository-wide search])
301. No alerting: No visible Sentry, Honeybadger, Datadog, Slack alert, or equivalent monitoring integration is present. (Files: [UNVERIFIED: repository-wide search])
302. No production logging service: The code uses console logging and server logs, but no centralized logging provider is visible. (Files: [UNVERIFIED: repository-wide search])
303. No health-check endpoint: No explicit health-check or readiness endpoint is visible. (Files: [UNVERIFIED: repository-wide search])
304. No backup automation: No visible database backup or restore automation is present. (Files: [UNVERIFIED: repository-wide search])

### 13. Custom-built systems

305. Custom browser tracker: The product built a standalone analytics tracker instead of relying on a third-party tag manager. (Files: public/tracker.js)
306. Custom session lifecycle: The tracker implements its own session ID, timeout, idle split, and unload behavior. (Files: public/tracker.js)
307. Custom scroll geometry: The tracker and FramePlate derive page positions from scrollable-range fractions. (Files: public/tracker.js, framePlate/geometry)
308. Custom page-visit timeline: FramePlate builds a visual timeline from page-view and away-gap data. (Files: framePlate)
309. Custom conversion path renderer: The product builds per-lead path cards and cuts sessions at submission time. (Files: lib/leadSessions/transform.js, app/platform/conversions/page.jsx)
310. Custom page-intent algorithm: The product built a heuristic score rather than using an external analysis service. (Files: lib/algorithms/pageAnalysis.ts)
311. Custom query language: The product built a typed query specification with nested conditions and tunnel composition. (Files: jh-hook)
312. Custom query planner: The Hook engine estimates conditions with Postgres EXPLAIN and selects execution strategy. (Files: jh-hook/engine/run.ts)
313. Custom query result canvas: The product renders query results as numbers, rankings, time series, lists, and session replay cards. (Files: output/components/Canvas.tsx)
314. Custom silhouette visualization: The product creates a separate silhouette preview for query results. (Files: silhouette/components)
315. Custom data-loading canvas: The output engine uses sealed tokens to load more rows without rerunning a Hook query. (Files: output/components/Canvas.tsx, lib/actions/canvas.action.ts)
316. Custom range chart: The main chart implements peak-bucket aggregation, panning, zooming, line styles, and markers. (Files: main-chart)
317. Custom hook canvas formula: The output engine supports comparison formulas between Hook results. (Files: output/types.ts, lib/actions/canvas.action.ts)
318. Custom cache modules: The app has separate in-process cache modules for chart ranges, conversions, intent, live ticker, and lead sessions. (Files: lib)
319. Custom stale-data cleanup: The app contains dedicated cleanup logic for sessions and form engagement. (Files: lib/closeStaleSessions.js, lib/closeStaleFormEngagement.js)
320. Custom billing synchronization: The webhook layer mirrors Clerk subscription state and creates billing audit events. (Files: app/api/webhooks/clerk/route.ts)
321. Custom form timing model: The application tracks form state and per-field dwell time without taking a request per keystroke. (Files: public/tracker.js, app/api/track-form-engagement/route.js)

### 14. Hard problems & clever solutions

322. Visitor/session identity isolation: The system uses browser-generated IDs and site-scoped database rows to distinguish customer sites and repeat visits. (Files: public/tracker.js, app/api/track/route.js)
323. Session idle timeout: The tracker distinguishes a genuinely inactive tab from a still-open session using a 30-minute idle split. (Files: public/tracker.js)
324. Page-view lifecycle: The system treats page-view open/close timestamps as the source of active-online state instead of only session existence. (Files: main-chart/overview.md, mds/database.md)
325. Scroll geometry correctness: The system distinguishes fractions of the scrollable range from fractions of the page. (Files: mds/database.md, framePlate/geometry)
326. Mid-scroll page-view handling: The tracker records the entry scroll position rather than assuming every page view starts at zero. (Files: public/tracker.js)
327. Revisit tracking: The tracker records the shallowest point after returning to a page and the maximum depth reached. (Files: public/tracker.js, mds/database.md)
328. Conversion attribution: The conversion path uses the submitted timestamp to cut a session at the exact conversion moment. (Files: lib/leadSessions/transform.js)
329. Multiple submissions in one session: The conversion path records each submission’s own cutoff rather than using one global converted flag. (Files: lib/leadSessions/transform.js)
330. Form reload resilience: Form engagement identity is based on session/page/form rather than page-view ID. (Files: app/api/track-form-engagement/route.js)
331. Field timing across reloads: The server merges field timing deltas into durable totals instead of trusting client state. (Files: app/api/track-form-engagement/route.js)
332. Out-of-order tracker events: The form engagement API prevents regressions and uses the latest activity time for abandoned events. (Files: app/api/track-form-engagement/route.js)
333. Multi-item billing calculation: The webhook chooses the effective plan from the full subscription item list. (Files: app/api/webhooks/clerk/route.ts)
334. Clerk timestamp correctness: The webhook uses Clerk’s millisecond timestamps directly rather than multiplying them by 1000. (Files: app/api/webhooks/clerk/route.ts)
335. User ID mapping: The webhook supports multiple possible payer/user ID field shapes and avoids a direct UUID cast. (Files: app/api/webhooks/clerk/route.ts, mds/database.md)
336. Site membership authorization: The application uses both application-level checks and RLS to isolate customer data. (Files: mds/database.md, lib/actions/permission.actions.js)
337. Anonymous tracking authorization: The tracker routes use an API key instead of a Clerk session, by design. (Files: app/api/track/route.js, middleware.ts)
338. Query planner safety: The Hook engine uses Postgres estimated row counts and cost budgets before execution. (Files: jh-hook/engine/run.ts)
339. Query compatibility: The Hook engine migrates old query formats before running them. (Files: jh-hook/migrate.ts)
340. UI query state: Hooks are serialized into URL parameters so queries can be shared as links. (Files: components/hook/HookWorkspace.tsx)
341. Large-time-range charting: The chart compresses wide ranges into pixel columns while retaining the highest and lowest bucket values. (Files: main-chart/overview.md)
342. Stale-tab visibility: The main chart uses page-view open/close timestamps because session rows can remain open across absence. (Files: main-chart/overview.md, lib/closeStaleSessions.js)
343. No false conversion flags: The conversion card truncates a session at the actual conversion event. (Files: lib/leadSessions/transform.js)
344. Form field ambiguity: The tracker classifies field types using name/ID/placeholder heuristics and does not claim perfect field classification. (Files: mds/features.md)
345. Raw form storage: The application stores arbitrary JSONB data without forcing a fixed schema. (Files: app/api/track-form/route.js, mds/database.md)
346. Missing visitor fallback: The lead model remains valid when a form submission has no matching visitor record. (Files: mds/database.md)
347. Hard-delete avoidance: The application uses soft deletion and deactivation for site-level operations. (Files: lib/actions/site-management.actions.js)
348. Incomplete live schema: The database documentation explicitly records unused or unapplied indexes and columns as a risk to verify before relying on them. (Files: mds/database.md)
349. Single source of truth: Form submissions are the lead source of truth; form engagement is supplementary. (Files: mds/features.md, mds/database.md)
350. Logger/diagnostic traceability: The code logs tracker hits, API-key lookup, database errors, and webhook events, though it does not show a centralized log backend. (Files: app/api/track/route.js, app/api/webhooks/clerk/route.ts)

---

## PART 3: DATA FLOW MAPS

### Flow 1: Customer installs the tracker and verifies the site

1. A signed-in user enters a domain on `/platform/create-site`.
2. `createSite()` normalizes the domain, checks for an existing active site, checks the user’s plan/site limit, and creates a site record.
3. The server creates a new API key and a site-member ownership record.
4. The setup page shows the site ID and API key snippet.
5. The customer inserts the script before the closing body tag on their website.
6. The browser loads `tracker.js`, reads the key, derives the API origin, and initializes visitor/session IDs.
7. On the first new session, the tracker sends a `session_start` event to `/api/track`.
8. `/api/track` validates the API key, finds the corresponding site, checks that it is active, and sets `verified: true` on the first accepted hit.
9. The setup page polls `getSiteVerifiedStatus()` and redirects to the dashboard when verification succeeds.

### Flow 2: A visitor lands and moves through a page

1. The customer website loads the public tracker script.
2. The tracker records the visitor ID, session ID, page URL/path/title, referrer, language, timezone, device type, and user agent.
3. It measures the page height, viewport height, entry scroll depth, and existing scroll state.
4. It sends a page-view event array to `/api/track`.
5. The API verifies the key and site, upserts the visitor, creates or reuses the session, and inserts or updates the page-view row.
6. Scroll and visibility events update the page-view’s maximum depth and final position.
7. The dashboard queries the page-view data for active sessions, range charts, page summaries, and page-intent analysis.
8. The custom main chart uses open page-view timestamps rather than merely open session rows.

### Flow 3: A lead submits a form

1. The visitor submits a form marked `data-conversion="true"` when the site uses labelled mode.
2. The tracker extracts name, email, phone, and arbitrary field values from the form.
3. It sends the payload and API key to `/api/track-form`.
4. The API validates the site, checks that it is active, enforces labelled-form mode, and performs a 60-second duplicate check.
5. A new lead row is inserted into `form_submissions` with the visitor/session/page linkage and server timestamp.
6. The leads page and lead profile query the submission and enrich it with linked sessions and page views.
7. The conversion path logic uses the submission timestamp to truncate the session at the exact conversion point.
8. The lead can be qualified or marked as junk by the user.

### Flow 4: A visitor fills a form and abandons it

1. The tracker observes form visibility, focus, input, blur, submit, and session-end events.
2. The tracker sends only meaningful lifecycle events and field timing deltas, not every keystroke.
3. `/api/track-form-engagement` validates the site and session identity.
4. The endpoint builds or updates a `form_engagement` record keyed by session, page path, and form index.
5. Field timing is merged additively on the server, preserving the first focus order and cumulative duration.
6. A submitted form is marked terminal; an abandoned form is finalized when the session ends or the stale-session sweep closes it.
7. FramePlate and the lead profile use the result to show form position, timing, and friction.

### Flow 5: A user asks a question through Hook

1. The user builds conditions in the Hook workspace.
2. The query specification is serialized into a URL-safe query parameter or pasted as JSON.
3. The workspace sends the specification to a server action.
4. The server action validates the site access and calls the Hook engine.
5. The engine migrates the spec, validates it, compiles field and relation conditions, and runs related-hook tunnels.
6. Postgres EXPLAIN estimates each condition and the engine automatically plans an efficient order or staged execution.
7. The engine applies the cost budget before executing the query.
8. The result is rendered as a number, ranking, time series, values, list, or interactive canvas.
9. Matching sessions, leads, visitors, pages, or forms can be highlighted in FramePlate and loaded in pages.

### Flow 6: Clerk billing changes are mirrored into the application

1. Clerk sends a signed webhook to `/api/webhooks/clerk`.
2. The webhook verifier validates the request.
3. User-created/updated events seed or update the local `users` row.
4. Subscription-level events choose the effective plan from all currently active or cancellable items.
5. The subscription row is upserted and the event is logged in `billing_events`.
6. The billing page reads the current subscription and event history from the local mirror tables.
7. Clerk entitlement remains the source for access gating.

---

## PART 4: UI & INFORMATION DISPLAY

### Public and account screens

- `/`: Marketing landing page; displays product positioning, calls to action, and public navigation.
- `/about`: About/organization page.
- `/pricing`: Pricing page; displays plan combinations and subscription calls to action.
- `/subscriptions`: Clerk-hosted subscription page.
- `/sign-in`: Clerk sign-in route.
- `/sign-up`: Clerk sign-up route.
- `/sign-in/sso-callback`: SSO completion route.
- `/sign-up/sso-callback`: SSO completion route.
- `/terms`: Terms content.
- `/privacy`: Privacy content.
- `/docs`: Documentation landing page and navigation.
- `/docs/installation`: Installation instructions, tracker snippet, and verification guidance.
- `/docs/troubleshooting`: Troubleshooting guidance for pending verification and analytics issues.
- `/docs/concepts/visitors-sessions`: Visitor/session semantics and lifecycle.
- `/docs/concepts/session-replay`: Session replay methodology and visualization.
- `/docs/concepts/form-engagement`: Form lifecycle and field timing.
- `/docs/concepts/leads-qualification`: Lead qualification semantics.
- `/docs/concepts/referrers-attribution`: Referrer and UTM attribution.
- `/docs/reference/dashboard`: Dashboard behavior and metrics.
- `/docs/reference/leads`: Lead data and qualification.
- `/docs/reference/lead-profile`: Lead profile data and behavior.
- `/docs/reference/conversions`: Conversion path and attribution.
- `/docs/reference/settings`: Site and account settings.
- `/docs/reference/team`: Team membership and invite behavior.
- `/docs/reference/billing`: Billing and plan behavior.

### Platform screens

- `/platform`: Platform entry shell; redirects or renders the platform landing state.
- `/platform/create-site`: Site registration, domain input, form mode choice, verification state, and tracker installation instructions.
- `/platform/invite`: Pending invitation details and accept/decline controls.
- `/platform/dashboard`: Main analytics dashboard with KPI tiles, online chart, page health, recent activity, and breakdowns.
- `/platform/visitors`: Visitor inventory and visitor-level behavior display.
- `/platform/leads`: Leads table with contact, page, date, confidence, and qualification state.
- `/platform/leads/[lead_id]`: Lead profile with submission, visitor, session, form engagement, and replay details.
- `/platform/conversions`: Per-lead conversion path cards with date filters and pagination.
- `/platform/acquisition`: Referrer/source analysis.
- `/platform/intent`: Page health and intent-failure analysis.
- `/platform/intent/debug`: Debug-level score and analysis breakdown.
- `/platform/network`: Team membership and pending invite management.
- `/platform/settings`: Site and profile settings.
- `/platform/billing`: Subscription and billing history.
- `/platform/subscription`: Pricing and subscription selection.
- `/platform/user`: User profile and account details.
- `/platform/hook`: Product Hook query workspace.
- `/dev/hook`: Developer Hook test bench with raw SQL and cost information.
- `/dev/frame-plate`: Development visualizer for FramePlate behavior.
- `/test`: Temporary site-selector debugging view.

### Information displayed by the main dashboard

- Active visitors: page-view rows that are currently open.
- Page views in the last 24 hours: count of page-view rows in the latest 24-hour window.
- Total sessions: count of sessions for the site.
- Leads: form submissions for the site.
- Conversion rate: derived from leads and total sessions.
- Recent activity: recent site events and user actions.
- Device breakdown: visitor or session counts by device type.
- Country breakdown: session counts by country.
- Page health: intent-failure score and labels.
- Top pages: page-view and submission counts by path.
- Acquisition sources: referrer and campaign grouping.
- Conversion paths: page sequences leading to a submission.

### Information displayed by the lead profile

- Name, email, phone, source page, submission time, confidence, and qualification.
- Visitor identity and linked session data.
- Page-view sequence and time-on-page data.
- Session start/end and duration.
- Form interaction status, field timing, and form position.
- Conversion path and session replay.
- Raw form answers when expanded.

### Information displayed by the Hook canvas

- Numeric answers and their formatted unit.
- Counts and distinct counts.
- Ranked values and time-series buckets.
- IDs and values with truncation markers.
- Matching sessions, leads, visitors, pages, forms, and form fields.
- Session replay with matching visits highlighted and non-matching visits dimmed.
- Comparison results between two hooks.
- Query plan, estimated cost, execution timing, SQL, and tunnel values in development mode.

---

## PART 5: TOP 15 STANDOUTS

1. **Custom visitor-to-lead attribution pipeline:** The tracker records per-session behavior and links form submissions through visitor/session IDs, then reconstructs the exact conversion path. (Files: public/tracker.js, app/api/track-form/route.js, lib/leadSessions/transform.js)
2. **Form-friction instrumentation:** The application tracks form visibility, first input, field timing, abandonment, and completion without one request per keystroke. (Files: public/tracker.js, app/api/track-form-engagement/route.js)
3. **Session replay with geometric page analysis:** The product reconstructs page position, scroll coverage, revisit depth, and away periods from raw browser data. (Files: public/tracker.js, framePlate/geometry, framePlate/components/FramePlateChart.tsx)
4. **Custom typed query language:** Hook provides a JSON-serializable query model with nested filters, related-row measures, tunnels, outputs, and query migration. (Files: jh-hook/types.ts, jh-hook/schema.ts)
5. **Postgres cost-aware query planner:** The engine estimates condition cost with EXPLAIN, selects execution order, stages complex joins, and blocks over-budget queries. (Files: jh-hook/engine/run.ts)
6. **Multi-layer authorization:** The product combines application ownership checks, active-site membership checks, site-scoped RLS, API keys, and signed webhook verification. (Files: lib/actions/permission.actions.js, mds/database.md, app/api/webhooks/clerk/route.ts)
7. **Anonymous public tracker with strict key validation:** The analytics API safely accepts arbitrary customer websites without granting them a Clerk session. (Files: app/api/track/route.js, middleware.ts)
8. **Single-source lead model:** Form submissions are the canonical lead records, while visitors, sessions, and page views are enrichment rather than separate lead tables. (Files: mds/database.md, app/platform/leads/page.jsx)
9. **Live online chart:** The main chart calculates peak simultaneous visitors from open page-view rows and supports multiple intervals, panning, zooming, line styles, and markers. (Files: main-chart/overview.md, main-chart/components/MainChart.tsx)
10. **Effective billing plan reconciliation:** The webhook resolves multi-item Clerk subscriptions correctly and handles cancellation grace periods. (Files: app/api/webhooks/clerk/route.ts)
11. **Stale-session recovery:** The product closes stale sessions and form engagement after inactivity to prevent permanent open records. (Files: lib/closeStaleSessions.js, lib/closeStaleFormEngagement.js)
12. **Data-aware page-intent scoring:** The product derives page health from reading pace, retention, engagement, confusion, conversion, and header visibility instead of relying on generic page-hit counts. (Files: lib/algorithms/pageAnalysis.ts)
13. **Cache design with stale results:** Range, converted-lead, intent, live-ticket, and lead-session data use explicit TTL and stale-result behavior. (Files: lib/chartRangeCache.ts, lib/convertedLeadsCache.ts, lib/intentCache.ts)
14. **Query-result visualization:** Hook results can draw matching session replays, lead cards, visitor cards, and page rankings directly from the same data model. (Files: output/components/Canvas.tsx, components/hook/HookWorkspace.tsx)
15. **Production data/schema documentation:** The repository documents the actual schema, migration history, edge cases, RLS model, and known application limitations. (Files: mds/database.md, mds/features.md)

---

## PART 6: GAPS & METRICS I SHOULD COLLECT

### Product and adoption metrics

- **Active customer count:** Number of active sites and distinct authenticated users with access. Get it from `sites.is_active`, `site_members.status`, and `users`.
- **New sites created per week/month:** Count `sites.created_at` by period and track activation/verification completion.
- **Verification rate:** Percentage of new sites that reach `verified: true` within a fixed window.
- **Time to first tracker hit:** Duration from site creation to first accepted tracker event.
- **Time to dashboard activation:** Duration from site creation to successful verification and dashboard access.
- **Daily active sites:** Distinct sites with at least one accepted tracker event during the day.
- **Daily active visitors:** Distinct `visitor_id` values seen in the selected period.
- **Weekly retention:** Percentage of visitors/sessions active in one week compared with the starting cohort.

### Tracking and event metrics

- **Events per day:** Count `page_views`, `session_start`, `form_submissions`, and `form_engagement` rows by day.
- **Tracker request success rate:** Successful `/api/track` and `/api/track-form` responses divided by attempted requests.
- **Tracker request latency:** P50/P95/P99 request duration for tracking endpoints.
- **Tracker rejection rate:** Invalid key, inactive site, bot filter, malformed payload, and database-error rates.
- **Form capture rate:** Form submissions divided by form-engagement `viewed` events.
- **Form abandonment rate:** Abandoned forms divided by started or viewed forms.
- **Field completion rate:** Forms with a completed field sequence divided by forms that started.
- **Page-view data completeness:** Percentage of rows with page height and viewport height.
- **Session close rate:** Sessions with `ended_at` divided by sessions created.
- **Stale-session cleanup rate:** Sessions/page views closed by the sweep divided by open records found.
- **Duplicate submission rate:** Duplicate submissions prevented divided by attempted submissions.

### Lead and conversion metrics

- **Lead volume:** Form submissions per day and per site.
- **Conversion rate:** Leads divided by sessions or unique visitors, using one consistent denominator.
- **Lead-to-session match rate:** Form submissions with a matching `session_id` and `visitor_id`.
- **Lead enrichment rate:** Leads with a valid name/email/phone versus total leads.
- **Lead qualification rate:** Qualified leads divided by reviewed leads.
- **Lead junk rate:** Marked junk divided by reviewed leads.
- **Lead-to-session conversion path completion:** Percentage of leads whose conversion path contains a valid page-view sequence.
- **Time to lead response:** [METRIC NEEDED: define response event and threshold].
- **Lead-to-qualified conversion:** Qualified leads divided by total leads.
- **Conversion by source:** Conversion-rate and lead count by UTM/referrer/source.
- **Conversion by page:** Submission count and conversion rate by page path.
- **Form friction by field:** Abandonment and time-to-first-input by classified field type.

### Dashboard and page-intent metrics

- **Online-visitor peak:** Highest simultaneous open page-view count by hour/day.
- **Online-visitor uptime:** Percentage of time the site has at least one open page view.
- **Page-view latency:** P50/P95/P99 database and dashboard response time.
- **Main-chart accuracy:** Compare the custom peak-bucket chart with a high-resolution event trace.
- **Page intent score distribution:** Count of good/warning/bad/unknown page scores.
- **Intent score precision:** Percentage of score outputs that match a manual review.
- **Intent score false-positive rate:** Pages marked problematic that did not exhibit the expected problem.
- **Intent score false-negative rate:** Problematic pages missed by the score.
- **Page score recalculation cost:** Query latency and credits per score refresh.
- **Page health coverage:** Percentage of pages with enough data to receive a score.

### Team and access metrics

- **Owner/member ratio:** Active owners and members per site.
- **Invite acceptance rate:** Accepted invites divided by sent invites.
- **Invite time-to-acceptance:** Time from invite creation to member activation.
- **Member retention:** Active members remaining after 30/60/90 days.
- **Access failure rate:** Permission denials and their causes.
- **API key rotation rate:** Number of key rotations and reissued keys.
- **Site deactivation rate:** Deactivated sites divided by sites created.

### Billing metrics

- **Monthly recurring revenue:** Sum of active subscription amounts by period.
- **Trial-to-paid conversion:** Trial users who activate a paid plan.
- **Plan distribution:** User counts by plan.
- **Cancellation rate:** Canceled subscriptions divided by active subscriptions.
- **Churn by plan:** Cancellation rate by plan tier.
- **Payment recovery:** Past-due subscriptions that recover after the next event.
- **Webhook processing failures:** Failed Clerk webhook events and database errors.
- **Subscription mirror lag:** Difference between Clerk event time and local subscription update time.
- **Customer support cost:** [METRIC NEEDED: define support ticket handling and cost source].

### Performance and scalability metrics

- **Postgres query latency:** P50/P95/P99 for dashboard, lead, conversion, and Hook queries.
- **Hook query cost:** Estimated and actual Postgres cost per query.
- **Hook credit utilization:** Credits consumed by users and percentage of max allowed.
- **Hook plan rejection rate:** Queries refused by cost budget.
- **Hook execution time:** Plan and execution duration.
- **Hook tunnel count:** Average nested sub-hook count per query.
- **Chart cache hit rate:** Cached chart result requests divided by range requests.
- **Cached data freshness:** Time since cache creation before reuse.
- **Concurrent dashboard polls:** Active tabs and requests per 15-second interval.
- **Live ticker overlap:** Number of concurrent requests from open dashboard tabs.
- **Database row counts:** Visitors, sessions, page views, form submissions, page structure, and form engagement by site.
- **Index usage:** Postgres index usage and dead-row/lock diagnostics.
- **Storage growth:** Database bytes and row counts by table over time.
- **API request volume:** Tracking and dashboard request counts by endpoint.

### Reliability metrics

- **Production uptime:** Available from the deployment platform; calculate as successful requests divided by total requests.
- **HTTP 5xx rate:** Tracking, dashboard, and API endpoint failures.
- **Database failure rate:** Supabase query errors divided by requests.
- **Webhook delivery failures:** Clerk webhook failures and retries.
- **Tracker script load failure rate:** Script load failures by page/browser.
- **API key invalidation rate:** Invalid key responses and key regeneration events.
- **Stale page-view rate:** Open page views older than the cleanup threshold.
- **Data loss rate:** Missing expected session/page-view/form events compared with emitted events.
- **Data reconciliation:** Count of form submissions matching a source tracker event.

### Business impact metrics

- **Lead volume per customer:** Leads per week/month.
- **Customer-reported conversion change:** Difference in conversion rate before and after the product or page changes.
- **Time saved reviewing leads:** [METRIC NEEDED: define a baseline and measurement method].
- **Organizations using the product:** [METRIC NEEDED: count unique customer sites or organizations].
- **Revenue per active site:** [METRIC NEEDED: subscription revenue divided by active site or customer].
- **Cost per tracked visitor:** [METRIC NEEDED: database/server cost divided by accepted visitor events].
- **Cost per lead:** [METRIC NEEDED: database/server cost divided by accepted form submissions].
- **Support response time:** [METRIC NEEDED: ticket timestamps and service-level target].

### Important missing measurements

- Trial-to-paid conversion and customer lifetime value.
- Real customer count and active-account retention.
- Average number of sites per customer.
- Exact tracker event-to-database write consistency.
- Real delay between a customer’s form submission and dashboard visibility.
- Query failure and retry rates for production endpoints.
- Percentage of records with valid site/session/visitor linkage.
- Retention of site data after user departure or plan cancellation.
- Whether the current production database has all documented indexes and columns applied.
- Any production deployment, monitoring, backup, and incident-response evidence.

---

## Evidence index

- Project stack and scripts: package.json, next.config.ts, tsconfig.json, eslint.config.mjs.
- Public product shell: app/layout.tsx, app/page.tsx, app/pricing/page.tsx, app/about/page.tsx.
- Tracking: public/tracker.js, app/api/track/route.js, app/api/track-form/route.js, app/api/track-form-engagement/route.js, app/api/track-structure/route.js.
- Data model: mds/database.md, mds/features.md.
- Authentication and billing: middleware.ts, app/api/webhooks/clerk/route.ts, lib/actions/permission.actions.js, lib/actions/billing.actions.ts.
- Dashboard and analytics: app/platform/dashboard/page.jsx, lib/actions/supabase.actions.js, main-chart, components/charts, components/dashboard.
- Lead intelligence: app/platform/leads/page.jsx, app/platform/leads/[lead_id]/page.jsx, lib/actions/leadProfile.actions.js, lib/leadSessions/transform.js.
- Page intent: lib/algorithms/pageAnalysis.ts, lib/algorithms/pageAnalysis.server.ts, lib/actions/intentFailure.action.ts.
- Hook query engine: jh-hook, components/hook, output, silhouette, lib/actions/canvas.action.ts.
- Custom visualization: framePlate, main-chart, output.
- Security and access: mds/database.md, lib/actions/permission.actions.js, app/api/track/route.js, app/api/webhooks/clerk/route.ts.
- Reliability: lib/closeStaleSessions.js, lib/closeStaleFormEngagement.js, lib/chartRangeCache.ts, lib/convertedLeadsCache.ts, lib/intentCache.ts.
