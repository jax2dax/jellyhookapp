# Output engine developer guide, part 2: data flow

How a result becomes something a person can look at, with almost no
code. For the code, see part 1 (`architecture.md`). For the display rules,
see `rules.md`.

## The short version

```
Run
  -> the hook engine finds the rows (as always)
  -> the output engine decides how to show them
  -> it fetches only what the first screen needs
  -> the rest wait as sealed tokens until "Show more"
  -> the canvas draws people, sessions, pages and numbers
```

## 1. Deciding the view

The question's own shape decides what is drawn:

- **A number:** shown big, with how it compares to everything ("4 out of 52
  sessions overall").
- **A breakdown:** bars, over time when it is per hour/day/week/month.
- **A list of things:** the things themselves.
  - Sessions become session replays.
  - Leads become mini profiles.
  - Visitors become cards.
  - Pages, forms and form fields become tables and cards.
  - Page views and away periods are shown inside the sessions they belong
    to.

## 2. Showing why: evidence

When the question looked at connected rows, the canvas shows which of
them made the difference:

- "Sessions with a /blogs visit": each replay **rings the /blogs visits**
  and dims the rest.
- "Leads whose session came from Google": each lead shows **the session
  they converted in**.
- "Visitors with a converted session": each visitor shows **up to 2 of
  those sessions**.

When the question didn't look at connected rows, nothing extra is fetched
or shown.

The engine works out which rows to highlight by asking the database again,
using the same conditions the hook used. Whatever can filter can also
highlight, including sequences like "/blogs then /pricing".

## 3. Only what is on screen

For a list, the order is decided first (newest session first, most viewed
page first...). Only the first screen is loaded: 6 replays, 12 cards, or 24
pages.

Every other item goes to the browser as a **sealed token**:

- it is encrypted, so the id inside can't be read;
- it is locked to this site and this kind of list;
- it expires after a day.

**Show more** hands the next tokens back. The server opens them and draws
those items. The hook is not run again, and no credits are used.

## 4. What the browser receives

- **What's shown on screen:** views made of names, emails, dates, pages,
  replays and numbers.
- **Behind each lead's name:** a link to the lead's page in the app.
- **For Show more:** sealed tokens.
- **Never:** raw ids, the SQL, or database details. The developer bench is
  the only place they are visible.

## 5. Comparing two hooks

**Compare with another hook** adds Hook B and a formula:
- A / B;
- A / B x 100;
- A - B;
- change from B to A.

Both hooks run at the same time and must each return one number. The
canvas shows A, B and the result, each with its sentence.

## 6. When something fails

| What fails | What the person sees |
|---|---|
| the hook can't run as written | the reason (as before) |
| the answer worked, the drawing didn't | the number, plus "the results couldn't be drawn" with a reference code |
| Show more after a day, or for another site | "Run the hook again" |
| connection lost | "Couldn't load more. Check your connection." |

## 7. Where it sits

```
builder ----> Run ----> hook engine ----> output engine ----> canvas (under the builder)
   |
   +--------> silhouette (right column, live, independent)
```
