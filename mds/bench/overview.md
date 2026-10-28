# The test environment ("bench"): everything in one place

Status: set up 2026-10-26. For the founder and any developer. Related: `WHICH-SQL-WHERE.md` (the short checklist of which SQL
goes in which project), `mds/build/control-room.md` (the control room and the traffic simulator), `jh-hook/architecture.md`
section 13 (how the Hook read-only login works in production).

## What it is, and why
Marks and hooks are flexible, and every new lead is checked against every mark and every hook. To know how much traffic
Jellyhook can take, how fast a lead reaches Slack and what it costs, load has to be generated. That cannot be done on the
production database: it would use up production's capacity and mix fake leads with customers' data. So there is a second
Supabase project, the **test project** ("bench"), holding only fake data, and a second copy of Jellyhook that talks to it.

```
 your computer                                               the cloud
 ┌───────────────────────────────┐
 │ npm run dev        :3000      │── .env.local ──────────►  PRODUCTION Supabase project (real customers)
 │ npm run dev:bench  :3100      │── .env.bench ──────────►  TEST Supabase project (fake data only)
 │ npm run sim  (fake visitors)  │── sends traffic to :3100
 └───────────────────────────────┘
```
Nothing runs in Docker. Docker or the PostgreSQL command-line tools were only needed once, to copy production's table
structure (no data) into the test project.

## The pieces
| Piece | What it does | Where |
|---|---|---|
| Test project | Empty Supabase project, same plan and region as production; holds fake data | Supabase dashboard (name it with BENCH) |
| Structure copy | Production's tables, columns, indexes, functions and access rules, no rows | `bench-schema.sql`, made by `node scripts/sim/bench-schema.mjs "<production connection string>"` (git ignores it) |
| `.env.bench` | The test project's keys; read only by `npm run dev:bench`; git ignores it | project folder |
| Test server | Jellyhook on http://localhost:3100, built into `.next-bench`, so it can run next to `npm run dev` | `scripts/sim/dev-bench.mjs` |
| Test mark | A table `jh_environment` with the row `bench`; the test server refuses to start without it | `mds/bench/01-mark-test-database.sql` |
| Traffic simulator | Fake visitors, page views, ad clicks and forms, and a one-form-per-second rush | `scripts/sim/traffic.mjs` (`npm run sim`) |
| Control room | `/admin` on the test server: the numbers (traffic, leads, speed to Slack, work, cost) | `mds/build/control-room.md` |

## `.env.bench`: the variables
Put the **test** project's values in it. Every database variable must be there: one left out would fall back to the value in
`.env.local`, which is production. `npm run dev:bench` checks this and refuses to start. It prints the variable names and the
test database's address, never a value.

| Variable | Value | Where to find it (test project) |
|---|---|---|
| `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` | `https://<test ref>.supabase.co` (the same in both) | Project Settings, API, Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key | Project Settings, API |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key | Project Settings, API |
| `HOOK_DATABASE_URL` | the Hook read-only login, see the next section | Connect, Transaction pooler |
| `NEXT_PUBLIC_TRACKER_URL`, `NEXT_PUBLIC_APP_URL` | `http://localhost:3100` | type it |
| `HOOK_DATABASE_SSL` | only if `.env.local` has it: the same value | |
| `JELLYHOOK_COUNTRY_LOOKUP` | `off` | type it. The simulator's fake addresses never resolve, and the lookups slowed the test server to a stop (2026-10-27) |

Clerk, Slack and HubSpot keys stay in `.env.local`; the test server uses them from there.

## The `hook_reader` login and `HOOK_DATABASE_URL`
**What it is.** Some marks (older ones, and "published" ones) and the Hook query tool read the database through a direct
Postgres connection (`lib/hook/pgDb.ts`) instead of through the Supabase API. That connection logs in as a database role named
`hook_reader`, which can only read five tables (`page_views`, `sessions`, `form_submissions`, `visitors`, `form_engagement`),
cannot write, and stops any query after 8 seconds. In production it was created once with `jh-hook/setup.sql`.

**Why the test project needs its own.** The structure copy contains `hook_reader`'s access rules (policies), and a rule that
names a role fails when that role does not exist: `ERROR: 42704: role "hook_reader" does not exist`. So the role has to be
created in the test project **before** the copy is pasted. And because the copy is made without permissions
(`pg_dump --no-privileges`), its read rights are granted again afterwards.

**Order in the test project** (details: `WHICH-SQL-WHERE.md`):
1. `00-create-hook-reader-role.sql`: create the role with a **new** password (letters and digits only, never production's).
2. `bench-schema.sql`: the structure copy.
3. `01-mark-test-database.sql`: the test mark.
4. `02-hook-reader-grants.sql`: what `hook_reader` may read.

**The connection string.** In the test project: Connect, **Transaction pooler**, copy the URI. It looks like
`postgresql://postgres.<test ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres`. Supabase's pooler decides
which project and which database user a connection is for from the **user name**, which is `<role>.<project ref>`. So change
`postgres.<test ref>` to `hook_reader.<test ref>` (keep the project ref) and replace `[YOUR-PASSWORD]` with the **hook_reader**
password from step 1 (not the project's database password). The result is `HOOK_DATABASE_URL` in `.env.bench`.

**Checks.** If it is wrong, the first Hook query or older mark fails with "password authentication failed" (wrong password or
wrong user name) or "Tenant or user not found" (wrong project ref). The test server starts anyway: only these queries fail.
Marks built with the newer builder (v2) and everything the control room shows do not use this connection.

## Day to day
1. `npm run dev:bench` (leave it running). It prints "Test database: <test ref>.supabase.co" and "Marked as the test database: ok".
   For load tests use `npm run start:bench` instead: the same checks, then a production build (into `.next-bench-prod`,
   a few minutes) and `next start` on port 3100. The development server compiles pages while it answers ("Compiling..."
   in the browser) and slows down under load, so it would be measured along with the database.
2. On http://localhost:3100 create a test site with a made-up domain (for example `sim.jellyhook.test`), copy its API key
   (Settings, Installation), and add marks and hooks as a business would. Use a separate Slack channel for the test hooks:
   the burst sends real messages.
3. `npm run sim -- --key <the key> --domain sim.jellyhook.test --visitors 100 --over 60 --burst 30`
4. Watch http://localhost:3100/admin with Live on.
5. Reset the fake data when you want a clean run: in the TEST project's SQL editor (check the name), delete the test site's
   rows (deleting the site in Jellyhook removes its data), or `truncate` the big tables there. Never in production.

## Safety nets
- `npm run dev:bench` refuses to start unless the database carries the test mark (`jh_environment`). Production has no such
  table, so a `.env.bench` that points at production is refused. Checked by `node scripts/sim/guardtest.mjs`.
- It also stops when a database variable is missing, or when `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` name different projects.
- `npm run sim` refuses to send to jellyhook.com unless `--allow-production` is given.
- The structure copy only reads production, and contains no data (`pg_dump --schema-only`). It contains column names such as
  `secret` but no values.
- `.env.bench` and `bench-schema.sql` are ignored by git. The hook_reader password of the test project is not production's.

## Problems met while setting this up, and the fix
| Message | Cause | Fix |
|---|---|---|
| `relation "public.site_usage_daily" does not exist` | migration 29 run in an empty project | run the structure copy first |
| `role "hook_reader" does not exist` | the copy refers to a login the test project does not have | run `00-create-hook-reader-role.sql` first |
| `--env-file= is not allowed in NODE_OPTIONS` | Next.js passes node's flags on to its workers | fixed: `dev-bench.mjs` reads `.env.bench` itself |
| Docker: "Virtual Machine Platform not enabled", then "No virtualization available" | a Windows feature and the BIOS virtualization setting | not needed: install the PostgreSQL command-line tools (Command Line Tools only); the script finds `pg_dump` there |
| `NOT STARTING: ... is not marked as the test database` | `01-mark-test-database.sql` not run, or `.env.bench` points at another project | run it in the test project; check `SUPABASE_URL` |
| `Missing in .env.bench: ...` | a database variable left out | add it |
| `Missing --key` from `npm run sim` | the site's key and domain are needed | `npm run sim -- --key ... --domain ...` (note the `--`) |

## Limits
- A free Supabase project holds 500 MB: enough for the 100-visitor and 30-form tests and sites of a few thousand leads. A
  100,000-lead site needs a bigger test project for a day.
- The test project must match production's compute size for the numbers to mean anything.
- The database's own CPU and disk work, and Vercel's billing, cannot be read from inside the app (see the control room doc).
