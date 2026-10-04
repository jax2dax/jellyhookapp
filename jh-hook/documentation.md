# Hook: documentation index

| File | What it answers |
|---|---|
| overview.md | what Hook is, the three ideas, definitions |
| architecture.md | decisions, compiler, planner, cost, security, research, **setup steps** |
| data-flow.md | a run end to end, tunnels, steps, related rows, caching, the URL |
| ui-ux.md | the builder on `/dev/hook` and where the UI is heading |
| plan.md | status, next steps, worked-out designs, guardrails |
| progress.md | dated log |
| setup.sql | the one-time database setup |

Code: `jh-hook/` (schema, types, describe, units, engine/),
`lib/actions/hook.action.ts`, `lib/hook/pgDb.ts`,
`components/hook/HookBuilder.tsx`, `app/dev/hook/page.tsx`. When the code
changes, update the doc that claims something about it.
