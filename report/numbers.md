# Jellyhook numbers ledger

The single place where every performance or quality number about Jellyhook lives.
A number may go on the resume, a post, or an interview answer **only if it is in the
Results table below with status MEASURED**, a script that produced it, and its conditions.

Started 2026-10-10. Owner: Josh.

---

## 1. Rules

1. **No number without a script.** Every result links to the script, the exact command, and the raw output file.
2. **Never benchmark production.** Not the production Supabase project (`.env.local` points at it today), not jellyhook.com.
   Planner tests run on PGlite (in-memory Postgres). Ingestion tests need a separate staging Supabase project.
3. **Every claim states its conditions**: machine, data size, data shape, database (PGlite / staging Supabase), build mode.
4. **A speed-up claim needs a baseline.** "Faster" or "reduced load" means: same query, same data, with and without the feature, same answer.
5. **Hypotheses are not results.** The Targets column is what we hope to see. It is never quoted.
6. **Re-measure when the code changes.** If `jh-hook/engine/**`, `app/api/track/**` or `lib/tracking/**` changes, the affected rows go back to STALE.

Status values: `NOT MEASURED` → `MEASURED` → `STALE` (code changed since).

---

## 2. What we want to prove (the outcomes)

| # | Claim we want to be able to make | Why it matters to a reader |
|---|---|---|
| A | The ingestion API handles a stated event rate with low tail latency and no lost events | Shows the tracker backend is production-grade, not a toy |
| B | The planner's staged execution is measurably faster than letting one statement run, on queries where step sizes differ a lot, with identical answers | Turns "built a planner" into "the planner makes queries N times faster" |
| C | Over-budget queries are rejected in milliseconds, before costing seconds of database time | Proves the cost gate protects the database |
| D | EXPLAIN row estimates are close enough to reality to make good decisions | Shows the planner's inputs are trustworthy, not a guess |
| E | Ask Hook (AI to query) produces valid, correct queries at a stated rate and cost | Already partly measured; needs a fresh, dated run |

---

## 3. Results

| ID | Metric | Target (hypothesis) | Result | Conditions | Status | Script / raw output |
|---|---|---|---|---|---|---|
| A1 | Sustained ingestion rate, events/s, 0% errors | ≥ 500 ev/s | — | — | NOT MEASURED | — |
| A2 | `/api/track` latency p50 / p95 / p99 at that rate | p95 < 300 ms | — | — | NOT MEASURED | — |
| A3 | Events sent vs rows landed | 100% | — | — | NOT MEASURED | — |
| B1 | Staged vs fused runtime, high-spread queries (median of runs) | staged ≥ 2x faster | **Hypothesis failed.** Staged was **slower** on all 3 queries the engine staged: H1 0.8x, H2 0.3x, H4 0.4x (fused 77 / 67 / 187 ms vs staged 92 / 224 / 471 ms). H3 was not staged (see D1) | P1 | MEASURED | `report/raw/planner-2026-10-11.json` |
| B2 | Staged vs fused, low-spread queries (should be about equal, engine picks fused) | within ±20% | L1 62 vs 57 ms (same SQL). L2 2.28 s vs 3.94 s with **identical SQL**, so run-to-run noise on PGlite can reach ~1.7x. Differences under ~2x are not meaningful at 5 runs | P1 | MEASURED | same |
| B3 | Staged and fused return identical answers | 100% of queries | **8 / 8 identical** | P1 | MEASURED | same |
| V1 | Engine answers vs hand-written SQL (independent oracle), 41 queries, 8 templates | 100% match | **41 / 41 match** the oracle in both engine and forced-fused modes; all 41 answers non-zero (no trivial empty matches); engine staged 10, fused 31 | P1 data, 1 run per mode | MEASURED | `report/raw/planner-verify-2026-10-13.json`, `npm run bench:verify` |
| V2 | Engine test suite against JS ground truth on a small fixture | all pass | **66 / 66 pass** (`npm run test:hook`) | PGlite, 60 sessions | MEASURED | run 2026-10-13 |
| B4 | Planning overhead (`timing.planMs`) cold / warm cache | warm < 20 ms | cold 2 to 21 ms, warm 1 to 7 ms (median per query) | P1 | MEASURED | same |
| C1 | Time to reject an over-budget query | < 50 ms | **5.7 ms median** (5 runs, cold estimate cache), nothing executed | P1 | MEASURED | same |
| C2 | What that query would have cost if run (runtime) | report | The query with the highest estimate (N1, 117,434 credits) actually ran in **111 ms**. The cost estimate did not predict runtime | P1 | MEASURED | same |
| C3 | False rejections on the representative set | 0 | At the production limit (200 credits): **3 of 8 rejected**. H3 (3.9 s) and L2 (2.3 s) are reasonable rejections; **N1 (111 ms) is a false rejection** | P1 | MEASURED | same |
| D1 | EXPLAIN estimate vs actual rows per step (median q-error) | ≤ 3 | **Median 1.6, max 24.8** over 17 steps. Plain field conditions are accurate (1.0 to 1.1). `converted` and related-count conditions get Postgres default guesses (e.g. converted est 150,000 vs actual 6,046), so the engine missed H3's real 33x spread and did not stage it | P1 | MEASURED | same |

Conditions P1: PGlite (in-memory Postgres, WebAssembly) on Intel Core Ultra 5 226V, 8 cores, 16 GB, Windows 11, Node 24.13.
Synthetic skewed data: 100,000 visitors, 300,000 sessions, 1,000,000 page views, 6,046 leads. ANALYZE run. Production indexes.
1 cold + 5 timed runs per query per mode. Ratios matter more than absolute ms; Supabase will differ.

### What P1 means

1. **Forced staging (MATERIALIZED steps) loses to Postgres's own plan here.** With statistics available, Postgres
   already filters by the selective condition first and can use indexes and joins freely; the fences stop it.
2. **The planner's inputs are weakest exactly on relational conditions.** EXPLAIN cannot see inside `EXISTS` /
   related counts, so those steps get default estimates (one third or one half of the table).
3. **The credit cost does not track runtime well** (N1: highest estimate, 111 ms). The 200-credit production limit
   would block some fast queries.
4. **What holds up:** identical answers in every mode, a 6 ms rejection that runs nothing, and accurate estimates for
   plain field conditions.

Next decisions (engine changes, owner to approve): raise `SPREAD_FACTOR` or stage only when the estimate comes from a
plain field condition; recalibrate `COST_UNITS_PER_CREDIT` / the 200 limit against measured runtime; run 15+ runs per
mode to shrink noise; repeat on a staging Supabase.
| E1 | Ask Hook valid-query rate | report | 39/39 (docs) | per `mds/build/ai-hook-translate/eval-and-tests.md` | STALE: re-run | `npm run ai:eval` |
| E2 | Ask Hook exact match, held-out set | report | 90% (37/41) (docs) | same | STALE: re-run | same |
| E3 | Ask Hook cost and latency per question | report | ~$0.0023, ~1.5 s (docs) | same | STALE: re-run | same |

q-error = max(estimate / actual, actual / estimate). 1 is perfect.

---

## 4. How each number is measured

### A. Ingestion (needs a staging Supabase project first)

- **Target**: a production build (`npm run build && npm run start`), not `npm run dev`. Dev mode compiles on request and is several times slower, so it measures the wrong thing.
- **Database**: a separate free Supabase project with the same schema (`mds/database.md` + `mds/migrations/*`). Point `.env.staging` at it. Never the production keys.
- **Load model**: open model (fixed arrival rate), not "N clients in a loop". A closed loop slows down when the server slows down and hides the worst latencies (coordinated omission).
  Tool: k6 `constant-arrival-rate`, or `autocannon` with `--overallRate`.
- **Payload**: realistic batches, the same shape `public/tracker.js` sends: `session_start`, `page_view_start`, `page_view_end`, `heartbeat`, `click`, several events per request, unique `visitor_id` / `session_id` per simulated visitor.
- **Steps**: ramp 50 → 100 → 250 → 500 → 1000 ev/s, 60 s each, plus 10 s warm-up. Record events/s, p50/p95/p99, error rate. Count rows per table before and after (A3).
- **Know the bottleneck**: Supabase free tier limits connections and CPU. If latency climbs, record where (Vercel/Node CPU vs database) before concluding.

### B, C, D. Planner (safe to run now, on PGlite)

- **Database**: PGlite, schema from `mds/database.md`, same approach as `lib/tracking/bench/storage.bench.ts`.
- **Data**: about 100k visitors, 1M page views, 300k sessions, generated **with skew**: a few pages get most views (Zipf-like), most visitors have 1 session, a few have many. Uniform random data makes every condition about the same size, so the planner never stages and B1 proves nothing.
- **Run `ANALYZE` after seeding.** Without it `pg_stats` is empty, EXPLAIN estimates are guesses, and D1 is meaningless.
- **Baseline**: run each query twice through `runHook`: once as the engine decides, once forced to `fused`. Assert the answers are identical (B3) before comparing time.
- **Repetitions**: 1 warm-up, then 10 runs per query per mode. Report the median and p95, and clear the estimate cache (`clearEstimateCache()`) for cold-planning runs (B4).
- **Query set** (8 to 10): two low-spread (both steps similar), four high-spread (one tiny step, one huge), one nested group, one sub-hook (tunnel), one over-budget query for C.
- **Budget gate (C)**: call with `maxCredits` low enough to reject. Time the rejection (C1). Then run the same query with no limit and time it (C2).
- **Estimates (D)**: for each step, compare `plan.steps[].estRows` with `SELECT count(*)` of that condition alone.
- **Caveat to state with the result**: PGlite is WebAssembly. Ratios (staged vs fused) carry over to real Postgres better than absolute milliseconds do.

### E. Ask Hook

- `npm run test:ai` is free and offline. `npm run ai:eval` calls the real model and costs money: check the cost in `mds/build/ai-hook-translate/models-and-cost.md` first.
- Record the date, model id, and set sizes with the numbers.

---

## 5. Run log

Add one line per run. Never edit old lines; add a new one.

| Date | ID(s) | Command | Commit | Machine | Raw output |
|---|---|---|---|---|---|
| 2026-10-13 | V1 | `npm run bench:verify` (~3 min; 41 cases, oracle = hand-written SQL in `scripts/bench/planner-verify.ts`) | 865cc99 + uncommitted | same as P1 | `report/raw/planner-verify-2026-10-13.json` |
| 2026-10-13 | V2 | `npm run test:hook` | same | same | console |
| 2026-10-11 | B1-B4, C1-C3, D1 (P1) | `npm run bench:planner` (BENCH_RUNS=5, ~3 min) | 865cc99 + uncommitted | Core Ultra 5 226V, 16 GB, Win 11, Node 24.13 | `report/raw/planner-2026-10-11.json` |

---

## 6. Resume and post wording

Allowed only after the matching rows are MEASURED. Fill in the numbers exactly; keep the conditions.

- A: "Ingestion API sustains **X events/s at p95 Y ms** with no lost events in load tests against a staging database."
- B: "Planner's staged execution ran **N× faster** than single-statement plans on high-spread queries over 1M synthetic rows, with identical results."
- C: "Rejects over-budget queries in **under X ms**, before they run; the same query would have taken **Y s**."
- E: "**X%** exact match on a held-out eval set at about **$Y per question**."

**Allowed now (from P1):**
- "Benchmarked the planner on 1M synthetic rows: identical answers across execution strategies on 8 of 8 queries; over-budget queries rejected in about 6 ms with nothing executed; EXPLAIN step estimates within 1.6x of actual rows (median)."

**Not allowed (P1 contradicts it):** "N× faster", "reduced database load", or any claim that staging speeds queries up.

If a result is disappointing (for example staging is not faster), that is still a result. Write it down, and the
honest phrasing becomes the interview story: what you found and what you changed.
