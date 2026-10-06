# Silhouette: when things are drawn, and when they are not

The silhouette draws the hook's DESCRIPTION, not its data. It never reads
the database for its shapes (only the site's page list, for "N+" labels).
Running the hook does not change it. A shape appears when, and only when,
a condition describes it. This file is the contract.
`silhouette/derive.ts` implements it, and `silhouette/tests/derive.test.ts`
pins it.

## 1. Which figures exist

| The hook returns | Figures drawn |
|---|---|
| sessions | one session figure (more for OR / NOT, see 3) |
| page views | **always** one big single page figure for the conditions on the page view itself; **plus** a session figure only if the hook involves its session (see below) |
| pages (unique addresses) | one big page figure (address + described views) |
| form activity, form fields | one page figure with a form mini-plate; plus a session figure if "its session" is described |
| form submissions (leads) | a session figure **only if** the session is described ("its session", or the submitted-on page). A plain lead filter ("name contains hanna") draws **nothing** |
| visitors | one session figure per "sessions" condition; one page figure per "page views" condition. Visitor fields alone draw **nothing** |
| away periods | a session figure with the described away period |

A page view "involves its session" when any of these is used:
- **its session**;
- **session converted**;
- **is the landing page**, **is the exit page**, **page number in the
  session**;
- **the next page**, **the previous page**, **the pages after it**,
  **the pages before it**.

In that session figure, the returned page view is the **cyan-ringed**
plate ("this page view"). It shows only the page address. All other page
details stay in the big page figure, because conditions on the returned
page are different from conditions on pages inside a filtered session.

When the session's page count is not described, a session figure always
ends with a **"+"**: the described pages are some of its pages, not all of
them ("has a page view of /blogs" = /blogs among possibly others). A
described count ("exactly 4 pages") removes the "+".

Nothing described means nothing to draw, except one case. A hook on
sessions with no conditions still draws one session figure: one dashed
page and a "+", meaning "a session has at least one page".

## 2. What each condition draws

### On a session

| Condition | Drawn |
|---|---|
| converted is true | a **yellow frame** (converted here) with the yellow bulb. If no page says where, it is placed at the end, captioned "converted here" |
| converted is false | the caption "did not convert"; no yellow anywhere |
| still open is true | a **cyan border** around the whole session |
| landing page / exit page | the first / last plate gets that address (a new first / last plate if needed) |
| has at least one page view where ... | **one plate** described by those conditions |
| count of page views where ... (=, at least, at most, between) | that many described plates: the minimum as normal, the extra possible ones **faint with "?"** (at most 3 drawn), unbounded = a **"+" stub** |
| count of page views (no conditions) | the whole session's size: dashed plates up to the minimum (at least 1), faint "?" plates up to the maximum, or "+". The figure is labelled ("2 to 5 pages") |
| number of different pages | that many plates captioned "different page" |
| away periods (has / count, time away) | **purple bars** between visits, labelled with the time away; visits are added around them if needed |
| form submissions | converted (yellow) |
| form activity where status is ... | a plate with a **form mini-plate**: yellow (seen / started), bright yellow (submitted), orange frame (abandoned) |
| anything else (started at, campaign, country, session length, totals and averages, its visitor...) | a **chip** under the figure with the condition in plain English. No shape |

### On a page view (big page figure, or a plate inside a session)

| Condition | Drawn |
|---|---|
| page is / is any of / is none of / contains... | the plate's **address label**: the exact path; "3 pages"; "N+" (any of the site's N pages); "12 · blog" (12 pages contain "blog"). Hover lists the possible pages |
| no page condition | **dashed white outline** and "N+" |
| time on page (either kind) | frame **width** grows with the described time; the label under the frame ("> 5 sec", "3 sec to 5 sec") |
| share of page seen | **light green band** from the top to that share; dashed edge = "at least", solid = exact or "at most" |
| share of page seen 2x+ / scrolled back up | **dark green band** (inset) |
| share of page never seen | a **hatched** bottom part |
| where they entered / furthest point / where they left (% down) | **green / blue / red bulbs** at that height; "mentioned" without a number = a faint bulb in the middle |
| converted on this page | **yellow frame** + yellow bulb |
| still on screen | **cyan** frame (live) |
| its forms (status) | a **form mini-plate** on the plate |
| page height at least 3000 px | a **taller** plate |
| the next page / the previous page | a plate right after / before, captioned "next page" / "previous page" |
| the pages after it / before it (has / count) | that many plates after / before, captioned "later" / "earlier", with the same range rules |
| page number in the session is N | the plate lands at position N, with dashed unknown pages before it |
| a NOT group inside the page's conditions | a **red hatched corner** on the plate; hover says what it must not be |
| anything else | a chip |

## 3. OR, NOT and sub-hooks

- **OR group** ("match any") at session level: **one figure per
  alternative**, titled "option 1 of 2"... Up to 4 alternatives are drawn;
  the rest are counted in a note. An OR inside a page's conditions is a
  chip (it would multiply plates without telling more).
- **NOT group** ("exclude") at session level: an **extra figure** drawn
  with **red diagonal lines**, titled "Not this: ... must not look like
  this". The figure without it shows the rest of the description.
- **Two different session descriptions in one hook** (for example a
  visitor with two "sessions" conditions): **one figure each**.
- **Sub-hooks**: every sub-hook that describes something gets its own,
  **smaller** figures under "Sub-hooks, flowing in through tunnels". They
  are titled with the sub-hook's name and say which value they flow into
  ("flows into visitor id").

## 4. Never drawn

- Real data: no actual pages, times or scroll from the database. The
  silhouette is the shape of the question, not an answer.
- Shapes for conditions whose value is a sub-hook (a value from a tunnel):
  the shape is drawn, but the label says "from a sub-hook".
- Anything beyond the limits:

  | Limit | Value |
  |---|---|
  | faint plates per range | 3 |
  | shapes per figure | 14 |
  | alternatives | 4 |
  | figures | 12 |

  Anything over a limit is counted in a note instead of being drawn.

## 5. Contradictions

If the description can't match anything, a note says so. For example "at
most 1 page" together with "at least 2 pages of /a" gives "this part
matches nothing".

## 6. Motion

- Faint at rest; full strength on hover or keyboard focus.
- Every edit to the hook: **one pulse** of the whole preview, and a
  **glow** on exactly the shapes that changed (shapes keep stable keys built
  from condition ids, so unrelated shapes don't glow).
- Both are off when the operating system asks for reduced motion.
