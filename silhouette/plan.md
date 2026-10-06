# Silhouette: plan

## v2: built (2026-10-06)

- Live preview from the hook: session and page figures, ranges, OR / NOT,
  sub-hooks, sequences, form states, away periods, seen bands, bulbs.
- Pulse per edit, glow on the shapes that changed, reduced motion.
- Shapes carry `source` (the condition that drew them) and stable keys.
- 23 rule checks. Not checked by me in a browser (I can only fetch the
  server-rendered page, which renders the preview correctly).

## v2 fixes (2026-10-06, after the first real use)

- Outlines were nearly invisible: FramePlate's plate-border colour (#3a3a3a
  on a dark card, a pale pink on a white one) at 62% panel opacity. They now
  use the theme's text colours (near-white dashed in dark mode, dark grey in
  light mode), and the panel rests at 78% opacity. Checked by rendering the
  real SVG to images in both themes.
- Described pages without a page count now end with "+" (other pages may
  exist), so "has a page view of /blogs" no longer looks like a one-page
  session. 24 checks.

## v3: interactive silhouette (designed, not built)

Goal: drag or click a shape and the hook updates exactly the condition
behind it, and nothing else.

How it fits:

- **Edits are addressed by `source`.** Every shape already knows its
  `hookPath` (which hook or sub-hook) and its `conditionPath` (the ids from
  that hook's top down to the condition). An edit is a pure function
  `applyEdit(spec, source, change) -> spec` in `silhouette/edit.ts`:
  1. walk to the hook by `hookPath`;
  2. walk to the condition by `conditionPath`;
  3. replace only that condition's value or operator.

  Unrelated conditions are untouched by construction. A test asserts that
  everything else stays deep-equal.
- **Edit kinds, first set:**
  - drag the top of a seen band to change "share of page seen";
  - drag a bulb to change "where they left" / "furthest point";
  - click a plate's label to pick the page;
  - drag a frame's edge to change "time on page";
  - add or remove plates to change a page count;
  - toggle a frame yellow for "converted".
- **Shapes with no condition yet** (a dashed "any page" plate, for
  example) need a create-edit. It adds a NEW condition in the right place
  (the session's page views, or the page view's own conditions), so
  `source` for filler shapes points at the place it would go.
- **Many session descriptions in one hook:** each figure belongs to
  exactly one description (one alternative, one NOT branch, one sub-hook),
  and edits go only to that one. `source.hookPath` plus `conditionPath`
  already separate them.
- **Undo:** the builder keeps the last N hooks; every silhouette edit is
  one undo step.

Open questions for v3:
1. Should dragging change values continuously (live), or only on release?
2. When a dashed plate is given a page, should it become a new "has a page
   view of X" condition, or extend an existing count condition?
3. Should edits made in the preview be marked in the builder (a brief
   highlight on the condition that changed)?

## Open points in v2

- An OR inside a page's conditions is shown as a chip, not as alternative
  plates.
- Positions given as ranges ("page number between 2 and 4") are a chip.
  Only an exact number places the plate.
- The page list is capped at 500 addresses.
