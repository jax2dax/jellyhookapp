# Hook: documentation index

| File | For | What it answers |
|---|---|---|
| user-guide.md | everyone using Hook | how to use the builder, every control, 21 worked examples |
| docs-brief.md | the writer of the public docs | every feature and the key points each docs page must cover, plus what not to claim |
| reference.md | everyone | every entity, field, type, operator and measure (generated: `npm run hook:reference`, never hand-edited) |
| overview.md | everyone | what Hook is, the core ideas, definitions |
| architecture.md | developers | **part 1, engineering**: code map, pipeline, compiler, planner, cost, security, versioning, errors, tests, how to extend, setup, decisions |
| data-flow.md | developers, product | **part 2, data flow**: the journey of a query, sub-hooks and tunnels, steps, connected rows, what is kept, failure modes (almost no code) |
| ui-ux.md | developers, design | the builder as built, and where the UI is heading |
| plan.md | Joshua | status, next steps, output engine and silhouette designs, guardrails |
| naming.md | everyone | audit of every user-facing name |
| progress.md | Joshua | dated log |
| setup.sql | ops | the one-time database setup |
| ../output/ | everyone | the output engine and results canvas: overview, `rules.md` (what is shown, when), developer guide part 1 and 2, plan, docs brief |
| ../silhouette/ | everyone | the live preview: overview, `rules.md` (when each shape is drawn), developer guide part 1 and 2, plan (v3), docs brief |

Code: `jh-hook/` (schema, types, shape, describe, migrate, errors, debug,
units, engine/, tests/, scripts/), `lib/actions/hook.action.ts`,
`lib/hook/pgDb.ts`, `components/hook/HookBuilder.tsx`,
`app/dev/hook/page.tsx`. When the code changes, update the doc that claims
something about it, and regenerate `reference.md`.

## Public documentation (the pages customers read)

Hook, the preview and the results have public pages under `app/docs/hook`, `app/docs/preview` and `app/docs/results`, each split into
"how to use it" and "how it works". **Whenever Hook, the preview or the results change, those pages change in the same commit.**
`npm run docs:check` fails until they are re-read and re-stamped (`app/docs/docsSync.ts`). The field reference page is generated from
`schema.ts`, so it never needs editing. The page-to-source table is in `mds/documentation/doc_source_map.md`.
