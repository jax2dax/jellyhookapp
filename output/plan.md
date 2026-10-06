# Output engine: plan

## v1: built (2026-10-06)

- **Views:** number + base rate, ranking, time series, values, sessions
  (replays + highlights), leads (mini profiles + converting session),
  visitors (cards + matching sessions), pages, forms, form fields, and
  compare.
- **Loading:** sealed-token "Show more", 500 items kept per list.
- **FramePlate:** a `highlightIds` prop.
- **Tests:** 28 checks covering plan, evidence SQL, tokens.
- **Verified:** tsc, eslint, `next build`, and the server render of the
  workspace.
- **Not verified here:** a run against your real data in a browser. The
  canvas reads display rows through the app's Supabase client, the same way
  the leads page does, which needs your signed-in session.

## Next

1. **Canvas comparisons beyond two numbers:** two breakdowns overlaid on
   one chart, and the "page conversion power" table (a breakdown divided by
   a number).
2. **Sort and filter inside a list view** (for example, sessions by length),
   without re-running.
3. **Export** a list as CSV, columns only, never raw ids.
4. **Pinned results:** save a canvas view on a dashboard once saved hooks
   exist.
5. **Highlight inside lead evidence for "its session" conditions on away
   periods and forms** (today: page-view conditions).
6. **Animated tunnels:** show a sub-hook's result flowing into its slot when
   the canvas renders (ties into the silhouette).

## Open questions

1. Should the base rate cost its credits, or be free context?
2. For long lists, should the order be configurable (newest first, longest
   first, most pages first)?
3. Should a visitor card show more than 2 matching sessions behind a "Show
   all" button?
