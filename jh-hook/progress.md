# Hook: progress

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
