# Form dashboard - developer reference

Added 2026-10-15, rebuilt the same day around form versions. Where: `/platform/form-engagement` (not in the sidebar yet).
Demo with fake data: `/dev/form-dashboard-demo`. The full design, every rule and the measured cost:
`mds/build/form-study/averages-and-versions.md`. Counts are Hook queries, so they can also be asked for by hand in
`/platform/hook`, by Enter Hook with AI and over MCP (the `form` entity has `formKey` and `version` fields).

## Parts
| File | Role |
|---|---|
| `jh-forms/dashboard.ts` | `dashboardSpecs(scope)`: the 20 Hook queries for one scope (form key + version, or dates, or all time). `formListSpecs()`: the site's forms by starts and submissions. `assembleDashboard(answers)`: turns the answers into `FormDashboard`. Pure |
| `jh-forms/averages.ts` | `summarizeVersion`: the median successful submission (journey, totals, per-field times) and its spreads. `unusualIn`, `isUnusual`, `spreadOf`: the unusual rule. Pure, runs on the server and in the browser |
| `lib/actions/formDashboard.action.ts` | `getFormDashboard({ form, compare, from, to })`: forms, versions, the current side, the compare side, unusual counts. Hook queries capped at 500 credits each. Ended versions frozen in `form_versions.summary`. `getFormReference(formKey)`: all-time reference for a lead's chart |
| `lib/actions/formEngagement.action.ts` | `getFormEngagements({ form, version })`: the newest 100 forms started in that version, with names when the visitor ever submitted |
| `components/forms/FormEngagementClient.tsx` | The page in the browser: controls in the URL, localStorage cache, the list with unusual tags |
| `components/forms/FormDashboard.tsx` | Presentation: cards with changes, healthy reference + current journey, field table, give-ups |
| `components/forms/FormAverages.tsx` | `Journey`: the median journey drawing |
| `components/forms/FormActivityChart.tsx` | One person's form; with a `reference`, tiles show "vs typical" and unusual parts are outlined in red |

## URL
`?form=<key>` (default: most submissions) · `?compare=off|all|v:<version id>|custom` with `&from=YYYY-MM-DD&to=YYYY-MM-DD` ·
`?show=pct` (default numbers).

## Rules
- Always the current version over its whole life. No date range on the current side.
- Comparisons need 30 started forms on both sides; below that the other number shows and the change reads "too few to
  compare".
- Durations are medians of submitted forms typed by hand (filled-without-typing submissions are counted, not timed).
- Unusual only with a comparison selected (the lead page always uses all time).
- Empty is shown as "-", never as 0, where a number was never recorded.
- Everything is pinned to the current site (no action takes a site id).

## Tests (`npm run test:forms`)
`jh-forms/tests/dashboard.test.ts` (23): the real queries on PGlite: funnel, rates, pages, fields, scope by form key,
version, dates and all time, the form list. `jh-forms/tests/averages.test.ts` (44): medians, groups, pauses, skipped,
quartiles, the unusual rule, comparisons. `jh-forms/tests/versions.test.ts` (14): the migration and the version rule on
real Postgres. `lib/tracking/tests/formKey.test.js` (22): form identity.

## Needs
`mds/migrations/17-form-versions.sql` (after 16). Without it the page still works: every form, all time, no comparison,
with a notice.

## Not built yet
Public docs page; sidebar link; `clearJhCache()` on sign-out; real autofill detection.
