# Output engine: what is shown, and when

The hook engine finds rows; the output engine decides how to show them.
This file is the contract. `output/plan.ts` implements it, and
`output/tests/output.test.ts` pins it. A person sees sessions, leads,
pages and numbers, never raw ids.

## 1. Which view

| The hook returns | Canvas view |
|---|---|
| **the number of / the number of different** | a big number, plus the **base rate**: the same count over everything ("out of 52 sessions overall (7.7%)"). Shown only when the hook has conditions |
| **a calculation** (average, total, median...) | a big number, plus the same calculation over everything ("across all page views: 12 sec") |
| **a breakdown** by a time field (per hour / day / week / month) | **bars over time** |
| **a breakdown** by anything else | a **ranked bar list** |
| **a list of ... values** | value **chips** |
| **a list of sessions** | **session replays** (FramePlate), 6 at a time |
| **a list of page views** / **away periods** | the **sessions** they belong to, as replays, 6 at a time, the returned visits highlighted |
| **a list of form submissions (leads)** | **lead mini profiles**, 12 at a time |
| **a list of visitors** | **visitor cards**, 12 at a time |
| **a list of pages** | a **page table**: views and form submissions per page, 24 at a time |
| **a list of form activity** | **form cards**: page, status, fill time, fields touched, last field, 12 at a time |
| **a list of form fields** | a **field table**: time in the field, typed or not, "gave up here", 50 at a time |
| two hooks + a formula (**Compare with another hook**) | **A, B and the result** (A / B, A / B x 100, A - B, change from B to A) |

## 2. When extra rows (evidence) are shown

Evidence is shown **only when the hook filtered on connected rows**. The
evidence is exactly the rows that satisfied those conditions.

| The hook | Evidence |
|---|---|
| sessions with "page views where ..." (at least one, or a count) | inside each replay, the **page visits that satisfied** those conditions are **ringed in cyan**, and everything else is **dimmed**. The header says how many visits matched |
| sessions with no page-view condition | none: the replay is shown as is |
| a page-view condition under **exclude (NOT)**, or "count = 0" | none: those visits are absent by definition |
| page views (or away periods) returned | each session shown once, with the **returned page views highlighted** |
| leads with "its session matches ..." | under each lead, **the session they converted in**, with any page-view conditions inside it highlighted |
| a plain lead filter (name, email, page...) | none: lead cards only |
| visitors with "sessions where ..." | under each visitor, **up to 2 sessions that matched**, newest first, with their page-view conditions highlighted |

Evidence uses the Hook compiler itself, so every field, operator, sub-hook
and sequence that can filter can also highlight.

## 3. The lead mini profile

- **Name** in the converted yellow, linked to the lead's page.
- **Email** and **phone**, the **submission date and page**, and a
  qualified / not qualified badge when sales has reviewed the lead.
- **Show form answers (N):** the rest of the submitted form, raw, hidden
  until clicked. At most 40 fields are shown.
- Evidence sessions underneath (section 2), and **Open the lead**.

## 4. Loading more

- The first page of a list is drawn right away. The rest wait as **sealed
  tokens**: encrypted, tied to the site and the view, valid for 24 hours.
- **Show N more (M left)** opens the next tokens on the server. It **does
  not re-run the hook and costs no credits**.
- A list keeps at most **500** items. Beyond that the view says "Showing
  the first 500 of N".

## 5. Never shown

- Raw ids. "A list of ..." is drawn as the rows themselves. Ids exist only
  inside sealed tokens and in links to the app's own pages (a lead's page
  address contains its id, as it always has).
- The SQL and the Postgres cost, except on the developer bench (`/dev/hook`).

## 6. Costs

- The run itself: its credits, as before.
- **Base rate:** one more run of the same measure without conditions, about
  the same credits. It is included in the credits shown.
- **Comparison:** the credits of both hooks.
- **Evidence and Show more:** small fixed lookups for the rows on screen.
  They are not metered as hook runs.

## 7. When drawing fails

- If the answer is computed but the drawing fails, the canvas says so and
  the number is still shown. The failure is logged with a reference code.
- If Show more fails or the tokens have expired, a notice explains it:
  "Run the hook again".
