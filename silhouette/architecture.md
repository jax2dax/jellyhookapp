# Silhouette developer guide, part 1: engineering

The silhouette is a live preview of a hook, drawn as FramePlate shapes. It
is a pure function of the hook plus an SVG renderer, and it never reads data
for its shapes. Part 2 (`data-flow.md`) explains the same thing without
code. The drawing rules are in `rules.md`.

## 1. Code map

| File | What it is |
|---|---|
| `silhouette/types.ts` | the model: figures, items (visits, away periods), plates, frames, chips, `Source` |
| `silhouette/derive.ts` | `deriveSilhouette(spec)`: hook to model. Pure, no React |
| `silhouette/components/SilhouetteFigure.tsx` | one figure as SVG, in FramePlate's theme colours |
| `silhouette/components/SilhouettePanel.tsx` | the sidebar: memoised derive, pulse, glow, page list, error boundary, legend |
| `silhouette/index.ts` | public exports |
| `silhouette/tests/derive.test.ts` | 23 rule checks (`npm run test:silhouette`) |
| `app/globals.css` (end) | `jh-silhouette*` classes: faint at rest, pulse, glow, reduced motion |
| `components/hook/HookWorkspace.tsx` | mounts the panel in the sticky right column |
| `lib/actions/hook.action.ts` `listSitePages()` | the site's page addresses (up to 500), for "N+" |

Dependencies point one way: `silhouette/` reads the Hook language
(`jh-hook/types.ts`, `schema.ts`, `describe.ts`, `units.ts`) and the
FramePlate theme. Nothing in `jh-hook/` or `framePlate/` knows the
silhouette exists.

## 2. The model (`types.ts`)

```
SilhouetteModel { figures: Figure[], notes: string[] }
Figure = SessionFigure { items: (VisitItem | AwayItem)[], live, converted, pagesLabel }
       | PageFigure    { item: VisitItem }
       both: key, title, scale ("main" | "sub"), excluded (NOT), chips, feeds?
VisitItem { key, certainty ("required" | "maybe" | "more"), plate: PlateSpec, frame: FrameSpec, anchor?, caption?, source }
PlateSpec { header (any | exact | oneOf | except | pattern), seen, seenTwice, notSeen, bulbs, form, tall, notes }
FrameSpec { outcome (unknown | converted | abandoned | live), duration label, weight }
Source    { hookPath ("main", "main>c3a9"...), conditionPath (condition ids) }
```

- **`key`:** stable across edits, because it is built from condition ids
  and an index. That's what lets the panel glow only the shapes that
  changed.
- **`source`:** says which condition drew a shape. It is unused by the UI
  today, and it is the hinge for v3 (`plan.md`).

## 3. The derivation (`derive.ts`)

```
deriveSilhouette(spec)
  deriveHook(spec, ctx{hookPath, scale})
    entity switch           -> which figures (rules.md section 1)
    describeSession(conds)  -> drafts; OR -> one draft per alternative (cap 4);
                               NOT -> separate excluded drafts
      applySession          -> fields (converted, open, landing/exit), related rows
                               (page views, away periods, leads, forms), chips
      describeVisit(conds)  -> a Template (plate + frame) + position + before/after groups
                               (sequence relations), chips, "involves session" flags
    layoutSession(draft)    -> ordered items:
                               first / middle / placed-at-N / last groups,
                               landing / exit headers, the converted visit,
                               total page count (min solid, maybe up to max, "+"),
                               away bars interleaved (visits added around them),
                               caps (14 shapes)
    findHookValues          -> every sub-hook in a value -> deriveHook(sub, scale "sub")
```

- **Groups:** a `Group` is "N to M visits looking like this template". It
  is expanded by `expand()` into required, maybe and more items, with its
  before/after neighbours (sequences) attached.
- **Ranges:** `countRange()` turns every count comparison into
  `{min, max | null}`. The session total is never below 1, since a session
  always has a page.
- **Headers merge:** the more specific description wins, in the order
  `exact > oneOf > pattern > except > any`.
- **Contradictions:** a described total below the described pages adds a
  note.
- **Units:** duration labels and frame weights come from the same unit
  conversion as the engine (`jh-hook/units.ts`).

## 4. Rendering (`SilhouetteFigure.tsx`)

- **Pure SVG, no state.** Positions are computed up front. Sizes come from
  a per-scale table (`SIZE.main`, `SIZE.sub` at about three quarters,
  `SIZE.page` for the big single page).
- **Outlines** use the theme's text colours (`--fp-text`, `--fp-text-muted`), not
  FramePlate's plate border: the silhouette is mostly outline, and the plate
  border disappears on the card in both themes (see `plan.md`, "v2 fixes").
- **Colours:** read from `framePlate/theme/defaultTheme.ts`, so outcome,
  seen-band and bulb colours are FramePlate's own. Light and dark mode
  follow the `--fp-*` CSS variables.
- **Hover:** native SVG `<title>`. It costs nothing until hovered, needs no
  JS and works with screen readers. The address-label hover lists the
  pages it could be, from the site's page list.
- **Patterns:** the red diagonal lines (NOT) and the unseen hatch are SVG
  patterns. Their ids are unique per figure, so several figures never
  clash.

## 5. The panel (`SilhouettePanel.tsx`)

- `useMemo(deriveSilhouette, [spec])`. A derive failure is logged and
  shows a quiet message. It never throws into the page.
- **Pulse and glow:** each shape gets a signature (JSON of everything except
  `source`). When the signatures change, React's "adjust state while
  rendering" pattern sets:
  - `pulse + 1`, which re-keys the content so the CSS pulse plays once;
  - `changed`, the keys whose signature changed, which then glow.

  There is no effect and no timer.
- **Page list:** `listSitePages()` runs once per mount and is cancelled on
  unmount. A failure returns an empty list, and labels fall back to "any".
- **Error boundary:** a render error pauses the preview and logs
  `[hook] silhouette render failed`. It resets when the hook changes. The
  builder is never affected.
- **Accessibility:** an `<aside>` with a label, `role="img"` with a label on
  each SVG, `prefers-reduced-motion` respected, and full opacity on focus
  within.

## 6. Performance

- No network on edit. Deriving costs well under a millisecond for normal
  hooks, and is bounded by the limits (14 shapes, 12 figures).
- Animations are CSS only. Glow is a one-shot class, and pulse remounts
  only the panel's content subtree.
- The SVG figures are small: a few dozen elements each.

## 7. Tests

`npm run test:silhouette` runs 23 pure checks. They cover:
- every row of `rules.md` that has a shape;
- OR and NOT;
- page figure vs session figure;
- sequences;
- sub-hooks;
- leads drawing nothing;
- contradictions;
- sources pointing at their condition;
- stable keys.

Change `derive.ts` only together with `rules.md` and a test.

## 8. How to extend

| To | Do |
|---|---|
| draw a new field | a case in `applyVisit` (page views) or `applySession` (sessions); a row in `rules.md`; a test |
| draw a new entity | a branch in `deriveHook` / `otherEntity` |
| a new shape | a property in `types.ts`, drawing in `SilhouetteFigure.tsx`, a legend line in the panel |
| make shapes editable (v3) | see `plan.md`; every shape already carries `source` |
