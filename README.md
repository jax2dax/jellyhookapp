# Jellyhook

Jellyhook is a tracking script and dashboard for websites whose main job is to produce form leads. For each lead it shows
what that person did on the site before filling in the form (pages read, time on each page, scroll depth, which headings
they reached, time spent in each form field) and where the form loses the people who start it.

Live site: [jellyhook.com](https://jellyhook.com). Public docs: [jellyhook.com/docs](https://jellyhook.com/docs).

## Contents

- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Scheduled jobs](#scheduled-jobs)
- [Installing the tracker on a site](#installing-the-tracker-on-a-site)
- [Scripts](#scripts)
- [Testing](#testing)
- [Test environment (bench)](#test-environment-bench)
- [Deployment](#deployment)
- [Privacy and data handling](#privacy-and-data-handling)
- [Further documentation](#further-documentation)
- [Contributing](#contributing)
- [License](#license)

## How it works

```
 customer's website                    Jellyhook (Next.js)                       Supabase (Postgres)
 ┌──────────────────────┐   events    ┌─────────────────────────────────┐       ┌──────────────────────┐
 │ <script tracker.js>  │ ──────────► │ /api/track, /api/track-form,    │ ────► │ visitors, sessions,  │
 │ page views, scroll,  │             │ /api/track-form-engagement,     │       │ page_views,          │
 │ headings, form focus │             │ /api/track-structure            │       │ form_submissions,    │
 │ and submit           │ ◄────────── │ /api/site-config                │       │ form_engagement, ... │
 └──────────────────────┘   config    └─────────────────────────────────┘       └──────────┬───────────┘
                                                     │                                     │
                                                     ▼                                     │
                                      /platform/* dashboard (Clerk auth) ◄─────────────────┘
                                      marks, Hook queries, Slack / webhook /
                                      HubSpot notifications, MCP server
```

1. **Tracker.** [public/tracker.js](public/tracker.js) runs on the customer's site. It keeps a visitor ID in
   `localStorage` and a session ID per tab. It reports page views, scroll positions, heading positions, form views,
   field focus times and form submissions. It skips password and search forms and never sends fields listed in
   [mds/documentation/sensitive-fields.md](mds/documentation/sensitive-fields.md).
2. **Ingestion.** The `app/api/track*` routes check the site's API key, drop bot traffic and write rows. These routes are
   excluded from Clerk's middleware on purpose (see the comment in [middleware.ts](middleware.ts)): they are called
   cross-origin by anonymous visitors.
3. **Dashboard.** `/platform/*` shows leads, the visit chart for each lead, the form dashboard, visitors, traffic
   sources and settings. A lead is a `form_submissions` row; there is no separate leads table.
4. **Marks and hooks.** Marks are rules checked against each new lead. Hooks send matching leads to Slack, a webhook or
   HubSpot. A background drainer delivers the messages (see [Scheduled jobs](#scheduled-jobs)).

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, Radix UI, shadcn components |
| Charts | Recharts, uPlot, custom SVG (visit chart) |
| Auth and billing | Clerk (`@clerk/nextjs`), including Clerk Billing webhooks |
| Database | Supabase (Postgres), accessed with `@supabase/supabase-js` and `pg` for read-only queries |
| AI | OpenAI API (optional, for Ask Hook and mark suggestions) |
| Integrations | Slack OAuth, HubSpot OAuth and app card, outgoing webhooks, MCP server |
| Hosting | Vercel |
| Tests | Plain TypeScript test files run with `jiti`; PGlite for SQL tests |

## Repository layout

| Path | Contents |
|---|---|
| `app/` | Routes. `app/page.tsx` is the landing page, `app/platform/` the signed-in app, `app/docs/` the public docs, `app/api/` the API routes, `app/admin/` the founder's control room. |
| `components/` | Shared React components (auth cards, dashboard parts, landing page parts in `components/showcase/v2/`). |
| `lib/` | Server and shared logic: tracking, actions, marks, notifications, integrations, privacy, metrics, Supabase clients. |
| `public/tracker.js` | The tracking script customers install. |
| `jh-hook/` | Hook, the query engine behind lead filters and hooks. |
| `jh-marks/` | Mark rules, the v2 checker and AI-assisted mark building. |
| `jh-forms/` | Form dashboard calculations (timelines, averages, versions). |
| `jh-ai/` | Ask Hook: turns a question into a Hook query. |
| `jh-mcp/` | MCP server (tokens, tools, masking). |
| `jh-stats/` | Site statistics ("typical" values). |
| `framePlate/`, `silhouette/`, `output/`, `main-chart/` | Visit chart, preview silhouette, results canvas and main traffic chart, each with its own design notes. |
| `hubspot/` | The HubSpot app card project. |
| `scripts/` | Test environment, traffic simulator, benchmarks, docs check, SEO tools, tracker end-to-end checks. |
| `mds/` | Engineering notes: schema, migrations, build plans, issues log, progress timeline. |
| `marketing/` | Marketing plans, the claims ledger and copy research. |

## Getting started

### Prerequisites

- Node.js 20 or newer (developed on Node 24)
- A Supabase project
- A Clerk application
- Optional: an OpenAI API key, a Slack app and a HubSpot developer app for the matching features

### Install and run

```bash
git clone https://github.com/jax2dax/jellyhookapp.git
cd jellyhookapp
npm install
# create .env.local with the variables listed below
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000). Sign up, create a site under `/platform`, and copy the
tracker snippet it shows into a test page.

## Environment variables

Put these in `.env.local`. Git ignores every `.env*` file. Never commit keys.

**Required**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk authentication |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Verifies Clerk webhooks (`/api/webhooks/clerk`: users and billing) |
| `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (same value in both) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side database access. Server only; never expose it to the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase key |
| `NEXT_PUBLIC_APP_URL`, `APP_URL` | The app's public address, used in links and OAuth redirects |
| `NEXT_PUBLIC_TRACKER_URL` | Where the tracker is served from, shown in the install snippet |
| `IP_HASH_SALT` | Salt for hashing visitor IP addresses |
| `CRON_SECRET` | Bearer token for the scheduled job routes |

**Optional, per feature**

| Variable | Feature |
|---|---|
| `HOOK_DATABASE_URL`, `HOOK_DATABASE_SSL` | Read-only Postgres login (`hook_reader`) for Hook queries; created with [jh-hook/setup.sql](jh-hook/setup.sql) |
| `HOOK_MAX_CREDITS` | Per-query work limit for Hook |
| `OPENAI_API_KEY`, `AI_ENABLED`, `AI_HOOK_MODEL` | Ask Hook and AI mark building |
| `AI_DAILY_USD_CAP`, `AI_DAILY_QUESTIONS`, `AI_USD_PER_CREDIT`, `AI_LOG_PAIRS` | AI spend limits and logging |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_BASE` | Connect Slack |
| `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_BASE` | Connect HubSpot and the HubSpot card |
| `CHANNEL_SECRET_KEY` | Encrypts stored integration secrets |
| `MCP_ENABLED`, `MCP_MAX_ROWS`, `MCP_MAX_CREDITS`, `MCP_CALLS_PER_MINUTE`, `MCP_CALLS_PER_DAY` | MCP server and its limits |
| `DEV_USAGE_USER_IDS` | Comma-separated Clerk user IDs allowed into `/admin`, `/dev/usage` and `/api/diag` in production |
| `JELLYHOOK_ADMIN_USER_IDS` | Comma-separated Clerk user IDs allowed to publish in-app announcements |
| `JELLYHOOK_COUNTRY_LOOKUP` | Set to `off` to skip visitor country lookups |
| `HOOK_DEBUG`, `NEXT_PUBLIC_HOOK_DEBUG`, `JH_DEBUG_TRACK` | Debug logging |

## Database

- The schema is documented in [mds/database.md](mds/database.md).
- Migrations live in [mds/migrations/](mds/migrations/) and are numbered. Apply them in order in the Supabase SQL editor.
  Each file starts with a comment saying what it does and any manual steps.
- The tables that existed before migration 07 are not in a migration file. To set up a new project, copy the structure
  of an existing database with `node scripts/sim/bench-schema.mjs "<connection string>"`, which writes a schema-only
  dump (no rows) to `bench-schema.sql`.
- Read [mds/bench/WHICH-SQL-WHERE.md](mds/bench/WHICH-SQL-WHERE.md) before running SQL. Some files are for the test
  project only.

## Scheduled jobs

| Job | How it runs | Set up in |
|---|---|---|
| Notification drainer (`/api/jobs/drain`) | Supabase Cron with `pg_net`, every few seconds, sending `Authorization: Bearer <CRON_SECRET>` | Last section of [20-groups-and-notifications.sql](mds/migrations/20-groups-and-notifications.sql) |
| Stale session sweep (`jh_close_stale()`) | Supabase Cron every 5 minutes; also runs after tracker requests, so the schedule is optional | [07-ingestion-hardening.sql](mds/migrations/07-ingestion-hardening.sql) |
| `/api/close-stale-sessions` | Optional HTTP entry point for the same sweep, for an external scheduler | Needs `CRON_SECRET` |

Both protected routes return 401 without the correct bearer token, and stay off when `CRON_SECRET` is not set.

## Installing the tracker on a site

Each site gets an API key when it is created in the dashboard. Add the script to every page:

```html
<script defer src="https://jellyhook.com/tracker.js" data-key="YOUR_SITE_API_KEY"></script>
```

Add `data-require-consent` to have the tracker wait for the site's cookie banner. Per-form options and the supported
form types are covered in the public docs under Concepts.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check (run before every commit) |
| `npm run docs:check` | Checks that docs pages tied to Hook and results still match the code |
| `npm run docs:stamp` | Updates the fingerprints after a reviewed docs change |
| `npm run hook:reference` | Regenerates the Hook field reference |
| `npm run ai:eval` | Runs the Ask Hook evaluation set |
| `npm run seo:indexnow` | Asks IndexNow to recrawl changed pages |

## Testing

There is no test runner framework. Each test file is plain TypeScript run with `jiti` and exits non-zero on failure.

| Command | Covers |
|---|---|
| `npm run test:tracking` | Tracker logic, identity, heading time, page snapshots, settings, metering |
| `npm run test:tracking-sql` | SQL migrations and functions, run against PGlite (in-memory Postgres) |
| `npm run test:forms` | Form timelines, engagement, sensitive fields, attribution, form rules |
| `npm run test:marks` | Marks, acquisition, notifications, HubSpot, lead stories |
| `npm run test:hook` | Hook query engine |
| `npm run test:ai` | Ask Hook prompt and checks |
| `npm run test:mcp` | MCP tokens, tools and protocol |
| `npm run test:silhouette`, `test:output`, `test:visits` | Chart geometry and aggregation |

End-to-end tracker checks are in [scripts/tracker-e2e/](scripts/tracker-e2e/) and need a local Chrome (`CHROME_PATH`).

## Test environment (bench)

Load tests and the traffic simulator run against a separate Supabase project holding only fake data, never production.

| Command | What it does |
|---|---|
| `npm run dev:bench` | A second copy of the app on port 3100, reading `.env.bench`. Refuses to start unless the database is marked as the test project. |
| `npm run start:bench` | The same, as a production build |
| `npm run sim` | Sends fake visitors, page views and form submissions to the bench server |
| `npm run drain:bench` | Runs the notification drainer against the bench server |
| `npm run bench:storage`, `bench:planner`, `bench:verify` | Storage and query planner benchmarks |

Full setup: [mds/bench/overview.md](mds/bench/overview.md).

## Deployment

The app is deployed on Vercel from the `main` branch.

1. Set every required environment variable in the Vercel project.
2. Apply any new migrations to the production Supabase project before deploying code that depends on them.
3. In Clerk, point the webhook at `https://<your domain>/api/webhooks/clerk`.
4. Set up the scheduled jobs above.

Production incidents and their fixes are logged in [mds/issues/prod-issues.md](mds/issues/prod-issues.md). Limits that
were lowered to fit the Supabase free tier are listed in [mds/issues/free-tier-mode.md](mds/issues/free-tier-mode.md).

## Privacy and data handling

- Password, payment and other sensitive fields are never stored
  ([mds/documentation/sensitive-fields.md](mds/documentation/sensitive-fields.md)).
- Visitor IP addresses are hashed with `IP_HASH_SALT`.
- The tracker can follow the site's cookie banner. Data retention and erasure of a person are in migration 35
  ([mds/build/privacy/privacy.md](mds/build/privacy/privacy.md)).
- The service role key is used only in server code.

## Further documentation

| Topic | Where |
|---|---|
| Product overview | [saas-overview.md](saas-overview.md), [SAAS_PRODUCT_AUDIT.md](SAAS_PRODUCT_AUDIT.md) |
| Tracker and ingestion specs | [mds/documentation/](mds/documentation/) |
| Feature build notes | [mds/build/](mds/build/) |
| Hook query engine | [jh-hook/documentation.md](jh-hook/documentation.md) |
| Change log by date | [mds/progress_timeline.md](mds/progress_timeline.md) |
| Rules for AI agents working in this repo | [CLAUDE.md](CLAUDE.md) |

## Contributing

- Branch from `main` and keep each change focused.
- Run `npx tsc --noEmit` and the test suites for the area you changed.
- A change that alters what users see is not done until the public docs in `app/docs/` are updated in the same change.
  The rules are in [mds/documentation/docs-standard.md](mds/documentation/docs-standard.md).
- Do not run Prettier on existing files. It rewraps long lines and produces whole-file diffs.
- Add a dated entry to [mds/progress_timeline.md](mds/progress_timeline.md) for each change.

## License

Proprietary. All rights reserved. No license is granted to use, copy or distribute this code.
