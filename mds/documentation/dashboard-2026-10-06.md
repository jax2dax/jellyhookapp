# Dashboard, conversions page and sidebar changes (2026-10-06)

For developers. What changed, why, where the code is, and how each number
is counted. Public wording is on `/docs/reference/dashboard` and
`/docs/reference/conversions`.

## Part 1: engineering

| Change | Code |
|---|---|
| Site Health card removed; Hook shortcut card in its place | `components/dashboard/HookShortcutCard.tsx`, `app/platform/dashboard/page.jsx`, keyframes `jh-hook-swing` in `app/globals.css` |
| Top tiles get a time window (24h / 7d / 30d, plus All on the conversions page) and a change vs the window before | `components/dashboard/WindowStatTile.tsx`, `lib/actions/dashboardStats.action.ts` (`getWindowStat`) |
| Active now as a round badge; the description only on hover | `components/dashboard/ActiveNowTile.tsx` |
| (i) explanations on tiles and charts | `components/InfoTip.tsx` (tooltip, keyboard reachable, safe inside link cards) |
| New Reach / Conversions minis draw a flat 0 line instead of "No conversions in this period" | `components/charts/NewReachChart.tsx`, `components/charts/ConversionsAreaChart.tsx` |
| Visits over time: Unique visitors + Split by referrer / device / country (stacked, legend, tooltip with every colour) | `lib/actions/visitsOverTime.action.ts`, `lib/analytics/visitsAggregate.ts` (pure counting, tested), `components/charts/visitsOverTime.tsx` |
| Sidebar Support opens a message dialog (no rating) | `components/feedback/SupportDialog.tsx`, `components/feedback/SupportFeedbackButton.tsx`, `submitSupportRequest` in `lib/actions/feedback.actions.js`, table `support_requests` (SQL in `mds/database.md`) |
| Conversions page: the all-time tile and the whole Conversion Rate Over Time chart were removed later the same day (see `leads-conversions-calendar-2026-10-06.md`) |
| "View full information" becomes "View lead information" | `components/leads/ConvertedLeadCard.tsx`, `app/docs/reference/conversions/page.tsx` |

### How the tiles count (`getWindowStat`)

| Tile | Current window | Previous window |
|---|---|---|
| Page Views | `page_views` with `entered_at` in [now - W, now) | [now - 2W, now - W) |
| Sessions | `sessions` with `started_at` in the window | same rule, window before |
| Leads / Total Conversions | `form_submissions` with `submitted_at` in the window | same rule, window before |
| Conversion Rate | distinct submitting `visitor_id`s / distinct `visitor_id`s with a session started in the window (capped at 100%) | same rule, window before |

- W is 24 hours, 7 days or 30 days, always rolling up to now.
- "All" has no previous window, so no arrow. For the conversion rate on
  "All", the denominator is every row in `visitors` (the old definition).
- Counts use PostgREST's exact count (`head: true`). The old tiles read
  rows, which PostgREST silently caps at 1,000, so "Total Sessions" was
  wrong past 1,000 sessions.
- Distinct visitors page through ids, 1,000 at a time, capped at 200,000
  rows.
- **Trend:**
  - counts show a relative %;
  - the previous window being 0 with something now reads "new";
  - both being 0 reads "0%";
  - the rate shows percentage points.
  - Green and up means more, red and down means fewer.
- Each tile remembers its window in `localStorage` (`jh_tile_window_<id>`).
  The conversions page tile has its own id, so it doesn't share the
  dashboard's choice.

### How Visits over time counts (`aggregateVisits`)

- **Buckets** are equal lengths from the window start:
  - hour for 24h;
  - day for 7 days and a month;
  - week for 3 months;
  - adaptive for all time.
- **Unique:** a person (`visitor_id`) counts once per bucket. Sessions with
  no `visitor_id` each count, since they can't be merged.
- **Split:**
  - **Groups:** referrer (`classifyReferrer`: the utm source, otherwise the
    known site name or domain, otherwise "Direct"), device
    (`visitors.device_type`, otherwise "Unknown"), or country
    (`sessions.country`, otherwise "Unknown").
  - **Ranking:** groups are ranked by sessions in the whole window, never by
    the unique count. The top 7 get keys `g0` to `g6`, and the rest share
    `__other__` ("Other (N)").
  - **Colours:** they come from the rank (`PALETTE` in the component, grey
    for Other). So a group keeps its colour in every bar and when Unique is
    toggled. A group absent from a bar takes no part of it, and its colour
    is never reused there.
- **Unique + split:** a person counts once per bucket, under the group of
  their first session in it, so stacks add up to the bar.
- **Paging:** sessions are read 1,000 per request, up to 100,000 per window.
  Beyond that the chart says so.
- **Tests:** `npm run test:visits` runs 10 checks, including the "3 sessions
  at 2:00 and 2 at 3:00 count as 1 + 1" example.

### Before shipping

- Run the `support_requests` SQL in `mds/database.md`. Until then, Support
  shows "Couldn't send your message".

## Part 2: data flow

- **Tiles:** each tile asks the server for its own number when it appears
  and whenever its window changes. The server counts the current window and
  the one before, and the tile shows the number and the arrow. No other part
  of the dashboard waits for the tiles.
- **Active now:** reads the same live store as the main chart, so the two
  always agree.
- **Visits over time:** changing the window, Unique or Split by asks the
  server again. The server reads that window's sessions (all of them, in
  pages), looks up devices if needed, counts, and sends back bars, groups and
  totals. The browser only formats labels (in the viewer's own time zone)
  and draws.
- **Minis:** unchanged data; a period with nothing in it is drawn as a flat
  line.
- **Support:** the message and the page it was written on go to
  `support_requests` through the server (service role). Nothing is readable
  from the browser.
- **Hook card:** a link to `/platform/hook`. No data.
