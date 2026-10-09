---
name: document-feature
description: Document a Jellyhook feature or screen in the public docs after it is built or changed. Use whenever a feature is added, changed or found undocumented; writes the feature page, the use case, updates nav and the doc-to-source map.
---

# Document a feature

Run the `docs-writer` agent's process (`.claude/agents/docs-writer.md`) for the named feature or screen:
1. Read the component and the action behind it. List every on-screen label and every number and where it comes from.
2. Write or update the feature reference page following `mds/documentation/docs-standard.md` (what it answers, scenario, what you see,
   needs, how calculated, empty state, limits, related).
3. Add the use case to the "What Jellyhook is for" page if the feature opens a new situation.
4. Update `app/docs/docsNav.ts`, `mds/documentation/doc_source_map.md`, and `marketing/docs-audit.md`.
5. Run `npx tsc --noEmit` and `npm run docs:check`.
