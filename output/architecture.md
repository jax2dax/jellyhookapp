# Output engine developer guide, part 1: engineering

The output engine turns a hook's result into what a person sees on the
canvas. Part 2 (`data-flow.md`) explains the same without code. The
display rules are in `rules.md`.

## 1. Code map

| File | Runs on | What it is |
|---|---|---|
| `output/types.ts` | both | the contract: `CanvasView` (number, ranking, timeSeries, values, six list views, compare), the card types, `Formula` |
| `output/plan.ts` | both | pure rules: `planOutput(spec)` picks the view, page size, base rate and evidence |
| `output/format.ts` | both | values by type (durations, percents, dates) |
| `output/server/render.ts` | server | the engine: `renderCanvas`, `loadMore`, `compareHooks` |
| `output/server/data.ts` | server | ordering, evidence, display rows (session replays, leads, visitors, pages, forms, fields) |
| `output/server/queries.ts` | both (pure) | the evidence SQL builders and row folding; tested on PGlite |
| `output/server/seal.ts` / `seal-core.ts` | server / pure | sealed tokens (AES-256-GCM, site + view bound, 24 h) |
| `output/components/Canvas.tsx` | browser | every view, Show more, lead mini profiles, FramePlate replays with highlights |
| `output/tests/output.test.ts` | dev | 28 checks (`npm run test:output`) |
| `lib/actions/canvas.action.ts` | server | `runHookCanvas`, `loadMoreCanvas`, `compareHooksAction` |
| `lib/hook/site.ts` | server | shared site resolution + error policy for every Hook action |
| `framePlate/components/SessionStrip.tsx` | browser | the optional `highlightIds` prop (ring the matches, dim the rest) |

## 2. Flow

```
runHookCanvas(spec, { raw })                         lib/actions/canvas.action.ts
  siteOrThrow()                                       same site rule as every platform page
  migrateSpec(spec)
  runHook(...)                                        the hook engine, unchanged
  renderCanvas(siteId, spec, result)                  output/server/render.ts
    planOutput(spec)                                  view + evidence (plan.ts)
    number   -> base rate: runHook(spec without conditions)
    table    -> ranking / timeSeries
    values   -> chips
    list     -> orderedItems (stable display order: newest session first, ...)
             -> keep 500; resolve the first page (resolveItems)
             -> seal the rest (one token per item)
  strip raw ids and SQL unless raw (the developer bench)
  -> { result, canvas, canvasError?, credits }

loadMoreCanvas(spec, kind, tokens)   -> open tokens (site + kind + age checked) -> resolveItems
compareHooksAction(a, b, formula)    -> two runHook in parallel -> both must be one number -> formula
```

`resolveItems(kind, page)`:

| Kind | Reads |
|---|---|
| sessions | `sessionReplays()` (Supabase client: sessions, page_views, form_submissions, form_engagement, page_structure, visitors' devices, then `buildSessionsRaw`) + highlights (`matchingVisits`, or the returned visits carried in the token) |
| leads | `leadRows()` + for leadSession evidence: the lead's session replay + its page-view highlights |
| visitors | `visitorRows()` (visitor, latest submission, session count) + `matchingSessionsOfVisitors()` (2 per visitor) + replays + highlights |
| pages / forms / formFields | pg aggregates through `scoped()` sources |

## 3. Two data doors

- **Hook's read-only connection** (`pgHookDb`): used for ordering,
  counting and evidence. Evidence uses the Hook compiler
  (`compileCondition`), so anything that can filter can also highlight.
  Tenant scoping is the same `scoped()` wall as the engine.
- **The app's Supabase client** (the signed-in user, RLS on): used for
  display rows. It reads exactly what the leads and conversions pages
  read, including `page_structure`, which `hook_reader` has no grant for.
  Every query also filters `site_id`.

## 4. Evidence

- **Sessions:** `matchingVisitsQuery` returns, for the sessions on screen,
  the `page_view_id`s that satisfy one "page views where ..." condition.
  Several conditions are unioned.
- **Visitors:** `matchingSessionsQuery` returns the visitor's sessions
  that satisfy ALL the session conditions, newest first. `foldSessions`
  keeps 2 per visitor.
- **Leads:** the session is the lead's own `session_id`, and its
  highlights come from the page-view conditions inside "its session".
- **Which conditions count:** the AND level of the hook, and OR branches,
  since any branch may have matched. Never NOT, and never "count = 0"
  (`plan.ts`).

## 5. Sealed tokens

- **Format:** `sealWith(key, site, kind, data)` is AES-256-GCM over
  `{s, k, d, t}`.
- **Opening:** `openWith` refuses a token that has been tampered with,
  belongs to another site or view, or is older than 24 h. Every refusal is
  a `HookError` that says "run the hook again".
- **Key:** `HOOK_TOKEN_SECRET`, otherwise sha256 of the service role key
  plus a purpose label. It never leaves the server.
- **Item data:**
  - sessions: `{id, h?}`, where `h` holds the returned visits to highlight
    for page-view results;
  - every other list: the row id.
- **Why tokens:** loading more needs no re-run, no credits and no
  server-side state (which Vercel's many instances couldn't share), and no
  readable ids in the browser.

## 6. FramePlate highlight

`FramePlateChart` gained one optional prop, `highlightIds`: a set of
`PageVisitRaw.id` values (`page_view_id`).
- When it is non-empty, every other frame is drawn at 28% opacity and the
  highlighted visits get a 2 px cyan ring.
- Omitted or empty, the chart is unchanged. Every existing chart is
  unaffected.

## 7. Errors and logging

- **Policy:** `lib/hook/site.ts` `failure()` is the same rule as the engine:
  a `HookError` is shown verbatim; anything else shows a reference code and
  is logged.
- **Drawing failures:** a failure while drawing doesn't lose the answer.
  The action returns `canvas: null` plus `canvasError`, and the workspace
  still shows the number and announces the problem.
- **Run log:** each run logs one line, `[hook] canvas {site, entity,
  output, view, credits, runMs, canvasMs}`. Comparisons log
  `[hook] compare`.
- **Client:** Show more failures are announced on screen and logged with
  `hookLog`.

## 8. Performance

- Only the rows on screen are fetched: 6 session replays, 12 cards, and
  so on.
- Ordering touches only the id columns of the result set (at most 5,000
  ids).
- Evidence is one statement per page-view condition, for the sessions on
  screen only.
- Replays reuse the existing `buildSessionsRaw` transform, so no second
  parser exists.

## 9. How to extend

| To add | Do |
|---|---|
| a view for a new entity | a list kind in `types.ts`, `LIST_OF` + `PAGE_SIZE` in `plan.ts`, ordering + `resolveItems` case in `render.ts`/`data.ts`, a component in `Canvas.tsx`, a row in `rules.md`, a test |
| a new kind of evidence | an `Evidence` variant in `plan.ts`, its query in `queries.ts` (tested), its use in `resolveItems` |
| a chart for a result shape | a `CanvasView` variant and a component; `plan.ts` decides when |
| a formula | `Formula` + `FORMULA_LABEL` in `types.ts`, one line in `compareHooks` |
