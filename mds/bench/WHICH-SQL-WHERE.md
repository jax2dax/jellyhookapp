# Which SQL runs where: production or the test project

Rewritten 2026-10-28 (the file had been committed empty). Two Supabase projects: **production** (real customers) and the
**test project** ("bench", fake data; its name says BENCH). Before running anything, check the project name at the top of
the Supabase dashboard. Background: `overview.md`.

## Test project only (never production)
Run once, in this order, when the test project is new:
1. `mds/bench/00-create-hook-reader-role.sql`: the read-only Hook login, with a NEW password (never production's).
2. `bench-schema.sql`: production's structure, no data (made by `node scripts/sim/bench-schema.mjs "<production connection string>"`; ignored by git).
3. `mds/bench/01-mark-test-database.sql`: the test mark (`jh_environment`). `npm run dev:bench` refuses to start without it, and production must never have it.
4. `mds/bench/02-hook-reader-grants.sql`: what the Hook login may read.

Resetting fake data (test project only), keeping the site, marks and hooks:
```sql
truncate page_views, sessions, visitors, form_submissions, form_engagement, pipeline_runs, site_usage_daily restart identity cascade;
```

## Both projects: the numbered migrations (`mds/migrations/NN-*.sql`)
Rule: run a new migration in the **test project first**, measure, then in **production at the deploy that ships the code
that needs it** (not before, not after). Every migration is safe to run twice.

| Migration | Test project | Production | Needed by |
|---|---|---|---|
| up to 28 | in the structure copy | done | |
| 29-control-room.sql | done | to run at the next deploy | the control room (`/admin`) |
| 30-control-room-stages.sql | done (2026-10-28) | to run at the next deploy | the control room's stage table |
| 31-submission-id.sql | to run now | at the deploy that ships the tracker outbox | one lead per form submission when the tracker sends it again |
| 32-other-marks-runs.sql | to run now | at the same deploy | recording the "other marks" step of the v2 lane |
| 33-marks-v3.sql | to run now | at the same deploy | when marks run (v3): past leads in the background, off = not checked |
| 34-mark-queue-and-cap.sql | to run now | at the same deploy | the queue of other marks and the cap on mark work (`mds/build/marks/queue-and-cap.md`) |

Keep this table current: add a row when a migration is written, and fill in the dates when it has run.

### Production, 29 to 34 (checked 2026-10-27, 34 added 2026-10-28)
All six only ADD things (columns with defaults, new tables, functions, indexes, a wider check list). None removes or
renames anything, and the code that runs in production today ignores what they add. So running them in production
before the deploy is safe; running the code before them is also safe (every new reader falls back when a column is
missing), but then the new parts stay switched off. The order that keeps everything working:
1. Test project: 31, 32, 33, 34 (29, 30 are done), measure (`mds/crowd-test/v2/summary.md`, `v3/summary.md`).
2. Production SQL editor (check the project name first): 29, 30, 31, 32, 33, 34, in that order, right before pushing.
3. Push the code.
Note: the control room code and the v2 and v3 code are already on `main` and pushed (commit 92d5c81, 2026-10-27). If
production deploys `main`, it runs that code before these migrations: `/admin` says "not ready" until 29, and v2/v3 fall
back to the old behaviour until 31 to 34 (nothing breaks). So step 3 above is already done; run 29 to 34 in production
after the correctness run in the test project. Also schedule the drainer in production
(`mds/build/marks/review-2026-10-27.md` section 4).

## Safety nets
- `npm run dev:bench` checks for the test mark and refuses to start against a database without it (`scripts/sim/dev-bench.mjs`, tested by `scripts/sim/guardtest.mjs`).
- `npm run sim` refuses to send to jellyhook.com unless `--allow-production`.
- The structure copy only reads production (`pg_dump --schema-only`): no data.
