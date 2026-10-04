# Hook: UI / UX

## Now: `/dev/hook` (test bench)

For you to test the engine. The real Hook page comes later, behind
authorization; it will reuse the same builder and the same server action.
Until then the bench runs against the signed-in user's current site only.

```
[how many v] of [sessions v] where
| [field: started at] [after] [3 days ago v]                                   c8f2k1  Remove
| [has / measure: number of] [page views] [at least] [2] where                  c1a9x0  Remove
|   | [page] [is] [/blogs]
|   | [time on page] [between] [3][sec] and [5][sec]
|   + Field  + Related rows  + Group (or / not)
| [not] [any of these]                                                          c7m2q4  Remove
|   | [utm source] [is any of] [facebook x] [google x]
| [visitor id] [is any of] [result of a sub-hook v]
|   +- Sub-hook: its list of values becomes this text ----------------------+
|   | [the values of] [visitor id] of [leads] where                         |
|   |   | [name] [contains] [hanna]                                         |
|   +-----------------------------------------------------------------------+
+ Field  + Related rows  + Group (or / not)
Reads as: how many sessions where started at after 3 days ago and ...

Order of the top-level conditions   [Auto | Manual]  [x] guard   1. Up Down ...
[Run hook]
Result: the number / the list / a breakdown with bars
        credits, plan ms, run ms, strategy
        What the engine did (steps in run order, row estimates), notes
        Sub-hooks (what each produced), Compiled SQL, Spec
```

How it is built:

- **One recursive editor.** `components/hook/HookBuilder.tsx`'s
  `SpecEditor` edits a whole spec. Related rows nest a `ConditionList` for
  the related entity; a sub-hook nests a whole `SpecEditor`. That is why a
  tunnel looks exactly like the main query, just inside a dashed box.
- **Everything comes from `schema.ts`.** The field list, each field's
  operators (by type), the value editor (number, %, px, duration with unit,
  time as exact or "N ago", text with suggestions, enum, lists), measures
  allowed per type, relations. A new field in the schema shows up here with
  no UI change.
- **Value suggestions** for text fields come from the site's own data
  (pages, utm values, countries, browsers...), most common first.
- **A sub-hook's output menu is filtered** to what fits: a list operator
  offers ids / values; a single-value operator offers counts / measures.
  The engine still checks types and explains a mismatch.
- **Reads as:** the spec in plain English under the builder, from
  `describe.ts`, so you can check the question before running it.
- **Explain is always shown,** including when the engine overrides your order.
- **Run is explicit,** since every run costs credits.
- **The URL is the state** (`?q=`).

## Where it is heading

1. **Dedicated Hook page** behind authorization, same action and builder.
2. **Saved hooks:** name a spec, re-run it, pin it to a dashboard card.
3. **Result renderers (conditional charting):** a session id list renders as
   FramePlates (the tunnels say which leads they came from); a time
   breakdown renders as a line or bars; a page breakdown as a ranked bar
   list; one value as a big number; two hooks as a ratio card.
4. **Comparisons:** several named hooks plus an expression (`a / b`,
   `a - b`) for indexes like conversion contribution (plan.md).
5. **Cost before running:** "about 3 credits" on Run, confirmation above
   a threshold.
6. **Node / drag-and-drop editor:** another editor of the same JSON. Every
   condition already has its own id and every sub-hook is already a nested
   spec, so it is a new view, not a new engine.
7. **Presets:** one-click starting specs for common questions. Presets are
   specs, not code.

## Writing rules

- Product words only. A column name never appears (no
  `revisit_start_scroll_depth`; it is "scrolled back up").
- Don't over-bundle. If a person might want to split a grouped idea, offer
  the parts, not one opaque switch. The test: could a curious user wish
  they could customize it more? Then expose the parts.
- Every derived field says what is non-obvious in its hint (for example,
  seen % is empty on old rows).
- No em dashes in user-facing copy.
