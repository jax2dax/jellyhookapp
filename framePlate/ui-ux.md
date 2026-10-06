

## Highlighting visits (added 2026-10-06)

`FramePlateChart` takes an optional `highlightIds`: a set of visit ids
(`PageVisitRaw.id`, the `page_view_id`). When it is non-empty:
- the highlighted visits keep full strength, with a 2 px cyan ring;
- every other frame (visits and away gaps) is drawn at 28% opacity.

Omitted or empty, the chart renders exactly as before. The Hook results
canvas (`output/components/Canvas.tsx`) uses it to show which page visits
matched a hook's conditions.

