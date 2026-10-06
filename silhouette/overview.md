# Silhouette: overview

A live preview beside the Hook builder (`/platform/hook`, `/dev/hook`). As
a person describes what they're looking for, a faint FramePlate fills in.
Pages appear as they're mentioned. A frame turns yellow when "converted"
is set. Bands and bulbs appear when scroll is described. Purple bars appear
for time away. Alternatives get their own pictures, and exclusions are
crossed with red diagonal lines.

It answers "is this the session I mean?" before anything runs, and it
costs nothing: no database reads for its shapes, and no credits.

## Versions

| Version | What | Status |
|---|---|---|
| v2 | read-only preview that follows the hook (this) | built |
| v3 | interactive: adjust a shape in the preview and the matching condition in the hook updates (only that one) | designed, `plan.md` |

## Decisions (Joshua, 2026-10-06)

| Question | Decision |
|---|---|
| placement | sticky right sidebar; stacks under the builder on narrow screens |
| motion | faint at rest; one pulse per edit; the changed shapes glow; off under reduced motion |
| ranges | minimum solid, extras faint with "?", "+" when unbounded |
| sub-hooks | their own smaller, labelled figures |
| page results | two figures: a single, bigger frame + plate for the page's own conditions, and a session figure only if the session is involved |
| sequences | added to the engine (next / previous page, pages after / before it) so "3 pages after the conversion" can be described and drawn |
| folder | `silhouette/` |

## Read next

- `rules.md`: exactly when each thing is drawn, and when it isn't.
- `architecture.md`: part 1, engineering.
- `data-flow.md`: part 2, data flow (no code).
- `plan.md`: v3 and the open points.
- `docs-brief.md`: notes for the public docs.
