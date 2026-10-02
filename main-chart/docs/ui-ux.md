# Main chart: UI / UX

## Placement

Full width on `/platform/dashboard`, directly under the five key-stat
tiles and above "Visits over time". It's the dashboard's main chart, so it
gets the most horizontal space: more width means more buckets drawn
individually before the chart has to switch to per-column ranges.

## Layout

```
+---------------------------------------------------------------------------+
| Sessions online (*)  [Smooth|Steps|Trend] [Live|Custom range] [5s 10s ...] |
| 3 open right now · most people online at once, per 10s                     |
| Markers  [ ] (o) Conversions   [ ] | Team joined                          |
| [from] to [to] [Show]                         (custom range only)          |
|                                                      [Now >>] [ - | + ]   |
|  y |          .-.                                            :            |
|    |     .---'   '-.     .-.                                 :  .--.      |
|    |____/           '---'   '-------------------------------- :_/    '--- |
|  (Smooth shown; [Smooth|Steps|Trend] switches the line style)            |
|    +------------------------------------------------------------------ x  |
| [swatch] Last 30 minutes: ... corrects itself after.                      |
| Too many 5s buckets ... (envelope mode only)  Drag to move · pinch or +/- to zoom |
+---------------------------------------------------------------------------+
```

- **Title row:** "Sessions online", with a pulsing dot while live and
  pinned to now. The dot dims once you've panned away. The controls sit
  on the right: line style, Live / Custom range, and one button per
  interval. Opening Custom range fills in the last 7 days and shows it
  immediately.
- **Readout line:** its own line under the title, fixed to one line of
  height. Its text changes on every hover and every second, so it must
  never push the controls or the chart around. Idle, it shows how many
  visitors have a page open right now (see overview.md, "Online means a
  page is actually open"). On hover, it shows the bucket (or range of
  buckets) under the cursor and its value: "peak 3", or "between 1 and 5
  across 1,700 5s buckets" in envelope mode. Long text is cut with "...".
- **Zoom buttons:** top right of the plot, live mode only, with "Now"
  beside them once you've panned away.
- **Footer:** the provisional-zone explanation, the envelope-mode note
  when it applies, and the interaction hint in live mode.

## Shape

- **Smooth area by default.** One point per bucket, joined by a curve,
  like a shadcn area chart. The curve is a *monotone* cubic, not the
  "natural" spline some shadcn examples use. It looks just as wavy, but it
  never overshoots: between two points it can't dip below 0 or rise above
  the higher of the two. A natural spline would draw things like "-0.3
  people" or a peak that never happened.
- **Steps, as a variety.** The same points, drawn with the value held flat
  until the next bucket. Both are drawn from the same computed data;
  switching between them only changes the path.
- **Trend, as a variety.** Points only where the count changed, each
  valued at its bucket's average, joined by the same no-overshoot curve.
  Long quiet stretches become slow slopes instead of flat lines. See
  overview.md for when to use which.

The toggle is **Smooth | Steps | Trend**, at the far left of the controls.
Hovering a button explains it. The readout line changes with the style:

| Style | Idle | Hovering |
|---|---|---|
| Smooth / Steps | "3 open right now · most people online at once, per 10s" | "10:40:00 to 10:40:10: peak 3" |
| Trend | "3 open right now · average online wherever it changed, per 10s" | "Change at 2:30:00: about 1 online on average across that 10s", or "Now: 3 open" on the line's live end |

In Trend, the footer adds that it averages, so a very short spike can
look smaller than in the other two styles.
- **y always starts at 0**, with integer gridlines only (people are whole).
  The top is 12% above the highest visible value, so a peak never touches
  the edge.
- **The step runs right up to "now"**, marked by a dashed vertical line.
  Nothing is ever drawn in the future.

## Markers

A row under the readout line: **Markers  [ ] Conversions  [ ] Team
joined**, each with a small swatch of how it looks. Both start unticked:
the chart shows the online line only until you ask for more.

| | Conversions | Team joined |
|---|---|---|
| Looks like | a yellow dot **on the line**, with a thin ring in the card's background color | a thin full-height vertical line, slightly translucent |
| Placed at | the next point after the submission (10:43 -> the 10:45 point on the 5s chart) | the exact moment they joined |
| Several at once | one dot, with the count above it ("3") | one line each |
| Hover | "2 conversions on the 10:45:05 point: Jane Doe, john@x.com" (up to 3 names, then "+N more") | "amy@x.com joined the team · Oct 1, 10:42:13" |
| Height | follows the line exactly, in every line style | full plot height; ignores the line |

- **Dots sit on the line, not over it.** In Trend the dot's height is
  computed on the drawn curve itself, so it doesn't float above or below.
- **The ring.** A dot sitting on a green line over a green fill would
  blend in. The ring separates it in both themes.
- **Vertical lines stay in the background:** translucent and 1px wide, so
  they mark a moment without competing with the data.
- **Hover priority:** a marker within 8px of the cursor takes the readout
  line over from the point underneath.

## Colors (`main-chart/theme.ts`)

| Part | Dark | Light | Why |
|---|---|---|---|
| Line + fill, history | `#22c55e` green | `#16a34a` | green = people present. Matches FramePlate's seen bands and live-session border family |
| Line + fill, last 30 min | `#22d3ee` cyan | `#0891b2` | FramePlate's blue-cyan already means "live, still open". Same meaning here: not final yet |
| Band (envelope mode) | same hue, ~10% | ~8% | the spread between a column's lowest and highest bucket |
| "Now" line | cyan, dashed | cyan, dashed | belongs to the live zone |
| Not-yet-loaded area | faint shade | faint shade | "loading", never confused with zero visitors |
| Conversion dot | `#eab308` yellow | `#ca8a04` (darker, readable on white) | FramePlate's "converted" yellow: the same meaning everywhere in the product |
| Dot ring | `#0a0a0a` | `#ffffff` | the card's background, so the dot separates from the line |
| Team-joined line | `#818cf8` indigo | `#6366f1` | a hue nothing else in the chart uses |

Yellow appears nowhere else on this chart, so a yellow dot can only mean
a conversion.

The color change at the 30-minute boundary is the conditional-color
mechanism. It's a gradient with a hard stop, computed at every draw, so
the boundary moves with time. Other conditions plug into the same function
(see architecture.md, "Flexibility").

Light/dark: canvas can't read CSS variables, so `theme.ts` holds two
palettes and picks one from `<html class="dark">` at draw time. Switching
the theme repaints immediately.

## Interactions

| Action | Live | Custom range |
|---|---|---|
| Drag horizontally | pan through time (loads history as needed) | none |
| Mouse wheel / two-finger scroll | **scrolls the page**, never touches the chart | scrolls the page |
| Trackpad pinch | zoom around the fingers, or anchored on now while pinned | none |
| + / - buttons | zoom in / out by 1.6x | not shown |
| Vertical touch drag | still scrolls the page | still scrolls the page |
| Hover | bucket readout | bucket readout |
| "Now" button | appears once unpinned; jumps back and re-pins | not shown |

How pinch is told apart from scrolling: Chrome, Edge and Firefox report a
trackpad pinch as a wheel event with `ctrlKey` set, and Safari sends its
own gesture events. Only those zoom the chart. A plain wheel is ignored,
so the page keeps scrolling while the cursor is over the chart.

Zoom limits: at least 12 buckets across (no zooming into a single bucket);
at most the site's whole history plus 5%. You can't pan past now or before
the first page view.

Changing the interval keeps your current view. Only the minimum zoom is
re-applied.

## Opening view

Live mode opens pinned to now, showing the last 360 buckets (1 hour at
10s). **If nobody visited in that stretch**, it opens wider instead: far
enough back to include the most recent visit, plus 15% room
(`theme.lastVisitPadding`). The interval stays as chosen.

Why: on a quiet site, the last hour is often empty, and an empty, flat
line at 0 looks exactly like "nothing loaded". That's what happened on
the first real test: 58 page views in the site's history, the latest 6.4
hours old, and the chart opened on an empty hour.

## States

- **Loading:** "Loading page views..." top-left. Unloaded areas are shaded.
- **Error:** the message in red in the same spot. The chart keeps whatever
  it already has.
- **Nobody online in this stretch:** a centered "Nobody was online in this
  stretch · last visit 6h ago", plus a **Show the last visit** button in
  live mode, which zooms out to include it. Appears whenever the visible,
  loaded stretch holds no one at all, e.g. after zooming into a quiet hour.
- **No visitors yet:** only when the site has never had a single page view
  (decided from the site's latest activity time, NOT from what happens to
  be loaded). Live polling still runs, so the first visitor appears
  without a reload.

## Decisions and what's flexible

| Decision | Reason | Change it in |
|---|---|---|
| Default 10s interval, 1h view | matches your "basis of 10 seconds" | `DEFAULT_INTERVAL_KEY`, `DEFAULT_BUCKETS_IN_VIEW` |
| Plain wheel never zooms (pinch and +/- do) | on a dashboard, the wheel must keep scrolling the page | `onWheel` in `MainChart.tsx` |
| Smooth is the default line, Steps and Trend are varieties | smooth reads like the rest of the dashboard's area charts | `useState<LineStyle>("smooth")`, `LINE_STYLES` |
| Zoom step 1.6x per click, pinch speed | feels like one meaningful step per click | `theme.buttonZoomFactor`, `theme.pinchZoomSensitivity` |
| 300px height | room for the shape without pushing the dashboard down | `theme.heightPx` |
| 30-minute provisional zone | equals the sweep's idle threshold | `theme.provisionalWindowMs` (keep in sync with `lib/closeStaleSessions.js`) |
| Custom range has no pan/zoom | it shows exactly the window you typed | add the same handlers if wanted |
| Markers start unticked | the online line is the main story; markers are something you ask for | `useState` for `markersOn` in `MainChart.tsx` |
| Dot size 4.5px, ring 1.5px, hover radius 8px | readable without hiding the line | `theme.marker` |

Not built yet: pinch-zoom on touch screens and keyboard navigation.
