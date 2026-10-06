# Hook: naming audit

Every name a person sees is a promise the docs have to keep. This is the
audit of names that confuse, with options. **Option A is my recommendation.**
**Status 2026-10-05: every A option is applied**, with two changes from
you: item 2 (the two words are now defined: a **sub-hook** is the separate
hook, a **tunnel** is the data flowing from it into another hook) and item
25 ("seen twice" became **share of page seen 2x+**, because it means more
than once, not exactly twice). Item 43 (remove "its page") is applied.
The remaining sections below show the original options for the record. Names live in one
place each (`schema.ts` labels, `OUTPUT_KINDS` and a few phrases in
`components/hook/HookBuilder.tsx`), so a rename is a one-line change and the
docs regenerate (`reference.md`).

Test used: could a marketer who has never seen Hook guess what this does
from the word alone? Does the same word mean the same thing everywhere?

## Added 2026-10-06 (named with the same rules)

| Where | Name |
|---|---|
| entity | **form fields** (one field someone clicked into) |
| form fields | field, field type, order focused (1 = first), time spent in the field, typed in it, time before typing, last field touched, first clicked into at, first typed at, last left at, form status |
| form activity connection | **its fields** |
| builder | **Use this hook as a sub-hook...**, **Make it a sub-hook**, **+ note**, **Untitled hook (click to name it)**, **Untitled sub-hook**, **Name this condition (optional)** |
| page header | **Copy link**, **</>**, **Load into builder**, **Show the current query here** |
| value toggle | **a value I type** / **the result of a sub-hook (tunnel)** |

## 1. The big concepts

| # | Now | Problem | A (recommended) | B | C |
|---|---|---|---|---|---|
| 1 | **Hook** (the whole thing) | fine as the product name; but "hook" also means a code callback | keep **Hook** | Query | Question |
| 2 | **Sub-hook** / **tunnel** (two names for one idea; UI says "sub-hook", docs say "tunnel") | two words for one thing | **Nested hook** (UI and docs) | Inner hook | Linked hook |
| 3 | **Spec** | jargon | **Query** (the saved JSON is "the query") | Recipe | Definition |
| 4 | **Step** (plan) | fine inside the explain panel | keep | | |

## 2. Adding conditions (the three buttons)

| # | Now | Problem | A | B | C |
|---|---|---|---|---|---|
| 5 | **+ Field** | "field" is a database word | **+ Condition** | + Filter | + Check |
| 6 | **+ Related rows** | "rows" is a database word; unclear that it looks at connected items | **+ Look at its page views / session / ...** (the button names the connection) | + Connected items | + Look inside |
| 7 | **+ Group (or / not)** | nobody guesses what a group is | **+ Any of / none of** | + Either-or | + Combine with OR / NOT |
| 8 | inside a related box: **has** / **measure** | "measure" is vague | **has at least one** / **count or total** | exists / calculate | any / summarise |
| 9 | **where** (after a relation) | fine in a sentence | keep | that match | |
| 10 | group: **any of these / all of these / not** | "not" is a lone checkbox | **match any (OR)** / **match all (AND)** / **exclude (NOT)** | any / all / none | |

## 3. The output menu (what the query returns)

| # | Now | Problem | A | B | C |
|---|---|---|---|---|---|
| 11 | **how many** | fine | **the number of** | how many | count of |
| 12 | **how many different** | "different" is ambiguous | **the number of different (unique)** | how many unique | distinct count |
| 13 | **a measure of** (+ average, total...) | "measure" is vague | **a calculation: average, total, lowest...** | a summary of | an aggregate of |
| 14 | **the ids** | fine | **a list of ids** | the ids | id list |
| 15 | **the values of** | reads badly in the sentence ("the values of started at of sessions") | **a list of [field] values** | the different values of | values of |
| 16 | **a breakdown** | unclear it makes a table | **a breakdown by [field]** | a table by | grouped by |
| 17 | **for each** (inside a breakdown, was "per") | fine | keep **for each** | by | |

Sentence form I would use: **"Show [the number of] [sessions] where ..."**
so every output reads as one sentence. Today it starts with the output,
which makes "the values of started at of sessions" read oddly.

## 4. Types (the colour badges)

| # | Now | Problem | A | B |
|---|---|---|---|---|
| 18 | **number / duration / percent / pixels / text / choice / date and time / yes / no** | **choice** is vague; **pixels** fine | keep, but **choice** -> **one of a fixed list** | choice -> option |

## 5. Entities (what you query)

| # | Now | Problem | A | B | C |
|---|---|---|---|---|---|
| 19 | **leads (submissions)** | a lead is a form submission here, a person elsewhere in the product | **form submissions (leads)** | leads | submissions |
| 20 | **form interactions** | vague | **form activity** | forms seen | form sessions |
| 21 | **pages** | really "every page address that has views" | **pages (unique addresses)** | page addresses | URLs |
| 22 | **away gaps** | jargon; the product calls it "time spent outside site" / purple "away" frame | **away periods** | time away | away gaps |
| 23 | **visitors** | fine | keep | | |

## 6. Fields that confuse

| # | Now | Problem | A | B | C |
|---|---|---|---|---|---|
| 24 | **time on page (measured in the browser)** and **visit duration (as the session replay shows)** | two similar numbers, long labels, and the one people expect ("time on page") is the less accurate one | **time on page** = the replay's number (left minus entered; applied rename of the label, key stays `visitDuration`), and the browser timer becomes **time on page (browser timer)** | keep both as they are | **time on page** and **time on page (server clock)** |
| 25 | **seen** / **seen twice or more** / **not seen** | "seen" of what? | **share of page seen** / **share seen twice or more** / **share never seen** | % seen once / % seen twice+ / % not seen | |
| 26 | **entry position** / **deepest point** / **exit position** | positions of what? | **where they entered (% down the page)** / **furthest point reached (% down)** / **where they left (% down)** | scroll start / scroll deepest / scroll end | |
| 27 | **scrolled back up** | fine | keep | | |
| 28 | **is the page where they converted** | long | **converted on this page** | is the conversion page | |
| 29 | **in a converted session** | fine | **session converted** | | |
| 30 | **position in session** | "position" is ambiguous with scroll position | **page number in the session (1 = first)** | step in session | |
| 31 | **is the landing page** / **is the exit page** | fine | keep | | |
| 32 | **screen height** / **screen height measured** | fine / jargony | **screen height** / **screen height was recorded** | | |
| 33 | **still open** (page view and session) | means different things on each | page view: **still on screen**; session: **still open** | | |
| 34 | **duration** (session) | next to "time on page" it is unclear | **session length** | total time | |
| 35 | **visitor id / session id / lead id** | ids are meaningless to marketers; they are only for linking | keep, but list them last under **Ids** (applied) and describe as "for linking queries" | | |
| 36 | **qualified** (leads) | who decides? | **marked qualified by sales** | qualified | |
| 37 | **confidence** (leads) | confidence of what? (an automatic email-present check) | **form quality (high = has an email)** | email check | |
| 38 | **utm source / medium / campaign** | jargon | **campaign source / medium / name (utm)** | utm source... | |
| 39 | **referrer** | fine for marketers | keep | | |
| 40 | **hour entered (UTC)** / **weekday entered (UTC, 0 = Sunday)** | clumsy | **hour of day (UTC, 0-23)** / **day of week (UTC, 0 = Sunday)** | | |
| 41 | **form number on page** (0 = first) | 0-based confuses | **which form on the page (0 = first)** | | |
| 42 | **fields touched** | lower bound caveat | **form fields touched** (keep the hint) | | |

## 7. Connections (relations)

| # | Now | Problem | A | B |
|---|---|---|---|---|
| 43 | **its session / its visitor / its page** | **its page** duplicates the **page** field and is slower: nesting through it is the long way round (it caused your /blogs query to be 3 levels deep) | **remove "its page"** from the menus (the **page** field does the same) | keep |
| 44 | **forms on this page in this session** | long | **its forms** | forms on this page |
| 45 | **page views / away gaps / form submissions / forms seen / views** | "views" vs "page views" | always the full noun: **page views**, **away periods**, **form submissions**, **form activity** | |

## 8. Run controls and results

| # | Now | Problem | A | B |
|---|---|---|---|---|
| 46 | **Order of the top-level conditions** | long | **Run order** | Order |
| 47 | **Auto / Manual / guard** | "guard" is jargon | **Auto / Manual**, and the guard checkbox says **Let the engine step in if my order is much slower** | |
| 48 | **What the engine did** | fine | **How it ran** | |
| 49 | **strategy: fused / staged** | jargon | **one pass / step by step** | |
| 50 | **credits (pg cost N)** | "pg cost" is jargon | **N credits** (the raw cost only in the details) | |
| 51 | **Compiled SQL / Spec** | for developers | keep, in a **For developers** section | |

## What is already applied

- Field menus are split into labelled groups (for example, a page view has
  "Which page", "When and how long", "How much of the page was seen",
  "Place in the session", "Screen and page size", "Ids"). Every field is in
  exactly one group; a test enforces it.
- Every field in a menu shows its type: `time on page (duration)`.
- Every condition has a coloured left border and a badge for the type it
  works on; every output and sub-hook shows what it returns.
- A sub-hook offers all six outputs, as the main hook does.

Reply with the numbers you want to change and the letter ("5A, 6B, 24C,
43A") and I will apply them, regenerate `reference.md` and update the docs.
