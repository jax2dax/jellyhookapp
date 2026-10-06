# Hook developer guide, part 2: data flow

How data moves through Hook, explained with as little code as possible.
For the code, see part 1 (`architecture.md`).

## The short version

A person builds a question in the builder. The question is saved as a
small, plain description, called the query. When they press Run:

1. The server checks who they are and which site they're looking at.
2. Any older query format is upgraded to the current one.
3. Every sub-hook in the question runs first, and its result is held ready.
4. The engine asks the database how big each part of the question is,
   without reading any data.
5. It decides the order of work and what the run will cost.
6. If the cost is within the limit, the database runs the whole question in
   one go.
7. The answer comes back with a full account of how it was found.

## 1. Where a query lives

- **In the builder** while someone edits it.
- **In the address bar** (`?q=...`), so a link reopens the exact same
  question, including names, notes and layout. A link never carries a
  site. Whoever opens it runs it against their own current site.
- **Later, in the database** as a saved hook. The query is already the
  exact thing that will be saved, names and layout included.

A query arriving from anywhere is treated as untrusted. It is upgraded,
then checked for structure and size, then type-checked, on every run.

## 2. Sub-hooks and tunnels: one hook's result flowing into another

Two words, two ideas:

- **Sub-hook:** a separate, complete hook whose job is to return values. It
  is the same engine, and it can return anything the main hook can: a
  number, a list of ids, a list of values, a breakdown.
- **Tunnel:** the flow. The sub-hook's result travels into one value of the
  hook above it.

Example: "page views by visitors who are leads named Hanna".

```
sub-hook:   form submissions where name contains "hanna"  ->  a list of visitor ids
                     | tunnel
main hook:  page views where visitor id is any of [ that list ]
```

What happens:

- The sub-hook runs **once**, inside the database. Its result never travels
  to the browser and back. A tunnel carrying fifty thousand ids still costs
  one statement.
- **Shape rule:** a sub-hook that returns **one value** can feed any
  comparison ("time on page more than [the average on /pricing]"). One that
  returns **a list** can only feed "is any of" / "is none of".
- **Type rule:** a list of visitor ids can only feed a visitor id field. A
  number can't feed a duration. Breaking a rule is an error that names both
  sides, never a silent conversion.
- **Breakdowns** hand over their keys. "The 5 pages with the most views"
  becomes a list of 5 pages.
- **Nesting:** a sub-hook can have its own sub-hooks. The innermost runs
  first. How deep they can go is capped.
- **Turning a whole hook into a sub-hook:** the builder can wrap the
  current hook inside a new one, choosing where its result should flow.
  Only slots that fit its type and shape are offered.
- **Reporting:** before the main question runs, every sub-hook reports what
  it produced: one value, or a count and the first few values. The result
  keeps that account, which is what will let later views say who or what an
  answer was about.

A future animation of data moving between hooks would show exactly this:
the sub-hook producing its result, and the result flowing along the tunnel.

## 3. Inside one hook: steps

The top-level conditions of a hook are its steps. Before anything runs,
the engine asks the database "about how many rows would this step alone
keep?". That is a planning question, answered from statistics the database
already keeps, so no data is read.

- When the steps are of very different sizes, the smallest runs first, and
  each next step only checks what survived. This is called step by step.
- When they are similar, they run together and the database orders them
  itself. This is called one pass.
- A person can set the order by hand. If their order would be ten times
  slower, the engine steps in and says so, unless they told it not to.

Whatever the order, the answer is identical. Order only changes speed.

## 4. Connected rows

Every entity is connected to others:
- a session has page views, away periods, form submissions and form
  activity;
- a form has fields;
- a page view has a session and a visitor.

A condition can look at connected rows in two ways:

- **has at least one** connected row matching some conditions ("sessions
  that have a page view of /blogs");
- **count or total** of the connected rows, compared with a number or a
  range ("sessions where the number of page views of /blogs, longer than
  5 sec, is at least 2").

The connected rows' conditions apply to the same row together. "/blogs AND
longer than 5 sec" means one page view that is both, not one of each.

Connections use the ids the tracker writes (session, visitor, page
address), the same way the rest of the app joins data.

## 5. What each part hands to the next

| From | To | What |
|---|---|---|
| builder | server | the query (plain description, no site) |
| server check | engine | the query + the site the person may read |
| upgrade | engine | the query in the current format, plus notes if anything changed |
| sub-hooks | main hook | a held-ready result inside the database, plus a report (value or count + samples) |
| estimates | planner | about how many rows each step keeps |
| planner | compiler | the order and the strategy |
| compiler | database | one statement; every value bound separately, every table pinned to the site |
| database | engine | rows |
| engine | page | the answer, how it ran, what it cost, what each tunnel carried, timings |

## 6. What is kept, and for how long

| What | Where | Lifetime |
|---|---|---|
| step size estimates | server memory | 5 minutes |
| value suggestions in the builder (pages, campaigns, countries...) | fetched when a field is chosen | per page load |
| answers | not kept | every run is live |
| the query | the address bar (later: the database) | as long as the link exists |

Nothing runs on its own. Every run is started by a person, because every
run is metered.

## 7. Form friction data

The tracker records, for every form a visitor sees:
- the form's progress: seen, started, submitted or abandoned;
- the last field they touched;
- for every field they clicked into, the order, the time spent in it,
  whether and when they typed, and when they left it.

Hook reads the per-field part as its own entity, **form fields**. So
questions like these all use the normal conditions, measures and
breakdowns, and need nothing special:
- "abandoned forms where the last field was phone";
- "average time per field";
- "fields people clicked into but never typed in".

## 8. Where things can go wrong, and what the person sees

| Situation | What the person sees |
|---|---|
| the question can't run as written | the exact reason, and what to change |
| over the credit limit | the estimate and the limit; nothing ran |
| a database or server problem | a short reference code to quote; details stay in the server log |
| no connection to the server | "Couldn't reach the server" |
| an old or damaged link | the query is upgraded with a notice, or an empty hook with a notice |
