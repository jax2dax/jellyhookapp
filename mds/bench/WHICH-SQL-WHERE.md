# Which SQL goes in which Supabase project

Two projects, two SQL editors. Mixing them is the one mistake this file exists to prevent.

| | PRODUCTION project | TEST project ("bench") |
|---|---|---|
| What it is | the real one; customers' data | an empty copy for load tests; fake data only |
| Its address | `https://<prod ref>.supabase.co` (in `.env.local` / Vercel) | `https://<test ref>.supabase.co` (in `.env.bench`) |
| Tell it apart | project name top left; the `<ref>` in `supabase.com/dashboard/project/<ref>` | rename it to include **BENCH**, e.g. "jellyhook-BENCH" |

## Before you paste ANY SQL: check where you are
1. Look at the project name at the top left of the dashboard.
2. Look at the address bar: `…/dashboard/project/<ref>/sql`. The `<ref>` is the first part of that project's `SUPABASE_URL`.
3. Only then paste and run.

## Run in PRODUCTION only
Migrations in `mds/migrations/` that production has not had yet. For the control room that is
**`mds/migrations/29-control-room.sql`** (adds the control room's tables and reports). Nothing from `mds/bench/`.
Never the schema copy of the test project (it is a copy FROM production; it would only re-create what exists).

## Run in the TEST project only (in this order)
1. **The structure of production, without data.** Make it from production, read-only on production:
   `pg_dump --schema-only --no-owner --no-privileges "<production connection string>" > bench-schema.sql`
   (or `npx supabase db dump --db-url "<production connection string>" -f bench-schema.sql`, needs Docker). Then paste
   `bench-schema.sql` into the TEST project's SQL editor and run it. Making the file reads production; pasting it writes
   only the test project. Do not paste it into production.
2. **`mds/migrations/29-control-room.sql`** (production does not have it yet, so the copy in step 1 does not either).
   The same file as production gets: it is safe in both.
3. **`mds/bench/01-mark-test-database.sql`**: marks the database as the test one. `npm run dev:bench` refuses to start
   without it, which is what stops a wrong `.env.bench` from ever load-testing production.

## The safety nets
- `npm run dev:bench` prints the test database's address and stops unless that database carries the mark from step 3.
  Production has no `jh_environment` table, so a `.env.bench` pointing at it is refused. (Checked by
  `node scripts/sim/guardtest.mjs`.)
- `npm run sim` refuses to send traffic to jellyhook.com unless `--allow-production` is given.
- The connection string in step 1 is only used to READ production's structure. A read-only database user is even safer
  if you have one; the dump never contains data with `--schema-only`.

## If the test project's tables ever look like production's data
Stop. Check `.env.bench`'s `SUPABASE_URL` against the production project's. The guard above should have prevented it.
