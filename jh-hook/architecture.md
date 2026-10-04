# Hook: architecture

Decisions, trade-offs and limits. **you** = decided by you in conversation;
**me** = a default I chose, change it if you disagree.

## The shape

```
HookSpec (JSON, the Hook language)               types.ts
   | validate (shape, sizes, depth, unique ids)   engine/validate.ts
   v
top-level conditions = steps
   | tunnels: run every sub-hook once, report     engine/run.ts
   | estimate each step alone (EXPLAIN, cached)
   | order + strategy (auto / manual + guard)
   v
compile: conditions -> predicates, output -> SELECT   engine/compile.ts
   fields/joins/sources from                       engine/sqlmap.ts
   vocabulary/types/operators from                 schema.ts
   | EXPLAIN final SQL -> credits -> gate
   v
execute on Postgres as hook_reader                lib/hook/pgDb.ts
   v
HookResult { answer (one | list | table), plan, cost, tunnels, timing, sql }
```

Entry from the browser: `lib/actions/hook.action.ts` only. The engine takes
a `HookDb` interface, so the same code runs on the real database and on an
in-memory Postgres in tests.

## Decisions

| # | Decision | Who | Why |
|---|---|---|---|
| 1 | Own language, compiled to SQL | you | the language is the product. Compile time is microseconds |
| 2 | Generic: every field is typed; operators, measures and value editors come from the type | me, after your correction | hundreds of combinations without writing a feature per combination |
| 3 | Vocabulary in two tables: `schema.ts` (labels, types, relations, client-safe) and `sqlmap.ts` (SQL, server) | me | adding a column is two entries; a test fails if they drift |
| 4 | Related rows are measured (count, distinct, sum, avg, min, max, median, percentile) with any operator | me, after your correction | "at least 2 times" hid the general case: exactly 2, fewer than 3, between |
| 5 | Tunnel = any value can be another hook's output, type- and shape-checked | you | one engine, recursive; output of one query is a field's input in the one above |
| 6 | List outputs only feed list operators; types and id kinds must match | you | mismatches are errors |
| 7 | Run in Postgres through a direct `pg` connection as a read-only role | you | the database has the indexes and statistics; no SQL-string RPC |
| 8 | Auto and manual order, with a guard | you | speed by default, control when wanted |
| 9 | No AI in the planner | you | parked for a later version (plan.md) |
| 10 | Cost = credits from EXPLAIN, known before running | you | stable and explainable |
| 11 | Two-valued logic in groups (empty = not matching) | me | "NOT any of facebook" should keep sessions with no utm, which plain SQL drops |
| 12 | Unmeasured geometry gives empty, not a guess | me | `mds/database.md` warns that guessed seen % is the most expensive mistake available |
| 13 | Away gap threshold 15 s | me | identical to FramePlate's away frames, so both views agree |
| 14 | Lists capped at 5,000, breakdowns at 500 rows | me | memory and browser safety; truncation is reported |

## How a condition becomes SQL

`compileCondition` handles three kinds, all generic:

- **field:** `sqlmap` gives the expression, the field's type picks the
  allowed operators, `compileComparison` emits `expr <op> value`. Durations
  are converted to ms, relative times become `now() - N * interval '1 unit'`,
  text patterns have `%` and `_` escaped.
- **related:** a correlated subquery over the related entity:
  `(SELECT <measure> FROM <related rows> WHERE <join> AND <their conditions>) <op> <value>`.
  "At least 1" and "exactly 0" become `EXISTS` / `NOT EXISTS`, which stop
  at the first row. A one-to-one relation (a page view's session) is an
  `EXISTS` with the related row's conditions.
- **group:** AND / OR of the children, each wrapped `COALESCE(x, FALSE)`,
  optionally negated.

Values that are sub-hooks compile into `AS MATERIALIZED` CTEs (computed
once, read many times). Nested sub-hooks land before their parent in the
same `WITH` list.

## Planner: how the order is decided

Postgres keeps per-column statistics (`pg_stats`) and its planner estimates
how many rows each condition keeps. Every serious database (Postgres,
Oracle, MySQL, CockroachDB) works the same way: push filters early,
estimate selectivity from statistics, run the most selective step first.
Hook does this at the level of its own top-level conditions, which the
database cannot see as separate steps.

For each top-level condition the engine runs `EXPLAIN (FORMAT JSON)` of that
condition alone (plans without scanning, a few ms) and reads `Plan Rows`.
Cached 5 minutes per (site, SQL, values).

- **auto:** if the largest estimate is at least 10x the smallest, run
  **staged**: a chain of `AS MATERIALIZED` CTEs, most selective first, each
  next step only checking the survivors. Otherwise **fused**: one WHERE, and
  Postgres orders it.
- **manual:** your order, staged. Guard on (default): if the engine's best
  first step keeps 10x fewer rows than yours, it runs that first and says so.

`MATERIALIZED` matters: since Postgres 12 a plain CTE is inlined and
reordered, so without the fence a manual order would only be a suggestion.
The trade-off: a fence hides later steps from index choices, so auto only
fences when the estimates say it pays.

Limits: estimates are as good as the statistics (a wrong estimate costs
speed, never correctness); conditions are estimated independently
(correlations are not modeled); estimates for correlated subqueries
(related-row measures) are rough. Sub-hooks are compiled fused (Postgres
plans their insides); planning sub-hooks separately is in plan.md.

## Cost

`EXPLAIN` of the exact final statement gives Postgres's total cost.
`credits = max(1, ceil(cost / 500))`. 500 (`COST_UNITS_PER_CREDIT`) is a
placeholder to calibrate against real usage. Above `HOOK_MAX_CREDITS`
(default 200) nothing runs. Measured plan and run time come back with every
result for calibration.

Where cost comes from, and where you have control:

| Lever | Effect |
|---|---|
| indexes (setup.sql, section 4) | turns scans into lookups; the biggest lever |
| order (auto / manual) | which step scans and which only probes |
| tunnels | computed once per run (materialized), however many rows read them |
| derived fields (seen %, position, landing/exit page) | per-row math or a correlated lookup: cheap on filtered sets, expensive over a whole site |
| related-row measures | one correlated subquery per candidate row; cheap after a selective step, expensive first |
| `statement_timeout` (8 s) on the role | hard stop |
| `HOOK_MAX_CREDITS` | pre-flight gate |

## Database access

Exact steps are at the end of this file ("Setup"). What the setup does
(`setup.sql`):

- creates the login `hook_reader`: read-only by default
  (`default_transaction_read_only`), 8 s statement timeout;
- grants SELECT on exactly five tables: `page_views`, `sessions`,
  `form_submissions`, `visitors`, `form_engagement`. Not `sites`,
  `site_members`, `users` or anything billing;
- adds an RLS policy per table so the role can see rows (a role with no
  policy sees none). This was chosen over giving the role `BYPASSRLS`, which
  Supabase's `postgres` user may not be allowed to grant;
- optional indexes.

TLS: `pgDb.ts` connects with TLS, without pinning Supabase's CA
certificate. To pin it later: download the CA from Supabase (Database
settings, SSL), pass it as `ssl.ca`, set `rejectUnauthorized: true`.

## Security

- **The site comes from the server.** `hook.action.ts` reads the
  signed-in user's current site (preferred-site cookie) and calls
  `requireSiteAccess`. The browser never sends a site id, so nobody can
  query another site's sessions. When Hook gets its own page, the same
  action guards it.
- **Tenant scoping is structural.** The only code that writes a table name
  is `scoped()` in `engine/sql.ts`: `(SELECT * FROM public.<t> WHERE site_id
  = $1::uuid)`, `$1` always the site. The test asserts every table reference
  in every statement is scoped (209 of 209 in the last run). The RLS policy
  lets the role see all sites' rows, so this is the wall: any change to
  `sql.ts`, `sqlmap.ts` or `compile.ts` must keep that test passing.
- **No user text becomes SQL.** Values are bound parameters. Spliced into
  SQL text are only whitelisted words (operators, aggregates, buckets, time
  units) and engine-made names (aliases, CTE names). Field names are looked
  up in the schema; an unknown one is an error.
- **Read-only and time-boxed** at the role level.

## Verified

Against a real Postgres (PGlite, in-memory; same SQL dialect, same planner)
with every table column the engine uses, 52 sessions on the site plus a
second site: **44 checks pass**. They include:

- ranges, unit conversion;
- related-row counts, distinct counts and sums with every operator;
- the marketer query under auto, manual, and manual with the guard off,
  all giving the same answer;
- away gaps;
- OR and NOT;
- list and single-value tunnels, two tunnels in one query, a tunnel inside
  a tunnel;
- five kinds of mismatch errors;
- every output kind;
- derived fields (seen %, position, landing page);
- tenant scoping, injection, LIKE escaping, and the budget gate.

The test lives outside the repo because it needs PGlite. Two real bugs were
caught this way and fixed:

- **NULL-dropping NOT:** `NOT` on a NULL comparison dropped rows. Groups
  now use two-valued logic, so an empty value counts as "not matching".
- **Fake 100% seen:** `LEAST(1.0, NULL)` returns 1.0 in Postgres, so an
  unmeasured screen read as 100% seen. Geometry fields are now guarded and
  return empty instead.

**Not verified:** against your Supabase database, or in a browser.

## Limitations now

- `raw_data` (custom form fields, jsonb) and `form_engagement.field_timings`
  per field are not exposed yet. They need a "field with a key" type
  (plan.md).
- Referrer is raw text; the classified source (`classifyReferrer.js`) is JS
  and not available in SQL yet.
- Hours and weekdays are UTC, not the visitor's local time.
- The page entity is "every path with at least one view".
- Each server instance keeps up to 3 database connections for Hook.
  `mds/reports/Traffic.md` found Supabase's connection ceiling is the
  bottleneck on the free stack, so use the pooler URL.

## Research: what big systems do, and what we took

- **Postgres planner / EXPLAIN** ([docs](https://www.postgresql.org/docs/9.1/sql-explain.html),
  [Supabase discussion](https://github.com/orgs/supabase/discussions/22839)):
  arbitrary cost units from statistics; row estimates drive everything.
  Took: EXPLAIN as a free estimator and as the cost meter.
- **Cost-based optimizers** ([overview](https://medium.com/@k.hassan202077/database-query-optimizers-and-planners-690d5f417a46),
  [QuestDB](https://questdb.com/glossary/cost-based-optimizer/)): predicate
  pushdown, reordering by selectivity. Took: most selective step first.
- **Semantic layers, Looker LookML and Cube** ([Cube](https://cube.dev/blog/semantic-layer-and-ai-the-future-of-data-querying-with-natural-language),
  [comparison](https://pipecode.ai/blogs/semantic-layer-cube-dbt-semantic-layer-looker-lookml)):
  a typed model of dimensions, measures and joins, compiled to one SQL
  statement. Closest relative to Hook; `schema.ts` + `sqlmap.ts` is our
  model. Took: typed fields, measures, joins as data. Different: their model
  is written by analysts; ours is fixed vocabulary for marketers.
- **PostHog HogQL, Mixpanel, Amplitude** ([comparison](https://userpilot.com/blog/posthog-vs-mixpanel/)):
  behavioral cohorts ("did X more than 3 times") are exactly our related-row
  measures; HogQL compiles its own dialect to SQL. Took: both a language
  underneath and a builder on top.

## Setup

1. **Pick a password** of letters and digits only (no symbols), 24+
   characters.
2. **Run the SQL.** Supabase dashboard, your project, **SQL Editor**, **New
   query**. Paste all of `jh-hook/setup.sql`, replace `CHANGE_ME` with the
   password, click **Run**. It should say "Success. No rows returned".
3. **Get the pooler address.** In the dashboard, click **Connect** (top of
   the project page), open the **Transaction pooler** section, copy the URI.
   It looks like:
   `postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
4. **Turn it into the Hook URL.** Change the user from `postgres.` to
   `hook_reader.` (keep the part after the dot, that is your project ref)
   and put your password in place of `[YOUR-PASSWORD]`:
   `postgresql://hook_reader.abcdefghijklmnop:YourPassword123@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
5. **Add it to `.env.local`** in the project root:
   `HOOK_DATABASE_URL=postgresql://hook_reader....`
   Optional: `HOOK_MAX_CREDITS=200`.
6. **Test the login** from the project folder:
   `node --env-file=.env.local -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.HOOK_DATABASE_URL,ssl:{rejectUnauthorized:false}});c.connect().then(()=>c.query('select current_user, count(*) from page_views')).then(r=>{console.log(r.rows);return c.end()}).catch(e=>{console.error(e.message);process.exit(1)})"`
   Expected: `[ { current_user: 'hook_reader', count: '<a number>' } ]`.
   That count is all sites (the engine adds the site filter itself).
7. **Restart** `npm run dev`, open `/dev/hook`, press **Run hook** with no
   conditions. It should equal the site's total page views.
8. **Production:** Vercel, your project, **Settings**, **Environment
   Variables**: add `HOOK_DATABASE_URL` (Production and Preview), then
   redeploy.

If step 6 says `password authentication failed`: the password in the URL
differs from the SQL, or the user part is not `hook_reader.<ref>`. If it
says `Tenant or user not found`: the project ref after the dot is wrong.
If it says `permission denied for table`: the grant in section 2 didn't run.
If the count is 0 on a site with data: the policies in section 3 didn't run.
