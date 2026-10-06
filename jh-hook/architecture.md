# Hook developer guide, part 1: engineering

For developers changing Hook's code. It covers the code map, the
compiler, the planner, cost, security, versioning, errors and logging,
tests, and how to extend each part. Part 2 (`data-flow.md`) explains the
same system as a journey of data, with almost no code.

Decisions are marked **you** (decided by Joshua) or **me** (a default chosen
during the build; change it if it's wrong).

## 1. Code map

| File | Runs on | What it is |
|---|---|---|
| `jh-hook/types.ts` | both | the Hook language: `HookSpec`, conditions, outputs, results. `SPEC_VERSION` |
| `jh-hook/schema.ts` | both | the vocabulary: entities, typed fields, relations, operators and measures by type, display groups, user-facing labels |
| `jh-hook/shape.ts` | both | what a hook returns (`returnedBy`), and where a result can flow (`slotsFor`) |
| `jh-hook/describe.ts` | both | a query to plain English |
| `jh-hook/migrate.ts` | both | upgrades any older query to the current version |
| `jh-hook/errors.ts` | both | `HookError`: the only error text safe to show a person |
| `jh-hook/debug.ts` | both | `hookLog`, the `[hook]` logger; `refCode()` |
| `jh-hook/units.ts` | both | duration units to ms, display formatting |
| `jh-hook/engine/validate.ts` | server | structure, sizes, depth, ids, names/layout bounds |
| `jh-hook/engine/sql.ts` | server | `scoped()` (the only place a table name is written), `Params`, LIKE escaping |
| `jh-hook/engine/sqlmap.ts` | server | the SQL of every field, the source of every entity, every join |
| `jh-hook/engine/compile.ts` | server | conditions, comparisons, measures, outputs, sub-hooks into SQL |
| `jh-hook/engine/run.ts` | server | the pipeline: migrate, validate, tunnels, estimates, order, cost gate, execute |
| `lib/hook/pgDb.ts` | server | the database connection (`hook_reader`, TLS, pool of 3) |
| `lib/actions/hook.action.ts` | server | the browser's only door: site check, error policy, run log, value suggestions |
| `components/hook/HookBuilder.tsx` | browser | the builder canvas (recursive) |
| `app/dev/hook/page.tsx` | browser | the test bench page: URL state, `</>` paste, notices, results |
| `jh-hook/tests/engine.test.ts` | dev | 61 checks against a real Postgres (`npm run test:hook`) |
| `jh-hook/scripts/genReference.ts` | dev | writes `reference.md` from the schema (`npm run hook:reference`) |
| `jh-hook/setup.sql` | ops | the one-time database setup |

"both" files import nothing server-only, so the builder and a future node
editor can use them directly.

## 2. The pipeline

```
input (any version)
  -> migrateSpec        upgrade to SPEC_VERSION                     migrate.ts
  -> validateSpec       structure, sizes, depth, unique ids         validate.ts
  -> type-check output                                              compile.ts
  -> tunnels            every sub-hook in the top-level conditions,
                        one statement: value, or count + 10 samples run.ts
  -> estimates          EXPLAIN each top-level condition alone,
                        in parallel, cached 5 min                   run.ts
  -> order + strategy   auto (spread rule) / manual (+ guard)       run.ts
  -> compile            predicates + output SELECT                  compile.ts, sqlmap.ts
  -> cost               EXPLAIN final SQL -> credits -> gate        run.ts
  -> execute            as hook_reader                              pgDb.ts
  -> HookResult { answer, plan, cost, tunnels, timing, sql }
```

`runHook(db, siteId, spec, opts)` is the whole engine API. `db` is the
`HookDb` interface (`query`, `explain`), so tests pass an in-memory Postgres.

## 3. The language (`types.ts`)

- `HookSpec = { v, entity, where, output, order?, meta?, ui? }`
- Conditions:
  - `field`: a field of this entity, an operator, and a value (or two, for
    between). Values can be literals or `{ hook }`.
  - `related`: rows connected to this one, with their own conditions,
    optionally measured (count, distinct, sum, avg, min, max, median,
    percentile), and compared.
  - `group`: AND or OR over children, optionally NOT.
- Outputs:
  - `count` / `countDistinct` / `aggregate` return one value.
  - `ids` / `values` return a list.
  - `groupBy` returns a table. As a sub-hook it hands over its keys.
- `meta` (name, description) and `ui` (collapsed, spaceBefore) can sit on
  the hook and on every condition. The engine never reads them. They live
  in the query so that a saved query keeps its names and layout.

## 4. The vocabulary (`schema.ts` + `sqlmap.ts`)

Every entity has a SQL source, a row key (what staged execution chains on)
and a ref (what "ids" returns and tunnels carry). Every field has a type,
and the type decides everything else:

- operators: `OPS_FOR`;
- measures: `AGGS_FOR`;
- the builder's value editor;
- how a literal is bound.

| Entity | Source | Key / ref |
|---|---|---|
| page views | `page_views` | id / id |
| sessions | `sessions` | session_id / session_id |
| form submissions (leads) | `form_submissions` | id / id |
| visitors | `visitors` | id / visitor_id |
| form activity | `form_engagement` | id / id |
| form fields | `form_engagement.field_timings`, one row per key (`jsonb_each`) | `<form id>:<key>` |
| pages (unique addresses) | distinct `page_views.page_path` | path / path |
| away periods | gaps of 15 s or more between consecutive page views of a session (`lead()` window) | the page view that opened the gap |

Joins go between entities on the tracker's string ids (`session_id`,
`visitor_id`, `page_path`). They are never on uuids, which is the same
convention as the rest of the app (`mds/database.md`).

Derived fields are plain SQL expressions, so they filter, measure and group
like columns:
- seen percentages (scroll geometry from `mds/database.md`);
- position in the session, landing page and exit page;
- converted on this page (the latest page view before a submission);
- form fill times, per-field focus time, last field touched.

Two rules learned the hard way:
- **`LEAST`/`GREATEST` ignore NULL in Postgres.** `LEAST(1.0, NULL)` is
  1.0, so geometry fields check that the screen and page height were
  recorded first. Otherwise an unmeasured visit reads as "100% seen".
- **Never cast jsonb text blindly.** Form field timings check
  `jsonb_typeof` and the timestamp shape before casting, so one malformed
  entry becomes an empty value instead of failing the query.

## 5. The compiler (`compile.ts`)

- **field:** the expression comes from `sqlmap`, and the type checks the
  operator. `compileComparison` emits `expr <op> value`:
  - durations become ms;
  - relative times become `now() - N * interval '1 unit'`, with the unit
    whitelisted;
  - LIKE wildcards are escaped.
- **related:** a correlated subquery, `(SELECT <measure> FROM <related
  rows> WHERE <join> AND <their conditions>) <op> <value>`.
  - "At least 1" and "exactly 0" become `EXISTS` / `NOT EXISTS`, which stop
    at the first row.
  - `sum` over no rows is 0, not NULL.
  - A one-row relation (a page view's session) is an `EXISTS`.
- **group:** each child is wrapped in `COALESCE(x, FALSE)`. That is
  two-valued logic: "NOT (utm is any of facebook)" keeps sessions with no
  utm, where plain SQL would drop them.
- **sub-hooks:** each becomes an `AS MATERIALIZED` CTE that is computed once
  and has a single column, `v`.
  - Shape check: a list fits only "is any of" / "is none of" (`IN` /
    `NOT EXISTS`), while one value fits any comparison.
  - Type check: the type and the id kind (`ref`) must match.
  - A breakdown hands over its keys.
  - Nested sub-hooks are emitted earlier in the same `WITH` list.

## 6. The planner (`run.ts`)

Postgres keeps per-column statistics (`pg_stats`), and its planner
estimates how many rows a condition keeps. Mature databases share the same
approach: filter early, estimate from statistics, and run the most
selective step first. Hook applies it to its own top-level conditions,
which the database can't see as separate steps.

- **Estimates:** `EXPLAIN (FORMAT JSON)` of each condition alone. It plans
  without scanning, takes a few ms, and is cached per (site, SQL, values).
- **auto:** if the largest estimate is at least 10x the smallest
  (`SPREAD_FACTOR`), the conditions run **staged**. That means a chain of
  `AS MATERIALIZED` CTEs, most selective first, where each step checks only
  the survivors. Otherwise **fused**: one WHERE, and Postgres orders it.
- **manual:** the person's order, always staged. With the guard on (the
  default), if the engine's best first step keeps at least 10x fewer rows
  (`GUARD_FACTOR`), the engine runs that step first and says so.
- **Why `MATERIALIZED`:** since Postgres 12, plain CTEs are inlined and
  reordered, so without the fence a manual order would only be a
  suggestion.

**Limits:**
- An estimate can only be as good as the statistics behind it. A wrong
  estimate costs speed, never correctness.
- Correlated conditions are estimated independently.
- Estimates for measures over connected rows are rough.
- The inside of a sub-hook is compiled fused.

## 7. Cost

- **Formula:** `credits = max(1, ceil(EXPLAIN total cost / 500))`. The
  EXPLAIN covers the exact final statement, so the cost is known before
  anything runs.
- **Gate:** above `HOOK_MAX_CREDITS` (default 200), nothing runs.
- **Calibration:** 500 (`COST_UNITS_PER_CREDIT`) is a placeholder. The
  action logs one line per run with credits, plan ms and exec ms, which is
  the data to calibrate it with.

| Lever | Effect |
|---|---|
| indexes (`setup.sql` section 4) | the biggest one: scans become lookups |
| order | which step scans, which only probes |
| sub-hooks | computed once per run, however many rows read them |
| derived fields and measures over connected rows | cheap on a filtered set, expensive as the first step over a whole site |
| `statement_timeout` (8 s) on the role | hard stop |

## 8. Security

- **Site from the server only.** The action reads the current site from the
  cookie and calls `requireSiteAccess`. The browser never sends a site id.
- **Tenant scoping is structural.** `scoped()` is the only code that writes
  a table name, and it always adds `site_id = $1`. The test asserts every
  table reference in every statement is scoped (255 of 255 in the last
  run). The role's RLS policy lets it see every site's rows, so this check
  is the wall. Any change to `sql.ts`, `sqlmap.ts` or `compile.ts` must
  keep that test green.
- **No user text becomes SQL.** Values are bound parameters. The only text
  spliced into SQL is whitelisted words (operators, measures, buckets,
  units) and names the engine makes itself.
- **Read-only, time-boxed role,** with SELECT on five tables only.
- **Error text policy:** see section 10.
- **Ids:** today the bench shows raw ids for the "list of ids" output. The
  output engine (plan.md) will render the rows behind ids instead, so
  people never see raw ids.

## 9. Versioning: why the query can change shape without breaking anything

- **`SPEC_VERSION` (now 3)** is bumped only for a breaking change. Each
  bump adds one upgrade step to `migrate.ts`.
  - **v1 to v2:** the fixed filters became generic conditions.
  - **v2 to v3:** the "its page" connection was removed and rewritten as
    the `page` field.
- **Every entry point migrates:** `runHook` itself, the URL loader and the
  paste box. A query saved today will still run after future changes.
- **Additive changes don't bump the version:** a new field, entity,
  operator or optional property.
- **Field and relation keys are permanent ids.** Labels can change freely.
  The whole naming audit changed labels only, and no query broke.
- **Removing or renaming a key is a breaking change:** bump the version and
  migrate. The test suite runs real v1 and v2 queries.
- **Unknown fields fail loudly, never silently.** In the builder, a
  condition on a removed field shows "is no longer a field".

## 10. Errors and logging

| Error | Shown to the person | Logged |
|---|---|---|
| `HookError`: the query can't run as written (type, shape, unknown field, limits, credits, no site, no access) | verbatim; it says what to fix | `[hook] run refused` (debug only) |
| anything else (database, network, bug) | "Something went wrong on our side. Reference ABC123." (plus the raw message in development only) | `[hook] run failed` with the reference, always |
| the server can't be reached at all (browser side) | "Couldn't reach the server." | browser console |

- Every successful run logs one `[hook] run` line with site prefix,
  entity, output, credits, plan ms, exec ms, strategy, steps and tunnels.
  That is the raw material for metering.
- `hookLog.debug` / `info` print only when debugging is on:
  - browser: `localStorage.setItem("hook:debug", "1")`;
  - server: `HOOK_DEBUG=1`.
  
  `warn` and `error` always print.
- The page announces every event a person should know about as an
  on-screen notice: a run, a failure, an upgraded query, a pasted query, a
  hook turned into a sub-hook, a copied link.

## 11. Tests

`npm run test:hook`: 61 checks on PGlite, an in-memory Postgres with the
same SQL dialect and planner. Every answer is compared with the same answer
computed in plain JS from the fixture. The suite covers:
- schema/SQL drift, and that every field is in exactly one display group;
- ranges, units, measures, OR/NOT;
- all three order modes giving the same answer;
- sub-hooks of every shape, including nested and breakdowns, and every
  mismatch error;
- derived fields and form friction;
- upgrades of real v1 and v2 queries;
- names and layout having no effect on answers;
- the error classes;
- tenant scoping, injection, LIKE escaping and the credit gate.

Run it before any change to `jh-hook/` ships. Two real bugs were found this
way, and both are now covered:
- `NOT` dropped rows where the value was empty;
- the `LEAST`/NULL behaviour made unmeasured visits read as 100% seen.

## 12. How to extend

| To add | Do this | Nothing else changes because |
|---|---|---|
| a field | an entry in `schema.ts` fields + a group in `FIELD_GROUPS` + its SQL in `sqlmap.ts` | operators, editor, docs (`npm run hook:reference`) follow the type |
| an entity | `EntityKey`, `RefKind`, a `SCHEMA` entry, a `SQL` entry (source via `scoped()`, key, ref, fields, joins), `FIELD_GROUPS`, relations to and from it | the compiler is generic |
| an operator | `Op`, `OPS_FOR` for the types it fits, `OP_LABEL`, one branch in `compileComparison` | |
| a measure | `Agg`, `AGGS_FOR`, `AGG_LABEL`, one branch in `measureSql` | |
| an output | `Output`, `returnedBy` in `shape.ts`, `compileOutput`, the answer shaping in `run.ts`, the builder menu | |
| a breaking change | bump `SPEC_VERSION`, add the upgrade step, add a test with a real old query | old queries keep working |

Then run `npm run test:hook` and `npm run hook:reference`.

## 13. Database setup

`setup.sql` does the following:
- creates the `hook_reader` login: read-only by default, with an 8 s
  statement timeout;
- grants SELECT on `page_views`, `sessions`, `form_submissions`,
  `visitors` and `form_engagement`, and on nothing else;
- adds one RLS policy per table so the role can see rows;
- adds optional indexes.

TLS is on, but without pinning Supabase's CA. To pin it, pass the CA file
as `ssl.ca` and set `rejectUnauthorized: true` in `pgDb.ts`.

Steps:
1. Pick a password of letters and digits only, 24 characters or more.
2. In Supabase, open **SQL Editor**, then **New query**. Paste
   `jh-hook/setup.sql`, replace `CHANGE_ME` with the password, and click
   **Run**. Keep the real password out of the file in git.
3. In the dashboard, click **Connect**, open **Transaction pooler** and
   copy the URI.
4. Change `postgres.` to `hook_reader.` (keep the project ref) and put in
   the password.
5. Add `HOOK_DATABASE_URL=...` to `.env.local`. `HOOK_MAX_CREDITS` and
   `HOOK_DEBUG` are optional.
6. Test the login:
   `node --env-file=.env.local -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.HOOK_DATABASE_URL,ssl:{rejectUnauthorized:false}});c.connect().then(()=>c.query('select current_user, count(*) from page_views')).then(r=>{console.log(r.rows);return c.end()}).catch(e=>{console.error(e.message);process.exit(1)})"`
7. Restart the dev server, open `/dev/hook`, and run with no conditions.
   The result should equal the site's page views.
8. In Vercel, add the variable under **Settings**, **Environment
   Variables**, then redeploy.

If step 6 fails:

| Error | Cause |
|---|---|
| `password authentication failed` | the password or the user part is wrong |
| `Tenant or user not found` | the project ref is wrong |
| `permission denied` | the grants didn't run |
| the count is 0 on a site with data | the policies didn't run |

## 14. Decisions

| # | Decision | Who | Why |
|---|---|---|---|
| 1 | Own language, compiled to SQL | you | the language is the product; compiling takes microseconds |
| 2 | Generic typed fields; operators, measures and editors come from the type | me | hundreds of combinations without a feature per combination |
| 3 | Vocabulary split into `schema.ts` (client-safe) and `sqlmap.ts` (server) | me | adding a column takes two entries; a drift test guards it |
| 4 | Related rows measured with any operator | me | "at least 2" hid exactly 2, fewer than 3, between |
| 5 | Sub-hook = a separate complete hook; tunnel = its result flowing into another hook | you | one engine, recursive |
| 6 | Lists feed only list operators; types and id kinds must match | you | mismatches are errors, never coercions |
| 7 | Run in Postgres through a direct `pg` connection as a read-only role | you | the database has the indexes and statistics |
| 8 | Auto and manual order, with a guard | you | fast by default, controllable |
| 9 | No AI in the planner yet | you | parked |
| 10 | Credits from EXPLAIN, known before running | you | stable and explainable |
| 11 | Two-valued logic in groups | me | NOT should keep empty values |
| 12 | Unmeasured geometry returns empty, not a guess | me | a guessed seen % would be the most expensive mistake |
| 13 | Away period threshold 15 s | me | the same as FramePlate |
| 14 | Lists capped at 5,000 items, breakdowns at 500 rows | me | memory; truncation is reported |
| 15 | Names, notes and layout stored in the query | me | saving to the database later needs no reshaping |
| 16 | Every query migrated on entry; keys are permanent | me | the query format can evolve without breaking saved queries |
| 17 | Only `HookError` text reaches the person | me | raw database errors can leak SQL or connection details |

## 15. Limitations now

- `raw_data` (custom form answers) is not exposed yet.
- The referrer is raw text. The classified source lives in JS
  (`classifyReferrer.js`), not SQL.
- Hours and weekdays are UTC.
- Seen % uses the entry, deepest and scroll-back points. The session
  replay chart uses the full scroll trace, which is not in the database.
- Each server instance holds up to 3 connections. Supabase's connection
  limit is the free-stack bottleneck (`mds/reports/Traffic.md`).
- Very large queries make long URLs. Saved hooks (the database) will
  replace the URL for those.
- The estimate cache is per server instance.

## 16. Research: what large systems do, and what we took

- **Postgres planner / EXPLAIN** ([docs](https://www.postgresql.org/docs/9.1/sql-explain.html),
  [Supabase discussion](https://github.com/orgs/supabase/discussions/22839)):
  costs come from statistics, and row estimates drive everything. We use
  EXPLAIN as a free estimator and as the cost meter.
- **Cost-based optimizers** ([overview](https://medium.com/@k.hassan202077/database-query-optimizers-and-planners-690d5f417a46),
  [QuestDB](https://questdb.com/glossary/cost-based-optimizer/)): push
  filters down and reorder by selectivity. We run the most selective step
  first.
- **Semantic layers, Looker LookML and Cube** ([Cube](https://cube.dev/blog/semantic-layer-and-ai-the-future-of-data-querying-with-natural-language),
  [comparison](https://pipecode.ai/blogs/semantic-layer-cube-dbt-semantic-layer-looker-lookml)):
  a typed model compiled to one SQL statement. This is Hook's closest
  relative, and `schema.ts` + `sqlmap.ts` is our model.
- **PostHog HogQL, Mixpanel, Amplitude** ([comparison](https://userpilot.com/blog/posthog-vs-mixpanel/)):
  behavioral cohorts match our measures over connected rows. HogQL also
  compiles its own dialect to SQL. Like them, Hook has a language
  underneath and a builder on top.
