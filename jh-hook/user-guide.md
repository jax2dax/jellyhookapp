# Hook user guide

Hook lets you ask precise questions about your visitors, sessions, leads
and forms, and get the answer in seconds. You don't need to know SQL or
how the data is stored. You build a question out of plain choices, and
Hook works out how to answer it.

This guide matches what is on screen today, at `/dev/hook`. Labels in
**bold** are exactly as they appear.

## The idea in one minute

Every question has three parts, and the builder reads like a sentence:

> **Show** [what you want back] **of** [what you're looking at] **where** [conditions]

- **What you're looking at:** page views, sessions, form submissions
  (leads), visitors, form activity, form fields, pages (unique
  addresses), or away periods.
- **Conditions:** narrow those rows down. For example, "page is /pricing"
  or "time on page more than 30 sec".
- **What you want back:** the number of them, a calculation (an average, a
  total...), a list, or a breakdown.

Under the builder, **Reads as:** repeats your question in plain English.
Check it before you press **Run hook**.

## Building a question

### 1. Choose what you're looking at

Pick from the menu after **of**. Each choice is one kind of row:

| Choice | One row is | Typical questions |
|---|---|---|
| page views | one visit to one page | which pages hold attention, how far people scroll |
| sessions | one visit to your site, start to finish | which journeys convert, where people come from |
| form submissions (leads) | one submitted form | who your leads are, where they converted |
| visitors | one browser or person | devices, returning visitors |
| form activity | one form seen by one visitor in one session | how many started, finished, abandoned |
| form fields | one field of a form that someone clicked into | where people stall on a form |
| pages (unique addresses) | one page address of your site | ranking pages |
| away periods | a stretch of 15 seconds or more when a visitor left your site and came back | how long people stay away |

### 2. Add conditions

Three buttons sit under every list of conditions:

- **+ Condition:** test one value of the row. "page is /blogs", "session
  length more than 2 min", "campaign source (utm) is any of facebook,
  google".
- **+ Look at its...:** test the rows connected to this one. For a session,
  that's its page views, its away periods, its form submissions, its form
  activity or its visitor. A box opens where you add conditions for those
  connected rows. Then choose:
  - **has at least one:** at least one connected row matches. "Has at
    least one page view where page is /pricing";
  - **count or total:** count or measure the connected rows and compare.
    "The number of page views where page is /blogs, at least 2", "total
    time on page between 1 min and 5 min".
- **+ Any of / none of:** a group. Choose **match any (OR)** or **match all
  (AND)**, and tick **exclude (NOT)** to turn it into "none of these".

All conditions at the same level must all be true.

### 3. Values, units and time

- **Durations:** type any number and choose ms, sec, min, hr or day. Hook
  converts it.
- **Ranges:** choose **between** and give two values ("between 3 sec and
  5 sec").
- **Dates:** choose **time ago** ("7 days ago") or **exact date**.
- **Lists:** with **is any of** / **is none of**, type a value and press
  Enter for each one. Text fields suggest values that exist on your site.
- **Percentages:** type the number (30 means 30%).
- Every value shows a coloured badge with its type (duration, text, date and
  time, yes / no...). The same colour always means the same kind of value,
  and each condition's left edge carries the colour of what it tests.
- Field menus are grouped by topic: Which page, When and how long, How much
  of the page was seen, Place in the session, and so on. Hover a field to
  read what it means.

### 4. Choose what you want back

| Choice | You get | Example |
|---|---|---|
| **the number of** | one number | how many sessions converted |
| **the number of different (unique)** | one number | how many different pages were visited |
| **a calculation:** | one value: average, total, lowest, highest, median, percentile | average time on page |
| **a list of ids** | a list | used to feed another hook |
| **a list of ... values** | the different values of one field | which campaign sources brought leads |
| **a breakdown:** | a table: one measure per value of a field, or per hour / day / week / month | page views per page, sessions per day |

The line under the menu says what the hook returns, for example "Returns
number single value: a number (how many sessions)".

### 5. Run it

Press **Run hook**. You get the answer, its cost in credits, and **How it
ran**: the order Hook used and a note on why. If you set the order
yourself and Hook found a much faster one, it says so.

## Sub-hooks and tunnels

A **sub-hook** is a separate, complete hook whose result becomes a value in
another hook. The **tunnel** is that flow, from the sub-hook into the hook
above it.

To use one, choose **the result of a sub-hook (tunnel)** instead of **a
value I type** next to any value. A full hook builder opens inside the
dashed box.

- It must return the right kind of thing. A list fits **is any of** /
  **is none of**, and a single value fits a comparison.
- Its type must match. A list of visitor ids goes into a visitor id field.
- The box turns green ("Fits") or red with the reason. If you used a
  comparison with a list, **Use "is any of" instead** fixes it in one
  click.

**Use this hook as a sub-hook...** under the main hook does the reverse.
Your whole hook moves inside a new one. You pick where its result should
flow, and Hook only offers places that fit.

## Names, notes, collapsing and spacing

- **Name** any hook, sub-hook or condition by clicking its title line.
- **+ note** adds a description: what it is for, in your words.
- **The arrow** collapses a block to one line. Collapsed blocks show their
  name, or a one-line summary. Long questions stay readable this way.
- **The dotted handle** on the left of each condition adds space above it.
  Drag it down or up, or use the arrow keys. Double-click to remove the
  space.
- Names, notes, collapsed blocks and spacing are part of the query, so a
  shared link opens looking exactly the same.

## Sharing and reusing a question

- **Copy link** copies a link to the exact question. Anyone who opens it
  runs it against their own current site. The link never contains your
  data.
- **</>** opens the query as code. Paste a query there and press **Load
  into builder** to rebuild it on screen. **Show the current query here**
  shows the one you're editing.
- Older queries and links still work. Hook upgrades them and tells you it
  did.

## Examples

Each example shows how to build it, then why it is useful.

**Marketing**

1. **Sessions after your campaign launch that read /blogs for real but
   didn't convert.** Show **the number of** sessions where:
   - started at, after (exact date: launch time);
   - **+ Look at its...** page views, then **count or total**: number of
     page views, at least 2, where page is /blogs and time on page more
     than 5 sec;
   - converted is false.

   Why: people the content reached but didn't persuade.
2. **Which campaigns bring leads.** Show **a breakdown:** number of
   sessions, for each campaign source (utm), where converted is true. Sort
   **biggest first**.
3. **Landing pages of sessions that converted.** Show **a list of ...
   values** of landing page, of sessions where converted is true.
4. **Pages with the most views this week.** Show **a breakdown:** number
   of page views, for each page, where entered at is after 7 days ago. Top
   10.
5. **Mobile visitors who never came back.** Show **the number of**
   visitors where device is mobile and **+ Look at its...** sessions,
   **count or total**, number of sessions is 1.

**Content and engagement**

6. **How much of /pricing people actually see.** Show **a calculation:**
   average share of page seen, of page views where page is /pricing.
7. **Readers who went back over the content.** Show the number of page
   views where page is /blogs and share of page seen 2x+ at least 20%.
8. **Visits that bounced fast.** Show the number of sessions where
   **+ Look at its...** page views, **count or total**, number of page
   views is 1, and session length less than 10 sec.
9. **Where long sessions end.** Show **a breakdown:** number of sessions,
   for each exit page, where session length more than 3 min.
10. **Time spent away.** Show **a calculation:** median time away, of away
    periods.

**Sales**

11. **Everything a specific lead viewed.** Show **a list of ... values** of
    page, of page views where visitor id is any of [sub-hook: **a list of
    ... values** of visitor id, of form submissions (leads) where name
    contains "hanna"].
12. **Leads who looked at pricing before converting.** Show the number of
    form submissions (leads) where **+ Look at its...** its session matches,
    with its page views: has at least one where page is /pricing.
13. **Qualified leads from Google.** Show the number of form submissions
    (leads) where marked qualified by sales is true and **+ Look at its...**
    its session matches, where campaign source (utm) is google.
14. **Leads who converted on the first page.** Show the number of page
    views where converted on this page is true and page number in the
    session (1 = first) is 1.

**Form friction**

15. **Where people give up.** Show **a breakdown:** number of form fields,
    for each field, where last field touched is true and form status is
    abandoned. Biggest first.
16. **The slowest fields.** Show **a breakdown:** average time spent in the
    field, for each field. Biggest first.
17. **Fields people click but don't type in.** Show the number of form
    fields where typed in it is false.
18. **Abandoned forms that stopped on phone.** Show the number of form
    activity where status is abandoned and **+ Look at its...** its fields,
    has at least one where last field touched is true and field is phone.
19. **Time from seeing a form to typing.** Show **a calculation:** median
    time from seeing to typing, of form activity.

**Comparisons (two runs)**

20. **Does /pricing help conversion?** Run the number of sessions where
    converted is true and has a page view of /pricing. Then run the number
    of sessions where converted is true. The first divided by the second is
    the share of conversions that saw /pricing. A built-in comparison view
    is coming.
21. **Above-average engagement.** Show the number of page views where time
    on page more than [sub-hook: **a calculation:** average time on page,
    of page views where page is /pricing].

## Good to know

- **Time on page** is what the session replay shows. **Time on page
  (browser timer)** is the browser's own stopwatch, and the two can differ
  by a second or more.
- **Share of page seen** is empty for older visits whose screen height was
  never recorded. Hook never guesses it.
- **Hours and weekdays** are in UTC.
- **Ids** are only for linking hooks together. Results will show people,
  pages and sessions, not ids.
- **Credits:** every run costs at least 1 credit, and more for heavier
  questions. Hook checks the cost before running and stops if it's over
  your limit.
- **Errors** say what to fix. If something breaks on our side, you get a
  short reference code to quote to support.
