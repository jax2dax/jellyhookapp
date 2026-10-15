# Hook and forms - developer reference

Added 2026-10-15. Hook (`jh-hook/`) can now aggregate the form-study signals. Public: `/docs/hook/building`, `/docs/hook/examples`, the generated field reference. Design of the signals: `mds/build/form-study/tracker-changes.md`.

## `form` entity (one row per `form_engagement` row)
New fields (all empty, never zero, for forms recorded before 2026-10-14):
| Field | Meaning | Source |
|---|---|---|
| `timeOnScreenBeforeStart` (duration) | time the form was at least half visible with the tab open, before the first input | `onscreen_before_start_ms` |
| `totalFields` (number) | fields in the form | `jsonb_array_length(form_fields)` |
| `fieldsNotTouched` (number) | fields of the form with no focused entry in `field_timings` | `form_fields` vs `field_timings` |
| `validationErrors` (number) | sum of the browser's validation failures over all fields | `field_timings[*].errors` |
`fieldsTouched` is unchanged (it counts keys of `field_timings`, a lower bound).

## `formField` entity (one row per field)
New fields: `touched`, `visits`, `filled`, `changes`, `errors`, `required`.
- Rows: every `field_timings` entry (as before) UNION one row per field of `form_fields` that has NO `field_timings` entry (an untouched field: `touched` false, `focusedTime` / `typed` / times empty, `required` known).
- `touched` is false only for those untouched rows and for an entry that ONLY recorded validation errors (a field that failed a submit without ever being clicked into). Every other entry, even an old one without a focus time, is touched, exactly as before.
- `typed` is EMPTY (not false) for a never-touched field, so "clicked in but never typed" does not count it. Old behaviour is unchanged.
- `visits` = number of stored visits; `filled` = last known filled state; `changes` = visits that changed the value (>1 means corrected); `errors`; `required` from `form_fields`.

## Compatibility and deploy order
- **13-form-signals.sql (`mds/migrations/13-form-signals.sql`) must be run BEFORE this code is deployed.** The engine now selects `form_fields` and `onscreen_before_start_ms`; without those columns every `form` / `formField` query fails ("column does not exist"). The test database in `jh-hook/tests/engine.test.ts` has the columns for this reason.
- Existing queries keep their meaning; the only visible change is more `formField` rows for forms that have a field list (use `touched is true` for "fields people actually used").
- Aggregations: `groupBy name` + count where `touched` is false = most skipped fields; where `errors` >= 1 = fields that fail validation; where `changes` > 1 = fields people correct; `form` aggregate median of `timeOnScreenBeforeStart`.

## Tests
`npm run test:hook` (83, against PGlite = real Postgres): 17 new checks including untouched rows, error-only entries, typed staying empty, required, groupBy of skipped fields, form-level sums, empty (not zero) for old rows; the earlier checks all still pass. Two first-draft mistakes were caught by the old checks (error-only entry double-counted; an old entry without a focus time had turned from "typed: false" into "unknown") and fixed.

## AI and docs
`jh-ai/glossary.ts` (4 new entries: skipped fields, fails validation, corrects, hesitates before starting), generated prompt card updates itself (`npm run test:ai` 50). Docs: `docsSync.ts` re-stamped 2026-10-15.
