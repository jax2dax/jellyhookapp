# Full SaaS Product, Feature & Data-Flow Audit

## 1. Product Overview

This SaaS is a website analytics and conversion-intelligence product built around a client-side tracker script and a Supabase-backed dashboard. The actual implementation shows a system where business owners register a site, install a JavaScript tracker, and then monitor visitor sessions, page views, scrolling, referrer/source data, and form submissions. The product is designed to show who visited, what pages they viewed, how long they spent on each page, how far they scrolled, and which submissions came from leads.

The primary problem it solves is conversion visibility: helping a website operator understand traffic quality, page engagement, and which forms are generating leads. The apparent target user is a business owner, marketing operator, or website manager running a business site with one or more conversion forms. The main workflow is: create a site -> install the tracker snippet -> collect traffic -> review analytics and lead data -> manage site members and plans.

What makes it useful today is that the codebase actually collects real behavioral metrics from the site itself: session starts/ends, page_view events, scroll depth, page structure, and form captures, then aggregates them into dashboard tables and charts. It also supports user/team access management and billing via Clerk.

What it is not designed to do, based on implementation: it is not a CRM, not a general project management tool, not a document ingestion platform, and not a general AI content analysis product. It does not appear to support e-commerce product analytics, invoicing beyond billing for the SaaS itself, or arbitrary user-defined data pipelines.

This SaaS is essentially a website analytics and lead-intelligence platform that allows users to install tracking on a site, monitor visitor behavior, and measure form-based conversions.

---

## 2. Complete Page / Route Inventory

| Page / Route | Purpose | What User Sees | Data Displayed | User Actions | Backend / API / Services |
| --- | --- | --- | --- | --- | --- |
| / | Public marketing landing page | Brand page with CTA buttons and auth states | Product copy, pricing/feature claims, sign-in/up calls | Sign in, sign up, open dashboard | Clerk auth components; no App Router data fetch in app/page.tsx |
| /sign-in/[[...sign-in]] | Clerk sign-in page | Hosted sign-in form | Auth form only | Sign in | Clerk auth |
| /subscriptions | Clerk pricing page | Pricing table | Subscription plans | Sign up / subscribe | Clerk Billing / PricingTable |
| /dashboard | Redirect page | Redirect to /platform/dashboard | None | Redirect | Next redirect |
| /platform/layout.jsx | Shell for authenticated platform | Sidebar + header + current site selection | User plan, site list, selected site | Navigate sections | getAuthUser(), getUserSite(), getAllUserSites(), getPlanLabel() |
| /platform/create-site | Site onboarding | Domain registration + install tracker instructions | Domain, site creation status, API key snippet | Create site, cancel verification, view install script | createSite(), cancelVerification(), getSiteVerifiedStatus(), sites table |
| /platform/invite | Invite acceptance screen | Pending invite details and actions | Invite sender/site info | Accept/decline invite flow (UI exists but logic is partly split) | getPendingInviteDetails(), acceptInvite()/declineInvite() in site-management flows |
| /platform/dashboard | Main analytics dashboard | Overview KPI cards and charts | Active visitors, page views, sessions, leads, conversion rate, device/country, page health, recent activity | Inspect charts, navigate to deeper pages | getActiveVisitors(), getPageViewsLast24h(), getTotalSessions(), getRecentActivity(), getDeviceBreakdown(), getCountryBreakdown(), getLeads(), getSitePagesOverview(), getIntentFailureAnalysis() |
| /platform/leads | Leads list | Table of all form submissions | Name, email, page, date, confidence | Click lead row to open detail | getLeads() from form_submissions |
| /platform/leads/[lead_id] | Lead profile | visitor identity + submission details + behavior stack | Name, email, phone, engagement metrics, path to conversion, form field payload | Inspect lead history and conversion events | getLeadProfileByLeadId(), buildLeadProfile(), page_views + form_submissions |
| /platform/acquisition | Acquisition tracking page | Referrer/source table | Source, sessions counts | View traffic sources | getAcquisitionSources() from sessions |
| /platform/conversions | Conversion path page | Path charts and list | Path sequences before conversion | View conversion funnels | getConversionPaths(), chart components |
| /platform/intent | Intent analysis page | Page health and intent-failure analysis | Page failure score, engagement metrics, content/scroll analysis | Inspect problem pages | getIntentFailureAnalysis() + pageAnalysis engine |
| /platform/intent/debug | Developer debug page | Raw scoring breakdown | Page analysis JSON and score button | Debug analysis internals | getIntentFailureAnalysis() |
| /platform/network | Team access / member management | Site members, pending invites, invite form | Members, roles, pending invites | Invite/remove members | getMembers(), inviteMember(), removeMember() |
| /platform/settings | Settings and profile page | Profile form + site config controls | Current user profile, site domain, name, API key, tracking state | Update domain/name, regenerate API key, toggle tracking, deactivate site | getMyProfile(), updateMyProfile(), getMembers(), updateSiteDomain(), updateSiteName(), regenerateApiKey(), toggleSiteActive(), deactivateSite() |
| /platform/billing | Billing overview | Current plan, billing email, transaction history | Subscription state, billing events | View plan status, open manage/upgrade page | getCurrentSubscription(), getBillingHistory(), getUserProfile(), Clerk Billing webhook mirror tables |
| /platform/subscription | Pricing table page | Upgrade plan | Clerk pricing UI | Choose plan | Clerk Billing / PricingTable |
| /platform/page.jsx | Placeholder scaffold page | Blank shell / skeleton | None | None | Unused placeholder |
| /app/dev/frame-plate | Development/demo page | Visual analytics demo | Demo charts and geometry data | None | Local fakeData + FramePlate prototype |
| /app/test/page.jsx | Temporary debug test page | Site selector debug | All sites/current site | None | getAllUserSites(), getUserSite() |
| /api/track | Core analytics ingestion endpoint | Not user-facing | N/A | No direct user action; called by tracker.js | Validates API key, matching site, inserts visitors, sessions, page_views |
| /api/track-form | Form conversion capture endpoint | Not user-facing | N/A | No direct user action; called by tracker.js on submit | Validates site API key, deduplicates, inserts form_submissions |
| /api/track-structure | Header structure capture endpoint | Not user-facing | N/A | No direct user action; called by tracker.js | Stores header metadata in page_structure |
| /api/site-config | Tracker config endpoint | Not user-facing | N/A | No direct user action; called by tracker.js | Returns specify_form flag for site |
| /api/subscription | Clerk subscription read endpoint | Not user-facing | N/A | Called by app logic or debugging | Clerk Billing API |
| /api/get-analytics | Debug/utility endpoint | Not user-facing | N/A | Called by internal tooling | returns page_views for user-owned sites |
| /api/debug, /api/debug-site, /api/debug-leads | Debug endpoints | Not user-facing | N/A | Internal debugging | Direct Supabase reads |
| /api/webhooks/clerk | Clerk webhook endpoint | Not user-facing | N/A | Clerk event delivery | Webhook verification, writes users/subscriptions/billing_events |

---

## 3. Core Features

### Feature: Site creation and onboarding
Purpose: allow a customer to register a domain and create an analytics site.
User input: domain, optional form labeling choice.
Processing: normalizes domain, checks if it exists, enforces plan/site limits, generates api_key.
Data created/modified: sites row, site_members row, api_key, verified flag.
Output: install script and dashboard access.
Relevant code: createSite() in lib/actions/site-management.actions.js; createSite() in lib/actions/supabase.actions.js; app/platform/create-site/page.jsx.

### Feature: Tracker installation and page-level behavior collection
Purpose: collect website traffic and behavior from customer sites.
User input: tracker script loaded on customer site; website visitor behavior.
Processing: script captures session id, visitor id, page path, scroll, duration, device/user-agent, page structures, form submissions.
Data created/modified: visitors, sessions, page_views, page_structure.
Output: traffic and engagement dashboard plus per-page analytics.
Relevant code: public/tracker.js; app/api/track/route.js; app/api/track-structure/route.js.

### Feature: Session and visitor tracking
Purpose: identify repeat visits and active sessions.
User input: browser session data, referrer, timezone, device info.
Processing: session deduplication, inactivity threshold handling, page_view lifecycle, visitor upsert logic.
Data created/modified: sessions and visitors records.
Output: active visitor count, session counts, source/referrer grouping.
Relevant code: app/api/track/route.js; lib/actions/supabase.actions.js getActiveVisitors(), getTotalSessions(), getAcquisitionSources().

### Feature: Lead capture from forms
Purpose: capture and store form submissions from the tracked site.
User input: form field data (name, email, phone, raw_data, page URL/path).
Processing: form extraction heuristics, dedupe logic, validation by specify_form.
Data created/modified: form_submissions rows.
Output: leads table, lead detail page, conversion counts.
Relevant code: public/tracker.js form capture block; app/api/track-form/route.js.

### Feature: Page health / intent-failure analysis
Purpose: infer whether pages are failing to hold attention or convert.
User input: page_views, page structure, page height, scroll, time-on-page, conversion sessions.
Processing: aggregate page metrics and score behavior using lib/algorithms/pageAnalysis.*.
Data created/modified: derived analytics, not stored per se in the basic flow; page_structure and page_metrics are persisted; reported values are computed live.
Output: page score, labels, insight sentences.
Relevant code: lib/actions/intentFailure.action.ts; lib/algorithms/pageAnalysis.server.ts; app/platform/intent/page.tsx.

### Feature: Team / multi-user site management
Purpose: allow multiple people to access one site.
User input: owner/invite email, role assignments.
Processing: site_members table checks on access, invite/pending member states.
Data created/modified: site_members rows, pending_invite/active/declined states.
Output: network view and permission enforcement.
Relevant code: lib/actions/settings.actions.js; app/platform/network/page.jsx; lib/actions/permission.actions.js.

### Feature: Billing and plan gating
Purpose: manage access tiers and billing through Clerk.
User input: subscription events from Clerk and user billing profile.
Processing: webhook mirrors subscription state into Supabase tables; pages gate features by Client/plan logic.
Data created/modified: users, subscriptions, billing_events rows.
Output: plan status, billing history, feature availability.
Relevant code: app/api/webhooks/clerk/route.ts; lib/actions/billing.actions.ts; app/platform/billing/page.tsx; lib/actions/permission.actions.js getPlanLabel().

### Feature: Site settings and profile management
Purpose: let the owner control site metadata and API key, and let the user manage their display profile.
User input: name, domain, API key regeneration, active state, first_name/last_name/phone.
Processing: updates in Supabase and user profile row.
Data created/modified: sites row, users row.
Output: updated configuration and user display data.
Relevant code: lib/actions/settings.actions.js; lib/actions/profile.actions.js; app/platform/settings/page.jsx.

### Summary table

| Feature | User Input | Processing | Data Created/Changed | Output |
| --- | --- | --- | --- | --- |
| Site onboarding | Domain + naming | Validate domain, generate key, enforce limits | sites, site_members | Tracker script and dashboard access |
| Traffic monitoring | Browser load and page actions | Collect session/page/scroll data | visitors, sessions, page_views | Analytics dashboard |
| Lead capture | Form fields | Extract and dedupe contact info | form_submissions | Leads list and detail |
| Intent analysis | Aggregated page behavior | Score pages against engagement/retention heuristics | Derived scores | Page health view |
| Team network | Invite emails, member roles | Permission checks, invite states | site_members | Shared access |
| Billing | Clerk subscription events | Mirror to Supabase | subscriptions, billing_events | Plan status |
| Profile/settings | Name, domain, key, phone | Update rows | users, sites | Site customization |

---

## 4. EVERYTHING THE SYSTEM COLLECTS

### A. User / Account Data

| Field / Data | Origin | Storage | Why Used |
| --- | --- | --- | --- |
| Clerk user ID | Clerk auth | users.id; site_members.user_id; subscriptions.user_id | Identify the authenticated user and map access to sites and plans |
| Email address | Clerk user profile; user.updated webhook | users.email; site_members.user_email | Account identity, site membership, invites, billing email |
| First/last name | Clerk user profile; editable in app settings | users.first_name, users.last_name | Display name in app and profile |
| Phone | User profile form | users.phone | Profile display / lead enrichment (not used much in dashboard) |
| Avatar / profile photo | Clerk image_url | users.pfp | Display in app UI |
| Organization site membership | site_members rows | site_members | Team permissions and ownership |
| Site ownership / role | site_members.role, sites.user_id | site_members, sites | Access control |
| Subscription plan/status | Clerk Billing webhooks | subscriptions, billing_events | Access gating and billing UI |
| Billing email | Clerk user profile | users.email | Billing page display |
| Preferences | Not strongly visible except site config and UI theme | local app state / cookies only | UI selection and preferred site |

### B. Application / Customer Data

This includes data the user explicitly provides to the SaaS through site setup and configuration:

| Data | Origin | Storage | Why Used |
| --- | --- | --- | --- |
| Website domain | User registration form | sites.domain | Unique site identity and installation key mapping |
| Site name | User registration/settings | sites.name | Dashboard display |
| API key | Generated when site is created | sites.api_key | Authenticates incoming tracker requests |
| specify_form flag | User chooses on site creation | sites.specify_form | Restricts conversion capture to labelled forms |
| Site active/paused state | Settings toggle | sites.is_active | Enables or disables tracking |
| Site deactivation timestamp | Setting deactivation | sites.deleted_at/is_active | Soft-delete / disable site |
| Invite email | Network page | site_members.user_email | Invite someone to a site |
| Contact form field values | Tracked forms on customer site | form_submissions.raw_data, name, email, phone | Lead capture |
| Page titles/paths | Browser tracker | page_views.page_title, page_path | Analytics and content analysis |
| Referrer URL | Browser document.referrer | sessions.referrer | Acquisition source analysis |
| Timezone | Intl.DateTimeFormat().resolvedOptions().timeZone | sessions.timezone | Geo/usage analytics |
| Page structure headings | Tracker captures headers from pages | page_structure.header_text | Page health analysis |

### C. Automatically Collected Data

This is the core of the product, and it is actual implementation, not a theory:

- IP address: captured from x-forwarded-for in app/api/track/route.js and stored in visitors.ip_address.
- User agent: captured in tracker.js (navigator.userAgent), stored in sessions or page_views values (track route sets user_agent on page_view_start but the actual insert path only uses it in page_views payload when sending; the route code does not persist user_agent on page_views explicitly, but the browser sends it and the route reads it for bot detection).
- Device type: determined from UA and stored in visitors.device_type.
- Country: derived from IP via ip-api.com in app/api/track/route.js and stored on sessions.country.
- Referrer: document.referrer stored on sessions.referrer.
- Session ID: sessionStorage-backed UUID.
- Visitor ID: localStorage-backed UUID.
- Page path / URL: captured from the tracker.
- Page view duration: measured by Date.now() - startTime and stored in page_views.time_on_page.
- Scroll depth: captured as fraction or percentage and stored in page_views.scroll_depth and max_scroll_depth.
- Scroll history / revisit depth: page_view_end includes revisit_start_scroll and max_scroll_depth.
- Time on page: time_on_page.
- Page height / viewport height: sent and stored in page_views.page_height and viewport_height.
- Page headers: header text/tag/index/position_y in page_structure.
- Session start/end times: sessions.started_at, ended_at, last_activity_at.
- Timestamps: created_at, entered_at, left_at, submitted_at, last_seen, updated_at.
- Browser state and navigation events: page_view_start/page_view_end, scroll events, visibility changes.

### D. Derived / Generated Data

| Derived Data | How It Is Generated |
| --- | --- |
| Active visitors count | Count session rows with last_activity_at within last 30 seconds in getActiveVisitors() |
| Page views in 24h | Count page_views entered_at >= threshold |
| Conversion rate | leads / totalSessions in app/platform/dashboard/page.jsx |
| Device breakdown | Group visitors by device_type |
| Country breakdown | Group sessions by country |
| Acquisition sources | Group sessions by referrer |
| Page path popularity | Count page_views by page_path |
| Engagement score / intent failure | lib/algorithms/pageAnalysis.* calculates page health based on time-on-page, scroll, exit behavior, structure, retention |
| Lead profile / conversion path | buildLeadProfile() aggregates a visitor’s page_views and form_submissions |
| Confidence score | email present => high else low; also form capture uses heuristics |
| Reading pace / content density / exit rate | page analysis algorithm |

---

## 5. DATA COLLECTION DEPTH

| Data Type | Collection Method | Granularity | Frequency | Stored? | Retention / Deletion |
| --- | --- | --- | --- | --- | --- |
| Site registration info | User form | per site | one-time | Yes | Not explicitly deleted in code; deactivation is soft delete / is_active false |
| Clerk account info | Auth provider | per user | ongoing | Yes | Handled by Clerk; site row is still separate |
| Visitor ID | localStorage UUID | per browser | per browser | Yes | In visitors table for site lifetime |
| Session ID | sessionStorage UUID | per tab/session | ongoing | Yes | sessions row remains until not explicitly removed |
| Page view data | tracker events | per page view | per page view | Yes | No explicit deletion logic in UI; rows persist |
| Scroll behavior | JS scroll monitoring | per page view and throttled event | ongoing while page open | Yes | Persistent in page_views |
| Session start/end | tracker events | per session | per visit | Yes | No removal code found |
| Referrer / timezone / country | browser + IP lookup | per session | per visit | Yes | Stored in sessions |
| Form submission fields | form capture | per submission | per form submit | Yes | No explicit delete code found |
| Billing events | Clerk webhook | per subscription event | event-driven | Yes | No retention/deletion logic in app code |
| Page structure metadata | page header scan | per page | on page load | Yes | Persisted in page_structure |

Practical difference: the system does not just know a user visited a page; it records a specific visitor_id, session_id, page_view_id, entered_at, left_at, scroll_depth, time_on_page, device, referrer, and sometimes raw form payload. It therefore reaches a per-session, per-page, and per-event level of visibility, not merely a general page-hit count.

---

## 6. Data Flow

### Authentication data flow
User signs in via Clerk -> ClerkProvider / Clerk auth middleware -> currentUser() / auth() -> Supabase client with Clerk token -> site membership lookups and access checks -> dashboard pages render.

### Site / customer data flow
User enters domain on create-site -> createSite() -> check site availability and ownership -> insert into sites and site_members -> store api_key -> tracker script installed -> tracker calls /api/track using api_key.

### Analytics / tracking data flow
Browser page loads -> public/tracker.js -> sendEvent() to /api/track -> validate api_key -> find site -> upsert visitors -> create/close sessions -> insert/update page_views -> query dashboard -> render page charts and stats.

### Form submission data flow
Website form submits -> tracker extracts fields -> sends payload to /api/track-form -> validate specify_form -> dedupe within 60 sec -> insert form_submissions -> leads pages query and display.

### Billing data flow
Clerk subscription changes -> webhook at /api/webhooks/clerk -> normalize plan/status -> write users, subscriptions, billing_events -> Billing page reads mirror tables -> UI displays plan and history.

### Intent analysis data flow
Page_views + page_structure + form submissions -> getIntentFailureAnalysis() -> analyzePageFull() -> Page health score + labels -> UI shows warning on dashboard and intent page.

---

## 7. DATABASE / STORAGE AUDIT

This codebase uses Supabase Postgres as the main database and Clerk for identity/billing. The app also uses cookies for preferred site selection.

| Storage | Purpose | Important Fields | Written By | Read By | Data Type |
| --- | --- | --- | --- | --- | --- |
| Supabase public.users | Internal user profile mirror | id, email, first_name, last_name, pfp, phone, created_at | Clerk webhook, getMyProfile() backfill, updateMyProfile() | billing page, settings page | auth/profile |
| Supabase sites | Site definition per customer website | id, domain, name, api_key, user_id, plan, is_active, verified, specify_form, monthly_event_limit, deleted_at | createSite(), settings actions | permission.actions, tracker, pages | customer site metadata |
| Supabase site_members | Multi-user membership and invite state | id, site_id, user_id, user_email, role, status, invited_by, created_at | createSite(), inviteMember(), getUserSite() backfill | permission actions, network pages | access control |
| Supabase visitors | Browser-level identity per site | id, visitor_id, site_id, ip_address, first_seen, last_seen, device_type | /api/track | dashboard queries | behavioral tracking |
| Supabase sessions | Visitor session lifecycle | id, session_id, visitor_id, site_id, started_at, ended_at, last_activity_at, referrer, country, timezone | /api/track | dashboard, acquisition, charts | behavioral tracking |
| Supabase page_views | One row per page view instance | id, page_view_id, session_id, visitor_id, site_id, page_url, page_path, page_title, entered_at, left_at, time_on_page, scroll_depth, max_scroll_depth, max_scroll_reached_at, viewport_height, page_height | /api/track | dashboard, lead profile, intent analysis | behavioral tracking |
| Supabase page_structure | Header layout metadata per page | site_id, page_path, page_height, header_index, header_text, header_tag, position_y | /api/track-structure | intent analysis | derived content structure |
| Supabase page_metrics | extra page metrics | site_id, page_path, page_height | Not obviously used heavily | intent analysis | derived measurement |
| Supabase form_submissions | Captured lead submissions | id, site_id, visitor_id, session_id, page_url, page_path, name, email, phone, confidence, raw_data, submitted_at | /api/track-form | leads pages, conversion analysis | lead / conversion |
| Supabase subscriptions | Mirrored current plan state | user_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, cancelled_at, updated_at | /api/webhooks/clerk | billing page, permission gating | billing |
| Supabase billing_events | Billing event log | id, user_id, event_type, plan, status, amount_cents, currency, subscription_id, created_at | /api/webhooks/clerk | billing page | billing audit |
| Cookies | Preferred site selection | preferred_site_id | site-cookie helpers | permission actions | app state |

Important notes:
- Multi-tenancy boundaries: site_id and site_members isolate data per website; user_id fields also exist for ownership/permissions.
- Ownership checks: verifyOwner() in settings.actions.js checks site_members first, then sites.user_id fallback.
- RLS: The code comments mention Supabase RLS but the actual app often uses createSupabaseClient() with Clerk access token and service-role clients for certain reads/writes. There are comments about service role for billing and subscriptions because those tables are not RLS-authorized for users.
- Deletion semantics: deactivation is a soft delete via is_active=false and deleted_at set; direct deletes are rare and not broadly implemented. No broad hard-delete cascade was identified.

---

## 8. API / BACKEND AUDIT

| Endpoint / Function | Method | Input | Processing | Database / External Services | Output |
| --- | --- | --- | --- | --- | --- |
| /api/track | POST | JSON array of event objects, x-api-key | bot detect, validate site, upsert visitor/session, insert/update page_views | Supabase sites/visitors/sessions/page_views; ip-api.com | success json |
| /api/track-form | POST | JSON form payload with api_key, visitor_id, session_id, page fields | validate site, check specify_form, dedupe within 60 sec, insert form_submissions | Supabase sites/form_submissions | success json |
| /api/track-structure | POST | page structure payload with api_key and headers | validate site, upsert page_structure rows | Supabase page_structure | success json |
| /api/site-config | GET | ?key=apiKey | fetch specify_form flag for site | Supabase sites | JSON { specify_form } |
| /api/subscription | GET | authenticated user | fetch Clerk subscription | Clerk Billing | JSON subscription |
| /api/webhooks/clerk | POST | signed Clerk webhook payload | verifyWebhook, handle user.created, user.updated, subscription.* events | Supabase users/subscriptions/billing_events | HTTP ok/error |
| /api/get-analytics | GET | authenticated user | fetch all user-owned sites and page_views | Supabase page_views/sites | JSON pages |
| /api/debug | GET | none | fetch recent page_views | Supabase | JSON debug data |
| /api/debug-site | GET | authenticated user | fetch sites for user | Supabase | JSON debug data |
| /api/debug-leads | GET | none | fetch recent form_submissions | Supabase | JSON debug data |
| getAuthUser() | server action | current request | ensure Clerk-authenticated user | Clerk auth | currentUser |
| getUserSite() | server action | userId | resolve selected/current site from memberships, cookie, fallback | Supabase site_members/sites | site object |
| getAllUserSites() | server action | userId | return all accessible sites | Supabase site_members/sites | site list |
| requireSite() | server action | userId | redirect if not accessible | uses getUserSite | site or redirect |
| getIntentFailureAnalysis() | server action | siteId | load page_views, structures, conversions; compute page analysis | Supabase page_views/page_structure/page_metrics/form_submissions | analysis result |
| getCurrentSubscription() | server action | authenticated user | read latest subscription mirror row | Supabase subscriptions | row or null |

---

## 9. External Services

| Service | Why Used | Data Sent | Data Received | Where Used |
| --- | --- | --- | --- | --- |
| Clerk | Authentication, session management, user identity, billing | user identity, auth metadata, billing data | user object, session claims, subscription info | app/layout.tsx, middleware.ts, all authenticated pages, webhooks |
| Supabase | Primary database and query layer | site data, analytics rows, form submissions, user profile rows | query results | entire product |
| ip-api.com | Country lookup from IP | IP address only | country name | app/api/track/route.js |
| Browser localStorage/sessionStorage | visitor and session tracking | UUIDs and browser state | stored IDs locally | public/tracker.js |

Notably, the code does not show any AI provider, email provider, object storage, vector DB, analytics vendor such as Segment, or S3/Blob storage. There is no visible third-party payment processor beyond Clerk Billing, which is the actual billing system.

---

## 10. AI / LLM Data Flow

There is no OpenAI, Anthropic, or generic LLM API integration directly in the codebase. The product does compute heuristic scores from page behavior, but it is not using a model call to generate summaries from the data. The page health logic is implemented as algorithmic analysis in lib/algorithms/pageAnalysis.* and pageAnalysis.server.ts, not as an LLM chain.

Observed flow:
User enters website -> tracker collects page engagement data -> page_views + page_structure + form_submissions -> getIntentFailureAnalysis() -> analyzePageFull() -> heuristic score + insight sentence -> dashboard displays result.

There is no embedding generation, no vector store, no prompt context, no AI model call, and no AI output storage in the code discovered. The “insightSentence” is generated by the custom algorithm, not an LLM.

---

## 11. Frontend → Backend → Database Map

```text
User / Visitor Browser
        ↓
public/tracker.js
  - session tracking
  - scroll tracking
  - page view tracking
  - form capture
        ↓
/app/api/track
/app/api/track-form
/app/api/track-structure
/api/site-config
        ↓
Supabase Postgres
  - sites
  - visitors
  - sessions
  - page_views
  - form_submissions
  - page_structure
  - page_metrics
  - users
  - subscriptions
  - billing_events
        ↓
Server actions / reads
lib/actions/supabase.actions.js
lib/actions/permission.actions.js
lib/actions/intentFailure.action.ts
lib/actions/billing.actions.ts
        ↓
Next.js app pages
/app/platform/dashboard
/app/platform/leads
/app/platform/intent
/app/platform/billing
        ↓
User sees charts, tables, lead detail, billing state
```

The architecture is centered on: browser script -> API ingestion -> Supabase -> dashboard UI.

---

## 12. User Actions

### Account
- Sign up via Clerk
- Sign in / out via Clerk
- Create a site
- Change site settings
- Manage profile details
- Invite/remove team members
- Review billing / plan

### Data
- Create a site
- Regenerate API key
- Toggle site tracking on/off
- Deactivate a site
- Upload nothing in the product itself; no file upload feature was found
- Search/filter: limited mostly to dashboard queries and lead tables, but no advanced search UI is clearly implemented
- Export: no direct export feature found in the codebase

### Analytics / Product Usage
- View active visitors
- View session totals
- View page views and path analytics
- Inspect device breakdown
- Inspect country breakdown
- Review acquisition sources
- Review conversion paths
- View lead list and lead detail
- View page intent health

### AI
- No user-triggered AI or text generation features found. The product is not an AI assistant product in this codebase.

---

## 13. What the System Knows About a User

### Explicitly provided
- Clerk user ID
- Email address
- First/last name, phone (if set in profile)
- Site name/domain and API key configuration
- Site membership invites / role assignments
- Billing profile / subscription information

### Automatically observed
- Browser user agent
- Device type (mobile/desktop)
- IP address
- Country derived from IP
- Timezone
- Referrer URL
- Session and visitor IDs
- Page paths and URLs visited
- How long a page was viewed
- Scroll depth and max scroll depth
- Page height and viewport height
- Whether a page was revisited or backtracked
- Whether a form was submitted and what fields were filled

### Inferred / derived
- Current plan from subscription mirror row
- Active visitor count based on recent sessions
- Site health score from the page analysis algorithm
- Conversion rate
- Acquisition source grouping
- Device/country distributions
- Lead confidence by email presence
- Time-to-convert / path-to-conversion metrics
- The system calculates “intent failure” based on reading pace, retention, exploration depth, and scroll behavior.

How detailed is the product’s understanding of an individual user?
It is fairly detailed for tracked website visitors. It can identify a repeat visitor by visitor_id, approximate their device/browser, know their pages, dwell time, scroll patterns, session timing, and form submissions. It does not appear to build a rich personal profile beyond those analytics and form data. It does not have, in the code found, a social graph, full CRM history, or external data enrichment layer.

---

## 14. What the System Knows About the Customer’s Users

The SaaS does track the customer’s own website visitors, but only in the context of the customer-defined site. This is a first-party analytics product for the customer’s website visitors.

- Does it track the customer’s users? Yes, through visitor_id, session_id, and page_views.
- How are those users identified? Browser-local random UUIDs stored in localStorage/sessionStorage.
- What actions are tracked? page_view_start/end, session_start/end, scroll, referrer, form submissions, paths.
- Can individual users be distinguished? Yes, at least as browser-scoped visitors, not necessarily as real human identities.
- Are sessions tracked? Yes.
- Are events tracked? Yes.
- Is behavior stored historically? Yes, page_views and sessions are stored over time.
- Can behavior be associated with an identity? Only if the same visitor later submits a form with name/email, then UI can correlate the browser identity with a lead identity.
- Can an individual user’s activity be inspected? Yes on the lead profile page, which builds a visitor journey from page_views and form submissions.
- What can a business customer see? They can see visits, pages, device/country breakdown, site health, lead submissions, and conversion paths.

If the SaaS does not do these things, say so explicitly: the code does not show a full identity graph for website visitors beyond visitor_id + form submissions; no login/account system for end-users is implemented.

---

## 15. Security / Data Access

Authentication:
- Clerk handles user auth via ClerkProvider and auth() / currentUser() calls.
- Middleware protects app routing via clerkMiddleware().

Authorization:
- site access is checked via site_members and site ownership.
- verifyOwner() ensures only owners can change site/domain/configuration.
- permission actions enforce access before site data is shown.

Workspace / organization isolation:
- Each site has a site_id; access is scoped through site_members. Data from one site should not appear in another site’s dashboard because most queries are filtered by site_id.

Database security rules:
- Comments mention Supabase RLS and service role client usage, but the actual code uses both. For app-level user reads, it uses auth-provided client; for billing and some mirror tables it uses service role. This means some logic intentionally bypasses user-scoped RLS to read subscriptions.

Secrets handling:
- API keys are stored in the sites table and used as bearer-like credentials in tracker requests.
- Service-role key exists in env and is used in server-side webhooks and billing reads.

Client vs server credentials:
- public/tracker.js runs in browser and uses the site api_key as a tracker credential via x-api-key.
- The app server uses Clerk session auth and Supabase service role for webhook operations.

Sensitive data exposed to browser:
- The public tracker script transmits page path, URL, user agent, referrer, and form values to the server; it does not appear to expose all customer analytics to arbitrary browsers beyond the tracked site.
- The app does not show user-level raw IP addresses in the product UI based on the code read.

Public endpoints:
- /api/track, /api/track-form, /api/track-structure, /api/site-config are effectively public in the sense they are accessible by a client with valid API key or no key for config.

Potential access concerns:
- API key is sent from the browser script and is effectively a site secret; if compromised, it could let arbitrary clients post fake tracking or form data.
- some routes return safe defaults on invalid auth, so they tolerate bad input; but the overall design still relies on api_key and site ownership checks.

---

## 16. Data Retention / Deletion

This is the documented actual behavior found:

- User deletes something: No broad deletion logic across all tables was found. The main soft-delete pattern is site deactivation: settings.deactivateSite() sets is_active=false and deleted_at = now.
- User deletes an account: No explicit account-deletion flow was found in the app code.
- Workspace is deleted: The implementation does not show a full workspace-delete cascade. Soft deactivation is implemented for a site, not for a whole workspace.
- File is deleted: No file-upload object storage exists in this codebase.
- Project is deleted: Not a concept in this SaaS; there are “sites” and “members,” not project objects.
- Subscription ends: The code handles this via Clerk webhooks and status changes; the UI reflects canceled or past_due states, but there is no explicit delete path for the mirror tables.

So the pattern is mostly “soft delete / disable / archive-like state,” not mass hard deletion. For events and analytics rows, the code did not show explicit retention policy or purge jobs.

---

## 17. Product Boundary

### What it collects
- Website visitor session data
- Page paths, URLs, scroll depth, time on page
- Browser/device/IP/country data
- Form submissions and raw form data
- Site metadata and plan access state
- Team member emails and roles
- Billing events and subscription mirror tables

### What it stores
- Supabase tables: sites, site_members, users, visitors, sessions, page_views, form_submissions, page_structure, page_metrics, subscriptions, billing_events
- Cookie state: preferred site id
- Clerk user records and subscription records

### What it processes
- Traffic analytics
- Conversion funnel/path analysis
- Page health / intent scoring
- Device and geography summaries
- Member access and invite logic
- Billing plan calculations from Clerk events

### What it analyzes
- Session-level behavior
- Scroll and content engagement patterns
- Lead conversion paths
- Page-level retention and intent failure
- Acquisition source grouping

### What it displays
- Dashboard KPI + charts
- Playback-like lead history and session summary
- Network access list
- Billing history and plan status

### What it allows the user to control
- Create and configure site
- Toggle tracking
- Generate API key
- Invite or remove members
- Update profile/site fields
- View billing and plan status

### What it does not currently collect
- File uploads
- Documents or PDFs
- External CRM records not related to tracked forms
- Multi-step AI workflows or prompts
- General user journey across multiple websites beyond the customer’s site

### What it does not currently analyze
- AI/computer-vision analysis of uploaded images or documents
- Natural-language analysis from arbitrary text sources
- Product or e-commerce event streams beyond basic web traffic and form submissions

### What it does not currently provide
- No built-in export or report generation pipeline found
- No project management, ticketing, or tasks
- No generic website editor or CMS
- No user-defined data warehouse or pipeline

---

## 18. Core Product Components

1. Authentication and identity
- Purpose: log in users and identify them across the app
- Main files: app/layout.tsx, middleware.ts, lib/actions/permission.actions.js, app/sign-in/[[...sign-in]]/page.tsx
- Inputs: Clerk auth/session
- Outputs: authenticated user IDs and site access

2. Site management and onboarding
- Purpose: create and configure tracked sites
- Main files: app/platform/create-site/page.jsx, lib/actions/site-management.actions.js, lib/actions/supabase.actions.js
- Inputs: domain, name, specify_form flag
- Outputs: site row, api_key, access membership

3. Tracking SDK and ingestion
- Purpose: capture real-time visitor behavior from customer websites
- Main files: public/tracker.js, app/api/track/route.js, app/api/track-form/route.js, app/api/site-config/route.js
- Inputs: browser events, form submissions, API keys
- Outputs: visitors/sessions/page_views/form_submissions records

4. Analytics and dashboard layer
- Purpose: aggregate stored event data into metrics and charts
- Main files: lib/actions/supabase.actions.js, app/platform/dashboard/page.jsx
- Inputs: site_id, page_views, visitors, sessions, form_submissions
- Outputs: KPI cards, charts, breakdowns

5. Lead intelligence
- Purpose: treat form submissions as conversion events and inspect behavior around them
- Main files: app/platform/leads/page.jsx, app/platform/leads/[lead_id]/page.jsx, lib/actions/leadProfile.actions.js, lib/algorithms/leadProfile.*
- Inputs: form submissions + page views + visitor data
- Outputs: lead list and per-lead journey view

6. Intent / page-health engine
- Purpose: determine whether a page is likely underperforming or confusing visitors
- Main files: lib/actions/intentFailure.action.ts, lib/algorithms/pageAnalysis.*
- Inputs: page_views, page_structure, conversion session IDs
- Outputs: per-page failure score and insight sentence

7. Team access and network
- Purpose: give multiple people access to a site
- Main files: app/platform/network/page.jsx, app/platform/invite/page.jsx, lib/actions/settings.actions.js
- Inputs: invite email and membership state
- Outputs: site_members roster and invite flows

8. Billing and plan gating
- Purpose: manage subscription plan and enforce access tiers
- Main files: app/api/webhooks/clerk/route.ts, lib/actions/billing.actions.ts, app/platform/billing/page.tsx, components/PlanGate.jsx
- Inputs: Clerk billing events and user subscriptions
- Outputs: plan status, feature gating, billing history

---

## 19. Core Product Loop

User creates a site and installs the tracker
        ↓
The tracker collects sessions, pages, scroll, and form submissions
        ↓
Server validates the site and stores events in Supabase
        ↓
Analytics queries aggregate the data into dashboards and lead records
        ↓
The owner sees traffic, engagement, conversion signals, and page health
        ↓
The owner updates configuration, invites teammates, or improves the site

In plain English: the product’s value loop is “track site behavior, turn it into a dashboard, identify conversion opportunities, and then act on the insight.” The product is not a full automation loop; it is a monitoring and lead-intelligence loop with direct access control and billing around it.

---

## 20. Feature Map

```text
PRODUCT
│
├── Authentication
│   ├── Clerk sign-in / sign-up
│   ├── Auth middleware
│   └── user + session identity
│
├── Site Management
│   ├── Create site
│   ├── Domain configuration
│   ├── API key generation
│   ├── Tracking enable/disable
│   └── Site deactivation
│
├── Data Collection
│   ├── Visitor tracking
│   ├── Session tracking
│   ├── Page view tracking
│   ├── Scroll tracking
│   ├── Referrer tracking
│   ├── Form capture
│   └── Page structure capture
│
├── Analytics
│   ├── Overview dashboard
│   ├── Active visitors
│   ├── Sessions and page views
│   ├── Devices / countries
│   ├── Acquisition sources
│   ├── Conversion paths
│   └── Page health / intent analysis
│
├── Leads
│   ├── Leads table
│   ├── Lead detail view
│   ├── Path-to-conversion analysis
│   └── Confidence scoring
│
├── Team Access
│   ├── Site membership
│   ├── Invite flow
│   └── Owner/member permissions
│
├── Billing
│   ├── Clerk subscription mirror tables
│   ├── Billing history
│   └── Plan gating
│
└── Settings / Profile
    ├── user profile
    ├── site settings
    └── site API key management
```

---

## 21. Final Product Definition

### What This SaaS Actually Is
This SaaS is a site analytics and conversion tracking platform for website owners. It works by loading a tracker script onto a customer website and then collecting visitor-level event data into a Supabase database. The product then turns that raw event stream into dashboards, lead records, page health scoring, acquisition stats, and conversion path views for the business owner. The user experience is centered on “install script, monitor site behavior, analyze conversions, and manage access/billing.”

The core code does not indicate a broad “all-in-one marketing suite.” Instead, the implementation is a narrow analytics product focused on behavior, engagement, and conversion capture from a web property. It uses Clerk for identity and billing, Supabase for storage, and custom server logic for analytics aggregation.

### Core Problem
It solves the problem of not knowing who visited a site, what they did, which pages they engaged with, and which forms actually turned into leads.

### Core User
It is built for website owners, marketers, and small business operators who have a site and want insight into visitor behavior and conversion performance.

### Core Input
The main input is website analytics data: session starts, page views, scroll depth, time on page, page titles, referrer source, device/browser metadata, IP-derived country, and form submissions.

### Core Processing
The system validates the site, stores events, normalizes them by visitor/session/page, aggregates metrics, and computes page health and conversion-related analytics.

### Core Output
The user gets dashboards, lead lists, per-lead behavior details, path analysis, site health scores, and billing/access status.

### Core Value
The main value is visibility: the user learns which pages are performing, what visitors are doing, where leads come from, and which page behaviors correlate with conversion or drop-off. It reduces the need to manually reason about Google Analytics-like traffic plus form data without a BI layer.

### Data Depth
The system records per-visitor, per-session, per-page, and per-event behavior. It is not just “page count” analytics; it stores enough metadata to reconstruct visitor behavior over time and to associate form submissions with browser sessions.

### Primary Product Category
Based on the implementation, this product most closely fits a website analytics and conversion intelligence platform.

---

# Audit Confidence

- The codebase is highly consistent on the product’s core concept: analytics + lead tracking + billing + team access.
- The one area where the implementation is partially ambiguous is whether the system intends to support deeper retention/soft-delete policies beyond sites and member rows; the app does not show a formal retention schedule or deletion job.
- The codebase contains some developer-only and leftover scaffold pages (for example /platform/page.jsx, app/test/page.jsx, app/dev/frame-plate/page.jsx), which are clearly not part of the main product flow.
- The exact “organic” page-health algorithm is implemented, but the scoring model is custom logic rather than an AI model, so there is no LLM integration to audit beyond that distinction.
- Some features are partially implemented or not fully wired in the UI (for example, some invite acceptance logic exists but the app flow is split across actions and pages). Those were treated as implemented only when the actual code path existed and could be traced.
