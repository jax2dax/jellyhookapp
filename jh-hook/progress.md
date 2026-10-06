# Hook: progress

## 2026-10-06 (evening): the output engine and results canvas

- New `output/` module: the view is chosen from the hook's shape; numbers
  get base rates; breakdowns become bars; lists become session replays,
  lead mini profiles, and visitor, page, form and field views.
- Evidence: the visits that matched are ringed in the replays
  (FramePlate's new `highlightIds`); leads show their converting session;
  visitors show up to 2 matching sessions.
- "Show more" uses sealed tokens (no re-run, no credits, no readable ids).
- Two-hook comparison with a formula.
- The workspace's Run goes through `lib/actions/canvas.action.ts`; the
  product strips raw ids and SQL.
- The site rule and error policy moved to `lib/hook/site.ts`, shared by
  every Hook action.
- Silhouette fixes: outline contrast (it was nearly invisible in dark
  mode), and "+" after described pages.
- Verified: tsc, eslint, `next build`, test suites (66 engine,
  24 silhouette, 28 output), server render of both pages. Not run against
  real data in a browser.

## 2026-10-06 (later): /platform/hook, sequences, silhouette v2

- `/platform/hook` product page (sidebar: Hook) and `/dev/hook` now share
  `components/hook/HookWorkspace.tsx`; the product hides SQL and raw ids.
- The action resolves the site exactly like every platform page
  (`getUserSite`), so Hook always runs on the site the person is looking at.
- "a list of ids" is now named per entity ("a list of sessions").
- Sequences: next page, previous page, pages after it, pages before it.
- Silhouette preview v2 in `silhouette/` (rules, tests, docs).
- Verified: tsc, eslint, `next build`, 66 engine checks, 23 silhouette
  checks, server render of `/dev/hook` (200, preview drawn) and
  `/platform/hook` (redirects when signed out). Not clicked through in a
  browser.

## 2026-10-06: future-proofing, form friction, canvas features, docs

- Query format v3 with migrations (v1 to v2 to v3) on every entry point;
  keys permanent, labels free (`migrate.ts`).
- New entity **form fields** (per-field form friction from
  `field_timings`): field, type, order, time in field, typed, time before
  typing, last field touched, form status. Form activity gains "its fields".
- `HookError` vs reference-code policy; `[hook]` logger; run log line per
  run; on-screen notices.
- Builder: names + notes + collapse for hooks, sub-hooks and conditions;
  vertical drag spacing (no re-render while dragging); "Use this hook as a
  sub-hook..." with fitting slots only; `</>` code panel; Copy link.
- Tests moved into the repo: `npm run test:hook` (61 checks, PGlite and
  jiti as dev dependencies). `npm run hook:reference`.
- Docs: user guide with 21 examples, docs brief for the public docs,
  developer guide split into part 1 (engineering) and part 2 (data flow).
- Verified: tsc, eslint, `next build`, 61 checks. Not checked in a browser.

## 2026-10-05: usability pass

- Sub-hooks offer all six outputs. A breakdown can be a sub-hook (its keys).
- Return type shown on every output and sub-hook, with a fit check and a
  one-click fix; type colour on every condition.
- Field menus grouped (`FIELD_GROUPS`), type shown in each option.
- `reference.md` generated from the schema; `naming.md` audit (51 items,
  options, nothing renamed yet).
- Added fields: visit duration, is the page where they converted.
- Verified: tsc, eslint, 46 engine checks. Browser not checked.

## 2026-10-02: v2, generic engine

v1 hard-coded the example queries (one "time on page >" filter, a fixed
"leads" filter). Rebuilt as a general language:

- `schema.ts` (vocabulary: 7 entities, about 80 typed fields, relations,
  operators and measures by type) + `engine/sqlmap.ts` (their SQL).
- Any operator on any field, ranges, relative times, AND/OR/NOT groups.
- Related-row measures with any operator.
- Real tunnels: any value can be another hook's output, with list/one and
  type checks, nestable.
- Outputs: count, distinct count, measure, ids, values, breakdown.
- Recursive builder (`components/hook/HookBuilder.tsx`).
- Read-only login uses RLS policies instead of BYPASSRLS; `setup.sql`.
- Bugs found by the Postgres test and fixed: NOT dropped empty values;
  `LEAST(1.0, NULL) = 1.0` made unmeasured pages read 100% seen.
- Verified: tsc, eslint, `next build`, 44 checks on in-memory Postgres.
  Not verified: real database, browser.
- Spec version is now 2; v1 URLs no longer load.

## 2026-10-02: v1

First version: spec, planner, guard, credits, `/dev/hook`. Superseded the
same day by v2.
