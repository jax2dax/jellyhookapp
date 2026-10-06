# Output engine and canvas: overview

The hook engine answers "which rows?". The output engine answers "how
should a person see them?". The canvas sits under the builder on
`/platform/hook` and `/dev/hook`, and shows that answer as people,
sessions, pages and numbers, never as ids.

## What it does

- **Picks the view** from the shape of the question: a number with its
  base rate, bars over time, a ranking, value chips, session replays, lead
  mini profiles, visitor cards, page, form and field tables, or a
  comparison.
- **Explains the result** when the question looked at connected rows:
  - matching page visits are ringed inside the replays;
  - a lead's converting session sits under the lead;
  - a visitor's matching sessions sit under the visitor.
- **Loads only what is on screen.** The rest waits as sealed tokens.
  "Show more" is free and doesn't re-run the hook.
- **Compares two hooks** with a formula.

## Decisions (Joshua, 2026-10-06)

| Question | Decision |
|---|---|
| evidence | only when the hook filtered on connected rows |
| session results | full replays, first 6, then "Show 6 more" |
| canvas location | below the builder (the right column is the silhouette) |
| "a list of ids" | named per entity ("a list of sessions"); the rows are drawn, ids never shown |
| matched visits | highlighted, the rest dimmed |
| lead card | name, email, phone, submission date, the raw form answers behind a reveal |
| comparison | two hooks + a formula |
| single numbers | with the base rate |

## Read next

- `rules.md`: what is shown, and when.
- `architecture.md`: part 1, engineering.
- `data-flow.md`: part 2, data flow (no code).
- `plan.md`: what is next.
- `docs-brief.md`: notes for the public docs.
