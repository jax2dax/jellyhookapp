# Hook: documentation brief

Purpose: hand this file to a writer (person or AI) who will produce the
public, user-facing Hook documentation for the Jellyhook SaaS. It lists
every significant feature and the key points each page must cover, in
note form, not finished prose.

Sources the writer should also read:
- `user-guide.md`: the current UI and worked examples;
- `reference.md`: every field, type, operator and measure, generated from
  the code and always current;
- `overview.md`.

Writing rules: professional SaaS tone, product words only (never table or
column names), no em dashes, every page has at least one worked example,
UI labels in bold exactly as on screen.

## Product framing
- Hook = ask precise questions about visitors, sessions, leads and forms;
  answers in seconds; no SQL, no analyst needed.
- Reads like a sentence: Show [what back] of [what you're looking at] where [conditions].
- Answers are live (never cached), scoped to your current site only.
- "Reads as" line: plain-English echo of the question; check before running.

## Page: What you can look at (entities)
- Eight kinds of rows: page views, sessions, form submissions (leads), visitors, form activity, form fields, pages (unique addresses), away periods.
- One-line meaning of each row (see the table in `user-guide.md`).
- Away period = left the site 15 s or more and came back (same rule as session replay's away frames).
- Form fields = one row per field someone clicked into (the form friction data).
- Pages = every address with at least one view.

## Page: Conditions
- **+ Condition**: test one value of the row.
- All conditions at one level must all be true.
- Every field has a type, and the type decides the operators: numbers and durations (is, more than, at least, between...), text (is, is any of, contains, starts with...), dates (after, before, between), yes / no.
- Ranges: **between** with two values, including durations ("between 3 sec and 5 sec").
- Durations in any unit (ms to days); converted automatically.
- Dates: **time ago** or **exact date**.
- Lists: type + Enter; suggestions from your own site's data.
- Colour badge per type, the same colour everywhere; each condition's left edge shows what it tests.
- Field menus grouped by topic; hover = meaning.
- Mention "empty" checks (**is empty** / **is not empty**).

## Page: Connected rows (**+ Look at its...**)
- Every row has connections: a session has page views, away periods, form submissions, form activity, its visitor; a form has fields; a page view has its session, its visitor, its forms.
- **has at least one**: at least one connected row matches.
- **count or total**: number of / number of different / total / average / lowest / highest / median / percentile of connected rows, compared any way (exactly 2, fewer than 3, between...).
- Connected conditions apply to the same row together ("/blogs AND over 5 sec" = one page view that is both).
- Can nest: connected rows of connected rows.
- Example: sessions with at least 2 page views of /blogs over 5 sec.

## Page: Any of / none of (groups)
- **match any (OR)**, **match all (AND)**, **exclude (NOT)**.
- NOT keeps rows where the value is empty ("not facebook" includes sessions with no campaign).
- Nest freely.

## Page: Outputs (what you get back)
- **the number of**, **the number of different (unique)**, **a calculation:** (average, total, lowest, highest, median, percentile), **a list of sessions** (named after what you're looking at: a list of leads, a list of page views...), **a list of ... values**, **a breakdown:** (a measure per value of a field, or per hour/day/week/month; sort; top N).
- "Returns ..." line under the menu tells you the type and whether it's one value or a list.
- Ids exist to link hooks; results will present people/pages/sessions rather than ids (output engine, coming).

## Page: Sub-hooks and tunnels (flagship feature)
- Sub-hook = a separate, complete hook whose result becomes a value in another hook. Tunnel = that flow.
- Same engine, every output available.
- Choose **the result of a sub-hook (tunnel)** next to any value.
- Fit rules: one value fits comparisons; a list fits **is any of** / **is none of**; types and id kinds must match.
- Green "Fits" / red reason; one-click **Use "is any of" instead**.
- Breakdowns hand over their keys ("top 5 pages" becomes a list of 5 pages).
- Sub-hooks can contain sub-hooks.
- **Use this hook as a sub-hook...**: wraps the whole hook into a new one; only fitting slots offered.
- Runs once, inside the database; cost does not grow with list size the way manual copy-paste would.
- Examples: everything a named lead viewed; time on page above the /pricing average.
- (Future: animated view of data flowing through tunnels.)

## Page: Organizing long questions
- Name any hook, sub-hook or condition (click the title line).
- **+ note** for a description.
- Collapse a block to one line (arrow); shows name or summary.
- Drag the dotted handle to add vertical space; arrow keys work; double-click removes.
- All of this travels with the query (links, and later saved hooks).

## Page: Run order and speed
- Auto: Hook checks how big each condition is (without reading data) and runs the most selective first.
- Manual: set the order; Hook steps in only if yours is 10x or more slower (toggle).
- Order never changes the answer, only the speed.
- **How it ran** shows the order used and why.

## Page: Credits and limits
- Every run costs at least 1 credit; heavier questions cost more.
- Cost is checked before running; over the limit = nothing runs, you see the estimate.
- Plan-based allowances: to be defined (do not invent numbers).

## Page: Journeys (sequences)
- Under **+ Look at its...** on any page view: **the next page**, **the previous page**, **the pages after it**, **the pages before it**.
- Same tools as any connected rows: has at least one, count or total, with any operator.
- Examples: visited /pricing before /contact; exactly 3 pages after converting; what people open right after the homepage (a breakdown).

## Page: Results and comparisons (the canvas)
- Covered by its own brief: `output/docs-brief.md`.

## Page: The preview (silhouette)
- Covered by its own brief: `silhouette/docs-brief.md`.

## Page: Where to find Hook
- **Hook** in the sidebar (`/platform/hook`), every plan for now.
- Runs on the site currently selected in the site switcher, the same one every page shows.

## Page: Sharing and reusing
- **Copy link**: exact question; opens against the recipient's own current site; no data in the link.
- **</>**: view or paste a query as code; **Load into builder** rebuilds it.
- Old links keep working (upgraded automatically, with a notice).
- Saved hooks: coming (do not describe as available).

## Page: Form friction with Hook
- Form activity: seen / started / submitted / abandoned, last field touched, time from seeing to typing, time spent filling, fields touched.
- Form fields: field, field type, order focused, time spent in the field, typed in it, time before typing, last field touched, form status.
- Questions: where people give up, slowest fields, click-but-don't-type fields, abandoned forms that stopped on phone.
- "Fields touched" counts only fields someone clicked into (a lower bound).

## Page: Seeing how much of a page was read
- Share of page seen, share of page seen 2x+ (more than once, not exactly twice), share of page never seen, where they entered / furthest point reached / where they left (% down the page), scrolled back up.
- Same model as the session replay chart (light green = seen, dark green = seen 2x+, blue bulb = furthest point).
- Empty for older visits without a recorded screen height; never guessed.

## Page: Two kinds of time on page
- **Time on page** = what session replay shows.
- **Time on page (browser timer)** = browser stopwatch; can differ by a second or more.
- Use **time on page** to match what you see in replays.

## Page: Errors and support
- Errors explain what to change.
- Server problems show a reference code; quote it to support.
- On-screen notices announce runs, upgrades, loads, copies.

## Page: Glossary
- Hook, sub-hook, tunnel, condition, connected rows, group, output, breakdown, credit, run order, away period, form friction.

## Do NOT claim (not built yet)
- Saved hooks, exporting results, sorting inside a result list, overlaying two breakdowns, editing the hook by dragging the preview, AI / natural-language questions, visitor-local time zones, custom form answers as their own fields in conditions, classified traffic source.
