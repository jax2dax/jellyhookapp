# Calendar, leads, lead profile and conversions changes (2026-10-06)

For developers. What changed, why, and where. Public wording is on
`/docs/reference/leads`, `/lead-profile`, `/conversions` and `/dashboard`.
URL keys are in `url-state.md`; local storage in `mds/local_cache_schema.md`.

## Part 1: engineering

| Change | Code |
|---|---|
| The app's calendar replaces every default date input | `components/ui/DateRangeField.tsx`, `components/ui/popover.tsx`, `lib/dateLocal.ts` |
| Used in: chart range picker, main chart custom range, conversions list range, leads date filter, Hook builder exact date | `components/charts/DateRangePicker.tsx`, `main-chart/components/MainChart.tsx`, `components/leads/ConvertedLeadsExplorer.tsx`, `components/leads/LeadsTable.tsx`, `components/hook/HookBuilder.tsx` |
| "All time" on the four top dashboard tiles | `allowAll` on `WindowStatTile` in `app/platform/dashboard/page.jsx` |
| Conversion Rate Over Time chart deleted; its two facts move into New Reach and Conversions | deleted `components/charts/conversionRate.tsx` and `lib/actions/rateConversion.action.ts`; new `components/charts/ChartFacts.tsx` used by `NewReachChart.tsx` and `ConversionsAreaChart.tsx` |
| Leads page: default All time, whole-row click, fade only when more rows exist | `components/leads/LeadsTable.tsx` |
| Lead profile: engagement score removed | deleted `components/charts/leadEngagementRadial.tsx`; score removed from `lib/algorithms/leadProfile.js` and the page |
| Lead profile: new "at a glance" card with pages per visit | `components/leads/LeadStatsCard.tsx` |
| Lead profile: form details show first 4 fields, the rest behind a button | `components/leads/FormDetails.tsx` |
| Lead profile: conversion events as one row of badges | `components/leads/ConversionEventsBadges.tsx` |
| Session chart (i) "Read docs" points at the session replay concept page | `components/leads/ChartLegend.tsx` (`/docs/concepts/session-replay`) |
| URL state for leads, conversions and the lead's selected session | `lib/urlState.ts`, see `url-state.md` |
| Billing text without an em dash | `app/platform/user/UserPageClient.tsx` |

### The calendar

- A button shows the chosen range; a popover holds a month grid.
- **Range:** click the first day, then the last. A hover preview shades the
  range, and the two ends are solid. Quick picks: Today, Yesterday, Last 7
  days, Last 30 days, This month.
- **Single** (`mode="single"`): one click picks the moment and closes.
- **Time:** optional start and end times (`withTime`), native time inputs.
- **Keyboard:** arrow keys move by day and week, Page Up and Page Down by
  month, Home and End to the week's ends, Enter or Space picks, Escape closes
  (Radix popover).
- **Values** are local strings, `YYYY-MM-DDTHH:mm` or `YYYY-MM-DD`
  (`lib/dateLocal.ts`), the same shape `datetime-local` gave, so each caller
  kept its own parsing. `max` blocks future days where a future range is
  meaningless.
- A range's end day is inclusive: the leads filter treats `to` as the end of
  that day.

### Chart facts

- **In range:** the total for the chosen range (`totalNewVisitors`,
  `totalUniqueConversions`).
- **Growth:** `(last - first) / first` over the chart's own buckets: first
  interval of the range against the most recent one.
  - A first interval of 0 reads "new" (or "0%" if the last is 0 too).
  - The last interval is usually in progress, so the (i) says it can look
    low until it ends.
- **Note:** "In range" counts unique converting visitors, the chart's own
  definition. The removed card counted raw submissions, which is why
  numbers can differ from the old card. Raw submissions are still the
  dashboard's Leads tile.

### The leads fade

`scrollHeight - clientHeight - scrollTop > 2` decides whether more rows hide
below the visible part. It is re-measured on scroll, on resize of the
scroller or the table, and when the filtered row count changes. One lead, or
all leads visible: no fade.

### Lead stats: what each number is

| Number | Formula |
|---|---|
| Visits | sessions (`totalVisits`) |
| Page views | `totalPageViews` |
| Pages per visit | page views / visits, one decimal; the dots show up to 10 |
| Time engaged | sum of `time_on_page` |
| Avg scroll | mean of `scroll_depth` as a percent |
| Time to convert | first seen to the submission time |

### Why the engagement score was removed

A single 0-100 score weighted pages, minutes and scroll with constants that
were a judgment, not something the data can verify (the roadmap already
called it "an arbitrary heuristic, not a fact"). The facts it was built
from are all on the page. A transparent comparison of a lead against the
site's typical lead can be built on Hook later (`jh-hook/plan.md`).

## Part 2: data flow

- **Calendar:** the field holds nothing of its own. It reads the local
  strings its parent keeps, shows them, and calls the parent back with new
  ones. Parents convert to ISO instants (charts) or filter in the browser
  (leads).
- **Leads page:** all leads are loaded once; the search text, date range and
  status are read from the address bar and applied in the browser. Changing
  one rewrites the address (after a pause for typing). Back, refresh or a
  pasted link re-reads the same address.
- **Conversions page:** the layout, range and page are in the address; the
  range decides which cached or fresh data the list loads (cache rules
  unchanged).
- **Lead page:** the selected session is in the address; the explorer picks
  it from there, falling back to the latest session when it is missing or
  unknown.
- **Chart facts:** computed in the browser from the buckets the chart
  already has. No extra request.
