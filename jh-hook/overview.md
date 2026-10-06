# Hook: overview

Hook is Jellyhook's own query engine. A person describes what they want in
product terms, and the engine works out how to fetch it from the database,
in what order, and what it cost. Today it runs on `/dev/hook` (a test
bench). Later it gets its own page, behind authorization.

It is not a list of canned reports, and it is not a SQL builder with
renamed columns. It is a small language with three ideas.

## 1. Any field, any operator

Every entity (page views, sessions, form submissions (leads), visitors,
form activity, form fields, pages, away periods) exposes its fields with a type. The type decides the
operators and the value editor:

| Type | Operators | Value |
|---|---|---|
| number, percent, px, duration | is, is not, more than, at least, less than, at most, between, not between, empty | a number; durations in any unit (ms to days) |
| time | after, before, between, empty | an exact date, or "N minutes/hours/days/weeks/months ago" |
| text | is, is not, is any of, is none of, contains, starts with, ends with, empty | text or a list |
| enum | is, is not, is any of, is none of | from the allowed values |
| true/false | is true, is false, empty | none |

So "time on page between 3 sec and 5 sec" is one condition, not a feature.

## 2. Related rows, measured

Any entity can be filtered by its related rows, measured any way:
number of, number of different, total, average, lowest, highest, median,
percentile, compared with any operator.

- sessions where the **number of page views** is less than 4
- sessions where the **number of different pages** is exactly 2
- sessions where the **number of page views where page is /blogs and time
  on page > 5 sec** is at least 2
- sessions where the **number of away periods where time away > 2 min** is 1
- sessions where the **total time on page** is between 10 and 20 sec
- page views whose **session** converted (a one-to-one relation)

The related rows have their own conditions, which can have related rows of
their own, and so on. "Has" (at least one) and "has none" (under NOT) are
the shortcut forms.

## 3. Sub-hooks and tunnels: one hook's result flows into another

Two words, two ideas:

- A **sub-hook** is a separate, complete hook (the same engine, every
  output: how many, a list of ids, a breakdown...) whose job is to return
  certain values.
- A **tunnel** is the flow: the sub-hook's result travelling into a value of
  another hook. The sub-hook is the source; the tunnel is the connection.

Any value in a condition can come through a tunnel from a sub-hook.

- page views where **visitor is any of** [the visitor ids of leads whose
  name contains "hanna"]
- page views where **time on page is more than** [the average time on page
  of /pricing]
- pages where **path is any of** [the landing pages of converted sessions]
- a sub-hook can itself contain a sub-hook

Rules, enforced as errors, never silently coerced:

- A sub-hook that returns **one value** (a count or a measure) fits any
  single-value operator. One that returns **a list** (ids or values) fits
  only "is any of" / "is none of".
- Types must match: a list of session ids cannot feed a visitor id field;
  a count cannot feed a duration.

## 4. Built for long questions

- Name any hook, sub-hook or condition, add a note, collapse it to one
  line, and drag space between conditions. Names and layout are saved in
  the query itself, so links (and later saved hooks) keep them.
- **Use this hook as a sub-hook...** wraps the whole current hook into a
  new one, offering only the slots its result fits.
- `</>` shows or loads the query as code.

## 5. Form friction

The per-field form data (which field, order, time spent in it, typed or
not, last field touched) is its own entity, **form fields**, so "where do
people give up on the form" is an ordinary breakdown.

## Also

- **AND / OR / NOT groups**, nested to any depth. NOT treats an empty value
  as "not matching", so "NOT utm source is any of facebook, google" keeps
  sessions with no utm at all.
- **Outputs:** how many, how many different, a measure (average, median,
  percentile...), the ids, the values of a field, or a breakdown (any
  measure per value of a field, or per hour/day/week/month of a time field).
- **Order:** the engine orders the top-level conditions from Postgres's own
  statistics, or you set the order, with a guard that overrides an order
  that is 10x worse.
- **Cost** in credits, known before running, with a limit.
- **Explain:** every run shows the order it used, row estimates, what each
  tunnel carried, the SQL, and the query.
- **Old queries keep working:** every query is upgraded to the current
  format on the way in (`migrate.ts`).

## Left and right

Every question Hook answers is either about one thing (left: one page,
session, lead) or about that thing against a group (right: converted vs
non-converted, this page vs all pages). Left answers are counts, measures
and lists. Right answers are left answers combined, which is why outputs
are numbers you can feed into other hooks (the tunnel) and into
comparisons (plan.md).

## Definitions the engine relies on

- **Page:** `page_views.page_path`.
- **Converted session:** a `form_submissions` row carries its `session_id`.
- **Lead:** a `form_submissions` row. Its visitor is `visitor_id`.
- **Time on page:** milliseconds (`public/tracker.js`); typed in any unit.
- **Away period:** the time between one page view's end and the next one's
  start in the same session, when it is at least 15 seconds. Same rule
  FramePlate uses to draw an away frame.
- **Seen %:** share of the page that was on screen, from the scroll
  geometry in `mds/database.md` (the scroll columns are fractions of the
  scrollable range, not of the page). Empty, never guessed, when the screen
  height was not measured.
- **Hours and weekdays:** UTC.

Files: `schema.ts` (vocabulary), `types.ts` (the language), `shape.ts`
(what a hook returns, where it can flow), `migrate.ts` (old queries keep
working), `describe.ts` (query to English), `engine/` (compiler, planner,
runner), `setup.sql`.

Read next: `user-guide.md` (how to use it, with examples),
`architecture.md` (developer guide part 1, engineering), `data-flow.md`
(part 2, data flow), `ui-ux.md`, `plan.md`, `docs-brief.md` (notes for the
public documentation).
